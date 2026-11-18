"""Background scheduling and delivery of routine-reminder push notifications."""

from __future__ import annotations

import json
import logging

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from requests import RequestException
from pywebpush import WebPushException, webpush

from app import crud, database, schemas
from app.push_transport import PushSession
from app.config import settings

logger = logging.getLogger(__name__)

ROUTINES = ("morning", "evening")

_scheduler: BackgroundScheduler | None = None


def _job_id(routine: str) -> str:
    """Return the APScheduler job id used for a routine's reminder."""
    return f"reminder_{routine}"


def send_reminder_push(routine: str) -> None:
    """Push a routine-start notification to every stored subscription; no-op (logged) if VAPID keys aren't configured."""
    if not settings.vapid_public_key or not settings.vapid_private_key:
        logger.info("Skipping %s reminder push: VAPID keys are not configured", routine)
        return

    db = database.SessionLocal()
    try:
        subscriptions = crud.get_push_subscriptions(db)
    finally:
        db.close()

    payload = json.dumps({
        "title": "ChoreBunny",
        "body": f"Time for the {routine} routine!",
        "routine": routine,
    })
    for subscription in subscriptions:
        try:
            schemas.PushSubscriptionCreate(
                endpoint=subscription.endpoint,
                keys={"p256dh": subscription.p256dh, "auth": subscription.auth},
            )
            with PushSession() as session:
                webpush(
                    subscription_info={
                        "endpoint": subscription.endpoint,
                        "keys": {"p256dh": subscription.p256dh, "auth": subscription.auth},
                    },
                    data=payload,
                    timeout=10,
                    requests_session=session,
                    vapid_private_key=settings.vapid_private_key,
                    vapid_claims={"sub": "mailto:admin@chorebunny.app"},
                )
        except (WebPushException, RequestException, ValueError):
            logger.exception("Failed to send %s reminder push to endpoint %s", routine, subscription.endpoint)


def get_scheduled_job(routine: str):
    """Return the APScheduler job currently scheduled for routine, or None if unscheduled or the scheduler isn't running."""
    if _scheduler is None:
        return None
    return _scheduler.get_job(_job_id(routine))


def reschedule_reminder(routine: str, reminder_time: str | None) -> None:
    """Remove any existing job for routine, then add a daily cron job at reminder_time ('HH:MM', local time) if set."""
    if _scheduler is None:
        return
    job_id = _job_id(routine)
    if _scheduler.get_job(job_id):
        _scheduler.remove_job(job_id)
    if reminder_time is None:
        return
    hour, minute = (int(part) for part in reminder_time.split(":"))
    _scheduler.add_job(
        send_reminder_push,
        trigger=CronTrigger(hour=hour, minute=minute),
        args=[routine],
        id=job_id,
        replace_existing=True,
    )


def start_scheduler() -> None:
    """Start a fresh background scheduler and schedule jobs for any currently configured reminder times."""
    global _scheduler
    _scheduler = BackgroundScheduler()
    _scheduler.start()
    db = database.SessionLocal()
    try:
        current = crud.get_settings(db)
    finally:
        db.close()
    for routine in ROUTINES:
        reschedule_reminder(routine, getattr(current, f"{routine}_reminder_time"))


def stop_scheduler() -> None:
    """Shut down and discard the background scheduler."""
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
