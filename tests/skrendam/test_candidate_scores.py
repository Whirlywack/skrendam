from datetime import date

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session as SASession

from skrendam.db import models as m
from skrendam.db import repositories as repo
from skrendam.db.base import Base
from skrendam.scanning.scoring.base import Score


def _session():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    return SASession(engine)


def _seed_candidate(s):
    s.add(m.Zone(zone="EU_SHORT", haul_type="short"))
    s.add(m.Route(id=1, origin="VNO", destination="AMS", zone="EU_SHORT"))
    s.add(m.AudienceSegment(id=1, slug="a", name="a"))
    s.add(m.TravelMoment(id=1, slug="t", name="t", moment_type="relative"))
    s.add(m.DealTemplate(id=1, slug="d", name="d", audience_segment_id=1, travel_moment_id=1))
    s.add(m.Candidate(id=1, route_id=1, origin="VNO", destination="AMS", zone="EU_SHORT",
                      trip_type="oneway", travel_date=date(2026, 6, 1), price=100.0,
                      deal_group_key="k1"))
    s.flush()


def _score(scorer="drop", value=0.4):
    return Score(scorer=scorer, value=value, score_0_100=round(value * 100),
                 quality_tier=None, reason_text="r", signals={"x": 1})


def test_upsert_score_inserts_then_updates():
    s = _session()
    _seed_candidate(s)
    _row, created = repo.upsert_score(s, 1, 1, _score(value=0.4))
    assert created is True
    _row, created = repo.upsert_score(s, 1, 1, _score(value=0.7))
    assert created is False
    rows = s.scalars(select(m.CandidateScore).where(m.CandidateScore.scorer == "drop")).all()
    assert len(rows) == 1
    assert rows[0].value == 0.7


def test_upsert_match_writes_headline_fields():
    s = _session()
    _seed_candidate(s)
    repo.upsert_match(s, 1, 1, 0.9, "reason", {"price_anomaly": True},
                      score_0_100=90, quality_tier="great", primary_scorer="weighted")
    row = s.scalar(select(m.CandidateTemplateMatch))
    assert row.score_0_100 == 90
    assert row.quality_tier == "great"
    assert row.primary_scorer == "weighted"
