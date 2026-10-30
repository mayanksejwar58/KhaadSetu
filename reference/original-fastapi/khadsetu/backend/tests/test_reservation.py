"""Step 2 tests: concurrency-safe reservation service.

The centrepiece is test_50_requests_for_30_bags_zero_overbooking: 50 threads
race for 30 bags; the assert is structural (exactly 30 reserved, 20 waitlisted,
positions 1..20 unique, reserved_stock never exceeds stock).
"""

import threading
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import inspect, select, text
from sqlalchemy.orm import sessionmaker

from app.models import (
    AuditLog,
    Centre,
    Inventory,
    Request,
    RequestStatus,
    Reservation,
    User,
    Waitlist,
)
from app.services.reservation import (
    DEFAULT_TTL_MINUTES,
    IdempotencyConflictError,
    InvalidRequestError,
    create_request,
)
from app.seed import run_seed


# ------------------------------------------------------------- helpers

def _first_farmer(session) -> User:
    return session.execute(
        select(User).filter(User.role == "farmer").order_by(User.id)
    ).scalars().first()


def _inventory(session, centre_id: int, product: str = "UREA") -> Inventory:
    return session.execute(
        select(Inventory).filter(
            Inventory.centre_id == centre_id, Inventory.product_type == product
        )
    ).scalars().one()


def _book(session, quantity, key=None, centre_id=1, product="UREA", ttl=DEFAULT_TTL_MINUTES):
    """Book inside the caller's open transaction (used by most tests)."""
    farmer = session.execute(select(User).filter(User.role == "farmer").order_by(User.id)).scalars().first()
    return create_request(
        session,
        farmer_id=farmer.id,
        centre_id=centre_id,
        product_type=product,
        quantity=quantity,
        idempotency_key=key,
        ttl_minutes=ttl,
    )


# ------------------------------------------------------------- happy path (stock)

def test_booking_with_stock_reserves_and_bumps_reserved_stock(seeded_db):
    session = seeded_db.session
    with session.begin():
        outcome = _book(session, quantity=10, key="book-1")

    assert outcome.status == RequestStatus.RESERVED
    assert outcome.reservation is not None
    assert outcome.waitlist is None

    inventory = _inventory(session, 1, "UREA")
    assert inventory.reserved_stock == 10          # 400 seeded, 400-10=390 free
    assert inventory.available == 390

    assert outcome.reservation.request_id == outcome.request.id
    assert outcome.reservation.quantity == 10
    assert outcome.reservation.expires_at > datetime.now(timezone.utc)

    assert outcome.request.status == RequestStatus.RESERVED.value


def test_reservation_ttl_matches_requested_window(seeded_db):
    session = seeded_db.session
    with session.begin():
        outcome = _book(session, quantity=1, ttl=5)  # +5 minutes

    delta = outcome.reservation.expires_at - datetime.now(timezone.utc)
    assert timedelta(minutes=4.5) < delta <= timedelta(minutes=6)


def test_reservation_gets_generated_key_when_client_sends_none(seeded_db):
    session = seeded_db.session
    with session.begin():
        outcome = _book(session, quantity=2, key=None)

    key = outcome.reservation.idempotency_key
    assert key.startswith("auto-")
    # a second keyless booking must not collide with it (unique constraint)
    with session.begin():
        second = _book(session, quantity=2, key=None)
    assert second.reservation.idempotency_key != key


def test_stock_path_writes_reserved_audit_row(seeded_db):
    session = seeded_db.session
    with session.begin():
        outcome = _book(session, quantity=5, key="audit-1")

    log = session.execute(
        select(AuditLog).filter(AuditLog.event_type == "TOKEN_RESERVED")
    ).scalars().one()
    assert log.details["request_id"] == outcome.request.id
    assert log.details["quantity"] == 5
    assert log.details["from"] == "REQUESTED"


# ------------------------------------------------------------- waitlist path

def test_booking_without_stock_goes_to_waitlist_with_position_1(seeded_db):
    session = seeded_db.session
    with session.begin():
        outcome = _book(session, quantity=401, key="wl-1")  # stock is 400

    assert outcome.status == RequestStatus.WAITLISTED
    assert outcome.position == 1
    assert outcome.reservation is None

    inventory = _inventory(session, 1, "UREA")
    assert inventory.reserved_stock == 0  # waitlist does NOT lock stock

    log = session.execute(
        select(AuditLog).filter(AuditLog.event_type == "TOKEN_WAITLISTED")
    ).scalars().one()
    assert log.details["position"] == 1


def test_waitlist_positions_increment_within_centre_product_scope(seeded_db):
    session = seeded_db.session
    with session.begin():
        outcome_a = _book(session, quantity=401, key="wl-a", centre_id=1, product="UREA")
        outcome_b = _book(session, quantity=401, key="wl-b", centre_id=1, product="UREA")

    assert (outcome_a.position, outcome_b.position) == (1, 2)

    # a different product at the same centre starts its own scope
    with session.begin():
        other = _book(session, quantity=251, key="wl-c", centre_id=1, product="DAP")
    assert other.position == 1


# ------------------------------------------------------------- idempotency

def test_idempotent_replay_returns_original_token(seeded_db):
    session = seeded_db.session
    with session.begin():
        first = _book(session, quantity=10, key="replay-1")
    with session.begin():
        replay = _book(session, quantity=10, key="replay-1")

    assert replay.request.id == first.request.id
    assert replay.status == RequestStatus.RESERVED
    assert session.execute(select(Request)).scalars().all().__len__() == 1
    reservations = session.execute(select(Reservation)).scalars().all()
    assert len(reservations) == 1  # replay did not double-reserve
    inventory = _inventory(session, 1, "UREA")
    assert inventory.reserved_stock == 10


def test_idempotent_replay_of_waitlisted_booking(seeded_db):
    session = seeded_db.session
    with session.begin():
        first = _book(session, quantity=401, key="replay-wl")
    with session.begin():
        replay = _book(session, quantity=401, key="replay-wl")

    assert replay.request.id == first.request.id
    assert replay.status == RequestStatus.WAITLISTED
    assert replay.position == first.position


def test_idempotency_conflict_on_different_payload(seeded_db):
    session = seeded_db.session
    with session.begin():
        _book(session, quantity=10, key="conflict-1")
    with session.begin(), pytest.raises(IdempotencyConflictError):
        _book(session, quantity=11, key="conflict-1")  # same key, new payload


# ------------------------------------------------------------- validation

def test_only_farmers_can_book(seeded_db):
    session = seeded_db.session
    operator = session.execute(select(User).filter(User.role == "operator")).scalars().first()
    session.commit()  # end the implicit read txn so begin() can open a fresh one
    with session.begin(), pytest.raises(InvalidRequestError, match="not a farmer"):
        create_request(
            session, farmer_id=operator.id, centre_id=1,
            product_type="UREA", quantity=5,
        )


@pytest.mark.parametrize(
    "kwargs,expected",
    [
        ({"farmer_id": 99999}, "does not exist"),
        ({"centre_id": 99999}, "does not exist"),
        ({"product_type": "ZINC"}, "unknown product_type"),
        ({"quantity": 0}, "positive number of bags"),
        ({"quantity": -3}, "positive number of bags"),
    ],
)
def test_invalid_bookings_raise(seeded_db, kwargs, expected):
    session = seeded_db.session
    farmer = _first_farmer(session)
    session.commit()  # end the implicit read txn so begin() can open a fresh one
    payload = {
        "farmer_id": farmer.id,
        "centre_id": 1,
        "product_type": "UREA",
        "quantity": 5,
        **kwargs,
    }
    with session.begin(), pytest.raises(InvalidRequestError, match=expected):
        create_request(session, **payload)


def test_centre_without_product_row_rejected(seeded_db):
    session = seeded_db.session
    centre = Centre(name="Bare Depot", location="Nowhere", total_capacity=50)
    session.add(centre)
    session.commit()
    farmer = _first_farmer(session)
    session.commit()  # end the implicit read txn so begin() can open a fresh one
    with session.begin(), pytest.raises(InvalidRequestError, match="no UREA stock"):
        create_request(
            session, farmer_id=farmer.id, centre_id=centre.id,
            product_type="UREA", quantity=5,
        )


# ------------------------------------------------------------- concurrency

def _spin_up_stock(db, stock: int, farmers: int) -> tuple[int, list[int]]:
    """One centre, `stock` UREA bags, `farmers` farmers; returns (centre_id, farmer_ids)."""
    setup = sessionmaker(bind=db.engine, autoflush=False, expire_on_commit=False)
    with setup() as s, s.begin():
        centre = Centre(name="Rush Depot", location="Rushpur", total_capacity=stock * 10)
        s.add(centre)
        s.flush()
        s.add(Inventory(centre_id=centre.id, product_type="UREA", physical_stock=stock))
        ids = []
        for i in range(farmers):
            u = User(name=f"Farmer {i}", phone=f"99000000{i:03d}",
                     land_holding_acres=1.0, role="farmer")
            s.add(u)
            s.flush()
            ids.append(u.id)
        return centre.id, ids


def _race(db, centre_id: int, farmer_ids: list[int], max_workers: int = 20):
    """One thread per booking; returns list of status strings (or 'ERROR: ...')."""
    factory = sessionmaker(bind=db.engine, autoflush=False, expire_on_commit=False)

    def run(i: int) -> str:
        session = factory()
        try:
            with session.begin():
                outcome = create_request(
                    session,
                    farmer_id=farmer_ids[i],
                    centre_id=centre_id,
                    product_type="UREA",
                    quantity=1,
                    idempotency_key=f"ks-race-{i}",
                )
            return outcome.status.value
        except Exception as exc:  # surfaced as an assertion failure below
            return f"ERROR:{type(exc).__name__}:{exc}"
        finally:
            session.close()

    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        return list(pool.map(run, range(len(farmer_ids))))


def test_50_requests_for_30_bags_zero_overbooking(db):
    """THE invariant: concurrent demand can never over-allocate stock."""
    centre_id, farmer_ids = _spin_up_stock(db, stock=30, farmers=50)

    results = _race(db, centre_id, farmer_ids)

    assert not any(r.startswith("ERROR") for r in results), f"thread errors: {results}"
    assert results.count(RequestStatus.RESERVED.value) == 30
    assert results.count(RequestStatus.WAITLISTED.value) == 20

    factory = sessionmaker(bind=db.engine, autoflush=False, expire_on_commit=False)
    with factory() as s:
        inv = s.execute(
            select(Inventory).filter(
                Inventory.centre_id == centre_id, Inventory.product_type == "UREA"
            )
        ).scalars().one()
        assert inv.reserved_stock == 30          # exactly the stock, never more
        assert inv.available == 0

        reservations = s.execute(select(Reservation)).scalars().all()
        assert len(reservations) == 30
        assert len({r.request_id for r in reservations}) == 30   # 1:1 with requests
        assert sum(r.quantity for r in reservations) == 30       # bags add up exactly
        assert len({r.idempotency_key for r in reservations}) == 30

        waitlist_rows = s.execute(select(Waitlist)).scalars().all()
        assert len(waitlist_rows) == 20
        assert sorted(w.position for w in waitlist_rows) == list(range(1, 21))

        states = s.execute(select(Request.status)).scalars().all()
        assert states.count("RESERVED") == 30
        assert states.count("WAITLISTED") == 20

        reserved_logs = s.execute(
            select(AuditLog).filter(AuditLog.event_type == "TOKEN_RESERVED")
        ).scalars().all()
        assert len(reserved_logs) == 30


def test_idempotency_replay_is_race_safe(db):
    """8 threads reusing ONE idempotency key must mint exactly one token."""
    centre_id, farmer_ids = _spin_up_stock(db, stock=10, farmers=1)
    factory = sessionmaker(bind=db.engine, autoflush=False, expire_on_commit=False)

    def run(i: int):
        session = factory()
        try:
            with session.begin():
                outcome = create_request(
                    session,
                    farmer_id=farmer_ids[0],
                    centre_id=centre_id,
                    product_type="UREA",
                    quantity=1,
                    idempotency_key="ks-same-key",
                )
            return outcome.request.id
        finally:
            session.close()

    with ThreadPoolExecutor(max_workers=8) as pool:
        ids = list(pool.map(run, range(8)))

    assert len(set(ids)) == 1, f"replay minted {len(set(ids))} distinct tokens"

    factory_two = sessionmaker(bind=db.engine, autoflush=False, expire_on_commit=False)
    with factory_two() as s:
        assert s.execute(select(Request)).scalars().all().__len__() == 1
        assert len(s.execute(select(Reservation)).scalars().all()) == 1
        inv = _inventory(s, centre_id, "UREA")
        assert inv.reserved_stock == 1  # replay never double-locks
