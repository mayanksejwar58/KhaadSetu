"""Step 1 tests: schema creation, seed integrity and constraint enforcement."""

import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from sqlalchemy import inspect
from sqlalchemy.exc import IntegrityError

from app.models import (
    AuditLog,
    Centre,
    Inventory,
    ProductType,
    Request,
    Reservation,
    User,
    Waitlist,
)
from app.seed import run_seed


# ------------------------------------------------------------- helpers

def _make_user(session, phone="+911000000000", role="farmer", **overrides) -> User:
    user = User(name="Test User", phone=phone, land_holding_acres=1.0, role=role, **overrides)
    session.add(user)
    session.flush()
    return user


def _make_centre(session, name="Centre A") -> Centre:
    centre = Centre(name=name, location="Loc A", total_capacity=100)
    session.add(centre)
    session.flush()
    return centre


def _make_request(session, farmer: int, centre: int, qty=10, product="UREA") -> Request:
    request = Request(
        farmer_id=farmer,
        centre_id=centre,
        product_type=product,
        quantity=qty,
    )
    session.add(request)
    session.flush()
    return request


def _make_reservation(session, request: Request, key="idem-1", qty=10) -> Reservation:
    reservation = Reservation(
        request_id=request.id,
        centre_id=request.centre_id,
        quantity=qty,
        expires_at=datetime(2026, 12, 31, tzinfo=timezone.utc),  # aware UTC datetime, not a string
        idempotency_key=key,
    )
    session.add(reservation)
    session.flush()
    return reservation


# ------------------------------------------------------------- schema

def test_all_seven_tables_created(db):
    names = set(inspect(db.engine).get_table_names())
    expected = {
        "users", "centres", "inventory", "requests",
        "reservations", "waitlist", "audit_logs",
    }
    assert expected <= names, f"missing tables: {expected - names}"


# ------------------------------------------------------------- seed

def test_seed_creates_full_baseline(seeded_db):
    s = seeded_db.session

    assert s.query(Centre).count() == 3
    assert s.query(Inventory).count() == 9  # 3 centres x 3 products
    assert s.query(User).filter(User.role == "farmer").count() == 2
    assert s.query(User).filter(User.role == "operator").count() == 2
    assert s.query(User).filter(User.role == "admin").count() == 1
    assert s.query(User).count() == 5

    # every centre carries exactly one row per product, all unreserved, stock > 0
    products_per_centre = {centre.id: set() for centre in s.query(Centre).all()}
    for row in s.query(Inventory).all():
        products_per_centre[row.centre_id].add(row.product_type)
        assert row.reserved_stock == 0
        assert row.physical_stock > 0
    assert all(
        products == {ProductType.UREA.value, ProductType.DAP.value, ProductType.NPK.value}
        for products in products_per_centre.values()
    )

    # centre names are unique and all users have unique phones
    names = [c.name for c in s.query(Centre).all()]
    assert len(names) == len(set(names))
    phones = [u.phone for u in s.query(User).all()]
    assert len(phones) == len(set(phones))

    # a SEED audit entry was written
    seed_logs = s.query(AuditLog).filter(AuditLog.event_type == "SEED").all()
    assert len(seed_logs) == 1
    assert seed_logs[0].details["inventory_rows"] == 9


def test_seed_is_idempotent(seeded_db):
    s = seeded_db.session

    assert run_seed(s) is False  # second run is a no-op
    assert s.query(Centre).count() == 3
    assert s.query(Inventory).count() == 9
    assert s.query(User).count() == 5
    # no duplicate SEED audit rows either
    assert s.query(AuditLog).filter(AuditLog.event_type == "SEED").count() == 1


def test_seed_escalates_centre_capacities_not_negative(seeded_db):
    for centre in seeded_db.session.query(Centre).all():
        assert centre.total_capacity > 0


# ------------------------------------------------------------- constraints

def test_inventory_centre_product_unique(db):
    s = db.session
    centre = _make_centre(s)
    s.add(Inventory(centre_id=centre.id, product_type="UREA", physical_stock=10))
    s.flush()
    s.add(Inventory(centre_id=centre.id, product_type="UREA", physical_stock=5))
    with pytest.raises(IntegrityError):
        s.flush()
    s.rollback()


def test_negative_physical_stock_rejected(db):
    s = db.session
    centre = _make_centre(s)
    s.add(Inventory(centre_id=centre.id, product_type="UREA", physical_stock=-1))
    with pytest.raises(IntegrityError):
        s.flush()
    s.rollback()


def test_negative_reserved_stock_rejected(db):
    s = db.session
    centre = _make_centre(s)
    s.add(
        Inventory(centre_id=centre.id, product_type="UREA", physical_stock=10, reserved_stock=-2)
    )
    with pytest.raises(IntegrityError):
        s.flush()
    s.rollback()


def test_request_fk_enforced(db):
    """FK pragma is ON: booking against a nonexistent farmer/centre must fail."""
    s = db.session
    s.add(Request(farmer_id=9999, centre_id=9999, product_type="UREA", quantity=5))
    with pytest.raises(IntegrityError):
        s.flush()
    s.rollback()


def test_request_quantity_must_be_positive(db):
    s = db.session
    farmer = _make_user(s, role="farmer")
    centre = _make_centre(s)
    s.add(
        Request(
            farmer_id=farmer.id, centre_id=centre.id, product_type="UREA", quantity=0
        )
    )
    with pytest.raises(IntegrityError):
        s.flush()
    s.rollback()


def test_request_default_status_is_requested(seeded_db):
    s = seeded_db.session
    farmer = s.query(User).filter(User.role == "farmer").first()
    centre = s.query(Centre).first()

    request = _make_request(s, farmer.id, centre.id, qty=3)

    assert request.status == "REQUESTED"
    assert request.created_at is not None


def test_users_role_check_constraint(db):
    s = db.session
    s.add(User(name="Odd", phone="+911111111111", role="alien"))
    with pytest.raises(IntegrityError):
        s.flush()
    s.rollback()


# ------------------------------------------------------------- reservations / waitlist

def test_idempotency_key_unique(db):
    s = db.session
    farmer = _make_user(s, role="farmer")
    centre = _make_centre(s)
    request_one = _make_request(s, farmer.id, centre.id)
    request_two = _make_request(s, farmer.id, centre.id)

    _make_reservation(s, request_one, key="ks-idem-42")
    s.add(
        Reservation(
            request_id=request_two.id,
            centre_id=centre.id,
            quantity=5,
            expires_at=datetime(2026, 12, 31, tzinfo=timezone.utc),
            idempotency_key="ks-idem-42",  # duplicate
        )
    )
    with pytest.raises(IntegrityError):
        s.flush()
    s.rollback()


def test_request_cannot_hold_two_reservations(db):
    s = db.session
    farmer = _make_user(s, role="farmer")
    centre = _make_centre(s)
    request = _make_request(s, farmer.id, centre.id)

    _make_reservation(s, request, key="idem-a")
    s.add(
        Reservation(
            request_id=request.id,
            centre_id=centre.id,
            quantity=1,
            expires_at=datetime(2026, 12, 31, tzinfo=timezone.utc),
            idempotency_key="idem-b",
        )
    )
    with pytest.raises(IntegrityError):
        s.flush()
    s.rollback()


def test_waitlist_position_must_be_positive(db):
    s = db.session
    farmer = _make_user(s, role="farmer")
    centre = _make_centre(s)
    request = _make_request(s, farmer.id, centre.id)
    s.add(Waitlist(request_id=request.id, position=0))
    with pytest.raises(IntegrityError):
        s.flush()
    s.rollback()


def test_request_cannot_hold_two_waitlist_entries(db):
    s = db.session
    farmer = _make_user(s, role="farmer")
    centre = _make_centre(s)
    request = _make_request(s, farmer.id, centre.id)

    s.add(Waitlist(request_id=request.id, position=1))
    s.flush()
    s.add(Waitlist(request_id=request.id, position=2))
    with pytest.raises(IntegrityError):
        s.flush()
    s.rollback()


# ------------------------------------------------------------- misc

def test_inventory_available_property(seeded_db):
    row = seeded_db.session.query(Inventory).first()
    row.physical_stock, row.reserved_stock = 100, 30
    assert row.available == 70


def test_audit_log_json_roundtrip(db):
    s = db.session
    actor = _make_user(s, role="admin")
    s.add(
        AuditLog(
            actor_id=actor.id,
            event_type="TEST_EVENT",
            details={"a": 1, "nested": {"b": [2, 3]}},
            note="roundtrip",
        )
    )
    s.commit()

    log = s.query(AuditLog).filter(AuditLog.event_type == "TEST_EVENT").one()
    assert log.details == {"a": 1, "nested": {"b": [2, 3]}}
    assert log.actor_id == actor.id
    assert log.timestamp is not None


# ------------------------------------------------------------- API smoke (boot path intact)

def test_api_health_endpoints():
    from app.main import app

    client = TestClient(app)
    root = client.get("/")
    assert root.status_code == 200
    assert root.json()["status"] == "ok"

    health = client.get("/api/health")
    assert health.status_code == 200
    assert health.json() == {"status": "healthy"}
