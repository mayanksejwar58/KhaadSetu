"""Centre/inventory listing + operator physical reconciliation."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import AuditLog, Centre, Inventory, User
from app.schemas import ReconcileRequest
from app.services.reservation import InvalidRequestError

router = APIRouter(prefix="/api", tags=["inventory"])


@router.get("/centres")
def list_centres(db: Session = Depends(get_db)):
    """Distribution centres with each product's live availability."""
    centres = db.execute(select(Centre).order_by(Centre.id)).scalars().all()
    return [
        {
            "id": c.id,
            "name": c.name,
            "location": c.location,
            "total_capacity": c.total_capacity,
            "inventory": [
                {
                    "id": row.id,
                    "product_type": row.product_type,
                    "physical_stock": row.physical_stock,
                    "reserved_stock": row.reserved_stock,
                    "available": row.available,
                }
                for row in sorted(c.inventory, key=lambda r: r.product_type)
            ],
        }
        for c in centres
    ]


@router.post("/inventory/{centre_id}/reconcile")
def reconcile(
    centre_id: int, body: ReconcileRequest, db: Session = Depends(get_db)
):
    """Operator physical stock count -> ground truth update + discrepancy log.

    A recount smaller than the outstanding reserved stock would silently void
    live promises, which the rules forbid: it is rejected so the operator
    resolves the waitlist instead (expired/claimed tokens first).
    """
    operator = db.get(User, body.operator_id)
    if operator is None or operator.role != "operator":
        raise InvalidRequestError(f"operator {body.operator_id} does not exist")

    row = db.execute(
        select(Inventory).where(
            Inventory.centre_id == centre_id,
            Inventory.product_type == body.product_type.value,
        )
    ).scalar_one_or_none()
    if row is None:
        raise InvalidRequestError(
            f"centre {centre_id} has no {body.product_type.value} inventory row"
        )
    if body.physical_count < row.reserved_stock:
        raise InvalidRequestError(
            f"physical count {body.physical_count} is below outstanding reserved "
            f"stock {row.reserved_stock}; expire or claim promises before recounting"
        )

    old_physical = row.physical_stock
    discrepancy = body.physical_count - old_physical
    row.physical_stock = body.physical_count

    db.add(
        AuditLog(
            actor_id=body.operator_id,
            event_type="STOCK_RECONCILED",
            details={
                "centre_id": centre_id,
                "product_type": body.product_type.value,
                "old_physical": old_physical,
                "new_physical": body.physical_count,
                "discrepancy": discrepancy,
                "reserved_stock": row.reserved_stock,
                "note": body.note,
            },
        )
    )
    db.commit()
    return {
        "centre_id": centre_id,
        "product_type": body.product_type.value,
        "old_physical": old_physical,
        "physical_stock": row.physical_stock,
        "reserved_stock": row.reserved_stock,
        "available": row.available,
        "discrepancy": discrepancy,
    }
