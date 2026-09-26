"""CRUD endpoints for child profiles."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import crud, schemas
from app.database import get_db

router = APIRouter(prefix="/children", tags=["children"])


@router.get("", response_model=list[schemas.Child])
def list_children(db: Session = Depends(get_db)) -> list[schemas.Child]:
    """Return all child profiles in creation order."""
    return crud.get_children(db)


@router.post("", response_model=schemas.Child, status_code=201)
def create_child(data: schemas.ChildCreate, db: Session = Depends(get_db)) -> schemas.Child:
    """Create a new child profile."""
    return crud.create_child(db, data)


@router.put("/{child_id}", response_model=schemas.Child)
def update_child(child_id: int, data: schemas.ChildUpdate, db: Session = Depends(get_db)) -> schemas.Child:
    """Update name, avatar, or color for a child profile."""
    child = crud.update_child(db, child_id, data)
    if not child:
        raise HTTPException(status_code=404, detail="Child not found")
    return child


@router.delete("/{child_id}", status_code=204)
def delete_child(child_id: int, db: Session = Depends(get_db)) -> None:
    """Delete a child profile and cascade-delete all their completions."""
    if not crud.delete_child(db, child_id):
        raise HTTPException(status_code=404, detail="Child not found")
