"""admin-set rider/hub delivery pay, snapshotted on each order

Revision ID: a229f47a1412
Revises: 458bffc2e34d
Create Date: 2026-11-24 00:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a229f47a1412'
down_revision: Union[str, None] = '458bffc2e34d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'fee_settings',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('market_id', sa.UUID(), nullable=True),
        sa.Column('rider_fee', sa.Numeric(12, 2), nullable=False),
        sa.Column('hub_fee', sa.Numeric(12, 2), nullable=False),
        sa.Column('updated_by', sa.UUID(), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_fee_settings_market_id'), 'fee_settings', ['market_id'], unique=True)

    op.add_column('orders', sa.Column('rider_fee', sa.Numeric(12, 2), server_default='0', nullable=False))
    op.add_column('orders', sa.Column('hub_fee', sa.Numeric(12, 2), server_default='0', nullable=False))
    # Orders still in flight when this ships get the built-in defaults
    # (orders/fees.py: 1000 rider + 500 hub, together the flat delivery fee),
    # so they pay out normally if they finish through the hub flow. Finished
    # and cancelled orders keep 0 - nothing is ever paid for them again.
    op.execute(
        "UPDATE orders SET rider_fee = 1000, hub_fee = 500 "
        "WHERE status NOT IN ('DELIVERED', 'CLOSED', 'DISPUTED', 'CANCELLED', 'CANCELLED_UNPAID')"
    )


def downgrade() -> None:
    op.drop_column('orders', 'hub_fee')
    op.drop_column('orders', 'rider_fee')
    op.drop_index(op.f('ix_fee_settings_market_id'), table_name='fee_settings')
    op.drop_table('fee_settings')
