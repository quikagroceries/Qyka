"""shopkeeper role, market hubs, and riders linked to a login

Revision ID: 3cfb3facb0e8
Revises: c6d7e8f9a0b1
Create Date: 2026-11-24 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '3cfb3facb0e8'
down_revision: Union[str, None] = 'c6d7e8f9a0b1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # A new enum value can't be used in the same transaction that adds it,
    # so these run outside the migration's transaction.
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'SHOPKEEPER'")
        op.execute("ALTER TYPE applicationkind ADD VALUE IF NOT EXISTS 'SHOPKEEPER'")

    op.add_column('riders', sa.Column('user_id', sa.UUID(), nullable=True))
    op.create_index(op.f('ix_riders_user_id'), 'riders', ['user_id'], unique=True)

    op.create_table(
        'hubs',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('market_id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(length=120), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_hubs_market_id'), 'hubs', ['market_id'], unique=False)
    op.create_index(op.f('ix_hubs_user_id'), 'hubs', ['user_id'], unique=True)
    op.create_index(op.f('ix_hubs_is_active'), 'hubs', ['is_active'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_hubs_is_active'), table_name='hubs')
    op.drop_index(op.f('ix_hubs_user_id'), table_name='hubs')
    op.drop_index(op.f('ix_hubs_market_id'), table_name='hubs')
    op.drop_table('hubs')
    op.drop_index(op.f('ix_riders_user_id'), table_name='riders')
    op.drop_column('riders', 'user_id')
    # Postgres can't drop a value from an enum: 'SHOPKEEPER' stays in
    # userrole / applicationkind after a downgrade, unused.
