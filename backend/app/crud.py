from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app import models, schemas


def get_settings(db: Session) -> schemas.Settings:
    """Return current settings, falling back to defaults for any missing keys."""
    rows = {r.key: r.value for r in db.scalars(select(models.Setting))}
    return schemas.Settings(
        morning_cutoff_hour=int(rows.get("morning_cutoff_hour", 12)),
    )


def update_settings(db: Session, data: schemas.SettingsUpdate) -> schemas.Settings:
    """Apply non-None fields from data to the settings table and return updated settings."""
    for key, value in data.model_dump(exclude_none=True).items():
        setting = db.get(models.Setting, key)
        if setting:
            setting.value = str(value)
        else:
            db.add(models.Setting(key=key, value=str(value)))
    db.commit()
    return get_settings(db)


def get_children(db: Session) -> list[models.Child]:
    """Return all child profiles ordered by creation time."""
    return list(db.scalars(select(models.Child).order_by(models.Child.created_at)))


def create_child(db: Session, data: schemas.ChildCreate) -> models.Child:
    """Create and persist a new child profile."""
    child = models.Child(**data.model_dump())
    db.add(child)
    db.commit()
    db.refresh(child)
    return child


def update_child(db: Session, child_id: int, data: schemas.ChildUpdate) -> models.Child | None:
    """Apply partial updates to an existing child profile; returns None if not found."""
    child = db.get(models.Child, child_id)
    if not child:
        return None
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(child, field, value)
    db.commit()
    db.refresh(child)
    return child


def delete_child(db: Session, child_id: int) -> bool:
    """Delete a child profile and all their completions; returns False if not found."""
    child = db.get(models.Child, child_id)
    if not child:
        return False
    db.delete(child)
    db.commit()
    return True


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
    for field, value in data.model_dump(exclude_unset=True).items():
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


def reorder_task(db: Session, task_id: int, data: schemas.TaskReorder) -> bool:
    """Move a task among all routine siblings and persist their positions atomically."""
    task = db.get(models.Task, task_id)
    if not task:
        return False
    siblings = get_tasks(db, routine=task.routine, active_only=False)
    index = siblings.index(task)
    target = index + data.direction
    if not 0 <= target < len(siblings):
        return True
    siblings[index], siblings[target] = siblings[target], siblings[index]
    try:
        for position, sibling in enumerate(siblings):
            sibling.sort_order = position
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise
    return True


def get_completions(
    db: Session,
    completion_date: date,
    routine: str | None = None,
    child_id: int | None = None,
) -> list[models.TaskCompletion]:
    """Return completions of active tasks for the date, optionally filtered by nonempty routine; child_id=None selects only completions with no child."""
    q = (
        select(models.TaskCompletion)
        .join(models.Task)
        .where(models.TaskCompletion.completion_date == completion_date)
        .where(models.Task.is_active == True)  # noqa: E712
    )
    if routine:
        q = q.where(models.Task.routine == routine)
    if child_id is not None:
        q = q.where(models.TaskCompletion.child_id == child_id)
    else:
        q = q.where(models.TaskCompletion.child_id.is_(None))
    return list(db.scalars(q))


def task_exists(db: Session, task_id: int) -> bool:
    """Return whether a task with the given id exists."""
    return db.get(models.Task, task_id) is not None


def toggle_completion(
    db: Session, task_id: int, completion_date: date, child_id: int | None = None
) -> schemas.ToggleResult | None:
    """Persist a toggle for the task/date and child (None selects no child); return deleted with no completion or created with the new or concurrently inserted completion, or None for a missing task or child; propagate IntegrityError when insertion fails with no matching completion and no missing task/child, and other database errors."""
    if not task_exists(db, task_id):
        return None
    if child_id is not None and db.get(models.Child, child_id) is None:
        return None

    existing = db.scalar(
        select(models.TaskCompletion).where(
            models.TaskCompletion.task_id == task_id,
            models.TaskCompletion.completion_date == completion_date,
            models.TaskCompletion.child_id == child_id,
        )
    )
    if existing:
        db.delete(existing)
        db.commit()
        return schemas.ToggleResult(action="deleted", completion=None)

    completion = models.TaskCompletion(task_id=task_id, completion_date=completion_date, child_id=child_id)
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
        if child_id is not None and db.get(models.Child, child_id) is None:
            return None
        existing = db.scalar(
            select(models.TaskCompletion).where(
                models.TaskCompletion.task_id == task_id,
                models.TaskCompletion.completion_date == completion_date,
                models.TaskCompletion.child_id == child_id,
            )
        )
        if existing is None:
            raise
        return schemas.ToggleResult(
            action="created",
            completion=schemas.Completion.model_validate(existing),
        )


def get_range_summary(db: Session, start_date: date, end_date: date, child_id: int | None = None) -> schemas.RangeSummary:
    """Return daily carrot totals for the inclusive range, in date order.

    Both routines use currently active tasks and their current carrot values,
    including for past dates. Each day has the same available total; days with
    no completions earn zero. A reversed range returns an empty days list.
    Optionally scoped to a single child; otherwise totals scale by the number
    of children in the household, plus one slot when the range includes
    unassigned completions (at least one slot in total). Database errors propagate.
    """
    all_tasks = get_tasks(db, active_only=True)
    total_carrots = sum(t.carrot_value for t in all_tasks)

    q = (
        select(models.TaskCompletion)
        .join(models.Task)
        .where(models.TaskCompletion.completion_date >= start_date)
        .where(models.TaskCompletion.completion_date <= end_date)
        .where(models.Task.is_active == True)  # noqa: E712
    )
    if child_id is not None:
        q = q.where(models.TaskCompletion.child_id == child_id)
    completions = list(db.scalars(q))
    if child_id is None:
        has_unassigned = any(c.child_id is None for c in completions)
        total_carrots *= max(len(get_children(db)) + int(has_unassigned), 1)

    earned_by_date: dict[date, int] = {}
    earned_by_routine: dict[tuple[date, str], int] = {}
    count_by_task: dict[int, int] = {}
    for c in completions:
        task = next((t for t in all_tasks if t.id == c.task_id), None)
        if task:
            earned_by_date[c.completion_date] = (
                earned_by_date.get(c.completion_date, 0) + task.carrot_value
            )
            key = (c.completion_date, task.routine)
            earned_by_routine[key] = earned_by_routine.get(key, 0) + task.carrot_value
            count_by_task[c.task_id] = count_by_task.get(c.task_id, 0) + 1

    days: list[schemas.DayCarrots] = []
    current = start_date
    while current <= end_date:
        days.append(schemas.DayCarrots(
            date=current,
            earned_carrots=earned_by_date.get(current, 0),
            total_carrots=total_carrots,
            morning_earned_carrots=earned_by_routine.get((current, "morning"), 0),
            evening_earned_carrots=earned_by_routine.get((current, "evening"), 0),
        ))
        if current == end_date:
            break
        current += timedelta(days=1)

    task_stats = [
        schemas.TaskStat(
            task_id=t.id,
            name=t.name,
            routine=t.routine,
            count=count_by_task.get(t.id, 0),
        )
        for t in all_tasks
    ]

    return schemas.RangeSummary(
        start_date=start_date,
        end_date=end_date,
        days=days,
        task_stats=task_stats,
    )


def get_streaks(db: Session, routine: str | None = None) -> schemas.StreakSummary:
    """Return current and longest consecutive-day completion streaks.

    A day counts if at least one active task was completed that day.
    Optionally scoped to a single routine; omitting routine spans both.
    The current streak counts backward from today; a gap yesterday breaks it.
    """
    today = date.today()
    q = (
        select(models.TaskCompletion.completion_date)
        .join(models.Task)
        .where(models.Task.is_active == True)  # noqa: E712
        .where(models.TaskCompletion.completion_date <= today)
    )
    if routine:
        q = q.where(models.Task.routine == routine)
    q = q.distinct().order_by(models.TaskCompletion.completion_date.desc())
    dates: list[date] = list(db.scalars(q))

    if not dates:
        return schemas.StreakSummary(current_streak=0, longest_streak=0, last_completion_date=None)

    # Current streak: walk backward from today
    current = 0
    cursor = today
    for d in dates:
        if d == cursor:
            current += 1
            cursor -= timedelta(days=1)
        elif d < cursor:
            break

    # Longest streak: scan all dates (already sorted desc → reverse for asc walk)
    longest = 0
    run = 1
    asc = list(reversed(dates))
    for i in range(1, len(asc)):
        if asc[i] == asc[i - 1] + timedelta(days=1):
            run += 1
        else:
            longest = max(longest, run)
            run = 1
    longest = max(longest, run)

    return schemas.StreakSummary(
        current_streak=current,
        longest_streak=longest,
        last_completion_date=dates[0],
    )


def get_daily_summary(
    db: Session, summary_date: date, child_id: int | None = None
) -> schemas.DailySummary:
    """Return carrot totals for one child or the household, including an extra capacity slot for unassigned completions on the date."""
    all_tasks = get_tasks(db, active_only=True)
    q = (
        select(models.TaskCompletion)
        .join(models.Task)
        .where(models.TaskCompletion.completion_date == summary_date)
        .where(models.Task.is_active == True)  # noqa: E712
    )
    if child_id is not None:
        q = q.where(models.TaskCompletion.child_id == child_id)
    completions = list(db.scalars(q))
    capacity = 1
    if child_id is None:
        has_unassigned = any(c.child_id is None for c in completions)
        capacity = max(len(get_children(db)) + int(has_unassigned), 1)

    def routine_summary(routine: str) -> schemas.RoutineSummary:
        """Return routine totals using the date's household capacity and each completion's value."""
        task_values = {t.id: t.carrot_value for t in all_tasks if t.routine == routine}
        completed_ids = [c.task_id for c in completions if c.task_id in task_values]
        total_carrots = sum(task_values.values()) * capacity
        earned_carrots = sum(task_values[task_id] for task_id in completed_ids)
        return schemas.RoutineSummary(
            total_carrots=total_carrots,
            earned_carrots=earned_carrots,
            total_count=len(task_values) * capacity,
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
