"""Booking + farmer-facing token routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Centre, Request, Reservation, User, Waitlist
from app.schemas import RequestCreate
from app.services.recovery import run_recovery_cycle
from app.services.reservation import (
    IdempotencyConflictError,
    InvalidRequestError,
    cancel_request,
    create_request,
)
from app.services.state_machine import IllegalTransitionError, transition
from app.models import RequestStatus

router = APIRouter(prefix="/api", tags=["requests"])


def token_payload(session: Session, request: Request) -> dict:
    """Serialise a request row (the token) for API responses."""
    entry = request.waitlist_entry
    reservation = request.reservation
    return {
        "token_id": request.id,
        "farmer_id": request.farmer_id,
        "farmer_name": request.farmer.name,
        "centre_id": request.centre_id,
        "centre_name": request.centre.name,
        "product_type": request.product_type,
        "quantity": request.quantity,
        "status": request.status,
        "created_at": request.created_at.isoformat(),
        "position": entry.position if entry is not None else None,
        "reservation": (
            {
                "id": reservation.id,
                "expires_at": reservation.expires_at.isoformat(),
                "otp_code": reservation.otp_code,
            }
            if reservation is not None
            else None
        ),
    }


@router.get("/farmers")
def list_farmers(db: Session = Depends(get_db)):
    """Farmer picker source for the farmer dashboard."""
    farmers = db.execute(
        select(User).filter(User.role == "farmer").order_by(User.id)
    ).scalars().all()
    return [
        {
            "id": u.id,
            "name": u.name,
            "phone": u.phone,
            "land_holding_acres": u.land_holding_acres,
        }
        for u in farmers
    ]


@router.post("/requests", status_code=201)
def submit_booking(body: RequestCreate, db: Session = Depends(get_db)):
    """Submit a booking; returns the minted token (RESERVED or WAITLISTED)."""
    try:
        outcome = create_request(
            db,
            farmer_id=body.farmer_id,
            centre_id=body.centre_id,
            product_type=body.product_type.value,
            quantity=body.quantity,
            idempotency_key=body.idempotency_key,
        )
        db.commit()
    except InvalidRequestError:
        db.rollback()
        raise
    except IdempotencyConflictError:
        db.rollback()
        raise
    return {
        "token_id": outcome.request.id,
        "status": outcome.status.value,
        "position": outcome.position,
        "reservation": (
            {
                "id": outcome.reservation.id,
                "expires_at": outcome.reservation.expires_at.isoformat(),
                "otp_code": outcome.reservation.otp_code,
            }
            if outcome.reservation is not None
            else None
        ),
    }


@router.get("/requests/{request_id}")
def get_token(request_id: int, db: Session = Depends(get_db)):
    """Token detail; tees up overdue expiries first so the caller reads live truth."""
    run_recovery_cycle(db)
    db.commit()
    request = db.get(Request, request_id)
    if request is None:
        raise InvalidRequestError(f"token {request_id} does not exist")
    return token_payload(db, request)


@router.get("/farmers/{farmer_id}/requests")
def list_farmer_tokens(farmer_id: int, db: Session = Depends(get_db)):
    """All tokens of one farmer (dashboard list); recovery cycle runs first."""
    if db.get(User, farmer_id) is None:
        raise InvalidRequestError(f"farmer {farmer_id} does not exist")
    run_recovery_cycle(db)
    db.commit()
    requests = db.execute(
        select(Request)
        .filter(Request.farmer_id == farmer_id)
        .order_by(Request.id.desc())
    ).scalars().all()
    return [token_payload(db, r) for r in requests]


@router.get("/centres/{centre_id}/requests")
def list_centre_queue(centre_id: int, db: Session = Depends(get_db)):
    """Live queue + recent tokens for the operator dashboard."""
    if db.get(Centre, centre_id) is None:
        raise InvalidRequestError(f"centre {centre_id} does not exist")
    run_recovery_cycle(db)
    db.commit()
    requests = db.execute(
        select(Request).filter(Request.centre_id == centre_id).order_by(Request.id)
    ).scalars().all()
    return [token_payload(db, r) for r in requests]


@router.post("/requests/{request_id}/confirm")
def confirm_token(request_id: int, db: Session = Depends(get_db)):
    """Farmer confirms the promise (verification / payment commitment)."""
    request = db.get(Request, request_id)
    if request is None:
        raise InvalidRequestError(f"token {request_id} does not exist")
    try:
        transition(request, RequestStatus.CONFIRMED, db, actor_id=request.farmer_id)
        db.commit()
    except IllegalTransitionError:
        db.rollback()
        raise
    return token_payload(db, request)


@router.post("/requests/{request_id}/cancel")
def cancel_token(
    request_id: int, operator_id: int | None = None, db: Session = Depends(get_db)
):
    """Farmer abandons a token; reserved bags return to the pool."""
    request = db.get(Request, request_id)
    if request is None:
        raise InvalidRequestError(f"token {request_id} does not exist")
    try:
        cancel_request(db, request, actor_id=operator_id or request.farmer_id)
        db.commit()
    except IllegalTransitionError:
        db.rollback()
        raise
    return token_payload(db, request)
