"""Concurrency-safe, stock-backed reservation service.

"A token should be a promise, not a queue number."

One booking = one atomic transaction. Every database connection in KhadSetu
opens transactions as BEGIN IMMEDIATE (see database.make_engine), which takes
the SQLite write lock up front. Therefore the `check available -> bump
reserved_stock` sequence below is serialized against all other writers and can
never see stale stock: over-booking is structurally impossible, not merely
unlikely.

Request handling order:
    1. validate farmer (exists, role=farmer), centre (exists), product, qty
    2. if the caller re-uses an idempotency_key, return the stored outcome
       for it (or raise IdempotencyConflictError on a different payload)
    3. read inventory.available = physical_stock - reserved_stock under the
       write lock
    4. available >= qty  -> bump reserved_stock, attach a TTL reservation,
       transition REQUESTED -> RESERVED
       available <  qty    -> append to the waitlist, transition
       REQUESTED -> WAITLISTED  (request keeps its full quantity; no partial
       fills - a partial token would not be a promise)

Committing is the caller's job: this service flushes inside the caller's open
transaction so the whole booking joins one atomic step.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from secrets import choice
from typing import Any
from uuid import uuid4

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import (
    Centre,
    Inventory,
    ProductType,
    Request,
    RequestStatus,
    Reservation,
    Role,
    User,
    Waitlist,
    WaitlistStatus,
)
from app.services.state_machine import IllegalTransitionError, transition

DEFAULT_TTL_MINUTES = 20  # slot a farmer has to confirm before stock auto-releases

OTP_ALPHABET = "3456789ABCDEFGHJKMNPQRSTUVWXYZ"  # no 0/O/1/I/L: safe to read off a phone screen


def generate_otp(length: int = 6) -> str:
    """Farmer-readable depot code (composed of unambiguous glyphs only)."""
    return "".join(choice(OTP_ALPHABET) for _ in range(length))


class InvalidRequestError(ValueError):
    """Raised when a booking is invalid (unknown farmer/centre/product, bad role or qty)."""


class IdempotencyConflictError(Exception):
    """Raised when a known idempotency_key arrives with a different payload."""


@dataclass(slots=True)
class ReservationOutcome:
    """Everything a caller needs after a booking attempt.

    `status` is always the live request status, so an idempotent replay of an
    already-EXPIRED token honestly reports EXPIRED instead of a stale snapshot.
    """

    request: Request
    reservation: Reservation | None
    waitlist: Waitlist | None

    @property
    def status(self) -> RequestStatus:
        return RequestStatus(self.request.status)

    @property
    def position(self) -> int | None:
        return self.waitlist.position if self.waitlist is not None else None


def _outcome_for(session: Session, request: Request) -> ReservationOutcome:
    """Rebuild an outcome from stored rows (used for idempotent replays)."""
    reservation = session.execute(
        select(Reservation).where(Reservation.request_id == request.id)
    ).scalar_one_or_none()
    waitlist = session.execute(
        select(Waitlist).where(Waitlist.request_id == request.id)
    ).scalar_one_or_none()
    return ReservationOutcome(request=request, reservation=reservation, waitlist=waitlist)


def _next_waitlist_position(
    session: Session, centre_id: int, product_type: str
) -> int:
    """Next queue position within a (centre, product) scope.

    Scoped, because stock is scoped: 10 bags FREE at depot A do not benefit a
    farmer waitlisted for depot B.
    """
    current_max = session.execute(
        select(func.max(Waitlist.position))
        .select_from(Waitlist)
        .join(Waitlist.request)
        .where(
            Request.centre_id == centre_id,
            Request.product_type == product_type,
        )
    ).scalar()
    return (current_max or 0) + 1


def validate_booking_inputs(
    session: Session,
    farmer_id: int,
    centre_id: int,
    product_type: str,
    quantity: int,
) -> tuple[User, Centre, ProductType, Inventory]:
    """Shared validation used by create_request (and testable on its own).

    Returns the farmer, centre, product enum and the single inventory row.
    Every failure raises InvalidRequestError with a farmer-readable message.
    """
    if quantity <= 0:
        raise InvalidRequestError("quantity must be a positive number of bags")

    try:
        product = ProductType(product_type)
    except ValueError as exc:
        raise InvalidRequestError(
            f"unknown product_type {product_type!r}; expected one of "
            f"{[p.value for p in ProductType]}"
        ) from exc

    farmer = session.get(User, farmer_id)
    if farmer is None:
        raise InvalidRequestError(f"farmer {farmer_id} does not exist")
    if farmer.role != Role.FARMER.value:
        raise InvalidRequestError(f"user {farmer_id} is not a farmer and cannot book stock")

    centre = session.get(Centre, centre_id)
    if centre is None:
        raise InvalidRequestError(f"centre {centre_id} does not exist")

    inventory = session.execute(
        select(Inventory).where(
            Inventory.centre_id == centre.id,
            Inventory.product_type == product.value,
        )
    ).scalar_one_or_none()
    if inventory is None:
        raise InvalidRequestError(
            f"centre {centre.id} has no {product.value} stock to book against"
        )

    return farmer, centre, product, inventory


def create_request(
    session: Session,
    *,
    farmer_id: int,
    centre_id: int,
    product_type: str,
    quantity: int,
    idempotency_key: str | None = None,
    ttl_minutes: float = DEFAULT_TTL_MINUTES,
) -> ReservationOutcome:
    """Create a booking request and try to reserve stock for it, atomically.

    Returns a ReservationOutcome whose request status is RESERVED (stock was
    locked) or WAITLISTED (farmer owes no stock yet, entry queued).

    The caller must have an open transaction on `session`; the reservation,
    stock bump, state transition and audit rows all flush inside that single
    transaction, then the caller commits once.
    """
    farmer, centre, product, inventory = validate_booking_inputs(
        session, farmer_id, centre_id, product_type, quantity
    )

    # ---- idempotent replay: same key + same payload -> stored outcome.
    # (Runs after validation so a malformed replay gets the honest error.)
    if idempotency_key:
        existing = session.execute(
            select(Request).where(Request.idempotency_key == idempotency_key)
        ).scalar_one_or_none()
        if existing is not None:
            replay_matches = (
                existing.farmer_id,
                existing.centre_id,
                existing.product_type,
                existing.quantity,
            ) == (farmer.id, centre.id, product.value, quantity)
            if not replay_matches:
                raise IdempotencyConflictError(
                    f"idempotency_key {idempotency_key!r} already used with a "
                    "different payload; use a fresh key for a new booking"
                )
            return _outcome_for(session, existing)

    request = Request(
        farmer_id=farmer.id,
        centre_id=centre.id,
        product_type=product.value,
        quantity=quantity,
        idempotency_key=idempotency_key,
    )
    session.add(request)
    session.flush()  # assign request.id

    if inventory.available >= quantity:
        # ---- STOCK PATH: lock the bags, mint the promise.
        inventory.reserved_stock += quantity   # serialized by BEGIN IMMEDIATE
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=ttl_minutes)
        reservation = Reservation(
            request_id=request.id,
            centre_id=centre.id,
            quantity=quantity,
            expires_at=expires_at,
            otp_code=generate_otp(),
            # materialised key (generated when the client did not send one,
            # the column is NOT NULL by design so history is always auditable)
            idempotency_key=idempotency_key or f"auto-{request.id}-{uuid4().hex}",
        )
        session.add(reservation)
        session.flush()
        transition(
            request,
            RequestStatus.RESERVED,
            session,
            actor_id=farmer.id,
            details={
                "centre_id": centre.id,
                "product": product.value,
                "quantity": quantity,
                "expires_at": expires_at.isoformat(),
            },
        )
        outcome = ReservationOutcome(
            request=request, reservation=reservation, waitlist=None
        )
    else:
        # ---- WAITLIST PATH: honest "not yet" instead of a forced promise.
        entry = Waitlist(
            request_id=request.id,
            position=_next_waitlist_position(session, centre.id, product.value),
        )
        session.add(entry)
        session.flush()
        transition(
            request,
            RequestStatus.WAITLISTED,
            session,
            actor_id=farmer.id,
            details={
                "centre_id": centre.id,
                "product": product.value,
                "quantity": quantity,
                "position": entry.position,
            },
        )
        outcome = ReservationOutcome(
            request=request, reservation=None, waitlist=entry
        )

    return outcome


def audit_summary(outcome: ReservationOutcome) -> dict[str, Any]:
    """Compact loggable/JSON representation of an outcome (for routes/tests)."""
    return {
        "request_id": outcome.request.id,
        "status": outcome.status.value,
        "position": outcome.position,
        "reservation_id": outcome.reservation.id if outcome.reservation else None,
    }


def cancel_request(
    session: Session,
    request: Request,
    actor_id: int | None = None,
    reason: str = "cancelled by farmer",
) -> Request:
    """Cancel a token; RESERVED/CONFIRMED stock goes straight back to the pool.

    Unlike TTL expiry there is no waitlist promotion window here: the farmer
    gave the bags back voluntarily, so the next recovery cycle (or an
    immediate promotion scan) can hand them to the queue head.
    """
    if request.status in (
        RequestStatus.CLAIMED.value,
        RequestStatus.EXPIRED.value,
        RequestStatus.CANCELLED.value,
    ):
        raise IllegalTransitionError  # sealed terminal state

    released_bags = 0
    if request.status in (RequestStatus.RESERVED.value, RequestStatus.CONFIRMED.value):
        inventory = session.execute(
            select(Inventory).where(
                Inventory.centre_id == request.centre_id,
                Inventory.product_type == request.product_type,
            )
        ).scalar_one()
        inventory.reserved_stock = max(0, inventory.reserved_stock - request.quantity)
        released_bags = request.quantity

    if request.waitlist_entry is not None:
        request.waitlist_entry.status = WaitlistStatus.CANCELLED.value

    transition(
        request,
        RequestStatus.CANCELLED,
        session,
        actor_id=actor_id,
        details={"released_bags": released_bags, "reason": reason},
    )
    return request
