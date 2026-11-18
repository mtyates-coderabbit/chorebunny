from __future__ import annotations

from tests.push_helpers import AUTH, KEY, push_key

from app import crud, schemas
from app.config import Settings
from app.models import PushSubscription


def _subscription(endpoint="https://fcm.googleapis.com/abc", p256dh=KEY, auth=AUTH, child_id=None):
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
        assert body["endpoint"] == "https://fcm.googleapis.com/abc"
        assert body["child_id"] is None
        assert db.query(PushSubscription).count() == 1

    def test_stores_subscription_for_a_child(self, client, db):
        child = crud.create_child(db, schemas.ChildCreate(name="Alice"))
        res = client.post("/api/push/subscribe", json=_subscription(child_id=child.id))
        assert res.status_code == 200
        assert res.json()["child_id"] == child.id

    def test_resubscribing_same_endpoint_updates_rather_than_duplicates(self, client, db):
        client.post("/api/push/subscribe", json=_subscription(p256dh=KEY))
        res = client.post("/api/push/subscribe", json=_subscription(p256dh=push_key(2)))
        assert res.status_code == 200
        assert db.query(PushSubscription).count() == 1
        stored = db.query(PushSubscription).one()
        assert stored.p256dh == push_key(2)

    def test_resubscribing_updates_child_association(self, client, db):
        child_a = crud.create_child(db, schemas.ChildCreate(name="Alice"))
        child_b = crud.create_child(db, schemas.ChildCreate(name="Bob"))
        client.post("/api/push/subscribe", json=_subscription(child_id=child_a.id))
        res = client.post("/api/push/subscribe", json=_subscription(child_id=child_b.id))
        assert res.json()["child_id"] == child_b.id
        assert db.query(PushSubscription).count() == 1

    def test_malformed_payload_rejected(self, client):
        assert client.post("/api/push/subscribe", json={"endpoint": "https://fcm.googleapis.com/x"}).status_code == 422
        assert client.post("/api/push/subscribe", json={"keys": {"p256dh": AUTH, "auth": "b"}}).status_code == 422
        assert client.post(
            "/api/push/subscribe",
            json={"endpoint": "https://fcm.googleapis.com/x", "keys": {"p256dh": AUTH}},
        ).status_code == 422
        assert client.post(
            "/api/push/subscribe",
            json={"endpoint": "", "keys": {"p256dh": AUTH, "auth": "b"}},
        ).status_code == 422


class TestUnsubscribe:
    def test_removes_subscription_by_endpoint(self, client, db):
        client.post("/api/push/subscribe", json=_subscription())
        res = client.request("DELETE", "/api/push/subscribe", json={"endpoint": "https://fcm.googleapis.com/abc"})
        assert res.status_code == 204
        assert db.query(PushSubscription).count() == 0

    def test_unknown_endpoint_returns_404(self, client):
        res = client.request("DELETE", "/api/push/subscribe", json={"endpoint": "https://fcm.googleapis.com/missing"})
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


class TestSubscriptionValidation:
    def test_rejects_invalid_keys(self, client):
        for keys in [
            {"p256dh": "!", "auth": AUTH},
            {"p256dh": KEY, "auth": "c2hvcnQ"},
            {"p256dh": "BA" + "A" * 85, "auth": AUTH},
        ]:
            payload = _subscription()
            payload["keys"] = keys
            assert client.post("/api/push/subscribe", json=payload).status_code == 422

    def test_rejects_unsupported_endpoints(self, client):
        for endpoint in ["http://fcm.googleapis.com/x", "https://localhost/x",
                         "https://fcm.googleapis.com.evil.test/x",
                         "https://user@fcm.googleapis.com/x",
                         "https://fcm.googleapis.com:8443/x"]:
            assert client.post("/api/push/subscribe", json=_subscription(endpoint=endpoint)).status_code == 422


def test_concurrent_registration_updates_one_complete_subscription(tmp_path):
    from concurrent.futures import ThreadPoolExecutor
    from threading import Barrier
    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session
    from app.database import Base

    engine = create_engine(f"sqlite:///{tmp_path / 'subscriptions.db'}")
    Base.metadata.create_all(engine)
    barrier = Barrier(2)

    def register(number):
        with Session(engine) as session:
            barrier.wait(timeout=5)
            crud.upsert_push_subscription(session, schemas.PushSubscriptionCreate(
                endpoint="https://fcm.googleapis.com/race",
                keys={"p256dh": push_key(number), "auth": AUTH},
            ))

    try:
        with ThreadPoolExecutor(max_workers=2) as pool:
            list(pool.map(register, (1, 2)))
        with Session(engine) as session:
            stored = session.query(PushSubscription).one()
            assert stored.p256dh in (push_key(1), push_key(2))
            assert stored.auth == AUTH
    finally:
        engine.dispose()
