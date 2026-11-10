"""Populate built-in achievement definitions for existing databases.

Revision ID: c9d0e1f2a3b4
Revises: b8c9d0e1f2a3
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.sqlite import insert

revision = "c9d0e1f2a3b4"
down_revision = "b8c9d0e1f2a3"
branch_labels = None
depends_on = None


DEFINITIONS = (
    {"key": "first_chore", "name": "First Chore", "description": "Complete your first chore.", "icon": "🌱", "criteria_type": "chores", "threshold": 1},
    {"key": "first_full_routine", "name": "First Full Routine", "description": "Complete every chore in a routine.", "icon": "🌟", "criteria_type": "routine", "threshold": 1},
    {"key": "7_day_streak", "name": "7-Day Streak", "description": "Complete all your chores for seven days in a row.", "icon": "🔥", "criteria_type": "streak", "threshold": 7},
    {"key": "30_day_streak", "name": "30-Day Streak", "description": "Complete all your chores for thirty days in a row.", "icon": "🏆", "criteria_type": "streak", "threshold": 30},
    {"key": "perfect_week", "name": "Perfect Week", "description": "Complete both routines for seven days in a row.", "icon": "🌈", "criteria_type": "perfect_week", "threshold": 7},
    {"key": "100_carrots", "name": "100 Carrots Earned", "description": "Earn one hundred carrots.", "icon": "🥕", "criteria_type": "carrots", "threshold": 100},
)


def upgrade() -> None:
    """Populate missing definitions without overwriting existing badges or unlocks."""
    achievements = sa.table(
        "achievements",
        sa.column("key", sa.String()),
        sa.column("name", sa.String()),
        sa.column("description", sa.String()),
        sa.column("icon", sa.String()),
        sa.column("criteria_type", sa.String()),
        sa.column("threshold", sa.Integer()),
    )
    op.execute(insert(achievements).values(list(DEFINITIONS)).on_conflict_do_nothing(index_elements=[achievements.c.key]))


def downgrade() -> None:
    """Retain definitions to preserve earned badge references until their tables are dropped."""
    pass
