"""owner-editable website copy

Revision ID: a3b4c5d6e7f8
Revises: f2a3b4c5d6e7
Create Date: 2026-11-25 01:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a3b4c5d6e7f8'
down_revision: Union[str, None] = 'f2a3b4c5d6e7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'site_content',
        sa.Column('key', sa.String(length=300), nullable=False),
        sa.Column('value', sa.Text(), nullable=False),
        sa.Column('updated_by', sa.UUID(), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('key'),
    )


def downgrade() -> None:
    op.drop_table('site_content')
