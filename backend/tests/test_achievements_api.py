from __future__ import annotations

from datetime import date

import pytest

from app import achievements, crud, schemas


@pytest.fixture()
def definitions(db):
    achievements.seed_achievements(db)
    db.commit()


def _child(db, name="Alice"):
    return crud.create_child(db, schemas.ChildCreate(name=name))


class TestAchievementsAPI:
    def test_lists_all_seeded_achievements_locked_by_default(self, client, db, definitions):
        child = _child(db)
        res = client.get(f"/api/achievements?child_id={child.id}")
        assert res.status_code == 200
        rows = res.json()
        assert len(rows) == 6
        assert {row["name"] for row in rows} == {
            "First Chore", "First Full Routine", "7-Day Streak", "30-Day Streak", "Perfect Week", "100 Carrots Earned",
        }
        assert all(row["unlocked"] is False and row["unlocked_at"] is None for row in rows)
        assert all(set(row) == {"id", "name", "description", "icon", "unlocked", "unlocked_at"} for row in rows)

    def test_shows_unlocked_achievement_with_its_unlock_date(self, client, db, definitions, morning_task):
        child = _child(db)
        crud.toggle_completion(db, morning_task.id, date.today(), child.id)

        rows = client.get(f"/api/achievements?child_id={child.id}").json()
        first_chore = next(row for row in rows if row["name"] == "First Chore")
        assert first_chore["unlocked"] is True
        assert first_chore["unlocked_at"] is not None

        still_locked = next(row for row in rows if row["name"] == "30-Day Streak")
        assert still_locked["unlocked"] is False
        assert still_locked["unlocked_at"] is None

    def test_unlock_state_is_scoped_per_child(self, client, db, definitions, morning_task):
        alice = _child(db, "Alice")
        bob = _child(db, "Bob")
        crud.toggle_completion(db, morning_task.id, date.today(), alice.id)

        alice_rows = client.get(f"/api/achievements?child_id={alice.id}").json()
        bob_rows = client.get(f"/api/achievements?child_id={bob.id}").json()
        assert next(row for row in alice_rows if row["name"] == "First Chore")["unlocked"] is True
        assert next(row for row in bob_rows if row["name"] == "First Chore")["unlocked"] is False

    def test_returns_empty_list_when_no_achievements_seeded(self, client, db):
        child = _child(db)
        assert client.get(f"/api/achievements?child_id={child.id}").json() == []
