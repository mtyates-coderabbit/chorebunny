"""add child_balances table

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-10-08

"""
from alembic import op

revision = "e5f6a7b8c9d0"
down_revision = "d4e5f6a7b8c9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create per-child carrot balances with zero defaults and cascading child deletion."""
    op.execute("""
        CREATE TABLE child_balances (
            child_id          INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
            lifetime_earned   INTEGER NOT NULL DEFAULT 0,
            lifetime_redeemed INTEGER NOT NULL DEFAULT 0,
            current_balance   INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (child_id)
        )
    """)


def downgrade() -> None:
    """Remove the child balances table and all stored carrot totals."""
    op.execute("DROP TABLE child_balances")
