"""add_token_version_to_user

Revision ID: 7a1e2f3b4c5d
Revises: d01d8eb39fe5
Create Date: 2026-11-05 10:55:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7a1e2f3b4c5d'
down_revision: Union[str, Sequence[str], None] = 'd01d8eb39fe5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add token_version column to users table with server_default of 1
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(sa.Column('token_version', sa.Integer(), nullable=False, server_default='1'))


def downgrade() -> None:
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_column('token_version')
