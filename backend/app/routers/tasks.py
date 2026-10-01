from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import crud, schemas
from app.database import get_db

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.get("", response_model=list[schemas.Task])
def list_tasks(
    routine: str | None = None,
    active_only: bool = True,
    child_id: int | None = None,
    db: Session = Depends(get_db),
):
    """Return tasks, optionally scoped to those visible to a specific child."""
    return crud.get_tasks(db, routine=routine, active_only=active_only, child_id=child_id)


@router.post("", response_model=schemas.Task, status_code=201)
def create_task(data: schemas.TaskCreate, db: Session = Depends(get_db)):
    return crud.create_task(db, data)


@router.put("/{task_id}", response_model=schemas.Task)
def update_task(task_id: int, data: schemas.TaskUpdate, db: Session = Depends(get_db)):
    task = crud.update_task(db, task_id, data)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.delete("/{task_id}", status_code=204)
def delete_task(task_id: int, db: Session = Depends(get_db)):
    if not crud.delete_task(db, task_id):
        raise HTTPException(status_code=404, detail="Task not found")


@router.post("/{task_id}/reorder", status_code=204)
def reorder_task(task_id: int, data: schemas.TaskReorder, db: Session = Depends(get_db)) -> None:
    """Move a task one position within its routine in a single transaction."""
    if not crud.reorder_task(db, task_id, data):
        raise HTTPException(status_code=404, detail="Task not found")


@router.put("/{task_id}/assignments", response_model=schemas.Task)
def set_task_assignments(
    task_id: int, data: schemas.TaskAssignmentUpdate, db: Session = Depends(get_db)
):
    """Replace per-child assignments for a task; empty child_ids restores global visibility."""
    task = crud.set_task_assignments(db, task_id, data.child_ids)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task
