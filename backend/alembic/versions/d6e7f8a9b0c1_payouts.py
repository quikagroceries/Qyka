"""payout accounts and payouts

Revision ID: d6e7f8a9b0c1
Revises: c5d6e7f8a9b0
Create Date: 2026-11-26 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = 'd6e7f8a9b0c1'
down_revision: Union[str, None] = 'c5d6e7f8a9b0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'payout_accounts',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('bank_code', sa.String(10), nullable=False),
        sa.Column('bank_name', sa.String(80), nullable=False),
        sa.Column('account_number', sa.String(10), nullable=False),
        sa.Column('account_name', sa.String(120), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_payout_accounts_user_id', 'payout_accounts', ['user_id'], unique=True)
    op.create_table(
        'payouts',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('role', sa.String(20), nullable=False),
        sa.Column('amount', sa.Numeric(12, 2), nullable=False),
        sa.Column('status', sa.String(20), nullable=False),
        sa.Column('reference', sa.String(64), nullable=False, unique=True),
        sa.Column('bank_code', sa.String(10), nullable=False),
        sa.Column('bank_name', sa.String(80), nullable=False),
        sa.Column('account_number', sa.String(10), nullable=False),
        sa.Column('account_name', sa.String(120), nullable=False),
        sa.Column('hold_reason', sa.String(200), nullable=True),
        sa.Column('failure_reason', sa.Text(), nullable=True),
        sa.Column('reviewed_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('paid_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_payouts_user_id', 'payouts', ['user_id'])
    op.create_index('ix_payouts_status', 'payouts', ['status'])
    op.create_index('ix_payouts_created_at', 'payouts', ['created_at'])


def downgrade() -> None:
    op.drop_index('ix_payouts_created_at', table_name='payouts')
    op.drop_index('ix_payouts_status', table_name='payouts')
    op.drop_index('ix_payouts_user_id', table_name='payouts')
    op.drop_table('payouts')
    op.drop_index('ix_payout_accounts_user_id', table_name='payout_accounts')
    op.drop_table('payout_accounts')
