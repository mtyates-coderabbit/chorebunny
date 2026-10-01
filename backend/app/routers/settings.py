from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import crud, schemas
from app.database import get_db

router = APIRouter(tags=["settings"])


@router.get("/settings", response_model=schemas.Settings)
def get_settings(db: Session = Depends(get_db)):
    """Return current application settings."""
    return crud.get_settings(db)


@router.put("/settings", response_model=schemas.Settings)
def update_settings(data: schemas.SettingsUpdate, db: Session = Depends(get_db)):
    """Update one or more settings; omitted fields are unchanged."""
    return crud.update_settings(db, data)
