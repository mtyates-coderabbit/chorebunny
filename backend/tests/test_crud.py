from __future__ import annotations

from datetime import date

import pytest

from app import crud, schemas
from app.models import Task


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
