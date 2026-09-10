import subprocess
from datetime import date, datetime

import sqlalchemy as sa
from sqlalchemy import select
from sqlalchemy.orm import Session

from skrendam.db import models
from skrendam.seeds import seed_all


def _alembic(*args):
    return subprocess.run(["uv", "run", "alembic", *args], capture_output=True, text=True)


def test_autogenerate_reports_no_diff(tmp_path, monkeypatch):
    """After the initial migration, autogenerate should detect no model drift."""
    db = tmp_path / "m.db"
    monkeypatch.setenv("SKRENDAM_DATABASE_URL", f"sqlite+pysqlite:///{db}")
    up = _alembic("upgrade", "head")
    assert up.returncode == 0, up.stderr
    chk = _alembic("check")
    assert chk.returncode == 0, chk.stdout + chk.stderr


def test_0011_rewrites_machine_headlines(tmp_path, monkeypatch):
    """0011 nulls machine templates and rewrites system drafts into brand voice."""
    url = f"sqlite+pysqlite:///{tmp_path / 'm.db'}"
    monkeypatch.setenv("SKRENDAM_DATABASE_URL", url)
    assert _alembic("upgrade", "0010_merge_heads").returncode == 0
    # DB is pinned at pre-0012 schema (no peak_windows table yet); this test only
    # cares about 0011's headline rewrite, so skip the unrelated peak-window seed.
    monkeypatch.setattr("skrendam.seeds.PEAK_WINDOWS", [])

    eng = sa.create_engine(url)
    with Session(eng) as s:
        seed_all(s)  # real templates + routes; seeds no longer carry machine patterns, so:
        tpl = s.scalar(select(models.DealTemplate).filter_by(slug="last-warm-days"))
        tpl.suggested_headline_template = "{origin}->{destination} EUR{price} return"
        other = s.scalar(select(models.DealTemplate).filter_by(slug="ski-alps"))
        other.suggested_headline_template = "Curator wrote this {price}"
        oneway = s.scalar(select(models.DealTemplate).filter_by(slug="last-minute-weekends"))
        oneway.suggested_headline_template = "{origin}->{destination} EUR{price}"
        route = s.scalar(select(models.Route).filter_by(origin="VNO", destination="LCA"))
        cand = models.Candidate(
            route_id=route.id,
            origin="VNO",
            destination="LCA",
            zone=route.zone,
            trip_type="return",
            travel_date=date(2026, 9, 30),
            price=140,
            baseline_price=285,
            deal_group_key="k1",
        )
        s.add(cand)
        s.flush()
        s.add_all(
            [
                models.ContentDraft(
                    id=1,
                    candidate_id=cand.id,
                    deal_template_id=tpl.id,
                    headline="VNO->LCA just EUR140 (usually EUR285)",
                    created_by="system",
                ),
                models.ContentDraft(
                    id=2,
                    candidate_id=cand.id,
                    deal_template_id=tpl.id,
                    headline="VNO->LCA just EUR140",
                    created_by="curator",
                ),
                models.ContentDraft(
                    id=3,
                    candidate_id=cand.id,
                    deal_template_id=oneway.id,
                    headline="VNO->LCA EUR140",
                    created_by="system",
                ),
            ]
        )
        s.commit()
        tpl_id, other_id = tpl.id, other.id

    up = _alembic("upgrade", "head")
    assert up.returncode == 0, up.stderr
    with eng.connect() as c:
        tpls = dict(
            x.tuple()
            for x in c.execute(
                sa.text("SELECT id, suggested_headline_template FROM deal_templates")
            )
        )
        assert tpls[tpl_id] is None
        assert tpls[other_id] == "Curator wrote this {price}"
        drafts = dict(
            x.tuple() for x in c.execute(sa.text("SELECT id, headline FROM content_drafts"))
        )
        assert drafts == {
            1: "€140 return to Larnaca (usually €285) — one last sun trip before winter.",
            2: "VNO->LCA just EUR140",  # curator-written: untouched
            # oneway template: never "return" (frozen _headline is trip-type aware)
            3: "€140 one-way to Larnaca (usually €285) — leave this weekend.",
        }


def test_0013_backfills_unsubscribe_token_for_every_row(tmp_path, monkeypatch):
    """0013 gives every pre-existing subscriber a distinct unsubscribe token."""
    url = f"sqlite+pysqlite:///{tmp_path / 'm.db'}"
    monkeypatch.setenv("SKRENDAM_DATABASE_URL", url)
    assert _alembic("upgrade", "0012_demand_layer").returncode == 0

    eng = sa.create_engine(url)
    with eng.begin() as c:
        for email in ("a@yip.lt", "b@yip.lt", "c@yip.lt"):
            c.execute(
                sa.text(
                    "INSERT INTO subscribers (email, created_at) VALUES (:e, CURRENT_TIMESTAMP)"
                ),
                {"e": email},
            )

    up = _alembic("upgrade", "head")
    assert up.returncode == 0, up.stderr
    with eng.connect() as c:
        rows = c.execute(
            sa.text("SELECT unsubscribe_token, unsubscribed_at FROM subscribers")
        ).fetchall()
    tokens = [r[0] for r in rows]
    assert len(tokens) == 3
    assert all(t for t in tokens), "every row must end with a non-empty token"
    assert len(set(tokens)) == 3, "tokens must be distinct"
    assert all(r[1] is None for r in rows), "backfill must not mark anyone unsubscribed"


def test_0014_backfills_expired_at(tmp_path, monkeypatch):
    """0014 stamps expired_at on already-expired deals and defaults plan to 'free'."""
    url = f"sqlite+pysqlite:///{tmp_path / 'm.db'}"
    monkeypatch.setenv("SKRENDAM_DATABASE_URL", url)
    assert _alembic("upgrade", "0013_unsubscribe").returncode == 0

    eng = sa.create_engine(url)
    with eng.begin() as c:
        c.execute(
            sa.text(
                "INSERT INTO subscribers (email, created_at) VALUES ('a@yip.lt', CURRENT_TIMESTAMP)"
            )
        )
        common = (
            "candidate_id, deal_template_id, headline, origin, destination, trip_type, price, "
            "tier, published_at, status, valid_until, last_seen_at"
        )
        rows = [
            (1, "expired", "2026-08-01", None),  # valid_until wins
            (2, "expired", None, "2026-08-05 10:00:00"),  # falls back to last_seen_at
            (3, "live", None, None),  # untouched
        ]
        for pid, status, valid_until, last_seen in rows:
            c.execute(
                sa.text(
                    f"INSERT INTO published_deals (id, {common}) VALUES "
                    "(:id, 1, 1, 'h', 'VNO', 'BCN', 'oneway', 30.0, 'free', '2026-07-01 08:00:00', "
                    ":status, :valid_until, :last_seen)"
                ),
                {"id": pid, "status": status, "valid_until": valid_until, "last_seen": last_seen},
            )

    up = _alembic("upgrade", "head")
    assert up.returncode == 0, up.stderr
    with eng.connect() as c:
        expired = {
            r[0]: (datetime.fromisoformat(r[1]) if r[1] else None)
            for r in c.execute(sa.text("SELECT id, expired_at FROM published_deals ORDER BY id"))
        }
        plan = c.execute(sa.text("SELECT plan FROM subscribers")).scalar_one()
    assert expired == {
        1: datetime(2026, 8, 1, 0, 0, 0),
        2: datetime(2026, 8, 5, 10, 0, 0),
        3: None,
    }
    assert plan == "free"
