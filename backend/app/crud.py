from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import models, schemas


def get_tasks(db: Session, routine: str | None = None, active_only: bool = True) -> list[models.Task]:
    q = select(models.Task)
    if routine:
        q = q.where(models.Task.routine == routine)
    if active_only:
        q = q.where(models.Task.is_active == True)  # noqa: E712
    q = q.order_by(models.Task.sort_order, models.Task.id)
    return list(db.scalars(q))


def create_task(db: Session, data: schemas.TaskCreate) -> models.Task:
    task = models.Task(**data.model_dump())
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def update_task(db: Session, task_id: int, data: schemas.TaskUpdate) -> models.Task | None:
    task = db.get(models.Task, task_id)
    if not task:
        return None
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(task, field, value)
    db.commit()
    db.refresh(task)
    return task


def delete_task(db: Session, task_id: int) -> bool:
    task = db.get(models.Task, task_id)
    if not task:
        return False
    db.delete(task)
    db.commit()
    return True


def get_completions(
    db: Session, completion_date: date, routine: str | None = None
) -> list[models.TaskCompletion]:
    q = (
        select(models.TaskCompletion)
        .join(models.Task)
        .where(models.TaskCompletion.completion_date == completion_date)
        .where(models.Task.is_active == True)  # noqa: E712
    )
    if routine:
        q = q.where(models.Task.routine == routine)
    return list(db.scalars(q))


def toggle_completion(
    db: Session, task_id: int, completion_date: date
) -> schemas.ToggleResult:
    existing = db.scalar(
        select(models.TaskCompletion).where(
            models.TaskCompletion.task_id == task_id,
            models.TaskCompletion.completion_date == completion_date,
        )
    )
    if existing:
        db.delete(existing)
        db.commit()
        return schemas.ToggleResult(action="deleted", completion=None)

    completion = models.TaskCompletion(task_id=task_id, completion_date=completion_date)
    db.add(completion)
    try:
        db.commit()
        db.refresh(completion)
        return schemas.ToggleResult(
            action="created",
            completion=schemas.Completion.model_validate(completion),
        )
    except IntegrityError:
        db.rollback()
        # Concurrent insert — treat as already completed
        existing = db.scalar(
            select(models.TaskCompletion).where(
                models.TaskCompletion.task_id == task_id,
                models.TaskCompletion.completion_date == completion_date,
            )
        )
        return schemas.ToggleResult(
            action="created",
            completion=schemas.Completion.model_validate(existing) if existing else None,
        )


def get_range_summary(db: Session, start_date: date, end_date: date) -> schemas.RangeSummary:
    all_tasks = get_tasks(db, active_only=True)
    total_carrots = sum(t.carrot_value for t in all_tasks)

    completions = list(
        db.scalars(
            select(models.TaskCompletion)
            .join(models.Task)
            .where(models.TaskCompletion.completion_date >= start_date)
            .where(models.TaskCompletion.completion_date <= end_date)
            .where(models.Task.is_active == True)  # noqa: E712
        )
    )

    earned_by_date: dict[date, int] = {}
    for c in completions:
        task = next((t for t in all_tasks if t.id == c.task_id), None)
        if task:
            earned_by_date[c.completion_date] = (
                earned_by_date.get(c.completion_date, 0) + task.carrot_value
            )

    days: list[schemas.DayCarrots] = []
    current = start_date
    while current <= end_date:
        days.append(schemas.DayCarrots(
            date=current,
            earned_carrots=earned_by_date.get(current, 0),
            total_carrots=total_carrots,
        ))
        current += timedelta(days=1)

    return schemas.RangeSummary(start_date=start_date, end_date=end_date, days=days)


def get_daily_summary(db: Session, summary_date: date) -> schemas.DailySummary:
    def routine_summary(routine: str) -> schemas.RoutineSummary:
        tasks = get_tasks(db, routine=routine, active_only=True)
        completions = get_completions(db, completion_date=summary_date, routine=routine)
        completed_ids = {c.task_id for c in completions}
        total_carrots = sum(t.carrot_value for t in tasks)
        earned_carrots = sum(t.carrot_value for t in tasks if t.id in completed_ids)
        return schemas.RoutineSummary(
            total_carrots=total_carrots,
            earned_carrots=earned_carrots,
            total_count=len(tasks),
            completed_count=len(completed_ids),
        )

    morning = routine_summary("morning")
    evening = routine_summary("evening")
    return schemas.DailySummary(
        date=summary_date,
        morning=morning,
        evening=evening,
        total_carrots=morning.total_carrots + evening.total_carrots,
        earned_carrots=morning.earned_carrots + evening.earned_carrots,
    )
