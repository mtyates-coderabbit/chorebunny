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
    op.execute("DROP TABLE child_balances")
