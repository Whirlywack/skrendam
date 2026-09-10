"""email streams: subscribers.plan, issues, deal_events, published_deals.expired_at
(spec 2026-09-10 WP6)."""

from datetime import datetime, time

import sqlalchemy as sa
from alembic import op

revision = "0014_email_streams"
down_revision = "0013_unsubscribe"
branch_labels = None
depends_on = None

_BATCH = 500


def upgrade() -> None:
    with op.batch_alter_table("subscribers") as b:
        b.add_column(sa.Column("plan", sa.String(), nullable=False, server_default="free"))
        b.add_column(sa.Column("paid_since", sa.DateTime(timezone=True), nullable=True))
        b.add_column(sa.Column("paid_source", sa.String(), nullable=True))
    op.create_index("ix_subscribers_plan", "subscribers", ["plan"])

    with op.batch_alter_table("published_deals") as b:
        b.add_column(sa.Column("expired_at", sa.DateTime(), nullable=True))

    op.create_table(
        "issues",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("kind", sa.String(), nullable=False),
        sa.Column("sent_at", sa.DateTime(), nullable=True),
        sa.Column("deal_ids", sa.JSON(), nullable=False),
        sa.Column("expired_deal_ids", sa.JSON(), nullable=False),
        sa.Column("stats", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_table(
        "deal_events",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("deal_id", sa.Integer(), sa.ForeignKey("published_deals.id"), nullable=False),
        sa.Column("issue_id", sa.Integer(), sa.ForeignKey("issues.id"), nullable=True),
        sa.Column("subscriber_id", sa.Integer(), sa.ForeignKey("subscribers.id"), nullable=True),
        sa.Column("kind", sa.String(), nullable=False),
        sa.Column("source", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_deal_events_deal_id", "deal_events", ["deal_id"])
    op.create_index("ix_deal_events_issue_id", "deal_events", ["issue_id"])
    op.create_index("ix_deal_events_subscriber_id", "deal_events", ["subscriber_id"])

    # Backfill expired_at for deals that expired before the column existed.
    # In Python, not SQL: valid_until is a Date and the others are DateTimes,
    # and casting/combining them differs between Postgres and SQLite (this
    # migration runs on both — tests/skrendam/test_migration.py). Best guess
    # of WHEN a deal expired: the day it stopped being valid, else the last
    # time it was seen, else the day it was published.
    bind = op.get_bind()
    rows = bind.execute(
        sa.text(
            "SELECT id, valid_until, last_seen_at, published_at FROM published_deals "
            "WHERE status = 'expired'"
        )
    ).fetchall()
    for start in range(0, len(rows), _BATCH):
        for pid, valid_until, last_seen_at, published_at in rows[start : start + _BATCH]:
            if valid_until is not None:
                expired_at = datetime.combine(_as_date(valid_until), time.min)
            else:
                expired_at = _as_datetime(last_seen_at or published_at)
            bind.execute(
                sa.text("UPDATE published_deals SET expired_at = :t WHERE id = :id"),
                {"t": expired_at, "id": pid},
            )


def _as_date(v):
    # SQLite hands raw text back through sa.text(); Postgres hands a date.
    return v if not isinstance(v, str) else datetime.fromisoformat(v).date()


def _as_datetime(v):
    return v if not isinstance(v, str) else datetime.fromisoformat(v)


def downgrade() -> None:
    op.drop_index("ix_deal_events_subscriber_id", table_name="deal_events")
    op.drop_index("ix_deal_events_issue_id", table_name="deal_events")
    op.drop_index("ix_deal_events_deal_id", table_name="deal_events")
    op.drop_table("deal_events")
    op.drop_table("issues")
    with op.batch_alter_table("published_deals") as b:
        b.drop_column("expired_at")
    op.drop_index("ix_subscribers_plan", table_name="subscribers")
    with op.batch_alter_table("subscribers") as b:
        b.drop_column("paid_source")
        b.drop_column("paid_since")
        b.drop_column("plan")
