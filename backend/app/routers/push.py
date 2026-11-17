"""Endpoints for registering and removing Web Push subscriptions."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.database import get_db

router = APIRouter(prefix="/push", tags=["push"])


@router.post("/subscribe", response_model=schemas.PushSubscription)
def subscribe(data: schemas.PushSubscriptionCreate, db: Session = Depends(get_db)) -> schemas.PushSubscription:
    """Store a push subscription, updating the existing row if the endpoint is already registered."""
    if data.child_id is not None and db.get(models.Child, data.child_id) is None:
        raise HTTPException(status_code=404, detail="Child not found")
    return crud.upsert_push_subscription(db, data)


@router.delete("/subscribe", status_code=204)
def unsubscribe(data: schemas.PushSubscriptionDelete, db: Session = Depends(get_db)) -> None:
    """Remove a push subscription by endpoint; raise HTTPException(404) if not found."""
    if not crud.delete_push_subscription(db, data.endpoint):
        raise HTTPException(status_code=404, detail="Subscription not found")
