"""add subscribers table

Revision ID: b7c41d9e2a02
Revises: a3f10c2b77e1
Create Date: 2026-06-03 16:30:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'b7c41d9e2a02'
down_revision: Union[str, Sequence[str], None] = 'a3f10c2b77e1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'subscribers',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('email', sa.String(), nullable=False),
        sa.Column('source', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('email'),
    )


def downgrade() -> None:
    op.drop_table('subscribers')
