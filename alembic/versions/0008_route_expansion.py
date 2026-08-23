"""Add routes.core, deal_templates.min_departure_dates, candidates.departure_date_count.

Revision ID: 0008_route_expansion
Revises: 0007_fli_resilience
Create Date: 2026-06-12
"""

import sqlalchemy as sa

from alembic import op

revision = "0008_route_expansion"
down_revision = "0007_fli_resilience"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add cohort, marketability-gate, and departure-date-count columns."""
    op.add_column(
        "routes",
        sa.Column("core", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.add_column(
        "deal_templates",
        sa.Column("min_departure_dates", sa.Integer(), nullable=True),
    )
    op.add_column(
        "candidates",
        sa.Column(
            "departure_date_count",
            sa.Integer(),
            nullable=True,
            comment=(
                "Calendar dates priced <=110% of the fare, window-relative to the "
                "DISCOVERING spec - may differ from another matching template's window."
            ),
        ),
    )


def downgrade() -> None:
    """Remove the three 0008 columns."""
    op.drop_column("candidates", "departure_date_count")
    op.drop_column("deal_templates", "min_departure_dates")
    op.drop_column("routes", "core")
