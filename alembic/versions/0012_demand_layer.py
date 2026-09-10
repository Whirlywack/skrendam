"""demand layer: peak_windows + match score_v2/archetype/demand_signals (spec 2026-09-10 WP2)."""

import sqlalchemy as sa
from alembic import op

revision = "0012_demand_layer"
down_revision = "0011_brand_voice_headlines"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "peak_windows",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("slug", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("kind", sa.String(), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("return_start_date", sa.Date(), nullable=True),
        sa.Column("return_end_date", sa.Date(), nullable=True),
        sa.Column("pref_codes", sa.JSON(), nullable=False),
        sa.Column("source_url", sa.String(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("slug"),
    )
    with op.batch_alter_table("candidate_template_matches") as b:
        b.add_column(sa.Column("score_v2", sa.Integer(), nullable=True))
        b.add_column(sa.Column("archetype", sa.String(), nullable=True))
        b.add_column(sa.Column("demand_signals", sa.JSON(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("candidate_template_matches") as b:
        b.drop_column("demand_signals")
        b.drop_column("archetype")
        b.drop_column("score_v2")
    op.drop_table("peak_windows")
