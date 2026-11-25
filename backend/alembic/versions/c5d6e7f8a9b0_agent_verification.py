"""agent identity verification by an admin

Revision ID: c5d6e7f8a9b0
Revises: b4c5d6e7f8a9
Create Date: 2026-11-25 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c5d6e7f8a9b0'
down_revision: Union[str, None] = 'b4c5d6e7f8a9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('agents', sa.Column('verified_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('agents', sa.Column('verified_by', sa.UUID(), nullable=True))
    op.add_column('agents', sa.Column('verification_note', sa.String(length=300), nullable=True))


def downgrade() -> None:
    op.drop_column('agents', 'verification_note')
    op.drop_column('agents', 'verified_by')
    op.drop_column('agents', 'verified_at')
