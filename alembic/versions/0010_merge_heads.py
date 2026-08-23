"""Merge the two 0007-descended heads.

0008_route_expansion (this PR) and 0009_published_deal_social_posts (merged to
main 2026-08-22) both revise 0007 — this no-op revision joins them so
`alembic upgrade head` is unambiguous again.

Revision ID: 0010_merge_heads
Revises: 0008_route_expansion, 0009_published_deal_social_posts
Create Date: 2026-08-22
"""

revision = "0010_merge_heads"
down_revision = ("0008_route_expansion", "0009_published_deal_social_posts")
branch_labels = None
depends_on = None


def upgrade() -> None:
    """No-op merge point."""


def downgrade() -> None:
    """No-op merge point."""
