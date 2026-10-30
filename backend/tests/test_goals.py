from __future__ import annotations

from datetime import date, timedelta

import pytest

from app import crud, schemas
from app.models import Goal

TODAY = date.today()


def _child(db, name="Alice"):
    return crud.create_child(db, schemas.ChildCreate(name=name))


class TestGoalsAPI:
    def test_create_requires_existing_child(self, client):
        res = client.post("/api/goals", json={"child_id": 9999, "name": "Lego set", "target_dollars": 45})
        assert res.status_code == 404

    def test_full_crud(self, client, db):
        child = _child(db)
        res = client.post("/api/goals", json={"child_id": child.id, "name": "Lego set", "target_dollars": 45})
        assert res.status_code == 201
        goal = res.json()
        assert goal["name"] == "Lego set"
        assert goal["target_dollars"] == 45
        assert goal["earned_dollars"] == 0
        assert goal["progress_percent"] == 0
        assert goal["completed_at"] is None

        res = client.put(f"/api/goals/{goal['id']}", json={"target_dollars": 50})
        assert res.status_code == 200
        assert res.json()["target_dollars"] == 50
        assert res.json()["name"] == "Lego set"

        res = client.post(f"/api/goals/{goal['id']}/complete")
        assert res.status_code == 200
        assert res.json()["completed_at"] is not None

        assert client.delete(f"/api/goals/{goal['id']}").status_code == 204
        assert client.delete(f"/api/goals/{goal['id']}").status_code == 404

    def test_update_complete_delete_missing_goal_404(self, client):
        assert client.put("/api/goals/999", json={"name": "x"}).status_code == 404
        assert client.post("/api/goals/999/complete").status_code == 404
        assert client.delete("/api/goals/999").status_code == 404

    @pytest.mark.parametrize("target", [0, -10])
    def test_create_rejects_non_positive_target(self, client, db, target):
        child = _child(db)
        res = client.post("/api/goals", json={"child_id": child.id, "name": "x", "target_dollars": target})
        assert res.status_code == 422

    @pytest.mark.parametrize("name", ["", "   "])
    def test_create_and_update_reject_blank_name(self, client, db, name):
        child = _child(db)
        assert client.post("/api/goals", json={"child_id": child.id, "name": name, "target_dollars": 10}).status_code == 422
        goal = client.post("/api/goals", json={"child_id": child.id, "name": "ok", "target_dollars": 10}).json()
        assert client.put(f"/api/goals/{goal['id']}", json={"name": name}).status_code == 422

    @pytest.mark.parametrize("body", [{"target_dollars": 0}, {"target_dollars": None}, {"name": None}])
    def test_update_rejects_invalid_values(self, client, db, body):
        child = _child(db)
        goal = client.post("/api/goals", json={"child_id": child.id, "name": "ok", "target_dollars": 10}).json()
        assert client.put(f"/api/goals/{goal['id']}", json=body).status_code == 422

    def test_list_active_first_then_completed(self, client, db):
        child = _child(db)
        g1 = client.post("/api/goals", json={"child_id": child.id, "name": "First", "target_dollars": 10}).json()
        g2 = client.post("/api/goals", json={"child_id": child.id, "name": "Second", "target_dollars": 10}).json()
        client.post(f"/api/goals/{g1['id']}/complete")

        names = [g["name"] for g in client.get(f"/api/goals?child_id={child.id}").json()]
        assert names == ["Second", "First"]

    def test_list_scoped_to_child(self, client, db):
        alice = _child(db, "Alice")
        bob = _child(db, "Bob")
        client.post("/api/goals", json={"child_id": alice.id, "name": "A's goal", "target_dollars": 10})
        client.post("/api/goals", json={"child_id": bob.id, "name": "B's goal", "target_dollars": 10})

        assert [g["name"] for g in client.get(f"/api/goals?child_id={alice.id}").json()] == ["A's goal"]

    def test_delete_child_cascades_goals(self, client, db):
        child = _child(db)
        client.post("/api/goals", json={"child_id": child.id, "name": "Gone soon", "target_dollars": 10})

        client.delete(f"/api/children/{child.id}")

        assert db.query(Goal).count() == 0


class TestGoalProgress:
    def test_progress_counts_only_completions_since_creation(self, client, db, morning_task):
        client.put("/api/settings", json={"carrots_per_dollar": 1})
        child = _child(db)
        crud.toggle_completion(db, morning_task.id, TODAY - timedelta(days=5), child_id=child.id)
        goal = client.post("/api/goals", json={"child_id": child.id, "name": "Lego set", "target_dollars": 2}).json()
        crud.toggle_completion(db, morning_task.id, TODAY, child_id=child.id)

        res = client.get(f"/api/goals?child_id={child.id}").json()[0]
        assert res["earned_dollars"] == 1.0
        assert res["progress_percent"] == 50.0

    def test_progress_caps_at_100_percent(self, client, db, morning_task, evening_task):
        client.put("/api/settings", json={"carrots_per_dollar": 1})
        child = _child(db)
        goal = client.post("/api/goals", json={"child_id": child.id, "name": "Cheap thing", "target_dollars": 1}).json()
        crud.toggle_completion(db, morning_task.id, TODAY, child_id=child.id)
        crud.toggle_completion(db, evening_task.id, TODAY, child_id=child.id)

        res = client.get(f"/api/goals?child_id={child.id}").json()[0]
        assert res["earned_dollars"] == 3.0
        assert res["progress_percent"] == 100.0
