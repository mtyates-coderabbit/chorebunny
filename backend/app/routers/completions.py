from datetime import date as date_type

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import crud, schemas
from app.database import get_db

router = APIRouter(tags=["completions"])


@router.get("/completions", response_model=list[schemas.Completion])
def list_completions(
    date: date_type | None = None,
    routine: str | None = None,
    db: Session = Depends(get_db),
):
    completion_date = date or date_type.today()
    return crud.get_completions(db, completion_date=completion_date, routine=routine)


@router.post("/completions/toggle", response_model=schemas.ToggleResult)
def toggle_completion(data: schemas.CompletionToggleRequest, db: Session = Depends(get_db)):
    return crud.toggle_completion(db, task_id=data.task_id, completion_date=data.completion_date)


@router.get("/summary", response_model=schemas.DailySummary)
def get_summary(date: date_type | None = None, db: Session = Depends(get_db)):
    summary_date = date or date_type.today()
    return crud.get_daily_summary(db, summary_date=summary_date)
