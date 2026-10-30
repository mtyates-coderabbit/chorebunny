"""CRUD endpoints for child savings goals."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import crud, schemas
from app.database import get_db

router = APIRouter(prefix="/goals", tags=["goals"])


@router.get("", response_model=list[schemas.Goal])
def list_goals(child_id: int, db: Session = Depends(get_db)) -> list[schemas.Goal]:
    """Return a child's goals, active first then completed."""
    return crud.get_goals(db, child_id=child_id)


@router.post("", response_model=schemas.Goal, status_code=201)
def create_goal(data: schemas.GoalCreate, db: Session = Depends(get_db)) -> schemas.Goal:
    """Create a savings goal; raise HTTPException(404) if the child is missing."""
    goal = crud.create_goal(db, data)
    if goal is None:
        raise HTTPException(status_code=404, detail="Child not found")
    return goal


@router.put("/{goal_id}", response_model=schemas.Goal)
def update_goal(goal_id: int, data: schemas.GoalUpdate, db: Session = Depends(get_db)) -> schemas.Goal:
    """Update a goal's name or target; raise HTTPException(404) if missing."""
    goal = crud.update_goal(db, goal_id, data)
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    return goal


@router.delete("/{goal_id}", status_code=204)
def delete_goal(goal_id: int, db: Session = Depends(get_db)) -> None:
    """Delete a goal; raise HTTPException(404) if missing."""
    if not crud.delete_goal(db, goal_id):
        raise HTTPException(status_code=404, detail="Goal not found")


@router.post("/{goal_id}/complete", response_model=schemas.Goal)
def complete_goal(goal_id: int, db: Session = Depends(get_db)) -> schemas.Goal:
    """Mark a goal completed now; raise HTTPException(404) if missing."""
    goal = crud.complete_goal(db, goal_id)
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    return goal
