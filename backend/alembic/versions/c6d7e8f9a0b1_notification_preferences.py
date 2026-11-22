"""per-user notification preferences (all on by default)

Revision ID: c6d7e8f9a0b1
Revises: b5c6d7e8f9a0
Create Date: 2026-11-21 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c6d7e8f9a0b1'
down_revision: Union[str, None] = 'b5c6d7e8f9a0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

COLUMNS = ('notify_order_updates', 'notify_agent_messages', 'notify_payment_reminders', 'notify_offers')


def upgrade() -> None:
    # Existing users get all-on, so nobody's notifications silently go quiet;
    # the server_default is then dropped so the model's default (also True)
    # stays the source of truth for new users.
    for col in COLUMNS:
        op.add_column('users', sa.Column(col, sa.Boolean(), nullable=False, server_default=sa.true()))
    for col in COLUMNS:
        op.alter_column('users', col, server_default=None)


def downgrade() -> None:
    for col in reversed(COLUMNS):
        op.drop_column('users', col)
