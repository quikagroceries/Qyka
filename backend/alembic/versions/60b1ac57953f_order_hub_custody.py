"""order hub custody: new statuses and hub drop/receipt columns

Revision ID: 60b1ac57953f
Revises: 3cfb3facb0e8
Create Date: 2026-11-24 00:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '60b1ac57953f'
down_revision: Union[str, None] = '3cfb3facb0e8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.get_context().autocommit_block():
        for value in ('DROPPED_AT_HUB', 'RECEIVED_BY_HUB', 'READY_FOR_PICKUP'):
            op.execute(f"ALTER TYPE orderstatus ADD VALUE IF NOT EXISTS '{value}'")

    op.add_column('orders', sa.Column('hub_id', sa.UUID(), nullable=True))
    op.add_column('orders', sa.Column('dropped_at_hub_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('orders', sa.Column('hub_received_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('orders', sa.Column('hub_missing_item_ids', sa.JSON(), nullable=True))
    op.add_column('orders', sa.Column('hub_receipt_note', sa.Text(), nullable=True))
    op.create_index(op.f('ix_orders_hub_id'), 'orders', ['hub_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_orders_hub_id'), table_name='orders')
    for col in ('hub_receipt_note', 'hub_missing_item_ids', 'hub_received_at', 'dropped_at_hub_at', 'hub_id'):
        op.drop_column('orders', col)
    # Postgres can't drop enum values: the three hub statuses stay in
    # orderstatus after a downgrade, unused.
