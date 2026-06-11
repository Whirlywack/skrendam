"""fli resilience: scan_runs.health, published_deals.unverified_since.

Revision ID: 0007_fli_resilience
Revises: 0006_multi_strategy_scoring
Create Date: 2026-06-11
"""

import sqlalchemy as sa

from alembic import op

revision = "0007_fli_resilience"
down_revision = "0006_multi_strategy_scoring"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add health and unverified_since columns."""
    op.add_column("scan_runs", sa.Column("health", sa.JSON(), nullable=True))
    op.add_column(
        "published_deals",
        sa.Column("unverified_since", sa.DateTime(), nullable=True),
    )
    op.create_index(op.f("ix_price_log_run_id"), "price_log", ["run_id"])


def downgrade() -> None:
    """Remove health and unverified_since columns."""
    op.drop_index(op.f("ix_price_log_run_id"), table_name="price_log")
    op.drop_column("published_deals", "unverified_since")
    op.drop_column("scan_runs", "health")
