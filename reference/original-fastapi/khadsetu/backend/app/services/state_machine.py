"""Token state machine for KhadSetu.

"A token should be a promise, not a queue number."

Legal transitions (exactly as specified, plus CANCELLED on non-terminal
states since the schema defines the status and users need an exit path):

    REQUESTED  -> RESERVED     (stock was available)
    REQUESTED  -> WAITLISTED   (stock was not available)
    WAITLISTED -> RESERVED     (stock released or restocked)
    RESERVED   -> CONFIRMED    (verification / payment commitment)
    CONFIRMED  -> CLAIMED      (operator scans QR/OTP at the depot)
    RESERVED   -> EXPIRED      (TTL elapsed, stock released back)
    CONFIRMED  -> EXPIRED      (TTL elapsed, stock released back)
    REQUESTED | WAITLISTED | RESERVED | CONFIRMED -> CANCELLED

CLAIMED, EXPIRED and CANCELLED are terminal: no outgoing transitions.
Every successful transition writes an audit-log row.
"""

from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.models import AuditLog, Request, RequestStatus

_TERMINAL = {
    RequestStatus.CLAIMED,
    RequestStatus.EXPIRED,
    RequestStatus.CANCELLED,
}

TRANSITIONS: dict[RequestStatus, set[RequestStatus]] = {
    RequestStatus.REQUESTED: {
        RequestStatus.RESERVED,
        RequestStatus.WAITLISTED,
        RequestStatus.CANCELLED,
    },
    RequestStatus.WAITLISTED: {
        RequestStatus.RESERVED,  # promotion by the recovery worker (Step 4)
        RequestStatus.CANCELLED,
    },
    RequestStatus.RESERVED: {
        RequestStatus.CONFIRMED,
        RequestStatus.EXPIRED,   # TTL elapsed, stock released
        RequestStatus.CANCELLED,
    },
    RequestStatus.CONFIRMED: {
        RequestStatus.CLAIMED,
        RequestStatus.EXPIRED,
        RequestStatus.CANCELLED,
    },
    RequestStatus.CLAIMED: set(),
    RequestStatus.EXPIRED: set(),
    RequestStatus.CANCELLED: set(),
}


class IllegalTransitionError(Exception):
    """Raised when a token transition is not allowed by the state machine."""


def _to_status(value: str | RequestStatus) -> RequestStatus:
    """Coerce a raw status string/enum value to RequestStatus or raise ValueError."""
    if isinstance(value, RequestStatus):
        return value
    try:
        return RequestStatus(value)
    except ValueError as exc:
        raise ValueError(f"unknown request status: {value!r}") from exc


def can_transition(
    current: str | RequestStatus, target: str | RequestStatus
) -> bool:
    """True when moving a token from `current` to `target` is allowed.

    Unknown status strings raise ValueError (a malformed status must never be
    silently treated as illegal).
    """
    current_state = _to_status(current)
    target_state = _to_status(target)
    return target_state in TRANSITIONS[current_state]


def assert_transition(
    current: str | RequestStatus, target: str | RequestStatus
) -> None:
    """Raise IllegalTransitionError unless current -> target is legal."""
    if not can_transition(current, target):
        raise IllegalTransitionError(
            f"illegal token transition: {_to_status(current).value} -> {_to_status(target).value}"
        )


def transition(
    request: Request,
    target: str | RequestStatus,
    session: Session,
    actor_id: int | None = None,
    details: dict[str, Any] | None = None,
) -> Request:
    """Apply a state transition to a request and write an audit-log row.

    Callers must hold an open transaction on `session`; this function only
    mutates and flushes side rows - committing stays the caller's job so the
    transition joins whatever larger atomic step is in flight.
    """
    current_state = _to_status(request.status)
    target_state = _to_status(target)
    assert_transition(current_state, target_state)

    request.status = target_state.value
    session.add(
        AuditLog(
            actor_id=actor_id,
            event_type=f"TOKEN_{target_state.value}",
            details={
                "request_id": request.id,
                "from": current_state.value,
                "to": target_state.value,
                **(details or {}),
            },
        )
    )
    return request
