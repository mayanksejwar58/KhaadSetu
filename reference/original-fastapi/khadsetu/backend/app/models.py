"""KhadSetu database models.

The core tables are users, centres, inventory, requests, reservations, waitlist, audit_logs.
Extensions added for the AI‑Synergy module are marked with comments.
"""

from __future__ import annotations

import enum
from datetime import datetime

from sqlalchemy import (
    JSON,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

# ---------------------------------------------------------------------------
# Enumerations
# ---------------------------------------------------------------------------
class Role(str, enum.Enum):
    FARMER = "farmer"
    OPERATOR = "operator"
    ADMIN = "admin"

class ProductType(str, enum.Enum):
    UREA = "UREA"
    DAP = "DAP"
    NPK = "NPK"

class RequestStatus(str, enum.Enum):
    """Token state machine states (see services/state_machine.py)."""
    REQUESTED = "REQUESTED"
    RESERVED = "RESERVED"
    WAITLISTED = "WAITLISTED"
    CONFIRMED = "CONFIRMED"
    CLAIMED = "CLAIMED"
    EXPIRED = "EXPIRED"
    CANCELLED = "CANCELLED"

class WaitlistStatus(str, enum.Enum):
    WAITING = "WAITING"
    PROMOTED = "PROMOTED"
    EXPIRED = "EXPIRED"
    CANCELLED = "CANCELLED"

# ---------------------------------------------------------------------------
# Core tables
# ---------------------------------------------------------------------------
class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    phone: Mapped[str] = mapped_column(String(20), nullable=False, unique=True, index=True)
    land_holding_acres: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    # ---- AI‑Synergy extensions ----
    mock_aadhaar_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    farmer_uid: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)

    __table_args__ = (
        CheckConstraint("role IN ('farmer', 'operator', 'admin')", name="ck_users_role"),
    )

    # Relationships
    land_parcels: Mapped[list["LandParcel"]] = relationship("LandParcel", back_populates="farmer")
    requests: Mapped[list["Request"]] = relationship("Request", back_populates="farmer")

class Centre(Base):
    __tablename__ = "centres"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False, unique=True)
    location: Mapped[str] = mapped_column(String(200), nullable=False)
    total_capacity: Mapped[int] = mapped_column(Integer, nullable=False)

    inventory: Mapped[list["Inventory"]] = relationship(
        "Inventory", back_populates="centre", cascade="all, delete-orphan"
    )

class Inventory(Base):
    __tablename__ = "inventory"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    centre_id: Mapped[int] = mapped_column(
        ForeignKey("centres.id", ondelete="CASCADE"), nullable=False, index=True
    )
    product_type: Mapped[str] = mapped_column(String(10), nullable=False)
    physical_stock: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    reserved_stock: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    centre: Mapped[Centre] = relationship("Centre", back_populates="inventory")

    @property
    def available(self) -> int:
        """Unreserved stock a new reservation may still claim."""
        return self.physical_stock - self.reserved_stock

    __table_args__ = (
        UniqueConstraint("centre_id", "product_type", name="uq_inventory_centre_product"),
        CheckConstraint("physical_stock >= 0", name="ck_inventory_physical_nonneg"),
        CheckConstraint("reserved_stock >= 0", name="ck_inventory_reserved_nonneg"),
    )

# ---------------------------------------------------------------------------
# New land‑parcel table (AI‑Synergy)
# ---------------------------------------------------------------------------
class LandParcel(Base):
    __tablename__ = "land_parcels"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    farmer_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    parcel_number: Mapped[str] = mapped_column(String(20), nullable=False)
    area_acres: Mapped[float] = mapped_column(Float, nullable=False)

    soil_type: Mapped[str] = mapped_column(String(20), nullable=False)
    soil_ph: Mapped[float] = mapped_column(Float, nullable=False)
    n_status: Mapped[str] = mapped_column(String(10), nullable=False)  # Low/Medium/High
    p_status: Mapped[str] = mapped_column(String(10), nullable=False)
    k_status: Mapped[str] = mapped_column(String(10), nullable=False)
    crop: Mapped[str] = mapped_column(String(20), nullable=False)

    farmer: Mapped[User] = relationship("User", back_populates="land_parcels")
    requests: Mapped[list["Request"]] = relationship("Request", back_populates="land_parcel")

    __table_args__ = (
        UniqueConstraint("farmer_id", "parcel_number", name="uq_farmer_parcel"),
    )

# ---------------------------------------------------------------------------
# Request / reservation tables (extended)
# ---------------------------------------------------------------------------
class Request(Base):
    __tablename__ = "requests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    farmer_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    centre_id: Mapped[int] = mapped_column(ForeignKey("centres.id"), nullable=False, index=True)
    product_type: Mapped[str] = mapped_column(String(10), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default=RequestStatus.REQUESTED.value, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    # ---- Extensions for AI-Synergy (nullable so existing requests still work) ----
    land_parcel_id: Mapped[int | None] = mapped_column(ForeignKey("land_parcels.id"), nullable=True, index=True)
    ai_recommended_bags: Mapped[int | None] = mapped_column(Integer, nullable=True)
    farmer_requested_bags: Mapped[int | None] = mapped_column(Integer, nullable=True)
    quota_approved_bags: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Idempotency key (already existed in original schema)
    idempotency_key: Mapped[str | None] = mapped_column(String(64), nullable=True, unique=True, index=True)

    farmer: Mapped[User] = relationship("User", back_populates="requests")
    centre: Mapped[Centre] = relationship("Centre")
    land_parcel: Mapped["LandParcel | None"] = relationship("LandParcel", back_populates="requests")
    reservation: Mapped["Reservation"] = relationship(
        "Reservation",
        back_populates="request",
        uselist=False,
        cascade="all, delete-orphan",
    )
    waitlist_entry: Mapped["Waitlist"] = relationship(
        "Waitlist",
        back_populates="request",
        uselist=False,
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_requests_qty_positive"),
    )

class Reservation(Base):
    __tablename__ = "reservations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    request_id: Mapped[int] = mapped_column(
        ForeignKey("requests.id", ondelete="CASCADE"), nullable=False, unique=True, index=True
    )
    centre_id: Mapped[int] = mapped_column(ForeignKey("centres.id"), nullable=False, index=True)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    idempotency_key: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    otp_code: Mapped[str | None] = mapped_column(String(8), nullable=True)

    request: Mapped[Request] = relationship("Request", back_populates="reservation")

    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_reservations_qty_positive"),
    )

class Waitlist(Base):
    __tablename__ = "waitlist"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    request_id: Mapped[int] = mapped_column(
        ForeignKey("requests.id", ondelete="CASCADE"), nullable=False, unique=True, index=True
    )
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default=WaitlistStatus.WAITING.value, index=True)

    request: Mapped[Request] = relationship("Request", back_populates="waitlist_entry")

    __table_args__ = (
        CheckConstraint("position >= 1", name="ck_waitlist_position_positive"),
    )

# ---------------------------------------------------------------------------
# Audit log (unchanged)
# ---------------------------------------------------------------------------
class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    actor_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    event_type: Mapped[str] = mapped_column(String(60), nullable=False, index=True)
    details: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
