"""add task_child_assignments table

Revision ID: d4e5f6a7b8c9
Revises: b2c3d4e5f6a7
Create Date: 2026-10-01

"""
from alembic import op

revision = "d4e5f6a7b8c9"
down_revision = "c3d4e5f6a7b8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE task_child_assignments (
            task_id  INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
            child_id INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
            PRIMARY KEY (task_id, child_id)
        )
    """)


def downgrade() -> None:
    op.execute("DROP TABLE task_child_assignments")
