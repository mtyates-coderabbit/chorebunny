from datetime import date, datetime, timedelta

from sqlalchemy import exists, func, select
from sqlalchemy.dialects.sqlite import insert
from sqlalchemy.orm import Session

from app import models, schemas


DEFINITIONS = (
    {"key": "first_chore", "name": "First Chore", "description": "Complete your first chore.", "icon": "🌱", "criteria_type": "chores", "threshold": 1},
    {"key": "first_full_routine", "name": "First Full Routine", "description": "Complete every chore in a routine.", "icon": "🌟", "criteria_type": "routine", "threshold": 1},
    {"key": "7_day_streak", "name": "7-Day Streak", "description": "Complete all your chores for seven days in a row.", "icon": "🔥", "criteria_type": "streak", "threshold": 7},
    {"key": "30_day_streak", "name": "30-Day Streak", "description": "Complete all your chores for thirty days in a row.", "icon": "🏆", "criteria_type": "streak", "threshold": 30},
    {"key": "perfect_week", "name": "Perfect Week", "description": "Complete both routines for seven days in a row.", "icon": "🌈", "criteria_type": "perfect_week", "threshold": 7},
    {"key": "100_carrots", "name": "100 Carrots Earned", "description": "Earn one hundred carrots.", "icon": "🥕", "criteria_type": "carrots", "threshold": 100},
)


def seed_achievements(db: Session) -> None:
    """Add missing built-in definitions without changing existing definitions or committing."""
    db.execute(insert(models.Achievement).values(list(DEFINITIONS)).on_conflict_do_nothing(index_elements=[models.Achievement.key]))


def _longest_run(days: list[date]) -> int:
    longest = current = 0
    previous = None
    for day in days:
        current = current + 1 if previous is not None and day - previous == timedelta(days=1) else 1
        longest = max(longest, current)
        previous = day
    return longest


def evaluate_achievements(db: Session, child_id: int, as_of: date | None = None) -> list[schemas.UnlockedAchievement]:
    """Insert and return new unlocks in the caller's transaction using retained history through as_of."""
    as_of = as_of or date.today()
    unlocked = exists().where(
        models.ChildAchievement.child_id == child_id,
        models.ChildAchievement.achievement_id == models.Achievement.id,
    )
    definitions = list(db.scalars(select(models.Achievement).where(~unlocked).order_by(models.Achievement.id)))
    if not definitions:
        return []

    has_assignments = exists().where(models.TaskChildAssignment.task_id == models.Task.id)
    assigned = exists().where(
        models.TaskChildAssignment.task_id == models.Task.id,
        models.TaskChildAssignment.child_id == child_id,
    )
    eligible = (models.Task.is_active.is_(True), ~has_assignments | assigned)
    totals = dict(db.execute(select(models.Task.routine, func.count()).where(*eligible).group_by(models.Task.routine)).all())
    daily = db.execute(
        select(models.TaskCompletion.completion_date, models.Task.routine, func.count())
        .join(models.Task, models.Task.id == models.TaskCompletion.task_id)
        .where(models.TaskCompletion.child_id == child_id, models.TaskCompletion.completion_date <= as_of, *eligible)
        .group_by(models.TaskCompletion.completion_date, models.Task.routine)
        .order_by(models.TaskCompletion.completion_date)
    ).all()
    days: dict[date, dict[str, int]] = {}
    for day, routine, count in daily:
        days.setdefault(day, {})[routine] = count

    full_routine = any(any(total > 0 and counts.get(routine, 0) == total for routine, total in totals.items()) for counts in days.values())
    full_days = [day for day, counts in days.items() if totals and all(counts.get(routine, 0) == total for routine, total in totals.items())]
    perfect_days = full_days if totals.get("morning", 0) and totals.get("evening", 0) else []
    chore_count = db.scalar(select(func.count()).select_from(models.TaskCompletion).where(
        models.TaskCompletion.child_id == child_id, models.TaskCompletion.completion_date <= as_of
    )) or 0
    balance = db.get(models.ChildBalance, child_id, populate_existing=True)
    values = {
        "chores": chore_count,
        "routine": int(full_routine),
        "streak": _longest_run(full_days),
        "perfect_week": _longest_run(perfect_days),
        "carrots": balance.lifetime_earned if balance else 0,
    }
    qualified = [definition for definition in definitions if values.get(definition.criteria_type, 0) >= definition.threshold]
    if not qualified:
        return []

    now = datetime.utcnow()
    inserted = db.execute(
        insert(models.ChildAchievement)
        .values([{"child_id": child_id, "achievement_id": definition.id, "unlocked_at": now} for definition in qualified])
        .on_conflict_do_nothing(index_elements=[models.ChildAchievement.child_id, models.ChildAchievement.achievement_id])
        .returning(models.ChildAchievement.achievement_id, models.ChildAchievement.unlocked_at)
    ).all()
    inserted_at = dict(inserted)
    return [schemas.UnlockedAchievement(id=d.id, name=d.name, description=d.description, icon=d.icon, unlocked_at=inserted_at[d.id]) for d in qualified if d.id in inserted_at]
