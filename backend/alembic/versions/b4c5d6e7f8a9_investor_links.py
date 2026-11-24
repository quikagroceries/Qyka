"""revocable, hashed investor links to the company overview

Revision ID: b4c5d6e7f8a9
Revises: a3b4c5d6e7f8
Create Date: 2026-11-25 02:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b4c5d6e7f8a9'
down_revision: Union[str, None] = 'a3b4c5d6e7f8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'investor_links',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('token_hash', sa.String(length=64), nullable=False),
        sa.Column('label', sa.String(length=120), nullable=False),
        sa.Column('include_financials', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('created_by', sa.UUID(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('revoked_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('view_count', sa.Integer(), server_default='0', nullable=False),
        sa.Column('last_viewed_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_investor_links_token_hash'), 'investor_links', ['token_hash'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_investor_links_token_hash'), table_name='investor_links')
    op.drop_table('investor_links')
