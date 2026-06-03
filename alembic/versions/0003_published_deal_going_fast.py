"""add going_fast to published_deals

Revision ID: a3f10c2b77e1
Revises: e2f66796e0e9
Create Date: 2026-06-03 16:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'a3f10c2b77e1'
down_revision: Union[str, Sequence[str], None] = 'e2f66796e0e9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('published_deals',
                  sa.Column('going_fast', sa.Boolean(), nullable=False, server_default='false'))


def downgrade() -> None:
    op.drop_column('published_deals', 'going_fast')
