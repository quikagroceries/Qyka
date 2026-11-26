"""delivery landmark on orders; saved address pin on users

Revision ID: e7f8a9b0c1d2
Revises: d6e7f8a9b0c1
Create Date: 2026-11-26 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'e7f8a9b0c1d2'
down_revision: Union[str, None] = 'd6e7f8a9b0c1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('orders', sa.Column('delivery_landmark', sa.Text(), nullable=True))
    op.add_column('users', sa.Column('default_delivery_landmark', sa.Text(), nullable=True))
    op.add_column('users', sa.Column('default_delivery_latitude', sa.Float(), nullable=True))
    op.add_column('users', sa.Column('default_delivery_longitude', sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'default_delivery_longitude')
    op.drop_column('users', 'default_delivery_latitude')
    op.drop_column('users', 'default_delivery_landmark')
    op.drop_column('orders', 'delivery_landmark')
