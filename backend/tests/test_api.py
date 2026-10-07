from __future__ import annotations

from datetime import date

import pytest

from app.models import Child, Task, TaskCompletion


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

    def test_update_task_distinguishes_omitted_and_null_estimate(self, client):
        create = client.post("/api/tasks", json={
            "name": "Timed task", "routine": "morning", "estimated_minutes": 30,
        })
        task_id = create.json()["id"]

        res = client.put(f"/api/tasks/{task_id}", json={"name": "Renamed task"})
        assert res.status_code == 200
        assert res.json()["estimated_minutes"] == 30

        res = client.put(f"/api/tasks/{task_id}", json={"estimated_minutes": None})
        assert res.status_code == 200
        assert res.json()["estimated_minutes"] is None
        assert res.json()["name"] == "Renamed task"

        tasks = client.get("/api/tasks").json()
        assert tasks[0]["estimated_minutes"] is None

    def test_update_nonexistent_task_returns_404(self, client):
        res = client.put("/api/tasks/9999", json={"name": "Ghost"})
        assert res.status_code == 404

    @pytest.mark.parametrize("field,value", [
        ("name", None), ("routine", None), ("carrot_value", None),
        ("is_active", None), ("sort_order", None),
    ])
    def test_update_task_rejects_explicit_null_for_required_fields(self, client, field, value):
        create = client.post("/api/tasks", json={"name": "Brush teeth", "routine": "morning", "carrot_value": 1})
        task_id = create.json()["id"]

        res = client.put(f"/api/tasks/{task_id}", json={field: value})
        assert res.status_code == 422

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

    def test_toggle_nonexistent_task_returns_404(self, client, db):
        res = client.post("/api/completions/toggle", json={"task_id": 9999, "completion_date": TODAY})
        assert res.status_code == 404
        assert res.json()["detail"] == "Task not found"
        assert db.query(TaskCompletion).count() == 0

    def test_list_completions_filtered_by_routine(self, client, morning_task, evening_task):
        client.post("/api/completions/toggle", json={"task_id": morning_task.id, "completion_date": TODAY})
        client.post("/api/completions/toggle", json={"task_id": evening_task.id, "completion_date": TODAY})

        res = client.get(f"/api/completions?date={TODAY}&routine=morning")
        assert len(res.json()) == 1
        assert res.json()[0]["task_id"] == morning_task.id


class TestSummaryAPI:
    @pytest.mark.parametrize("child_count", [0, 1, 2])
    @pytest.mark.parametrize("unassigned", [False, True])
    def test_household_daily_and_range_totals_agree(
        self, client, morning_task, evening_task, child_count, unassigned
    ):
        child_ids = [
            client.post("/api/children", json={"name": f"Child {i}"}).json()["id"]
            for i in range(child_count)
        ]
        for child_id in child_ids:
            for task in (morning_task, evening_task):
                response = client.post("/api/completions/toggle", json={
                    "task_id": task.id, "completion_date": TODAY, "child_id": child_id,
                })
                assert response.status_code == 200
        if unassigned:
            response = client.post("/api/completions/toggle", json={
                "task_id": morning_task.id, "completion_date": TODAY,
            })
            assert response.status_code == 200

        for child_id in [None, *child_ids]:
            params = {} if child_id is None else {"child_id": child_id}
            daily_response = client.get("/api/summary", params={"date": TODAY, **params})
            range_response = client.get("/api/summary/range", params={
                "start_date": TODAY, "end_date": TODAY, **params,
            })
            assert daily_response.status_code == range_response.status_code == 200
            daily = daily_response.json()
            day = range_response.json()["days"][0]
            capacity = max(child_count + int(unassigned), 1) if child_id is None else 1
            morning_count = child_count + int(unassigned) if child_id is None else 1
            evening_count = child_count if child_id is None else 1

            assert daily["morning"] == {
                "total_carrots": morning_task.carrot_value * capacity,
                "earned_carrots": morning_task.carrot_value * morning_count,
                "total_count": capacity,
                "completed_count": morning_count,
            }
            assert daily["evening"] == {
                "total_carrots": evening_task.carrot_value * capacity,
                "earned_carrots": evening_task.carrot_value * evening_count,
                "total_count": capacity,
                "completed_count": evening_count,
            }
            assert daily["total_carrots"] == day["total_carrots"] == 3 * capacity
            assert daily["earned_carrots"] == day["earned_carrots"] == morning_count + 2 * evening_count
            assert day["morning_earned_carrots"] == daily["morning"]["earned_carrots"]
            assert day["evening_earned_carrots"] == daily["evening"]["earned_carrots"]
            assert day["earned_carrots"] <= day["total_carrots"]

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

    def test_summary_reflects_completions_from_any_child(self, client, morning_task):
        child_id = client.post("/api/children", json={"name": "Alice"}).json()["id"]
        client.post("/api/completions/toggle", json={
            "task_id": morning_task.id, "completion_date": TODAY, "child_id": child_id,
        })

        res = client.get(f"/api/summary?date={TODAY}")
        data = res.json()
        assert data["morning"]["earned_carrots"] == morning_task.carrot_value
        assert data["morning"]["completed_count"] == 1

    def test_summary_child_id_scopes_to_that_child(self, client, morning_task):
        alice_id = client.post("/api/children", json={"name": "Alice"}).json()["id"]
        bob_id = client.post("/api/children", json={"name": "Bob"}).json()["id"]
        client.post("/api/completions/toggle", json={
            "task_id": morning_task.id, "completion_date": TODAY, "child_id": alice_id,
        })

        res = client.get(f"/api/summary?date={TODAY}&child_id={bob_id}")
        assert res.json()["morning"]["earned_carrots"] == 0

        res = client.get(f"/api/summary?date={TODAY}&child_id={alice_id}")
        assert res.json()["morning"]["earned_carrots"] == morning_task.carrot_value

    def test_health_endpoint(self, client):
        res = client.get("/health")
        assert res.status_code == 200
        assert res.json() == {"status": "ok"}


class TestSettingsAPI:
    def test_get_settings_returns_defaults(self, client):
        """Return a noon cutoff when no setting has been persisted."""
        res = client.get("/api/settings")
        assert res.status_code == 200
        assert res.json()["morning_cutoff_hour"] == 12

    def test_put_settings_updates_cutoff(self, client):
        """Accept a valid cutoff and return its updated value."""
        res = client.put("/api/settings", json={"morning_cutoff_hour": 10})
        assert res.status_code == 200
        assert res.json()["morning_cutoff_hour"] == 10

    def test_put_settings_rejects_out_of_range(self, client):
        """Reject cutoff hours outside the inclusive range from zero to 23."""
        assert client.put("/api/settings", json={"morning_cutoff_hour": 24}).status_code == 422
        assert client.put("/api/settings", json={"morning_cutoff_hour": -1}).status_code == 422

    def test_put_settings_partial_update_preserves_other_keys(self, client):
        """Preserve the stored cutoff when an update omits it."""
        client.put("/api/settings", json={"morning_cutoff_hour": 9})
        res = client.put("/api/settings", json={})
        assert res.json()["morning_cutoff_hour"] == 9


class TestStreaksAPI:
    def test_streaks_empty(self, client):
        res = client.get("/api/streaks")
        assert res.status_code == 200
        data = res.json()
        assert data["current_streak"] == 0
        assert data["longest_streak"] == 0
        assert data["last_completion_date"] is None

    def test_streaks_with_completion_today(self, client, morning_task):
        client.post("/api/completions/toggle", json={"task_id": morning_task.id, "completion_date": TODAY})
        res = client.get("/api/streaks")
        assert res.json()["current_streak"] == 1
        assert res.json()["last_completion_date"] == TODAY

    def test_streaks_routine_filter(self, client, morning_task, evening_task):
        client.post("/api/completions/toggle", json={"task_id": morning_task.id, "completion_date": TODAY})
        res = client.get("/api/streaks?routine=evening")
        assert res.json()["current_streak"] == 0
        res = client.get("/api/streaks?routine=morning")
        assert res.json()["current_streak"] == 1


class TestChildrenAPI:
    def test_list_children_empty(self, client):
        res = client.get("/api/children")
        assert res.status_code == 200
        assert res.json() == []

    def test_create_child(self, client):
        res = client.post("/api/children", json={"name": "Alice"})
        assert res.status_code == 201
        data = res.json()
        assert data["name"] == "Alice"
        assert data["avatar"] == "🐰"
        assert data["color"] == "#F97316"
        assert "id" in data

    def test_create_child_with_custom_avatar_and_color(self, client):
        res = client.post("/api/children", json={"name": "Bob", "avatar": "🐻", "color": "#7DD3FC"})
        assert res.status_code == 201
        data = res.json()
        assert data["avatar"] == "🐻"
        assert data["color"] == "#7DD3FC"

    def test_list_children_returns_all(self, client):
        client.post("/api/children", json={"name": "Alice"})
        client.post("/api/children", json={"name": "Bob"})
        res = client.get("/api/children")
        assert len(res.json()) == 2

    def test_update_child_name(self, client):
        child_id = client.post("/api/children", json={"name": "Alice"}).json()["id"]
        res = client.put(f"/api/children/{child_id}", json={"name": "Alicia"})
        assert res.status_code == 200
        assert res.json()["name"] == "Alicia"
        assert res.json()["avatar"] == "🐰"

    def test_update_nonexistent_child_returns_404(self, client):
        res = client.put("/api/children/9999", json={"name": "Ghost"})
        assert res.status_code == 404

    def test_delete_child(self, client):
        child_id = client.post("/api/children", json={"name": "Alice"}).json()["id"]
        res = client.delete(f"/api/children/{child_id}")
        assert res.status_code == 204
        assert client.get("/api/children").json() == []

    def test_delete_nonexistent_child_returns_404(self, client):
        res = client.delete("/api/children/9999")
        assert res.status_code == 404

    def test_toggle_completion_with_child_id(self, client, morning_task):
        child_id = client.post("/api/children", json={"name": "Alice"}).json()["id"]
        res = client.post("/api/completions/toggle", json={
            "task_id": morning_task.id,
            "completion_date": TODAY,
            "child_id": child_id,
        })
        assert res.status_code == 200
        assert res.json()["action"] == "created"
        assert res.json()["completion"]["child_id"] == child_id

    def test_two_children_can_complete_same_task_on_same_day(self, client, morning_task):
        alice_id = client.post("/api/children", json={"name": "Alice"}).json()["id"]
        bob_id = client.post("/api/children", json={"name": "Bob"}).json()["id"]

        res_a = client.post("/api/completions/toggle", json={
            "task_id": morning_task.id, "completion_date": TODAY, "child_id": alice_id,
        })
        res_b = client.post("/api/completions/toggle", json={
            "task_id": morning_task.id, "completion_date": TODAY, "child_id": bob_id,
        })
        assert res_a.json()["action"] == "created"
        assert res_b.json()["action"] == "created"

    def test_list_completions_filtered_by_child(self, client, morning_task):
        alice_id = client.post("/api/children", json={"name": "Alice"}).json()["id"]
        bob_id = client.post("/api/children", json={"name": "Bob"}).json()["id"]
        client.post("/api/completions/toggle", json={
            "task_id": morning_task.id, "completion_date": TODAY, "child_id": alice_id,
        })
        client.post("/api/completions/toggle", json={
            "task_id": morning_task.id, "completion_date": TODAY, "child_id": bob_id,
        })

        res = client.get(f"/api/completions?date={TODAY}&child_id={alice_id}")
        assert len(res.json()) == 1
        assert res.json()[0]["child_id"] == alice_id

    def test_delete_child_cascades_completions(self, client, morning_task):
        child_id = client.post("/api/children", json={"name": "Alice"}).json()["id"]
        client.post("/api/completions/toggle", json={
            "task_id": morning_task.id, "completion_date": TODAY, "child_id": child_id,
        })
        client.delete(f"/api/children/{child_id}")
        res = client.get(f"/api/completions?date={TODAY}&child_id={child_id}")
        assert res.json() == []


class TestRangeSummaryAPI:
    @pytest.mark.parametrize("start,end", [
        ("2026-09-02", "2026-09-01"),
        ("2024-01-01", "2025-01-01"),  # 367 inclusive days
        ("0001-01-01", "9999-12-31"),
    ])
    def test_invalid_ranges_rejected_before_crud(self, client, monkeypatch, start, end):
        from unittest.mock import Mock
        from app import crud

        query = Mock()
        monkeypatch.setattr(crud, "get_range_summary", query)
        response = client.get("/api/summary/range", params={"start_date": start, "end_date": end})
        assert response.status_code == 422
        query.assert_not_called()

    @pytest.mark.parametrize("start,end,count", [
        ("2024-01-01", "2024-12-31", 366),
        ("9999-12-31", "9999-12-31", 1),
    ])
    def test_boundary_ranges_succeed(self, client, start, end, count):
        response = client.get("/api/summary/range", params={"start_date": start, "end_date": end})
        assert response.status_code == 200
        days = response.json()["days"]
        assert len(days) == count
        assert days[0]["date"] == start
        assert days[-1]["date"] == end
        assert days[-1]["morning_earned_carrots"] == 0
        assert days[-1]["evening_earned_carrots"] == 0

    def test_household_total_scales_with_number_of_children(self, client, morning_task):
        alice_id = client.post("/api/children", json={"name": "Alice"}).json()["id"]
        bob_id = client.post("/api/children", json={"name": "Bob"}).json()["id"]
        client.post("/api/completions/toggle", json={
            "task_id": morning_task.id, "completion_date": TODAY, "child_id": alice_id,
        })
        client.post("/api/completions/toggle", json={
            "task_id": morning_task.id, "completion_date": TODAY, "child_id": bob_id,
        })

        res = client.get("/api/summary/range", params={"start_date": TODAY, "end_date": TODAY})
        day = res.json()["days"][0]
        assert day["total_carrots"] == morning_task.carrot_value * 2
        assert day["earned_carrots"] == morning_task.carrot_value * 2
        assert day["earned_carrots"] <= day["total_carrots"]

    def test_single_child_total_unaffected_by_other_children(self, client, morning_task):
        alice_id = client.post("/api/children", json={"name": "Alice"}).json()["id"]
        client.post("/api/children", json={"name": "Bob"})
        client.post("/api/completions/toggle", json={
            "task_id": morning_task.id, "completion_date": TODAY, "child_id": alice_id,
        })

        res = client.get("/api/summary/range", params={
            "start_date": TODAY, "end_date": TODAY, "child_id": alice_id,
        })
        day = res.json()["days"][0]
        assert day["total_carrots"] == morning_task.carrot_value
        assert day["earned_carrots"] == morning_task.carrot_value


class TestTaskAssignmentsAPI:
    def _make_task(self, client):
        return client.post("/api/tasks", json={"name": "T", "routine": "morning", "carrot_value": 1}).json()

    def _make_child(self, client, name="Alice"):
        return client.post("/api/children", json={"name": name, "avatar": "🐰", "color": "#F97316"}).json()

    def test_task_starts_with_no_assignments(self, client):
        task = self._make_task(client)
        assert task["assigned_child_ids"] == []

    def test_set_assignments_returns_updated_task(self, client):
        task = self._make_task(client)
        child = self._make_child(client)
        res = client.put(f"/api/tasks/{task['id']}/assignments", json={"child_ids": [child["id"]]})
        assert res.status_code == 200
        assert res.json()["assigned_child_ids"] == [child["id"]]

    def test_list_tasks_includes_assigned_child_ids(self, client):
        task = self._make_task(client)
        child = self._make_child(client)
        client.put(f"/api/tasks/{task['id']}/assignments", json={"child_ids": [child["id"]]})
        tasks = client.get("/api/tasks").json()
        assert tasks[0]["assigned_child_ids"] == [child["id"]]

    def test_duplicate_child_ids_replace_assignments_once(self, client):
        task = self._make_task(client)
        alice = self._make_child(client, "Alice")
        bob = self._make_child(client, "Bob")
        carol = self._make_child(client, "Carol")
        url = f"/api/tasks/{task['id']}/assignments"
        assert client.put(url, json={"child_ids": [alice["id"]]}).status_code == 200

        res = client.put(url, json={"child_ids": [bob["id"], carol["id"], bob["id"]]})

        assert res.status_code == 200
        assert sorted(res.json()["assigned_child_ids"]) == [bob["id"], carol["id"]]
        tasks = client.get("/api/tasks").json()
        assert sorted(tasks[0]["assigned_child_ids"]) == [bob["id"], carol["id"]]

    def test_clear_assignments_restores_global(self, client):
        task = self._make_task(client)
        child = self._make_child(client)
        client.put(f"/api/tasks/{task['id']}/assignments", json={"child_ids": [child["id"]]})
        res = client.put(f"/api/tasks/{task['id']}/assignments", json={"child_ids": []})
        assert res.json()["assigned_child_ids"] == []

    def test_child_id_filter_returns_global_tasks(self, client):
        task = self._make_task(client)
        child = self._make_child(client)
        tasks = client.get(f"/api/tasks?child_id={child['id']}").json()
        assert any(t["id"] == task["id"] for t in tasks)

    def test_child_id_filter_excludes_tasks_assigned_to_other_child(self, client):
        task = self._make_task(client)
        alice = self._make_child(client, "Alice")
        bob = self._make_child(client, "Bob")
        client.put(f"/api/tasks/{task['id']}/assignments", json={"child_ids": [alice["id"]]})
        tasks = client.get(f"/api/tasks?child_id={bob['id']}").json()
        assert not any(t["id"] == task["id"] for t in tasks)

    def test_child_id_filter_includes_tasks_assigned_to_that_child(self, client):
        task = self._make_task(client)
        alice = self._make_child(client, "Alice")
        client.put(f"/api/tasks/{task['id']}/assignments", json={"child_ids": [alice["id"]]})
        tasks = client.get(f"/api/tasks?child_id={alice['id']}").json()
        assert any(t["id"] == task["id"] for t in tasks)

    def test_assignments_deleted_when_task_deleted(self, client):
        task = self._make_task(client)
        child = self._make_child(client)
        client.put(f"/api/tasks/{task['id']}/assignments", json={"child_ids": [child["id"]]})
        client.delete(f"/api/tasks/{task['id']}")
        tasks = client.get("/api/tasks?active_only=false").json()
        assert not any(t["id"] == task["id"] for t in tasks)

    def test_set_assignments_unknown_task_returns_404(self, client):
        res = client.put("/api/tasks/9999/assignments", json={"child_ids": []})
        assert res.status_code == 404
