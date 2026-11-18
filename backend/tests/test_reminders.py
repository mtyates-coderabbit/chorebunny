from __future__ import annotations

import json

import pytest
from requests import ConnectionError, Timeout

from tests.push_helpers import AUTH, KEY, push_key

from app import crud, reminders, schemas
from app.config import settings as app_settings


@pytest.fixture()
def vapid_configured(monkeypatch):
    """Configure VAPID keys for the duration of a test."""
    monkeypatch.setattr(app_settings, "vapid_public_key", "test-public-key")
    monkeypatch.setattr(app_settings, "vapid_private_key", "test-private-key")


class TestReminderSettingsAPI:
    def test_setting_a_reminder_time_persists_it(self, client):
        res = client.put("/api/settings", json={"morning_reminder_time": "07:00"})
        assert res.status_code == 200
        assert res.json()["morning_reminder_time"] == "07:00"
        assert client.get("/api/settings").json()["morning_reminder_time"] == "07:00"

    def test_morning_and_evening_are_independent(self, client):
        client.put("/api/settings", json={"morning_reminder_time": "07:00", "evening_reminder_time": "19:30"})
        body = client.get("/api/settings").json()
        assert body["morning_reminder_time"] == "07:00"
        assert body["evening_reminder_time"] == "19:30"

    def test_unset_reminder_times_default_to_none(self, client):
        body = client.get("/api/settings").json()
        assert body["morning_reminder_time"] is None
        assert body["evening_reminder_time"] is None

    def test_clearing_a_reminder_time_persists_the_clear(self, client):
        client.put("/api/settings", json={"morning_reminder_time": "07:00"})
        res = client.put("/api/settings", json={"morning_reminder_time": None})
        assert res.status_code == 200
        assert res.json()["morning_reminder_time"] is None
        assert client.get("/api/settings").json()["morning_reminder_time"] is None

    @pytest.mark.parametrize("bad", ["7:00", "25:00", "07:60", "7am", "", "07:00:00"])
    def test_rejects_malformed_reminder_time(self, client, bad):
        assert client.put("/api/settings", json={"morning_reminder_time": bad}).status_code == 422


class TestSchedulerIntegration:
    def test_setting_a_reminder_time_schedules_a_job(self, client):
        client.put("/api/settings", json={"morning_reminder_time": "07:30"})
        job = reminders.get_scheduled_job("morning")
        assert job is not None
        assert str(job.trigger) == "cron[hour='7', minute='30']"

    def test_leaving_a_reminder_unset_schedules_nothing(self, client):
        assert reminders.get_scheduled_job("morning") is None
        assert reminders.get_scheduled_job("evening") is None

    def test_clearing_a_reminder_time_removes_its_job(self, client):
        client.put("/api/settings", json={"morning_reminder_time": "07:30"})
        assert reminders.get_scheduled_job("morning") is not None
        client.put("/api/settings", json={"morning_reminder_time": None})
        assert reminders.get_scheduled_job("morning") is None

    def test_morning_and_evening_jobs_are_independent(self, client):
        client.put("/api/settings", json={"morning_reminder_time": "07:00", "evening_reminder_time": "19:00"})
        client.put("/api/settings", json={"morning_reminder_time": None})
        assert reminders.get_scheduled_job("morning") is None
        assert reminders.get_scheduled_job("evening") is not None

    def test_changing_an_existing_reminder_reschedules_without_restart(self, client):
        client.put("/api/settings", json={"morning_reminder_time": "07:00"})
        client.put("/api/settings", json={"morning_reminder_time": "08:15"})
        job = reminders.get_scheduled_job("morning")
        assert str(job.trigger) == "cron[hour='8', minute='15']"

    def test_startup_schedules_jobs_from_persisted_settings(self, client, db):
        # Persist directly (bypassing the API, whose handler would also reschedule)
        # to prove start_scheduler() itself reads settings and schedules jobs at boot.
        crud.update_settings(db, schemas.SettingsUpdate(morning_reminder_time="06:45"))
        reminders.start_scheduler()
        job = reminders.get_scheduled_job("morning")
        assert job is not None
        assert str(job.trigger) == "cron[hour='6', minute='45']"


class TestSendReminderPush:
    def test_skips_sending_without_vapid_keys_configured(self, client, monkeypatch):
        called = []
        monkeypatch.setattr(reminders, "webpush", lambda **kwargs: called.append(kwargs))
        reminders.send_reminder_push("morning")
        assert called == []

    def test_sends_to_every_stored_subscription_with_the_right_payload(self, client, db, vapid_configured, monkeypatch):
        calls = []
        monkeypatch.setattr(reminders, "webpush", lambda **kwargs: calls.append(kwargs))
        crud.upsert_push_subscription(
            db,
            schemas.PushSubscriptionCreate(
                endpoint="https://fcm.googleapis.com/a",
                keys=schemas.PushSubscriptionKeys(p256dh=KEY, auth=AUTH),
            ),
        )
        crud.upsert_push_subscription(
            db,
            schemas.PushSubscriptionCreate(
                endpoint="https://fcm.googleapis.com/b",
                keys=schemas.PushSubscriptionKeys(p256dh=KEY, auth=AUTH),
            ),
        )

        reminders.send_reminder_push("evening")

        assert len(calls) == 2
        endpoints = {call["subscription_info"]["endpoint"] for call in calls}
        assert endpoints == {"https://fcm.googleapis.com/a", "https://fcm.googleapis.com/b"}
        for call in calls:
            assert call["vapid_private_key"] == "test-private-key"
            payload = json.loads(call["data"])
            assert payload["routine"] == "evening"
            assert "evening" in payload["body"]
        a_call = next(c for c in calls if c["subscription_info"]["endpoint"] == "https://fcm.googleapis.com/a")
        assert a_call["subscription_info"]["keys"] == {"p256dh": KEY, "auth": AUTH}

    def test_a_failed_send_does_not_stop_the_others(self, client, db, vapid_configured, monkeypatch):
        from pywebpush import WebPushException

        calls = []

        def fake_webpush(**kwargs):
            if kwargs["subscription_info"]["endpoint"].endswith("/fails"):
                raise WebPushException("boom")
            calls.append(kwargs)

        monkeypatch.setattr(reminders, "webpush", fake_webpush)
        crud.upsert_push_subscription(
            db,
            schemas.PushSubscriptionCreate(
                endpoint="https://fcm.googleapis.com/fails",
                keys=schemas.PushSubscriptionKeys(p256dh=KEY, auth=AUTH),
            ),
        )
        crud.upsert_push_subscription(
            db,
            schemas.PushSubscriptionCreate(
                endpoint="https://fcm.googleapis.com/ok",
                keys=schemas.PushSubscriptionKeys(p256dh=KEY, auth=AUTH),
            ),
        )

        reminders.send_reminder_push("morning")

        assert len(calls) == 1
        assert calls[0]["subscription_info"]["endpoint"] == "https://fcm.googleapis.com/ok"


@pytest.mark.parametrize("error", [Timeout("timeout"), ConnectionError("reset"), ValueError("bad encoding")])
def test_transport_errors_do_not_retry_or_stop_later_sends(client, db, vapid_configured, monkeypatch, error):
    calls = []
    for suffix in ("first", "bad", "last"):
        crud.upsert_push_subscription(db, schemas.PushSubscriptionCreate(
            endpoint=f"https://fcm.googleapis.com/{suffix}", keys={"p256dh": KEY, "auth": AUTH},
        ))

    def send(**kwargs):
        calls.append(kwargs["subscription_info"]["endpoint"])
        assert kwargs["timeout"] == 10
        assert kwargs["requests_session"].trust_env is False
        if calls[-1].endswith("/bad"):
            raise error

    monkeypatch.setattr(reminders, "webpush", send)
    reminders.send_reminder_push("morning")
    assert [url.rsplit("/", 1)[1] for url in calls] == ["first", "bad", "last"]


def test_malformed_legacy_subscription_is_skipped(client, db, vapid_configured, monkeypatch):
    from app.models import PushSubscription
    db.add(PushSubscription(endpoint="https://fcm.googleapis.com/bad", p256dh="!", auth="!"))
    db.commit()
    crud.upsert_push_subscription(db, schemas.PushSubscriptionCreate(
        endpoint="https://fcm.googleapis.com/ok", keys={"p256dh": KEY, "auth": AUTH},
    ))
    calls = []
    monkeypatch.setattr(reminders, "webpush", lambda **kw: calls.append(kw))
    reminders.send_reminder_push("morning")
    assert len(calls) == 1
    assert calls[0]["subscription_info"]["endpoint"].endswith("/ok")


def test_settings_commit_and_reschedule_are_serialized(tmp_path, monkeypatch):
    from concurrent.futures import ThreadPoolExecutor
    from threading import Event
    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session
    from app.database import Base
    from app.routers import settings as router

    engine = create_engine(f"sqlite:///{tmp_path / 'settings.db'}")
    Base.metadata.create_all(engine)
    scheduling = Event()
    release = Event()
    second_started = Event()
    second_committed = Event()
    scheduled = []
    original = crud.update_settings

    def update(db, data):
        result = original(db, data)
        if data.morning_reminder_time == "08:00":
            second_committed.set()
        return result

    def schedule(routine, value):
        if value == "07:00":
            scheduling.set()
            assert release.wait(timeout=5)
        scheduled.append(value)

    def request(value):
        with Session(engine) as session:
            if value == "08:00":
                second_started.set()
            router.update_settings(schemas.SettingsUpdate(morning_reminder_time=value), session)

    monkeypatch.setattr(crud, "update_settings", update)
    monkeypatch.setattr(router, "reschedule_reminder", schedule)
    try:
        with ThreadPoolExecutor(max_workers=2) as pool:
            first = pool.submit(request, "07:00")
            assert scheduling.wait(timeout=5)
            second = pool.submit(request, "08:00")
            assert second_started.wait(timeout=5)
            try:
                assert not second_committed.wait(timeout=0.1)
            finally:
                release.set()
            first.result(timeout=5)
            second.result(timeout=5)
        assert scheduled == ["07:00", "08:00"]
        with Session(engine) as session:
            assert crud.get_settings(session).morning_reminder_time == "08:00"
    finally:
        release.set()
        engine.dispose()
