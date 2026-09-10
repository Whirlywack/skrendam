"""unsubscribe: subscribers.unsubscribe_token + unsubscribed_at (spec 2026-09-10 WP6)."""

import secrets

import sqlalchemy as sa
from alembic import op

revision = "0013_unsubscribe"
down_revision = "0012_demand_layer"
branch_labels = None
depends_on = None

_BATCH = 500


def upgrade() -> None:
    with op.batch_alter_table("subscribers") as b:
        b.add_column(sa.Column("unsubscribe_token", sa.String(), nullable=True))
        b.add_column(sa.Column("unsubscribed_at", sa.DateTime(timezone=True), nullable=True))

    # Backfill in Python, not SQL: md5(random()) is Postgres-only and this
    # migration also runs on SQLite (tests/skrendam/test_migration.py).
    # Every existing subscriber must end with a token — a marketing send with
    # no unsubscribe link is not one we are allowed to make.
    bind = op.get_bind()
    ids = [r[0] for r in bind.execute(sa.text("SELECT id FROM subscribers")).fetchall()]
    for start in range(0, len(ids), _BATCH):
        for sid in ids[start : start + _BATCH]:
            bind.execute(
                sa.text("UPDATE subscribers SET unsubscribe_token = :t WHERE id = :id"),
                {"t": secrets.token_hex(16), "id": sid},
            )

    op.create_index(
        "ix_subscribers_unsubscribe_token", "subscribers", ["unsubscribe_token"], unique=True
    )


def downgrade() -> None:
    op.drop_index("ix_subscribers_unsubscribe_token", table_name="subscribers")
    with op.batch_alter_table("subscribers") as b:
        b.drop_column("unsubscribed_at")
        b.drop_column("unsubscribe_token")
