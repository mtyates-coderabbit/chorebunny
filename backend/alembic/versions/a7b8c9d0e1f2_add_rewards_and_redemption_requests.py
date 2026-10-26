"""add rewards and redemption_requests tables

Revision ID: a7b8c9d0e1f2
Revises: f6a7b8c9d0e1
Create Date: 2026-10-12

"""
from alembic import op

revision = "a7b8c9d0e1f2"
down_revision = "f6a7b8c9d0e1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE rewards (
            id          INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
            name        VARCHAR NOT NULL,
            carrot_cost INTEGER NOT NULL,
            is_active   BOOLEAN NOT NULL DEFAULT 1,
            created_at  DATETIME NOT NULL
        )
    """)
    op.execute("""
        CREATE TABLE redemption_requests (
            id          INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
            child_id    INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
            reward_id   INTEGER REFERENCES rewards(id) ON DELETE SET NULL,
            reward_name VARCHAR NOT NULL,
            carrot_cost INTEGER NOT NULL,
            status      VARCHAR NOT NULL DEFAULT 'pending',
            created_at  DATETIME NOT NULL,
            resolved_at DATETIME
        )
    """)


    op.execute("""
        CREATE UNIQUE INDEX uq_redemption_requests_one_pending
        ON redemption_requests (child_id, reward_id) WHERE status = 'pending'
    """)


def downgrade() -> None:
    op.execute("DROP TABLE redemption_requests")
    op.execute("DROP TABLE rewards")
