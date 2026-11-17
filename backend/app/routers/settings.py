from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import crud, schemas
from app.database import get_db
from app.reminders import reschedule_reminder

router = APIRouter(tags=["settings"])


@router.get("/settings", response_model=schemas.Settings)
def get_settings(db: Session = Depends(get_db)):
    """Return current application settings."""
    return crud.get_settings(db)


@router.put("/settings", response_model=schemas.Settings)
def update_settings(data: schemas.SettingsUpdate, db: Session = Depends(get_db)):
    """Update one or more settings; omitted fields are unchanged; a touched reminder time reschedules its push job immediately."""
    updated = crud.update_settings(db, data)
    if "morning_reminder_time" in data.model_fields_set:
        reschedule_reminder("morning", updated.morning_reminder_time)
    if "evening_reminder_time" in data.model_fields_set:
        reschedule_reminder("evening", updated.evening_reminder_time)
    return updated
