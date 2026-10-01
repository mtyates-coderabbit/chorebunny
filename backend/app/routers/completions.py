from datetime import date as date_type
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import crud, schemas
from app.database import get_db

router = APIRouter(tags=["completions"])
MAX_RANGE_DAYS = 366


@router.get("/completions", response_model=list[schemas.Completion])
def list_completions(
    date: date_type | None = None,
    routine: str | None = None,
    child_id: int | None = None,
    db: Session = Depends(get_db),
):
    """List completions of active tasks for the date (default: today on the server), optionally filtered by nonempty routine; omitted child_id selects only completions with no child."""
    completion_date = date or date_type.today()
    return crud.get_completions(db, completion_date=completion_date, routine=routine, child_id=child_id)


@router.post("/completions/toggle", response_model=schemas.ToggleResult)
def toggle_completion(data: schemas.CompletionToggleRequest, db: Session = Depends(get_db)):
    """Persist a task/date toggle and return its action and completion (None on deletion); omitted child_id selects no child; raise HTTPException(404) for a missing child and propagate unhandled database errors."""
    result = crud.toggle_completion(
        db, task_id=data.task_id, completion_date=data.completion_date, child_id=data.child_id
    )
    if result is None:
        raise HTTPException(status_code=404, detail="Child not found")
    return result


@router.get("/summary", response_model=schemas.DailySummary)
def get_summary(date: date_type | None = None, db: Session = Depends(get_db)):
    summary_date = date or date_type.today()
    return crud.get_daily_summary(db, summary_date=summary_date)


@router.get("/streaks", response_model=schemas.StreakSummary)
def get_streaks(routine: Literal["morning", "evening"] | None = None, db: Session = Depends(get_db)):
    """Return current and longest completion streaks, optionally scoped to a routine."""
    return crud.get_streaks(db, routine=routine)


@router.get("/summary/range", response_model=schemas.RangeSummary)
def get_range_summary(
    start_date: date_type,
    end_date: date_type,
    child_id: int | None = None,
    db: Session = Depends(get_db),
):
    """Return carrot totals for an inclusive range of at most 366 days.

    Totals use currently active tasks and their current values. Missing
    completions earn zero. Reversed or oversized ranges are rejected.
    Optionally scoped to a single child via child_id.
    """
    if start_date > end_date:
        raise HTTPException(status_code=422, detail="start_date must be on or before end_date")
    if (end_date - start_date).days + 1 > MAX_RANGE_DAYS:
        raise HTTPException(status_code=422, detail=f"Date range must not exceed {MAX_RANGE_DAYS} days")
    return crud.get_range_summary(db, start_date=start_date, end_date=end_date, child_id=child_id)
