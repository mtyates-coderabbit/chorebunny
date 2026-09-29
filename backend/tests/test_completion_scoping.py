from datetime import date, timedelta

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, event, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import crud, schemas
from app.config import settings
from app.models import Child, Task, TaskCompletion


TODAY = date(2026, 9, 26)


def test_completion_lists_and_summary_use_child_scope(client, db, morning_task, evening_task):
    child = crud.create_child(db, schemas.ChildCreate(name="Alice"))
    child_completion = crud.toggle_completion(db, morning_task.id, TODAY, child.id).completion
    assert client.get("/api/completions", params={"date": TODAY}).json() == []
    assert client.get("/api/summary", params={"date": TODAY}).json()["earned_carrots"] == 0

    unscoped = crud.toggle_completion(db, evening_task.id, TODAY).completion
    response = client.get("/api/completions", params={"date": TODAY})
    assert response.status_code == 200
    assert [row["id"] for row in response.json()] == [unscoped.id]
    response = client.get("/api/completions", params={"date": TODAY, "routine": "morning"})
    assert response.json() == []
    response = client.get("/api/completions", params={"date": TODAY, "child_id": child.id})
    assert [row["id"] for row in response.json()] == [child_completion.id]


@pytest.mark.parametrize("child_id", [0, 9999])
def test_missing_child_returns_404_without_inserting(client, db, morning_task, child_id):
    assert crud.toggle_completion(db, morning_task.id, TODAY, child_id) is None
    response = client.post("/api/completions/toggle", json={
        "task_id": morning_task.id, "completion_date": TODAY.isoformat(), "child_id": child_id,
    })
    assert response.status_code == 404
    assert response.json() == {"detail": "Child not found"}
    assert db.scalars(select(TaskCompletion)).all() == []


@pytest.mark.parametrize("field", ["name", "avatar", "color"])
def test_child_update_rejects_null_and_preserves_omitted_fields(client, field):
    child = client.post("/api/children", json={"name": "Alice"}).json()
    response = client.put(f"/api/children/{child['id']}", json={field: None})
    assert response.status_code == 422
    assert response.json()["detail"][0]["loc"] == ["body", field]
    response = client.put(f"/api/children/{child['id']}", json={})
    assert response.status_code == 200
    assert response.json() == child
    response = client.put(f"/api/children/{child['id']}", json={field: "updated"})
    assert response.status_code == 200
    assert response.json() == {**child, field: "updated"}


@pytest.mark.parametrize("scoped", [False, True])
def test_unique_race_returns_existing_completion(db, db_engine, morning_task, scoped):
    child_id = crud.create_child(db, schemas.ChildCreate(name="Alice")).id if scoped else None

    def insert_competing_completion(session):
        with Session(db_engine) as competing:
            competing.add(TaskCompletion(task_id=morning_task.id, completion_date=TODAY, child_id=child_id))
            competing.commit()

    event.listen(db, "before_commit", insert_competing_completion, once=True)
    result = crud.toggle_completion(db, morning_task.id, TODAY, child_id)
    assert result.action == "created"
    assert result.completion is not None
    assert result.completion.child_id == child_id
    assert len(db.scalars(select(TaskCompletion)).all()) == 1


def test_unrelated_integrity_error_is_not_reported_as_created(db):
    with pytest.raises(IntegrityError):
        crud.toggle_completion(db, None, TODAY)
    assert db.scalars(select(TaskCompletion)).all() == []


@pytest.fixture(params=["metadata", "migration"])
def completion_engine(request, db_engine, tmp_path, monkeypatch):
    if request.param == "metadata":
        yield db_engine
        return

    database_url = f"sqlite:///{tmp_path / 'migration.db'}"
    monkeypatch.setattr(settings, "database_url", database_url)
    config = Config("alembic.ini")
    command.upgrade(config, "a1b2c3d4e5f6")
    engine = create_engine(database_url)
    with engine.begin() as connection:
        connection.exec_driver_sql("""
            INSERT INTO tasks (id, name, routine, carrot_value, is_active, sort_order, created_at)
            VALUES (1, 'Legacy task', 'morning', 1, 1, 0, CURRENT_TIMESTAMP)
        """)
        connection.exec_driver_sql("""
            INSERT INTO task_completions (task_id, completion_date, completed_at)
            VALUES (1, '2026-09-25', CURRENT_TIMESTAMP)
        """)
    command.upgrade(config, "head")
    yield engine
    command.downgrade(config, "a1b2c3d4e5f6")
    with engine.connect() as connection:
        assert connection.exec_driver_sql(
            "SELECT COUNT(*) FROM task_completions WHERE task_id = 1 AND completion_date = '2026-09-25'"
        ).scalar_one() == 1
    command.upgrade(config, "head")
    engine.dispose()


def test_database_enforces_completion_uniqueness_per_scope(completion_engine):
    with Session(completion_engine) as db:
        task = Task(name="Test task", routine="morning")
        children = [Child(name="Alice"), Child(name="Bob")]
        db.add_all([task, *children])
        db.commit()
        task_id = task.id
        child_ids = [None, *(child.id for child in children)]
        for child_id in child_ids:
            db.add(TaskCompletion(task_id=task_id, completion_date=TODAY, child_id=child_id))
            db.commit()
            db.add(TaskCompletion(task_id=task_id, completion_date=TODAY, child_id=child_id))
            with pytest.raises(IntegrityError):
                db.commit()
            db.rollback()
            db.add(TaskCompletion(task_id=task_id, completion_date=TODAY + timedelta(days=1), child_id=child_id))
            db.commit()
        assert len(db.scalars(select(TaskCompletion).where(TaskCompletion.task_id == task_id)).all()) == 6
