from concurrent.futures import ThreadPoolExecutor
from datetime import date
from threading import Barrier

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, event, select, text
from sqlalchemy.exc import IntegrityError, OperationalError
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.config import settings
from app.database import Base


TODAY = date(2026, 10, 26)


@pytest.mark.parametrize("new_value", [1, 5])
def test_undo_uses_stored_award_after_task_edit(db, new_value):
    child = crud.create_child(db, schemas.ChildCreate(name="Alice"))
    task = crud.create_task(db, schemas.TaskCreate(name="Chore", routine="morning", carrot_value=3))
    crud.toggle_completion(db, task.id, TODAY, child.id)
    completion = db.scalar(select(models.TaskCompletion))
    assert completion.awarded_carrots == 3
    crud.update_task(db, task.id, schemas.TaskUpdate(carrot_value=new_value))
    crud.toggle_completion(db, task.id, TODAY, child.id)
    balance = crud.get_balance(db, child.id)
    assert (balance.current_balance, balance.lifetime_earned) == (0, 3)


@pytest.mark.parametrize("undo", [False, True])
@pytest.mark.parametrize("operation", ["INSERT", "UPDATE"])
def test_balance_failure_rolls_back_completion_and_balance(db, morning_task, undo, operation):
    child_id = crud.create_child(db, schemas.ChildCreate(name="Alice")).id
    task_id = morning_task.id
    if undo:
        crud.toggle_completion(db, task_id, TODAY, child_id)
    if operation == "INSERT":
        db.execute(text("DELETE FROM child_balances"))
        db.commit()
    before = db.execute(text("SELECT * FROM child_balances")).all()
    db.execute(text(f"""
        CREATE TRIGGER reject_balance BEFORE {operation} ON child_balances
        BEGIN SELECT RAISE(ABORT, 'balance failed'); END
    """))
    db.commit()
    with pytest.raises(IntegrityError, match="balance failed"):
        crud.toggle_completion(db, task_id, TODAY, child_id)
    assert len(db.scalars(select(models.TaskCompletion)).all()) == int(undo)
    assert db.execute(text("SELECT * FROM child_balances")).all() == before
    assert db.is_active


@pytest.mark.parametrize("undo", [False, True])
def test_non_integrity_database_failure_rolls_back(db, morning_task, undo):
    child_id = crud.create_child(db, schemas.ChildCreate(name="Alice")).id
    task_id = morning_task.id
    if undo:
        crud.toggle_completion(db, task_id, TODAY, child_id)
    db.execute(text("DROP TABLE child_balances"))
    db.commit()
    with pytest.raises(OperationalError):
        crud.toggle_completion(db, task_id, TODAY, child_id)
    assert len(db.scalars(select(models.TaskCompletion)).all()) == int(undo)
    assert db.is_active


@pytest.fixture()
def concurrent_engine(tmp_path):
    """Provide independent SQLite connections for real overlapping transactions."""
    engine = create_engine(f"sqlite:///{tmp_path / 'concurrent.db'}", connect_args={"timeout": 15})
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        db.add(models.Child(id=1, name="Alice"))
        db.add_all(models.Task(id=i, name=f"Chore {i}", routine="morning", carrot_value=3) for i in range(1, 7))
        db.commit()
    yield engine
    engine.dispose()


def test_concurrent_balance_gets_and_completions_share_row(concurrent_engine):
    barrier = Barrier(8)

    def request(index):
        with Session(concurrent_engine, autoflush=False) as db:
            barrier.wait(timeout=10)
            if index < 2:
                return crud.get_balance(db, 1)
            return crud.toggle_completion(db, index - 1, TODAY, 1)

    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(request, range(8)))
    assert all(result is not None for result in results)
    with Session(concurrent_engine) as db:
        balances = db.scalars(select(models.ChildBalance)).all()
        assert len(balances) == 1
        assert (balances[0].current_balance, balances[0].lifetime_earned) == (18, 18)
        assert len(db.scalars(select(models.TaskCompletion)).all()) == 6


@pytest.mark.parametrize("operations, expected", [
    (("credit", "credit"), (16, 16)),
    (("debit", "debit"), (4, 10)),
    (("credit", "debit"), (10, 13)),
])
def test_concurrent_adjustments_ignore_stale_balance(concurrent_engine, operations, expected):
    with Session(concurrent_engine) as db:
        db.add(models.ChildBalance(child_id=1, current_balance=10, lifetime_earned=10))
        db.commit()
    barrier = Barrier(2)

    def adjust(operation):
        with Session(concurrent_engine, autoflush=False) as db:
            stale_balance = db.get(models.ChildBalance, 1)
            assert stale_balance.current_balance == 10
            barrier.wait(timeout=10)
            if operation == "credit":
                crud._credit_balance(db, 1, 3)
            else:
                crud._debit_balance(db, 1, 3)
            db.commit()

    with ThreadPoolExecutor(max_workers=2) as pool:
        list(pool.map(adjust, operations))
    with Session(concurrent_engine) as db:
        balance = db.get(models.ChildBalance, 1)
        assert (balance.current_balance, balance.lifetime_earned) == expected


@pytest.mark.parametrize("undo", [False, True])
def test_same_completion_race_adjusts_balance_once(concurrent_engine, undo):
    if undo:
        with Session(concurrent_engine) as db:
            crud.toggle_completion(db, 1, TODAY, 1)
    barrier = Barrier(2)

    def toggle(_):
        with Session(concurrent_engine, autoflush=False) as db:
            def on_execute(state):
                if state.is_select and state.statement.column_descriptions[0].get("entity") is models.TaskCompletion:
                    result = state.invoke_statement()
                    # Consume the SELECT before either request changes the completion.
                    frozen = result.freeze()
                    barrier.wait(timeout=10)
                    return frozen()
                return state.invoke_statement()

            task = db.get(models.Task, 1)
            child = db.get(models.Child, 1)
            event.listen(db, "do_orm_execute", on_execute, retval=True, once=True)
            return crud.toggle_completion(db, task.id, TODAY, child.id)

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(toggle, range(2)))
    assert [result.action for result in results] == ["deleted" if undo else "created"] * 2
    with Session(concurrent_engine) as db:
        balance = db.get(models.ChildBalance, 1)
        assert (balance.current_balance, balance.lifetime_earned) == (0 if undo else 3, 3)
        assert len(db.scalars(select(models.TaskCompletion)).all()) == (0 if undo else 1)


def test_award_migration_backfills_and_preserves_balance(tmp_path, monkeypatch):
    url = f"sqlite:///{tmp_path / 'migration.db'}"
    monkeypatch.setattr(settings, "database_url", url)
    config = Config("alembic.ini")
    command.upgrade(config, "e5f6a7b8c9d0")
    engine = create_engine(url)
    with engine.begin() as connection:
        connection.exec_driver_sql("INSERT INTO children (id, name) VALUES (1, 'Alice')")
        connection.exec_driver_sql("""
            INSERT INTO tasks (id, name, routine, carrot_value, is_active, sort_order, created_at)
            VALUES (1, 'Chore', 'morning', 3, 1, 0, CURRENT_TIMESTAMP)
        """)
        connection.exec_driver_sql("""
            INSERT INTO task_completions (task_id, child_id, completion_date, completed_at)
            VALUES (1, 1, '2026-10-26', CURRENT_TIMESTAMP)
        """)
        connection.exec_driver_sql("INSERT INTO child_balances VALUES (1, 8, 2, 6)")
    command.upgrade(config, "head")
    with Session(engine) as db:
        assert db.scalar(select(models.TaskCompletion)).awarded_carrots == 3
        crud.update_task(db, 1, schemas.TaskUpdate(carrot_value=5))
        crud.toggle_completion(db, 1, TODAY, 1)
        balance = db.get(models.ChildBalance, 1)
        assert (balance.current_balance, balance.lifetime_earned, balance.lifetime_redeemed) == (3, 8, 2)
    command.downgrade(config, "e5f6a7b8c9d0")
    command.upgrade(config, "head")
    engine.dispose()
