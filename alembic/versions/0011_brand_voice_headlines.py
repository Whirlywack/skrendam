"""Brand-voice headlines: drop machine headline templates, rewrite system drafts.

The five seeded templates carried `{origin}->{destination} EUR{price} return`
patterns, which rendered on the public site as "VNO->LCA just EUR140". The
scan's fallback headline is now brand voice ("€140 return to Larnaca — one last
sun trip before winter."), so:

1. those template patterns are nulled to let the fallback apply, and
2. every *system-written, still-draft* content_draft whose headline matches the
   machine pattern is rewritten with the same fallback.

Curator-authored templates, curator-edited drafts, and published_deals are
untouched (published headlines were approved by a human; the site guards the
machine pattern at render time anyway).

Revision ID: 0011_brand_voice_headlines
Revises: 0010_merge_heads
Create Date: 2026-08-23
"""

import sqlalchemy as sa

from alembic import op
from skrendam.scanning.content import fallback_headline

revision = "0011_brand_voice_headlines"
down_revision = "0010_merge_heads"
branch_labels = None
depends_on = None

MACHINE_PREFIX = "{origin}->{destination}"


def upgrade() -> None:
    """Null machine-pattern templates; rewrite system drafts that used them."""
    bind = op.get_bind()
    bind.execute(
        sa.text(
            "UPDATE deal_templates SET suggested_headline_template = NULL "
            "WHERE suggested_headline_template LIKE :p"
        ),
        {"p": f"{MACHINE_PREFIX}%"},
    )
    rows = bind.execute(
        sa.text(
            "SELECT d.id, c.destination, c.price, c.baseline_price, t.content_angle "
            "FROM content_drafts d "
            "JOIN candidates c ON c.id = d.candidate_id "
            "JOIN deal_templates t ON t.id = d.deal_template_id "
            "WHERE d.created_by = 'system' AND d.status = 'draft' "
            "AND d.headline LIKE '___->___%'"
        )
    ).fetchall()
    for draft_id, destination, price, baseline, angle in rows:
        bind.execute(
            sa.text("UPDATE content_drafts SET headline = :h WHERE id = :id"),
            {"h": fallback_headline(destination, float(price), baseline, angle), "id": draft_id},
        )


def downgrade() -> None:
    """Data-only; the old machine patterns are not worth restoring."""
