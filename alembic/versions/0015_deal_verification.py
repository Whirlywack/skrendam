"""deal verification: published_deals current price / window min / verified_at /
missed_checks, deal_price_checks history (spec 2026-09-11 WP9)."""

import sqlalchemy as sa
from alembic import op

revision = "0015_deal_verification"
down_revision = "0014_email_streams"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("published_deals") as b:
        b.add_column(sa.Column("current_price", sa.Float(), nullable=True))
        b.add_column(sa.Column("current_price_at", sa.DateTime(), nullable=True))
        b.add_column(sa.Column("window_min_price", sa.Float(), nullable=True))
        b.add_column(sa.Column("window_min_date", sa.Date(), nullable=True))
        b.add_column(sa.Column("verified_at", sa.DateTime(), nullable=True))
        b.add_column(
            sa.Column("missed_checks", sa.Integer(), nullable=False, server_default="0")
        )

    op.create_table(
        "deal_price_checks",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "deal_id",
            sa.Integer(),
            sa.ForeignKey("published_deals.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("checked_at", sa.DateTime(), nullable=False),
        sa.Column("source", sa.String(), nullable=False),
        sa.Column("available", sa.Boolean(), nullable=False),
        sa.Column("price", sa.Float(), nullable=True),
        sa.Column("window_min_price", sa.Float(), nullable=True),
        sa.Column("window_min_date", sa.Date(), nullable=True),
        sa.Column("run_id", sa.Integer(), sa.ForeignKey("scan_runs.id"), nullable=True),
    )
    op.create_index("ix_deal_price_checks_deal_id", "deal_price_checks", ["deal_id"])


def downgrade() -> None:
    op.drop_index("ix_deal_price_checks_deal_id", table_name="deal_price_checks")
    op.drop_table("deal_price_checks")
    with op.batch_alter_table("published_deals") as b:
        b.drop_column("missed_checks")
        b.drop_column("verified_at")
        b.drop_column("window_min_date")
        b.drop_column("window_min_price")
        b.drop_column("current_price_at")
        b.drop_column("current_price")
