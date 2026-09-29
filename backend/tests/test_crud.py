from __future__ import annotations

from datetime import date

import pytest

from app import crud, schemas
from app.models import Child, Task


TODAY = date.today()


class TestToggleCompletion:
    def test_creates_completion_when_none_exists(self, db, morning_task):
        result = crud.toggle_completion(db, morning_task.id, TODAY)

        assert result.action == "created"
        assert result.completion is not None
        assert result.completion.task_id == morning_task.id
        assert result.completion.completion_date == TODAY

    def test_deletes_completion_when_already_exists(self, db, morning_task):
        crud.toggle_completion(db, morning_task.id, TODAY)
        result = crud.toggle_completion(db, morning_task.id, TODAY)

        assert result.action == "deleted"
        assert result.completion is None

    def test_toggle_twice_leaves_no_completion(self, db, morning_task):
        crud.toggle_completion(db, morning_task.id, TODAY)
        crud.toggle_completion(db, morning_task.id, TODAY)

        completions = crud.get_completions(db, completion_date=TODAY)
        assert len(completions) == 0

    def test_completions_are_per_day(self, db, morning_task):
        yesterday = date(TODAY.year, TODAY.month, TODAY.day - 1) if TODAY.day > 1 else date(TODAY.year, TODAY.month - 1, 28)
        crud.toggle_completion(db, morning_task.id, yesterday)
        result = crud.toggle_completion(db, morning_task.id, TODAY)

        assert result.action == "created"
        all_completions = crud.get_completions(db, completion_date=TODAY)
        assert len(all_completions) == 1

    def test_different_tasks_independent(self, db, morning_task, evening_task):
        crud.toggle_completion(db, morning_task.id, TODAY)
        result = crud.toggle_completion(db, evening_task.id, TODAY)

        assert result.action == "created"
        completions = crud.get_completions(db, completion_date=TODAY)
        assert len(completions) == 2


class TestDailySummary:
    def test_zero_carrots_when_nothing_done(self, db, morning_task, evening_task):
        summary = crud.get_daily_summary(db, TODAY)

        assert summary.earned_carrots == 0
        assert summary.total_carrots == morning_task.carrot_value + evening_task.carrot_value
        assert summary.morning.completed_count == 0
        assert summary.evening.completed_count == 0

    def test_earned_carrots_match_completed_task_values(self, db, morning_task, evening_task):
        crud.toggle_completion(db, morning_task.id, TODAY)

        summary = crud.get_daily_summary(db, TODAY)

        assert summary.morning.earned_carrots == morning_task.carrot_value
        assert summary.morning.completed_count == 1
        assert summary.evening.earned_carrots == 0
        assert summary.earned_carrots == morning_task.carrot_value

    def test_full_completion_earns_all_carrots(self, db, morning_task, evening_task):
        crud.toggle_completion(db, morning_task.id, TODAY)
        crud.toggle_completion(db, evening_task.id, TODAY)

        summary = crud.get_daily_summary(db, TODAY)

        assert summary.earned_carrots == summary.total_carrots
        assert summary.morning.completed_count == 1
        assert summary.evening.completed_count == 1

    def test_high_value_task_counts_correctly(self, db):
        big_task = Task(name="Do homework", routine="evening", carrot_value=5, sort_order=0)
        db.add(big_task)
        db.commit()
        db.refresh(big_task)

        crud.toggle_completion(db, big_task.id, TODAY)
        summary = crud.get_daily_summary(db, TODAY)

        assert summary.evening.earned_carrots == 5
        assert summary.total_carrots == 5

    def test_inactive_tasks_excluded_from_summary(self, db, morning_task):
        hidden = Task(name="Hidden", routine="morning", carrot_value=3, is_active=False, sort_order=1)
        db.add(hidden)
        db.commit()

        summary = crud.get_daily_summary(db, TODAY)

        # Only the active morning_task (1 carrot) counts
        assert summary.morning.total_carrots == morning_task.carrot_value
        assert summary.morning.total_count == 1

    def test_routine_summary_isolated(self, db, morning_task, evening_task):
        crud.toggle_completion(db, morning_task.id, TODAY)

        summary = crud.get_daily_summary(db, TODAY)

        assert summary.morning.earned_carrots == morning_task.carrot_value
        assert summary.evening.earned_carrots == 0


class TestGetTasks:
    def test_filters_by_routine(self, db, morning_task, evening_task):
        morning = crud.get_tasks(db, routine="morning")
        evening = crud.get_tasks(db, routine="evening")

        assert all(t.routine == "morning" for t in morning)
        assert all(t.routine == "evening" for t in evening)

    def test_excludes_inactive_by_default(self, db, morning_task):
        morning_task.is_active = False
        db.commit()

        tasks = crud.get_tasks(db, routine="morning")
        assert len(tasks) == 0

    def test_includes_inactive_when_requested(self, db, morning_task):
        morning_task.is_active = False
        db.commit()

        tasks = crud.get_tasks(db, routine="morning", active_only=False)
        assert len(tasks) == 1


class TestRangeSummary:
    @pytest.mark.parametrize("end", [date(2026, 1, 1), date.max])
    def test_inclusive_range_keeps_last_day(self, db, morning_task, end):
        from datetime import timedelta

        start = end - timedelta(days=1)
        crud.toggle_completion(db, morning_task.id, end)
        summary = crud.get_range_summary(db, start, end)
        assert [day.date for day in summary.days] == [start, end]
        assert [day.earned_carrots for day in summary.days] == [0, morning_task.carrot_value]
        assert len(crud.get_range_summary(db, end, end).days) == 1

    def test_daily_earnings_are_isolated_by_routine(self, db, morning_task, evening_task):
        from datetime import timedelta

        start = date(2026, 9, 1)
        end = start + timedelta(days=2)
        crud.toggle_completion(db, morning_task.id, start)
        crud.toggle_completion(db, evening_task.id, start + timedelta(days=1))
        hidden = Task(name="Hidden", routine="morning", carrot_value=5, is_active=False)
        db.add(hidden)
        db.commit()
        crud.toggle_completion(db, hidden.id, start)

        summary = crud.get_range_summary(db, start, end)
        assert [day.morning_earned_carrots for day in summary.days] == [1, 0, 0]
        assert [day.evening_earned_carrots for day in summary.days] == [0, 2, 0]
        assert [day.earned_carrots for day in summary.days] == [1, 2, 0]
        assert all(day.total_carrots == 3 for day in summary.days)
        assert {stat.task_id: stat.count for stat in summary.task_stats} == {
            morning_task.id: 1, evening_task.id: 1,
        }


class TestChildCRUD:
    def test_create_and_list_child(self, db):
        crud.create_child(db, schemas.ChildCreate(name="Alice"))
        children = crud.get_children(db)
        assert len(children) == 1
        assert children[0].name == "Alice"
        assert children[0].avatar == "🐰"

    def test_create_child_custom_avatar(self, db):
        child = crud.create_child(db, schemas.ChildCreate(name="Bob", avatar="🐻", color="#7DD3FC"))
        assert child.avatar == "🐻"
        assert child.color == "#7DD3FC"

    def test_update_child_name(self, db):
        child = crud.create_child(db, schemas.ChildCreate(name="Alice"))
        updated = crud.update_child(db, child.id, schemas.ChildUpdate(name="Alicia"))
        assert updated is not None
        assert updated.name == "Alicia"
        assert updated.avatar == "🐰"

    def test_update_nonexistent_child_returns_none(self, db):
        result = crud.update_child(db, 9999, schemas.ChildUpdate(name="Ghost"))
        assert result is None

    def test_delete_child(self, db):
        child = crud.create_child(db, schemas.ChildCreate(name="Alice"))
        assert crud.delete_child(db, child.id) is True
        assert crud.get_children(db) == []

    def test_delete_nonexistent_child_returns_false(self, db):
        assert crud.delete_child(db, 9999) is False

    def test_two_children_can_complete_same_task_same_day(self, db, morning_task):
        alice = crud.create_child(db, schemas.ChildCreate(name="Alice"))
        bob = crud.create_child(db, schemas.ChildCreate(name="Bob"))

        r1 = crud.toggle_completion(db, morning_task.id, TODAY, child_id=alice.id)
        r2 = crud.toggle_completion(db, morning_task.id, TODAY, child_id=bob.id)

        assert r1.action == "created"
        assert r2.action == "created"

    def test_toggle_per_child_is_independent(self, db, morning_task):
        alice = crud.create_child(db, schemas.ChildCreate(name="Alice"))

        crud.toggle_completion(db, morning_task.id, TODAY, child_id=alice.id)
        r = crud.toggle_completion(db, morning_task.id, TODAY, child_id=alice.id)
        assert r.action == "deleted"

        unscoped = crud.toggle_completion(db, morning_task.id, TODAY)
        assert unscoped.action == "created"

    def test_get_completions_filtered_by_child(self, db, morning_task):
        alice = crud.create_child(db, schemas.ChildCreate(name="Alice"))
        bob = crud.create_child(db, schemas.ChildCreate(name="Bob"))

        crud.toggle_completion(db, morning_task.id, TODAY, child_id=alice.id)
        crud.toggle_completion(db, morning_task.id, TODAY, child_id=bob.id)

        alice_completions = crud.get_completions(db, completion_date=TODAY, child_id=alice.id)
        assert len(alice_completions) == 1
        assert alice_completions[0].child_id == alice.id

    def test_delete_child_cascades_completions(self, db, morning_task):
        alice = crud.create_child(db, schemas.ChildCreate(name="Alice"))
        crud.toggle_completion(db, morning_task.id, TODAY, child_id=alice.id)
        crud.delete_child(db, alice.id)

        completions = crud.get_completions(db, completion_date=TODAY, child_id=alice.id)
        assert completions == []
