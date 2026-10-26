"""Store the carrots awarded when a task was completed.

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
"""

import sqlalchemy as sa
from alembic import op

revision = "f6a7b8c9d0e1"
down_revision = "e5f6a7b8c9d0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Snapshot legacy completions using current task values, the only available history."""
    op.add_column(
        "task_completions",
        sa.Column("awarded_carrots", sa.Integer(), nullable=False, server_default="0"),
    )
    op.execute("""
        UPDATE task_completions
        SET awarded_carrots = (
            SELECT carrot_value FROM tasks WHERE tasks.id = task_completions.task_id
        )
    """)


def downgrade() -> None:
    """Remove stored completion awards while preserving completion records."""
    with op.batch_alter_table("task_completions") as batch_op:
        batch_op.drop_column("awarded_carrots")
