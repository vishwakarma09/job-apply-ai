"""add user activation fields

Revision ID: 7a8b9c1d2e3f
Revises: 69ded6760523
Create Date: 2026-06-19 12:55:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '7a8b9c1d2e3f'
down_revision = '69ded6760523'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add is_active with server_default=true so existing users remain active
    op.add_column('users', sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')))
    op.add_column('users', sa.Column('activation_token', sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'activation_token')
    op.drop_column('users', 'is_active')
