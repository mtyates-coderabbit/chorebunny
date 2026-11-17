"""add goals table

Revision ID: d0e1f2a3b4c5
Revises: c9d0e1f2a3b4
Create Date: 2026-10-29

"""
from alembic import op

revision = "d0e1f2a3b4c5"
down_revision = "c9d0e1f2a3b4"
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
