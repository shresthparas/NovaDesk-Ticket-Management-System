#app/celery_app.py
from celery import Celery
import os

RABBITMQ_URL = os.getenv("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/%2F")

celery_app = Celery(
    "tasks",
    broker=RABBITMQ_URL,
    backend=os.getenv("REDIS_URL", "redis://localhost:6379/0"), 
    include=["app.tasks"] 
)

# Optional Celery configuration
celery_app.conf.update(
    task_track_started=True,
    broker_connection_retry_on_startup=True,
)

from celery.schedules import crontab

celery_app.conf.beat_schedule = {
    "check_sla_breaches_every_minute": {
        "task": "check_sla_breaches",
        "schedule": crontab(minute="*"),
    },
    "check_sla_warnings_every_minute": {
        "task": "check_sla_warnings",
        "schedule": crontab(minute="*"),
    },
}