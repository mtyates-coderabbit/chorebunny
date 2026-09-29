"""add children table and child_id on task_completions

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-09-26

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "b2c3d4e5f6a7"
down_revision = "a1b2c3d4e5f6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create children table and add child_id FK to task_completions."""
    op.create_table(
        "children",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("avatar", sa.String(), nullable=False, server_default="🐰"),
        sa.Column("color", sa.String(), nullable=False, server_default="#F97316"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
    )

    # Rebuild task_completions to swap UNIQUE(task_id, completion_date)
    # for UNIQUE(task_id, completion_date, child_id) and add the child_id FK.
    # SQLite requires a full table recreation to change constraints.
    op.execute("""
        CREATE TABLE task_completions_new (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            task_id         INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
            child_id        INTEGER REFERENCES children(id) ON DELETE CASCADE,
            completion_date DATE    NOT NULL,
            completed_at    DATETIME NOT NULL,
            UNIQUE(task_id, completion_date, child_id)
        )
    """)
    op.execute("""
        INSERT INTO task_completions_new
            (id, task_id, child_id, completion_date, completed_at)
        SELECT id, task_id, NULL, completion_date, completed_at
        FROM task_completions
    """)
    op.execute("DROP TABLE task_completions")
    op.execute("ALTER TABLE task_completions_new RENAME TO task_completions")


def downgrade() -> None:
    """Remove child_id from task_completions and drop children table."""
    conn = op.get_bind()
    row = conn.execute(sa.text("SELECT COUNT(*) FROM task_completions WHERE child_id IS NOT NULL")).scalar()
    if row:
        raise RuntimeError(
            f"Cannot downgrade: {row} task_completion row(s) are scoped to a child. "
            "Delete or reassign them before reverting this migration."
        )

    op.execute("""
        CREATE TABLE task_completions_old (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            task_id         INTEGER NOT NULL REFERENCES tasks(id),
            completion_date DATE    NOT NULL,
            completed_at    DATETIME NOT NULL,
            UNIQUE(task_id, completion_date)
        )
    """)
    op.execute("""
        INSERT INTO task_completions_old (id, task_id, completion_date, completed_at)
        SELECT id, task_id, completion_date, completed_at
        FROM task_completions
        WHERE child_id IS NULL
    """)
    op.execute("DROP TABLE task_completions")
    op.execute("ALTER TABLE task_completions_old RENAME TO task_completions")

    op.drop_table("children")
