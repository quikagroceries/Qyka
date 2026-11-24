"""admin levels (owner/support) and the admin audit log

Revision ID: e1f2a3b4c5d6
Revises: d0e1f2a3b4c5
Create Date: 2026-11-25 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = 'e1f2a3b4c5d6'
down_revision: Union[str, None] = 'd0e1f2a3b4c5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

admin_level = postgresql.ENUM('OWNER', 'SUPPORT', name='adminlevel')


def upgrade() -> None:
    admin_level.create(op.get_bind(), checkfirst=True)
    op.add_column('users', sa.Column(
        'admin_level', postgresql.ENUM(name='adminlevel', create_type=False), nullable=True,
    ))
    # Everyone who is an admin today keeps full access: they become owners.
    # (New admins are created as support unless an owner says otherwise.)
    op.execute("UPDATE users SET admin_level = 'OWNER' WHERE role = 'ADMIN'")

    op.create_table(
        'admin_audit_log',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('admin_id', sa.UUID(), nullable=True),
        sa.Column('admin_email', sa.String(length=255), nullable=True),
        sa.Column('admin_level', sa.String(length=20), nullable=True),
        sa.Column('action', sa.String(length=80), nullable=False),
        sa.Column('target', postgresql.JSONB(), nullable=True),
        sa.Column('detail', postgresql.JSONB(), nullable=True),
        sa.Column('method', sa.String(length=10), nullable=True),
        sa.Column('path', sa.String(length=300), nullable=True),
        sa.Column('ip', sa.String(length=64), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_admin_audit_log_admin_id'), 'admin_audit_log', ['admin_id'], unique=False)
    op.create_index(op.f('ix_admin_audit_log_action'), 'admin_audit_log', ['action'], unique=False)
    op.create_index(op.f('ix_admin_audit_log_created_at'), 'admin_audit_log', ['created_at'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_admin_audit_log_created_at'), table_name='admin_audit_log')
    op.drop_index(op.f('ix_admin_audit_log_action'), table_name='admin_audit_log')
    op.drop_index(op.f('ix_admin_audit_log_admin_id'), table_name='admin_audit_log')
    op.drop_table('admin_audit_log')
    op.drop_column('users', 'admin_level')
    admin_level.drop(op.get_bind(), checkfirst=True)
