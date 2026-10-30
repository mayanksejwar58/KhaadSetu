"""Operator token redemption (QR/OTP scan at the depot)."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Inventory, Request, RequestStatus, User
from app.schemas import RedeemRequest
from app.services.reservation import InvalidRequestError
from app.services.state_machine import IllegalTransitionError, transition
from app.routes.requests import token_payload

router = APIRouter(prefix="/api", tags=["tokens"])


def _inventory_row(db: Session, centre_id: int, product_type: str) -> Inventory:
    return db.execute(
        select(Inventory).where(
            Inventory.centre_id == centre_id,
            Inventory.product_type == product_type,
        )
    ).scalar_one()


@router.post("/tokens/{token_id}/redeem")
def redeem_token(token_id: int, body: RedeemRequest, db: Session = Depends(get_db)):
    """Operator scans the farmer's OTP/QR -> bags handed over, token CLAIMED.

    Rules (AI proposes, rules dispose):
      * only a CONFIRMED token can be redeemed - a never-confirmed reservation
        is not a promise the depot honours (its TTL will expire it);
      * the OTP must match the one minted on the reservation;
      * stock leaves the system only here: physical_stock AND reserved_stock
        both drop by the claimed quantity, atomically with the transition.
    """
    request = db.get(Request, token_id)
    if request is None:
        raise InvalidRequestError(f"token {token_id} does not exist")
    operator = db.get(User, body.operator_id)
    if operator is None:
        raise InvalidRequestError(f"operator {body.operator_id} does not exist")

    reservation = request.reservation
    if request.status != RequestStatus.CONFIRMED.value:
        raise IllegalTransitionError(
            f"token {token_id} is {request.status}, not CONFIRMED; "
            "the farmer must confirm before depot redemption"
        )
    if reservation is None:
        # CONFIRMED without a reservation -> state corruption; fail safe.
        raise IllegalTransitionError(f"token {token_id} has no active reservation")
    if not reservation.otp_code or reservation.otp_code != body.otp:
        raise InvalidRequestError("wrong OTP: the depot cannot honour this token")

    inventory = _inventory_row(db, request.centre_id, request.product_type)
    inventory.physical_stock -= request.quantity
    inventory.reserved_stock = max(0, inventory.reserved_stock - request.quantity)

    transition(
        request,
        RequestStatus.CLAIMED,
        db,
        actor_id=operator.id,
        details={
            "centre_id": request.centre_id,
            "product": request.product_type,
            "quantity": request.quantity,
        },
    )
    db.commit()
    return token_payload(db, request)
