"""Add achievement definitions and permanent child unlocks.

Revision ID: b8c9d0e1f2a3
Revises: a7b8c9d0e1f2
"""

from alembic import op
import sqlalchemy as sa

revision = "b8c9d0e1f2a3"
down_revision = "a7b8c9d0e1f2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create the achievement tables and the child completion history index."""
    op.create_table(
        "achievements",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("key", sa.String(), nullable=False, unique=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=False),
        sa.Column("icon", sa.String(), nullable=False),
        sa.Column("criteria_type", sa.String(), nullable=False),
        sa.Column("threshold", sa.Integer(), nullable=False),
    )
    op.create_table(
        "child_achievements",
        sa.Column("child_id", sa.Integer(), sa.ForeignKey("children.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("achievement_id", sa.Integer(), sa.ForeignKey("achievements.id"), primary_key=True),
        sa.Column("unlocked_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_task_completions_child_date_task", "task_completions", ["child_id", "completion_date", "task_id"])


def downgrade() -> None:
    """Remove achievement data and its completion history index."""
    op.drop_index("ix_task_completions_child_date_task", table_name="task_completions")
    op.drop_table("child_achievements")
    op.drop_table("achievements")
