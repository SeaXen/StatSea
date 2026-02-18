"""Add isp column to speedtest_results

Revision ID: 2eb64d488aab
Revises: ea2a343d25ea
Create Date: 2026-02-18 14:32:47.492464

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2eb64d488aab'
down_revision: Union[str, Sequence[str], None] = 'ea2a343d25ea'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('speedtest_results',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('timestamp', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=True),
        sa.Column('ping', sa.Float(), nullable=True),
        sa.Column('download', sa.Float(), nullable=True),
        sa.Column('upload', sa.Float(), nullable=True),
        sa.Column('server_id', sa.Integer(), nullable=True),
        sa.Column('server_name', sa.String(), nullable=True),
        sa.Column('server_country', sa.String(), nullable=True),
        sa.Column('provider', sa.String(), server_default='ookla', nullable=True),
        sa.Column('isp', sa.String(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_speedtest_results_id'), 'speedtest_results', ['id'], unique=False)
    op.create_index(op.f('ix_speedtest_results_timestamp'), 'speedtest_results', ['timestamp'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_speedtest_results_timestamp'), table_name='speedtest_results')
    op.drop_index(op.f('ix_speedtest_results_id'), table_name='speedtest_results')
    op.drop_table('speedtest_results')
