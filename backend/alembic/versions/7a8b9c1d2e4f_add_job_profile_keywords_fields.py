"""add job profile keywords fields

Revision ID: 7a8b9c1d2e4f
Revises: 7a8b9c1d2e3f
Create Date: 2026-06-26 20:38:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '7a8b9c1d2e4f'
down_revision = '7a8b9c1d2e3f'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('job_profiles', sa.Column('job_location', sa.String(length=150), nullable=True))
    op.add_column('job_profiles', sa.Column('job_title_keywords', sa.Text(), nullable=True))
    op.add_column('job_profiles', sa.Column('job_title_negative_keywords', sa.Text(), nullable=True))
    op.add_column('job_profiles', sa.Column('job_body_keywords', sa.Text(), nullable=True))
    op.add_column('job_profiles', sa.Column('job_body_negative_keywords', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('job_profiles', 'job_body_negative_keywords')
    op.drop_column('job_profiles', 'job_body_keywords')
    op.drop_column('job_profiles', 'job_title_negative_keywords')
    op.drop_column('job_profiles', 'job_title_keywords')
    op.drop_column('job_profiles', 'job_location')
