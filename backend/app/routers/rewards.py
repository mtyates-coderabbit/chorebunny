"""CRUD endpoints for the reward catalog."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import crud, schemas
from app.database import get_db

router = APIRouter(prefix="/rewards", tags=["rewards"])


@router.get("", response_model=list[schemas.Reward])
def list_rewards(active_only: bool = False, db: Session = Depends(get_db)) -> list[schemas.Reward]:
    """Return rewards cheapest first; admin sees all, the child view passes active_only=true."""
    return crud.get_rewards(db, active_only=active_only)


@router.post("", response_model=schemas.Reward, status_code=201)
def create_reward(data: schemas.RewardCreate, db: Session = Depends(get_db)) -> schemas.Reward:
    """Create a reward."""
    return crud.create_reward(db, data)


@router.put("/{reward_id}", response_model=schemas.Reward)
def update_reward(reward_id: int, data: schemas.RewardUpdate, db: Session = Depends(get_db)) -> schemas.Reward:
    """Update supplied reward fields, including deactivation; raise HTTPException(404) if missing."""
    reward = crud.update_reward(db, reward_id, data)
    if not reward:
        raise HTTPException(status_code=404, detail="Reward not found")
    return reward


@router.delete("/{reward_id}", status_code=204)
def delete_reward(reward_id: int, db: Session = Depends(get_db)) -> None:
    """Delete a reward while preserving redemption history; raise HTTPException(404) if missing."""
    if not crud.delete_reward(db, reward_id):
        raise HTTPException(status_code=404, detail="Reward not found")
