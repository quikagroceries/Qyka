"""owner-editable platform settings, and the pricing snapshot on each order

Revision ID: f2a3b4c5d6e7
Revises: db0d041bd5d6
Create Date: 2026-11-25 00:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = 'f2a3b4c5d6e7'
down_revision: Union[str, None] = 'db0d041bd5d6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'platform_settings',
        sa.Column('key', sa.String(length=80), nullable=False),
        sa.Column('value', postgresql.JSONB(), nullable=False),
        sa.Column('updated_by', sa.UUID(), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('key'),
    )
    # NULL = priced by the built-in defaults, which is exactly how every order
    # created before this was priced.
    op.add_column('orders', sa.Column('pricing', postgresql.JSONB(), nullable=True))


def downgrade() -> None:
    op.drop_column('orders', 'pricing')
    op.drop_table('platform_settings')
