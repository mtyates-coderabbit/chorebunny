"""Endpoints for the reward redemption flow: children request, parents approve or deny."""

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import crud, schemas
from app.database import get_db

router = APIRouter(prefix="/redemptions", tags=["redemptions"])

_CREATE_ERRORS = {
    "child_not_found": (404, "Child not found"),
    "reward_not_found": (404, "Reward not found"),
    "reward_inactive": (409, "Reward is not available"),
    "insufficient_balance": (409, "Not enough carrots"),
    "already_pending": (409, "This reward is already waiting for approval"),
}
_RESOLVE_ERRORS = {
    "not_found": (404, "Redemption request not found"),
    "not_pending": (409, "Redemption request is not pending"),
    "insufficient_balance": (409, "Not enough carrots"),
}


@router.get("", response_model=list[schemas.RedemptionRequest])
def list_redemptions(
    child_id: int | None = None,
    status: Literal["pending", "approved", "denied"] | None = None,
    db: Session = Depends(get_db),
) -> list[schemas.RedemptionRequest]:
    """Return redemption requests oldest first, optionally filtered by child and status."""
    return crud.get_redemption_requests(db, child_id=child_id, status=status)


@router.post("", response_model=schemas.RedemptionRequest, status_code=201)
def create_redemption(
    data: schemas.RedemptionRequestCreate, db: Session = Depends(get_db)
) -> schemas.RedemptionRequest:
    """Create a pending request without deducting carrots; 409 if the reward is inactive, already pending for the child, or costs more than the balance."""
    result = crud.create_redemption_request(db, data.child_id, data.reward_id)
    if isinstance(result, str):
        status_code, detail = _CREATE_ERRORS[result]
        raise HTTPException(status_code=status_code, detail=detail)
    return result


@router.post("/{request_id}/approve", response_model=schemas.RedemptionRequest)
def approve_redemption(request_id: int, db: Session = Depends(get_db)) -> schemas.RedemptionRequest:
    """Approve a pending request and deduct its cost; 409 if already resolved or the balance no longer covers it."""
    result = crud.resolve_redemption_request(db, request_id, approve=True)
    if isinstance(result, str):
        status_code, detail = _RESOLVE_ERRORS[result]
        raise HTTPException(status_code=status_code, detail=detail)
    return result


@router.post("/{request_id}/deny", response_model=schemas.RedemptionRequest)
def deny_redemption(request_id: int, db: Session = Depends(get_db)) -> schemas.RedemptionRequest:
    """Deny a pending request without deducting carrots; 409 if already resolved."""
    result = crud.resolve_redemption_request(db, request_id, approve=False)
    if isinstance(result, str):
        status_code, detail = _RESOLVE_ERRORS[result]
        raise HTTPException(status_code=status_code, detail=detail)
    return result
