"""rider job claims: pickup code, claim and drop-off timestamps

Revision ID: c9d0e1f2a3b4
Revises: b8c9d0e1f2a3
Create Date: 2026-11-24 00:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c9d0e1f2a3b4'
down_revision: Union[str, None] = 'b8c9d0e1f2a3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # orders.rider_id has existed (unused) since the initial schema.
    op.create_index(op.f('ix_orders_rider_id'), 'orders', ['rider_id'], unique=False)
    op.add_column('orders', sa.Column('rider_claimed_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('orders', sa.Column('pickup_code', sa.String(length=8), nullable=True))
    op.add_column('orders', sa.Column('rider_delivered_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('orders', 'rider_delivered_at')
    op.drop_column('orders', 'pickup_code')
    op.drop_column('orders', 'rider_claimed_at')
    op.drop_index(op.f('ix_orders_rider_id'), table_name='orders')
