"""add push_subscriptions table

Revision ID: e2f3a4b5c6d7
Revises: d1e2f3a4b5c6
Create Date: 2026-11-17

"""
from alembic import op

revision = "e2f3a4b5c6d7"
down_revision = "d1e2f3a4b5c6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create push_subscriptions to store Web Push endpoint/key pairs, one row per endpoint."""
    op.execute("""
        CREATE TABLE push_subscriptions (
            id         INTEGER  NOT NULL PRIMARY KEY AUTOINCREMENT,
            endpoint   TEXT     NOT NULL UNIQUE,
            p256dh     TEXT     NOT NULL,
            auth       TEXT     NOT NULL,
            child_id   INTEGER  REFERENCES children(id) ON DELETE CASCADE,
            created_at DATETIME NOT NULL
        )
    """)


def downgrade() -> None:
    """Remove the push_subscriptions table and all stored subscriptions."""
    op.execute("DROP TABLE push_subscriptions")
