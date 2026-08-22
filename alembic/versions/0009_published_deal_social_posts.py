"""Deal Desk: track manual TikTok / Instagram posting per published deal.

The curator posts deal snapshots to TikTok/Instagram by hand and marks them
posted in the Live board (chips). Columns are timestamps, not booleans, so
"when was this posted" is answerable later for hook-performance analysis.

NOTE: this revises 0007 in parallel with PR #8's 0008_route_expansion (also
down_revision=0007). When PR #8 merges, add an `alembic merge` revision to
join the two heads. On Postgres the DDL is idempotent (IF NOT EXISTS) so
`upgrade heads` is safe on databases where the columns were pre-applied via
psql; SQLite (the migration test) gets portable op.add_column.

Revision ID: 0009_published_deal_social_posts
Revises: 0007_fli_resilience
Create Date: 2026-08-22
"""

import sqlalchemy as sa

from alembic import op

revision = "0009_published_deal_social_posts"
down_revision = "0007_fli_resilience"
branch_labels = None
depends_on = None

COLUMNS = ("posted_tiktok_at", "posted_instagram_at")


def upgrade() -> None:
    """Add posted_tiktok_at / posted_instagram_at to published_deals."""
    if op.get_bind().dialect.name == "postgresql":
        for col in COLUMNS:
            op.execute(f"ALTER TABLE published_deals ADD COLUMN IF NOT EXISTS {col} TIMESTAMP")
    else:
        for col in COLUMNS:
            op.add_column("published_deals", sa.Column(col, sa.DateTime(), nullable=True))


def downgrade() -> None:
    """Drop the social-posting columns."""
    for col in COLUMNS:
        op.drop_column("published_deals", col)
