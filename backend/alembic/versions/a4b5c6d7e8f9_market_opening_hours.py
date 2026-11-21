"""per-market opening hours (opening_time, closing_time, timezone)

Revision ID: a4b5c6d7e8f9
Revises: f4a5b6c7d8e9
Create Date: 2026-11-19 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a4b5c6d7e8f9'
down_revision: Union[str, None] = 'f4a5b6c7d8e9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # server_default so existing rows on a live table get today's behaviour
    # (08:00-20:00 Lagos); dropped right after so the model's defaults
    # (markets/hours.py) stay the single source of truth for new markets.
    op.add_column('markets', sa.Column('opening_time', sa.Time(), nullable=False, server_default='08:00:00'))
    op.add_column('markets', sa.Column('closing_time', sa.Time(), nullable=False, server_default='20:00:00'))
    op.add_column('markets', sa.Column('timezone', sa.String(length=64), nullable=False, server_default='Africa/Lagos'))
    op.alter_column('markets', 'opening_time', server_default=None)
    op.alter_column('markets', 'closing_time', server_default=None)
    op.alter_column('markets', 'timezone', server_default=None)


def downgrade() -> None:
    op.drop_column('markets', 'timezone')
    op.drop_column('markets', 'closing_time')
    op.drop_column('markets', 'opening_time')
