"""multi-strategy scoring: candidate_scores, headline columns, primary_scorer, price_log index

Revision ID: 0006_multi_strategy_scoring
Revises: adb4f0192c7e
Create Date: 2026-06-11
"""

import sqlalchemy as sa
from alembic import op

revision = "0006_multi_strategy_scoring"
down_revision = "adb4f0192c7e"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "candidate_scores",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("candidate_id", sa.Integer(), sa.ForeignKey("candidates.id"), nullable=False, index=True),
        sa.Column("deal_template_id", sa.Integer(), sa.ForeignKey("deal_templates.id"), nullable=False, index=True),
        sa.Column("scorer", sa.String(), nullable=False),
        sa.Column("value", sa.Float(), nullable=False),
        sa.Column("score_0_100", sa.Integer(), nullable=False),
        sa.Column("quality_tier", sa.String(), nullable=True),
        sa.Column("reason_text", sa.Text(), nullable=True),
        sa.Column("signals", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.add_column("candidate_template_matches", sa.Column("score_0_100", sa.Integer(), nullable=True))
    op.add_column("candidate_template_matches", sa.Column("quality_tier", sa.String(), nullable=True))
    op.add_column("candidate_template_matches", sa.Column("primary_scorer", sa.String(), nullable=True))
    op.add_column("deal_templates",
                  sa.Column("primary_scorer", sa.String(), nullable=False, server_default="weighted"))
    op.create_index("ix_price_log_route_trip_date_scanned", "price_log",
                    ["route_id", "trip_type", "travel_date", "scanned_at"])


def downgrade() -> None:
    op.drop_index("ix_price_log_route_trip_date_scanned", table_name="price_log")
    op.drop_column("deal_templates", "primary_scorer")
    op.drop_column("candidate_template_matches", "primary_scorer")
    op.drop_column("candidate_template_matches", "quality_tier")
    op.drop_column("candidate_template_matches", "score_0_100")
    op.drop_table("candidate_scores")
