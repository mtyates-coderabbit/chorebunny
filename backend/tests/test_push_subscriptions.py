from __future__ import annotations

import pytest

from app import crud, schemas
from app.config import Settings
from app.models import PushSubscription


def _subscription(endpoint="https://push.example/abc", p256dh="p256dh-key", auth="auth-key", child_id=None):
    return {
        "endpoint": endpoint,
        "keys": {"p256dh": p256dh, "auth": auth},
        "child_id": child_id,
    }


class TestSubscribe:
    def test_stores_a_subscription(self, client, db):
        res = client.post("/api/push/subscribe", json=_subscription())
        assert res.status_code == 200
        body = res.json()
        assert body["endpoint"] == "https://push.example/abc"
        assert body["child_id"] is None
        assert db.query(PushSubscription).count() == 1

    def test_stores_subscription_for_a_child(self, client, db):
        child = crud.create_child(db, schemas.ChildCreate(name="Alice"))
        res = client.post("/api/push/subscribe", json=_subscription(child_id=child.id))
        assert res.status_code == 200
        assert res.json()["child_id"] == child.id

    def test_resubscribing_same_endpoint_updates_rather_than_duplicates(self, client, db):
        client.post("/api/push/subscribe", json=_subscription(p256dh="old-key"))
        res = client.post("/api/push/subscribe", json=_subscription(p256dh="new-key"))
        assert res.status_code == 200
        assert db.query(PushSubscription).count() == 1
        stored = db.query(PushSubscription).one()
        assert stored.p256dh == "new-key"

    def test_resubscribing_updates_child_association(self, client, db):
        child_a = crud.create_child(db, schemas.ChildCreate(name="Alice"))
        child_b = crud.create_child(db, schemas.ChildCreate(name="Bob"))
        client.post("/api/push/subscribe", json=_subscription(child_id=child_a.id))
        res = client.post("/api/push/subscribe", json=_subscription(child_id=child_b.id))
        assert res.json()["child_id"] == child_b.id
        assert db.query(PushSubscription).count() == 1

    @pytest.mark.parametrize("existing", [False, True])
    @pytest.mark.parametrize("missing_child_id", [0, 99999])
    def test_missing_child_rejected_before_writing(self, client, db, existing, missing_child_id):
        if existing:
            child = crud.create_child(db, schemas.ChildCreate(name="Alice"))
            original = client.post(
                "/api/push/subscribe", json=_subscription(child_id=child.id)
            ).json()
        res = client.post(
            "/api/push/subscribe",
            json=_subscription(child_id=missing_child_id, p256dh="changed", auth="changed"),
        )
        assert res.status_code == 404
        assert res.json() == {"detail": "Child not found"}
        if existing:
            stored = db.query(PushSubscription).one()
            assert schemas.PushSubscription.model_validate(stored).model_dump(mode="json") == original
        else:
            assert db.query(PushSubscription).count() == 0

    def test_upsert_preserves_identity_and_creation_time(self, db):
        child = crud.create_child(db, schemas.ChildCreate(name="Alice"))
        original = crud.upsert_push_subscription(
            db, schemas.PushSubscriptionCreate(**_subscription(child_id=child.id))
        )
        original_id, original_created_at = original.id, original.created_at
        updated = crud.upsert_push_subscription(
            db, schemas.PushSubscriptionCreate(**_subscription(p256dh="new-key", auth="new-auth"))
        )
        assert updated.id == original_id
        assert updated.created_at == original_created_at
        assert updated.p256dh == "new-key"
        assert updated.auth == "new-auth"
        assert updated.child_id is None
        assert db.query(PushSubscription).count() == 1

    def test_malformed_payload_rejected(self, client):
        assert client.post("/api/push/subscribe", json={"endpoint": "https://push.example/x"}).status_code == 422
        assert client.post("/api/push/subscribe", json={"keys": {"p256dh": "a", "auth": "b"}}).status_code == 422
        assert client.post(
            "/api/push/subscribe",
            json={"endpoint": "https://push.example/x", "keys": {"p256dh": "a"}},
        ).status_code == 422
        assert client.post(
            "/api/push/subscribe",
            json={"endpoint": "", "keys": {"p256dh": "a", "auth": "b"}},
        ).status_code == 422


class TestUnsubscribe:
    def test_removes_subscription_by_endpoint(self, client, db):
        client.post("/api/push/subscribe", json=_subscription())
        res = client.request("DELETE", "/api/push/subscribe", json={"endpoint": "https://push.example/abc"})
        assert res.status_code == 204
        assert db.query(PushSubscription).count() == 0

    def test_unknown_endpoint_returns_404(self, client):
        res = client.request("DELETE", "/api/push/subscribe", json={"endpoint": "https://push.example/missing"})
        assert res.status_code == 404

    def test_malformed_delete_payload_rejected(self, client):
        res = client.request("DELETE", "/api/push/subscribe", json={})
        assert res.status_code == 422


class TestVapidSettings:
    def test_vapid_keys_default_to_none(self, monkeypatch):
        monkeypatch.delenv("VAPID_PUBLIC_KEY", raising=False)
        monkeypatch.delenv("VAPID_PRIVATE_KEY", raising=False)
        settings = Settings(_env_file=None)
        assert settings.vapid_public_key is None
        assert settings.vapid_private_key is None

    def test_vapid_keys_read_from_environment(self, monkeypatch):
        monkeypatch.setenv("VAPID_PUBLIC_KEY", "pub-key")
        monkeypatch.setenv("VAPID_PRIVATE_KEY", "priv-key")
        settings = Settings(_env_file=None)
        assert settings.vapid_public_key == "pub-key"
        assert settings.vapid_private_key == "priv-key"
