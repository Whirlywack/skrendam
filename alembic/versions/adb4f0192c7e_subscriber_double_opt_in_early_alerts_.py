"""subscriber double opt-in, early-alerts, prefs

Revision ID: adb4f0192c7e
Revises: b7c41d9e2a02
Create Date: 2026-06-04 20:13:04.353783

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'adb4f0192c7e'
down_revision: Union[str, Sequence[str], None] = 'b7c41d9e2a02'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('subscribers', sa.Column('confirmed', sa.Boolean(), nullable=False, server_default=sa.text('false')))
    op.add_column('subscribers', sa.Column('confirm_token', sa.String(), nullable=True))
    op.add_column('subscribers', sa.Column('confirmed_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('subscribers', sa.Column('early_alerts', sa.Boolean(), nullable=False, server_default=sa.text('false')))
    op.add_column('subscribers', sa.Column('prefs', sa.JSON(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('subscribers', 'prefs')
    op.drop_column('subscribers', 'early_alerts')
    op.drop_column('subscribers', 'confirmed_at')
    op.drop_column('subscribers', 'confirm_token')
    op.drop_column('subscribers', 'confirmed')
