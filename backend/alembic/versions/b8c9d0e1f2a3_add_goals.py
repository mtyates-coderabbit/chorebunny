"""add goals table

Revision ID: b8c9d0e1f2a3
Revises: a7b8c9d0e1f2
Create Date: 2026-10-29

"""
from alembic import op

revision = "b8c9d0e1f2a3"
down_revision = "a7b8c9d0e1f2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create per-child savings goals with a positive dollar target and optional completion timestamp."""
    op.execute("""
        CREATE TABLE goals (
            id             INTEGER  PRIMARY KEY AUTOINCREMENT,
            child_id       INTEGER  NOT NULL REFERENCES children(id) ON DELETE CASCADE,
            name           TEXT     NOT NULL,
            target_dollars REAL     NOT NULL CHECK (target_dollars > 0),
            created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            completed_at   DATETIME
        )
    """)


def downgrade() -> None:
    """Remove the goals table and all stored savings goals."""
    op.execute("DROP TABLE goals")
