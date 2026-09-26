"""add estimated_minutes to tasks

Revision ID: a1b2c3d4e5f6
Revises: fd75b0c4b2c8
Create Date: 2026-09-26

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "a1b2c3d4e5f6"
down_revision = "fd75b0c4b2c8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("tasks") as batch_op:
        batch_op.add_column(sa.Column("estimated_minutes", sa.Integer(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("tasks") as batch_op:
        batch_op.drop_column("estimated_minutes")
