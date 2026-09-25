from __future__ import annotations

from app.database import SessionLocal
from app.models import Task


MORNING_TASKS = [
    ("Wake up & stretch", "Take a big stretch and get out of bed!", 1, 0),
    ("Brush teeth", "Two minutes — top, bottom, front and back!", 1, 1),
    ("Make your bed", "Straighten your sheets and fluff your pillow", 2, 2),
    ("Get dressed", "Pick out your clothes and put them on", 1, 3),
    ("Eat breakfast", "A healthy breakfast gives you superpower energy", 1, 4),
    ("Pack your bag", "Make sure you have everything you need for the day", 1, 5),
]

EVENING_TASKS = [
    ("Do homework", "Get it done so you can relax!", 2, 0),
    ("Tidy your room", "Put things where they belong", 2, 1),
    ("Brush teeth", "Don't forget your back teeth too!", 1, 2),
    ("Put on pajamas", "Time to get cozy for bedtime", 1, 3),
    ("Read for 15 minutes", "Pick your favourite book and snuggle up", 2, 4),
]


def seed() -> None:
    db = SessionLocal()
    try:
        existing = db.query(Task).count()
        if existing > 0:
            print(f"Database already has {existing} tasks — skipping seed.")
            return

        for name, description, carrot_value, sort_order in MORNING_TASKS:
            db.add(Task(
                name=name,
                description=description,
                routine="morning",
                carrot_value=carrot_value,
                sort_order=sort_order,
            ))

        for name, description, carrot_value, sort_order in EVENING_TASKS:
            db.add(Task(
                name=name,
                description=description,
                routine="evening",
                carrot_value=carrot_value,
                sort_order=sort_order,
            ))

        db.commit()
        print(f"Seeded {len(MORNING_TASKS)} morning tasks and {len(EVENING_TASKS)} evening tasks.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
