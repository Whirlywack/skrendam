from datetime import date, datetime

from skrendam.db import models, repositories as repo


def test_upsert_candidate_is_idempotent_and_preserves_decision(session):
    session.add(models.Route(id=1, origin="VNO", destination="BCN", zone="MED"))
    session.flush()
    fields = dict(route_id=1, origin="VNO", destination="BCN", zone="MED", trip_type="oneway",
                  travel_date=date(2026, 7, 29), return_date=None, price=30.0, currency="EUR",
                  baseline_price=49.0, discount_pct=39.0)
    key = "VNO|BCN|oneway|2026-07-29|30"
    now = datetime(2026, 6, 2)

    c1 = repo.upsert_candidate(session, key, fields, now)
    c1.status = "rejected"          # curator decision
    session.flush()

    c2 = repo.upsert_candidate(session, key, {**fields, "price": 28.0}, datetime(2026, 6, 3))
    assert c2.id == c1.id                       # same row
    assert c2.status == "rejected"              # decision preserved (no resurrection)
    assert c2.last_seen_at == datetime(2026, 6, 3)
    assert session.query(models.Candidate).count() == 1
