from datetime import date, timedelta

from sqlalchemy import delete, exists, select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session, selectinload

from app import models, schemas


def get_settings(db: Session) -> schemas.Settings:
    """Return current settings, falling back to defaults for any missing keys."""
    rows = {r.key: r.value for r in db.scalars(select(models.Setting))}
    return schemas.Settings(
        morning_cutoff_hour=int(rows.get("morning_cutoff_hour", 12)),
        carrots_per_dollar=int(rows.get("carrots_per_dollar", 15)),
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


def get_or_create_balance(db: Session, child_id: int) -> models.ChildBalance | None:
    """Return the child's balance row, creating a zeroed one on first access; None if the child doesn't exist."""
    if db.get(models.Child, child_id) is None:
        return None
    balance = db.get(models.ChildBalance, child_id)
    if balance is None:
        balance = models.ChildBalance(child_id=child_id)
        db.add(balance)
        db.commit()
        db.refresh(balance)
    return balance


def get_balance(db: Session, child_id: int) -> schemas.ChildBalance | None:
    """Return the child's carrot balance and its dollar equivalent at the configured conversion rate; None if the child doesn't exist."""
    balance = get_or_create_balance(db, child_id)
    if balance is None:
        return None
    rate = get_settings(db).carrots_per_dollar
    return schemas.ChildBalance(
        child_id=balance.child_id,
        current_balance=balance.current_balance,
        lifetime_earned=balance.lifetime_earned,
        lifetime_redeemed=balance.lifetime_redeemed,
        dollar_value=round(balance.current_balance / rate, 2),
    )


def get_tasks(
    db: Session,
    routine: str | None = None,
    active_only: bool = True,
    child_id: int | None = None,
) -> list[models.Task]:
    """Return tasks, optionally filtered to those visible to a given child (global + assigned)."""
    q = select(models.Task).options(selectinload(models.Task.assignments))
    if routine:
        q = q.where(models.Task.routine == routine)
    if active_only:
        q = q.where(models.Task.is_active == True)  # noqa: E712
    if child_id is not None:
        has_any = exists().where(models.TaskChildAssignment.task_id == models.Task.id)
        assigned_to_child = exists().where(
            models.TaskChildAssignment.task_id == models.Task.id,
            models.TaskChildAssignment.child_id == child_id,
        )
        q = q.where(~has_any | assigned_to_child)
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


def set_task_assignments(
    db: Session, task_id: int, child_ids: list[int]
) -> models.Task | None:
    """Replace all child assignments for the task; empty list makes it visible to all children."""
    task = db.get(models.Task, task_id)
    if not task:
        return None
    child_ids = list(dict.fromkeys(child_ids))
    db.execute(
        delete(models.TaskChildAssignment).where(
            models.TaskChildAssignment.task_id == task_id
        )
    )
    for child_id in child_ids:
        db.add(models.TaskChildAssignment(task_id=task_id, child_id=child_id))
    db.commit()
    return db.scalar(
        select(models.Task)
        .options(selectinload(models.Task.assignments))
        .where(models.Task.id == task_id)
    )


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


def _credit_balance(db: Session, child_id: int | None, carrot_value: int) -> None:
    """Add carrot_value to the child's lifetime_earned and current_balance; no-op without a child."""
    if child_id is None:
        return
    balance = get_or_create_balance(db, child_id)
    balance.lifetime_earned += carrot_value
    balance.current_balance += carrot_value
    db.commit()


def _debit_balance(db: Session, child_id: int | None, carrot_value: int) -> None:
    """Subtract carrot_value from the child's current_balance, never going below zero; no-op without a child."""
    if child_id is None:
        return
    balance = get_or_create_balance(db, child_id)
    balance.current_balance = max(balance.current_balance - carrot_value, 0)
    db.commit()


def toggle_completion(
    db: Session, task_id: int, completion_date: date, child_id: int | None = None
) -> schemas.ToggleResult | None:
    """Persist a toggle for the task/date and child (None selects no child), crediting or debiting that child's carrot balance; return deleted with no completion or created with the new or concurrently inserted completion, or None for a missing task or child; propagate IntegrityError when insertion fails with no matching completion and no missing task/child, and other database errors."""
    task = db.get(models.Task, task_id)
    if task is None:
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
        _debit_balance(db, child_id, task.carrot_value)
        return schemas.ToggleResult(action="deleted", completion=None)

    completion = models.TaskCompletion(task_id=task_id, completion_date=completion_date, child_id=child_id)
    db.add(completion)
    try:
        db.commit()
        db.refresh(completion)
        _credit_balance(db, child_id, task.carrot_value)
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
    including for past dates. Days with no completions earn zero. A reversed
    range returns an empty days list. Optionally scoped to a single child;
    otherwise each task's total scales by the number of children it is
    visible to, plus one slot on dates that have an unassigned completion
    (at least one slot per day), matching get_daily_summary. Database errors
    propagate.
    """
    all_tasks = get_tasks(db, active_only=True, child_id=child_id)
    num_children = len(get_children(db)) if child_id is None else 0
    base_total = sum(
        t.carrot_value * ((len(t.assignments) or max(num_children, 1)) if child_id is None else 1)
        for t in all_tasks
    )
    unassigned_total = sum(t.carrot_value for t in all_tasks) if num_children else 0

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

    earned_by_date: dict[date, int] = {}
    earned_by_routine: dict[tuple[date, str], int] = {}
    count_by_task: dict[int, int] = {}
    unassigned_dates: set[date] = set()
    for c in completions:
        task = next((t for t in all_tasks if t.id == c.task_id), None)
        if task:
            earned_by_date[c.completion_date] = (
                earned_by_date.get(c.completion_date, 0) + task.carrot_value
            )
            key = (c.completion_date, task.routine)
            earned_by_routine[key] = earned_by_routine.get(key, 0) + task.carrot_value
            count_by_task[c.task_id] = count_by_task.get(c.task_id, 0) + 1
            if child_id is None and c.child_id is None:
                unassigned_dates.add(c.completion_date)

    days: list[schemas.DayCarrots] = []
    current = start_date
    while current <= end_date:
        if child_id is None:
            day_total = base_total + unassigned_total * int(current in unassigned_dates)
        else:
            day_total = base_total
        days.append(schemas.DayCarrots(
            date=current,
            earned_carrots=earned_by_date.get(current, 0),
            total_carrots=day_total,
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
    """Return assignment-aware carrot totals, including an extra capacity slot for unassigned completions on the date."""
    all_tasks = get_tasks(db, active_only=True, child_id=child_id)
    q = (
        select(models.TaskCompletion)
        .join(models.Task)
        .where(models.TaskCompletion.completion_date == summary_date)
        .where(models.Task.is_active == True)  # noqa: E712
    )
    if child_id is not None:
        q = q.where(models.TaskCompletion.child_id == child_id)
    completions = list(db.scalars(q))
    num_children = len(get_children(db)) if child_id is None else 0
    has_unassigned = any(c.child_id is None for c in completions)
    task_capacities = {
        t.id: max((len(t.assignments) or num_children) + int(has_unassigned), 1)
        if child_id is None else 1
        for t in all_tasks
    }

    def routine_summary(routine: str) -> schemas.RoutineSummary:
        """Return routine totals using each task's capacity and each completion's value."""
        task_values = {t.id: t.carrot_value for t in all_tasks if t.routine == routine}
        completed_ids = [c.task_id for c in completions if c.task_id in task_values]
        total_carrots = sum(value * task_capacities[task_id] for task_id, value in task_values.items())
        earned_carrots = sum(task_values[task_id] for task_id in completed_ids)
        return schemas.RoutineSummary(
            total_carrots=total_carrots,
            earned_carrots=earned_carrots,
            total_count=sum(task_capacities[task_id] for task_id in task_values),
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
