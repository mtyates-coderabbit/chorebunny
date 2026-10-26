from __future__ import annotations

import pytest

from app import crud, schemas


def _child_with_balance(db, carrots: int):
    child = crud.create_child(db, schemas.ChildCreate(name="Alice"))
    balance = crud.get_or_create_balance(db, child.id)
    balance.current_balance = carrots
    balance.lifetime_earned = carrots
    db.commit()
    return child


def _reward(client, name="Ice cream", cost=50, **extra):
    return client.post("/api/rewards", json={"name": name, "carrot_cost": cost, **extra}).json()


class TestRewardsAPI:
    def test_create_update_deactivate_delete(self, client):
        reward = _reward(client)
        assert reward["is_active"] is True
        res = client.put(f"/api/rewards/{reward['id']}", json={"carrot_cost": 40, "is_active": False})
        assert res.json()["carrot_cost"] == 40
        assert res.json()["is_active"] is False
        assert client.delete(f"/api/rewards/{reward['id']}").status_code == 204
        assert client.delete(f"/api/rewards/{reward['id']}").status_code == 404

    @pytest.mark.parametrize("cost", [0, -5])
    def test_create_rejects_non_positive_cost(self, client, cost):
        assert client.post("/api/rewards", json={"name": "x", "carrot_cost": cost}).status_code == 422

    @pytest.mark.parametrize("name", ["", "   "])
    def test_create_and_update_reject_blank_name(self, client, name):
        assert client.post("/api/rewards", json={"name": name, "carrot_cost": 5}).status_code == 422
        reward = _reward(client)
        assert client.put(f"/api/rewards/{reward['id']}", json={"name": name}).status_code == 422

    def test_create_rejects_missing_cost(self, client):
        assert client.post("/api/rewards", json={"name": "x"}).status_code == 422

    @pytest.mark.parametrize("body", [{"carrot_cost": 0}, {"carrot_cost": None}, {"name": None}])
    def test_update_rejects_invalid_values(self, client, body):
        reward = _reward(client)
        assert client.put(f"/api/rewards/{reward['id']}", json=body).status_code == 422

    def test_update_missing_reward_404(self, client):
        assert client.put("/api/rewards/999", json={"name": "x"}).status_code == 404

    def test_active_only_hides_inactive(self, client):
        _reward(client, "Active", 10)
        _reward(client, "Hidden", 5, is_active=False)
        assert [r["name"] for r in client.get("/api/rewards").json()] == ["Hidden", "Active"]
        assert [r["name"] for r in client.get("/api/rewards?active_only=true").json()] == ["Active"]


class TestRedemptionFlow:
    def test_request_does_not_deduct(self, client, db):
        child = _child_with_balance(db, 60)
        reward = _reward(client)
        res = client.post("/api/redemptions", json={"child_id": child.id, "reward_id": reward["id"]})
        assert res.status_code == 201
        assert res.json()["status"] == "pending"
        assert client.get(f"/api/children/{child.id}/balance").json()["current_balance"] == 60

    def test_request_over_balance_rejected(self, client, db):
        child = _child_with_balance(db, 49)
        reward = _reward(client)
        res = client.post("/api/redemptions", json={"child_id": child.id, "reward_id": reward["id"]})
        assert res.status_code == 409
        assert client.get("/api/redemptions").json() == []

    def test_request_exact_balance_allowed(self, client, db):
        child = _child_with_balance(db, 50)
        reward = _reward(client)
        res = client.post("/api/redemptions", json={"child_id": child.id, "reward_id": reward["id"]})
        assert res.status_code == 201

    def test_duplicate_pending_request_rejected_until_resolved(self, client, db):
        child = _child_with_balance(db, 200)
        reward = _reward(client)
        body = {"child_id": child.id, "reward_id": reward["id"]}
        first = client.post("/api/redemptions", json=body).json()
        assert client.post("/api/redemptions", json=body).status_code == 409
        client.post(f"/api/redemptions/{first['id']}/deny")
        assert client.post("/api/redemptions", json=body).status_code == 201

    def test_request_inactive_reward_rejected(self, client, db):
        child = _child_with_balance(db, 100)
        reward = _reward(client, is_active=False)
        res = client.post("/api/redemptions", json={"child_id": child.id, "reward_id": reward["id"]})
        assert res.status_code == 409

    def test_request_missing_child_or_reward_404(self, client, db):
        child = _child_with_balance(db, 100)
        reward = _reward(client)
        assert client.post("/api/redemptions", json={"child_id": 999, "reward_id": reward["id"]}).status_code == 404
        assert client.post("/api/redemptions", json={"child_id": child.id, "reward_id": 999}).status_code == 404

    def test_approve_deducts_and_records_redeemed(self, client, db):
        child = _child_with_balance(db, 60)
        reward = _reward(client)
        req = client.post("/api/redemptions", json={"child_id": child.id, "reward_id": reward["id"]}).json()
        res = client.post(f"/api/redemptions/{req['id']}/approve")
        assert res.status_code == 200
        assert res.json()["status"] == "approved"
        assert res.json()["resolved_at"] is not None
        balance = client.get(f"/api/children/{child.id}/balance").json()
        assert balance["current_balance"] == 10
        assert balance["lifetime_redeemed"] == 50

    def test_approve_fails_when_balance_dropped(self, client, db):
        child = _child_with_balance(db, 50)
        reward = _reward(client)
        req = client.post("/api/redemptions", json={"child_id": child.id, "reward_id": reward["id"]}).json()
        crud.get_or_create_balance(db, child.id).current_balance = 10
        db.commit()
        assert client.post(f"/api/redemptions/{req['id']}/approve").status_code == 409
        assert client.get("/api/redemptions?status=pending").json()[0]["id"] == req["id"]

    def test_deny_does_not_deduct(self, client, db):
        child = _child_with_balance(db, 60)
        reward = _reward(client)
        req = client.post("/api/redemptions", json={"child_id": child.id, "reward_id": reward["id"]}).json()
        res = client.post(f"/api/redemptions/{req['id']}/deny")
        assert res.json()["status"] == "denied"
        assert client.get(f"/api/children/{child.id}/balance").json()["current_balance"] == 60

    def test_resolved_request_cannot_be_resolved_again(self, client, db):
        child = _child_with_balance(db, 200)
        reward = _reward(client)
        req = client.post("/api/redemptions", json={"child_id": child.id, "reward_id": reward["id"]}).json()
        client.post(f"/api/redemptions/{req['id']}/approve")
        assert client.post(f"/api/redemptions/{req['id']}/approve").status_code == 409
        assert client.post(f"/api/redemptions/{req['id']}/deny").status_code == 409
        assert client.get(f"/api/children/{child.id}/balance").json()["current_balance"] == 150

    def test_resolve_missing_request_404(self, client):
        assert client.post("/api/redemptions/999/approve").status_code == 404
        assert client.post("/api/redemptions/999/deny").status_code == 404

    def test_list_filters_by_child_and_status(self, client, db):
        alice = _child_with_balance(db, 100)
        bob = crud.create_child(db, schemas.ChildCreate(name="Bob"))
        crud.get_or_create_balance(db, bob.id).current_balance = 100
        db.commit()
        reward = _reward(client)
        a = client.post("/api/redemptions", json={"child_id": alice.id, "reward_id": reward["id"]}).json()
        client.post("/api/redemptions", json={"child_id": bob.id, "reward_id": reward["id"]})
        client.post(f"/api/redemptions/{a['id']}/deny")
        assert len(client.get("/api/redemptions").json()) == 2
        assert len(client.get(f"/api/redemptions?child_id={bob.id}").json()) == 1
        assert [r["id"] for r in client.get("/api/redemptions?status=denied").json()] == [a["id"]]
        assert client.get("/api/redemptions?status=bogus").status_code == 422

    def test_deleting_reward_preserves_history(self, client, db):
        child = _child_with_balance(db, 100)
        reward = _reward(client)
        req = client.post("/api/redemptions", json={"child_id": child.id, "reward_id": reward["id"]}).json()
        assert client.delete(f"/api/rewards/{reward['id']}").status_code == 204
        history = client.get(f"/api/redemptions?child_id={child.id}").json()
        assert history[0]["reward_id"] is None
        assert history[0]["reward_name"] == "Ice cream"
        assert client.post(f"/api/redemptions/{req['id']}/approve").json()["status"] == "approved"
        assert client.get(f"/api/children/{child.id}/balance").json()["current_balance"] == 50

    def test_editing_reward_does_not_change_pending_cost(self, client, db):
        child = _child_with_balance(db, 100)
        reward = _reward(client)
        req = client.post("/api/redemptions", json={"child_id": child.id, "reward_id": reward["id"]}).json()
        client.put(f"/api/rewards/{reward['id']}", json={"carrot_cost": 90})
        client.post(f"/api/redemptions/{req['id']}/approve")
        assert client.get(f"/api/children/{child.id}/balance").json()["current_balance"] == 50
