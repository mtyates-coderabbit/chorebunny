from __future__ import annotations

from datetime import date

import pytest

from app.models import Task, TaskCompletion


TODAY = date.today().isoformat()


class TestTasksAPI:
    def test_list_tasks_empty(self, client):
        res = client.get("/api/tasks")
        assert res.status_code == 200
        assert res.json() == []

    def test_create_task(self, client):
        res = client.post("/api/tasks", json={
            "name": "Brush teeth",
            "routine": "morning",
            "carrot_value": 1,
        })
        assert res.status_code == 201
        data = res.json()
        assert data["name"] == "Brush teeth"
        assert data["routine"] == "morning"
        assert data["is_active"] is True

    def test_create_task_invalid_routine(self, client):
        res = client.post("/api/tasks", json={
            "name": "Bad task",
            "routine": "afternoon",
            "carrot_value": 1,
        })
        assert res.status_code == 422

    def test_create_task_carrot_value_out_of_range(self, client):
        res = client.post("/api/tasks", json={
            "name": "Too many carrots",
            "routine": "morning",
            "carrot_value": 6,
        })
        assert res.status_code == 422

    def test_list_tasks_filters_by_routine(self, client):
        client.post("/api/tasks", json={"name": "Morning task", "routine": "morning", "carrot_value": 1})
        client.post("/api/tasks", json={"name": "Evening task", "routine": "evening", "carrot_value": 1})

        res = client.get("/api/tasks?routine=morning")
        assert res.status_code == 200
        tasks = res.json()
        assert len(tasks) == 1
        assert tasks[0]["name"] == "Morning task"

    def test_update_task(self, client):
        create = client.post("/api/tasks", json={"name": "Old name", "routine": "morning", "carrot_value": 1})
        task_id = create.json()["id"]

        res = client.put(f"/api/tasks/{task_id}", json={"name": "New name", "carrot_value": 3})
        assert res.status_code == 200
        assert res.json()["name"] == "New name"
        assert res.json()["carrot_value"] == 3

    def test_update_nonexistent_task_returns_404(self, client):
        res = client.put("/api/tasks/9999", json={"name": "Ghost"})
        assert res.status_code == 404

    def test_delete_task(self, client):
        create = client.post("/api/tasks", json={"name": "Doomed", "routine": "morning", "carrot_value": 1})
        task_id = create.json()["id"]

        res = client.delete(f"/api/tasks/{task_id}")
        assert res.status_code == 204

        res = client.get("/api/tasks")
        assert all(t["id"] != task_id for t in res.json())

    def test_delete_nonexistent_task_returns_404(self, client):
        res = client.delete("/api/tasks/9999")
        assert res.status_code == 404


class TestCompletionsAPI:
    def test_toggle_creates_completion(self, client, morning_task):
        res = client.post("/api/completions/toggle", json={
            "task_id": morning_task.id,
            "completion_date": TODAY,
        })
        assert res.status_code == 200
        assert res.json()["action"] == "created"
        assert res.json()["completion"]["task_id"] == morning_task.id

    def test_toggle_twice_deletes_completion(self, client, morning_task):
        client.post("/api/completions/toggle", json={"task_id": morning_task.id, "completion_date": TODAY})
        res = client.post("/api/completions/toggle", json={"task_id": morning_task.id, "completion_date": TODAY})

        assert res.json()["action"] == "deleted"
        assert res.json()["completion"] is None

    def test_list_completions_for_date(self, client, morning_task, evening_task):
        client.post("/api/completions/toggle", json={"task_id": morning_task.id, "completion_date": TODAY})

        res = client.get(f"/api/completions?date={TODAY}")
        assert res.status_code == 200
        assert len(res.json()) == 1
        assert res.json()[0]["task_id"] == morning_task.id

    def test_list_completions_filtered_by_routine(self, client, morning_task, evening_task):
        client.post("/api/completions/toggle", json={"task_id": morning_task.id, "completion_date": TODAY})
        client.post("/api/completions/toggle", json={"task_id": evening_task.id, "completion_date": TODAY})

        res = client.get(f"/api/completions?date={TODAY}&routine=morning")
        assert len(res.json()) == 1
        assert res.json()[0]["task_id"] == morning_task.id


class TestSummaryAPI:
    def test_summary_all_zero_before_completions(self, client, morning_task, evening_task):
        res = client.get(f"/api/summary?date={TODAY}")
        assert res.status_code == 200
        data = res.json()
        assert data["earned_carrots"] == 0
        assert data["morning"]["total_carrots"] == morning_task.carrot_value
        assert data["evening"]["total_carrots"] == evening_task.carrot_value

    def test_summary_reflects_completion(self, client, morning_task):
        client.post("/api/completions/toggle", json={"task_id": morning_task.id, "completion_date": TODAY})

        res = client.get(f"/api/summary?date={TODAY}")
        data = res.json()
        assert data["morning"]["earned_carrots"] == morning_task.carrot_value
        assert data["morning"]["completed_count"] == 1

    def test_health_endpoint(self, client):
        res = client.get("/health")
        assert res.status_code == 200
        assert res.json() == {"status": "ok"}
