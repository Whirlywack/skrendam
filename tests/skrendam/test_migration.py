import subprocess
from datetime import date

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

    eng = sa.create_engine(url)
    with Session(eng) as s:
        seed_all(s)  # real templates + routes; seeds no longer carry machine patterns, so:
        tpl = s.scalar(select(models.DealTemplate).filter_by(slug="last-warm-days"))
        tpl.suggested_headline_template = "{origin}->{destination} EUR{price} return"
        other = s.scalar(select(models.DealTemplate).filter_by(slug="ski-alps"))
        other.suggested_headline_template = "Curator wrote this {price}"
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
        }
