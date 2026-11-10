from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta
from threading import Barrier

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker

from app import achievements, crud, models, schemas
from app.config import settings
from app.database import Base
import seed


@pytest.fixture()
def definitions(db):
    achievements.seed_achievements(db)
    db.commit()


def add_history(db, child_id, tasks, start, days):
    for offset in range(days):
        for task in tasks:
            db.add(models.TaskCompletion(task_id=task.id, child_id=child_id, completion_date=start + timedelta(days=offset)))
    db.commit()


def names(unlocks):
    return {unlock.name for unlock in unlocks}


def test_toggle_api_returns_new_unlocks_and_keeps_them_after_undo(client, db, definitions, morning_task, evening_task):
    child = crud.create_child(db, schemas.ChildCreate(name="Alice"))
    payload = {"task_id": morning_task.id, "child_id": child.id, "completion_date": date.today().isoformat()}
    first = client.post("/api/completions/toggle", json=payload)
    assert first.status_code == 200
    assert first.json()["action"] == "created"
    unlocked = first.json()["newly_unlocked"]
    assert {row["name"] for row in unlocked} == {"First Chore", "First Full Routine"}
    assert all(set(row) == {"id", "name", "description", "icon", "unlocked_at"} for row in unlocked)
    assert client.post("/api/completions/toggle", json=payload).json()["newly_unlocked"] == []
    assert client.post("/api/completions/toggle", json=payload).json()["newly_unlocked"] == []
    assert len(db.scalars(select(models.ChildAchievement)).all()) == 2
    unscoped = client.post("/api/completions/toggle", json={"task_id": evening_task.id})
    assert unscoped.json()["newly_unlocked"] == []


@pytest.mark.parametrize("days,expected", [(6, set()), (7, {"7-Day Streak", "Perfect Week"}), (29, {"7-Day Streak", "Perfect Week"}), (30, {"7-Day Streak", "Perfect Week", "30-Day Streak"})])
def test_historical_thresholds_and_simultaneous_unlocks(db, definitions, morning_task, evening_task, days, expected):
    child = crud.create_child(db, schemas.ChildCreate(name="Alice"))
    add_history(db, child.id, [morning_task, evening_task], date.today() - timedelta(days=days), days)
    result = crud.toggle_completion(db, morning_task.id, date.today(), child.id)
    assert names(result.newly_unlocked) == {"First Chore", "First Full Routine"} | expected
    assert achievements.evaluate_achievements(db, child.id) == []
    db.rollback()


def test_gaps_future_dates_and_both_routines_are_required_for_perfect_week(db, definitions, morning_task, evening_task):
    child = crud.create_child(db, schemas.ChildCreate(name="Alice"))
    start = date.today() - timedelta(days=7)
    add_history(db, child.id, [morning_task, evening_task], start, 3)
    add_history(db, child.id, [morning_task, evening_task], start + timedelta(days=4), 3)
    add_history(db, child.id, [morning_task, evening_task], date.today() + timedelta(days=1), 30)
    assert names(achievements.evaluate_achievements(db, child.id)) == {"First Chore", "First Full Routine"}
    db.rollback()
    evening_task.is_active = False
    db.commit()
    add_history(db, child.id, [morning_task], start + timedelta(days=3), 1)
    assert names(achievements.evaluate_achievements(db, child.id)) == {"First Chore", "First Full Routine", "7-Day Streak"}


def test_eligibility_uses_current_assignments_and_active_tasks_and_is_child_scoped(db, definitions):
    alice = crud.create_child(db, schemas.ChildCreate(name="Alice"))
    bob = crud.create_child(db, schemas.ChildCreate(name="Bob"))
    global_task = crud.create_task(db, schemas.TaskCreate(name="Global", routine="morning"))
    bob_task = crud.create_task(db, schemas.TaskCreate(name="Bob only", routine="morning"))
    inactive = crud.create_task(db, schemas.TaskCreate(name="Hidden", routine="morning"))
    crud.set_task_assignments(db, bob_task.id, [bob.id])
    crud.update_task(db, inactive.id, schemas.TaskUpdate(is_active=False))
    add_history(db, alice.id, [global_task], date.today() - timedelta(days=7), 7)
    add_history(db, bob.id, [bob_task], date.today() - timedelta(days=7), 7)
    assert names(achievements.evaluate_achievements(db, alice.id)) == {"First Chore", "First Full Routine", "7-Day Streak"}
    assert names(achievements.evaluate_achievements(db, bob.id)) == {"First Chore"}
    db.rollback()
    crud.set_task_assignments(db, bob_task.id, [])
    assert names(achievements.evaluate_achievements(db, alice.id)) == {"First Chore"}


def test_no_eligible_tasks_cannot_complete_routine_or_streak(db, definitions, morning_task):
    child = crud.create_child(db, schemas.ChildCreate(name="Alice"))
    add_history(db, child.id, [morning_task], date.today() - timedelta(days=8), 8)
    crud.update_task(db, morning_task.id, schemas.TaskUpdate(is_active=False))
    assert names(achievements.evaluate_achievements(db, child.id)) == {"First Chore"}


def test_carrot_milestone_uses_lifetime_counter_after_recompletion(db, definitions, morning_task):
    child = crud.create_child(db, schemas.ChildCreate(name="Alice"))
    db.add(models.ChildBalance(child_id=child.id, current_balance=0, lifetime_earned=99, lifetime_redeemed=0))
    db.commit()
    first = crud.toggle_completion(db, morning_task.id, date.today(), child.id)
    assert "100 Carrots Earned" in names(first.newly_unlocked)
    crud.toggle_completion(db, morning_task.id, date.today(), child.id)
    again = crud.toggle_completion(db, morning_task.id, date.today(), child.id)
    assert "100 Carrots Earned" not in names(again.newly_unlocked)
    assert db.get(models.ChildBalance, child.id, populate_existing=True).lifetime_earned == 101


@pytest.mark.parametrize("undo", [False, True])
def test_unlock_failure_rolls_back_completion_and_balance(db, morning_task, undo):
    child = crud.create_child(db, schemas.ChildCreate(name="Alice"))
    if undo:
        crud.toggle_completion(db, morning_task.id, date.today(), child.id)
        add_history(db, child.id, [morning_task], date.today() - timedelta(days=1), 1)
    achievements.seed_achievements(db)
    db.commit()
    before = db.execute(text("SELECT * FROM child_balances")).all()
    db.execute(text("CREATE TRIGGER reject_achievement BEFORE INSERT ON child_achievements BEGIN SELECT RAISE(ABORT, 'unlock failed'); END"))
    db.commit()
    with pytest.raises(IntegrityError, match="unlock failed"):
        crud.toggle_completion(db, morning_task.id, date.today(), child.id)
    assert len(db.scalars(select(models.TaskCompletion)).all()) == 2 * int(undo)
    assert db.execute(text("SELECT * FROM child_balances")).all() == before
    assert db.scalars(select(models.ChildAchievement)).all() == []
    assert db.is_active


def test_concurrent_toggles_do_not_duplicate_unlocks(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'concurrent.db'}", connect_args={"timeout": 15})
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        db.add(models.Child(id=1, name="Alice"))
        db.add_all([models.Task(id=i, name=f"Task {i}", routine="morning") for i in (1, 2)])
        achievements.seed_achievements(db)
        db.commit()
    barrier = Barrier(2)
    def toggle(task_id):
        with Session(engine, autoflush=False) as db:
            barrier.wait(timeout=10)
            return crud.toggle_completion(db, task_id, date.today(), 1)
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(toggle, (1, 2)))
    returned = [item.id for result in results for item in result.newly_unlocked]
    with Session(engine) as db:
        rows = db.scalars(select(models.ChildAchievement)).all()
        assert len(returned) == len(set(returned)) == len(rows) == 2
    engine.dispose()


def test_migration_seed_and_child_cascade_on_existing_database(tmp_path, monkeypatch):
    url = f"sqlite:///{tmp_path / 'migration.db'}"
    monkeypatch.setattr(settings, "database_url", url)
    config = Config("alembic.ini")
    command.upgrade(config, "a7b8c9d0e1f2")
    engine = create_engine(url)
    with engine.begin() as connection:
        connection.execute(text("INSERT INTO tasks (id, name, routine, carrot_value, is_active, sort_order, created_at) VALUES (1, 'Existing', 'morning', 1, 1, 0, CURRENT_TIMESTAMP)"))
    command.upgrade(config, "head")
    monkeypatch.setattr(seed, "SessionLocal", sessionmaker(bind=engine))
    seed.seed()
    seed.seed()
    with Session(engine) as db:
        assert len(db.scalars(select(models.Achievement)).all()) == 6
        assert len(db.scalars(select(models.Task)).all()) == 1
        child = crud.create_child(db, schemas.ChildCreate(name="Alice"))
        child_id = child.id
        crud.toggle_completion(db, 1, date.today(), child_id)
        assert len(db.scalars(select(models.ChildAchievement)).all()) == 2
        crud.delete_child(db, child_id)
        assert db.scalars(select(models.ChildAchievement)).all() == []
    command.downgrade(config, "a7b8c9d0e1f2")
    with engine.connect() as connection:
        assert connection.execute(text("SELECT name FROM tasks")).scalar_one() == "Existing"
    command.upgrade(config, "head")
    engine.dispose()
