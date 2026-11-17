"""Read-only endpoint exposing achievement definitions and one child's unlock status for each."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import crud, schemas
from app.database import get_db

router = APIRouter(prefix="/achievements", tags=["achievements"])


@router.get("", response_model=list[schemas.AchievementStatus])
def list_achievements(child_id: int, db: Session = Depends(get_db)) -> list[schemas.AchievementStatus]:
    """Return every achievement, ordered by id, with the given child's unlock state for each."""
    return crud.get_achievements(db, child_id=child_id)
