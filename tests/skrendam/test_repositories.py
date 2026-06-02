from datetime import date, datetime

from skrendam.db import models, repositories as repo


def test_upsert_candidate_is_idempotent_and_preserves_decision(session):
    session.add(models.Route(id=1, origin="VNO", destination="BCN", zone="MED"))
    session.flush()
    fields = dict(route_id=1, origin="VNO", destination="BCN", zone="MED", trip_type="oneway",
                  travel_date=date(2026, 7, 29), return_date=None, price=30.0, currency="EUR",
                  baseline_price=49.0, discount_pct=39.0,
                  expires_at=datetime(2026, 6, 16))
    key = "VNO|BCN|oneway|2026-07-29|30"
    now = datetime(2026, 6, 2)

    c1, created1 = repo.upsert_candidate(session, key, fields, now)
    assert created1 is True
    c1.status = "rejected"          # curator decision
    session.flush()

    c2, created2 = repo.upsert_candidate(
        session, key, {**fields, "price": 28.0, "expires_at": datetime(2026, 6, 17)},
        datetime(2026, 6, 3))
    assert created2 is False
    assert c2.id == c1.id                       # same row
    assert c2.status == "rejected"              # decision preserved (no resurrection)
    assert c2.last_seen_at == datetime(2026, 6, 3)
    assert session.query(models.Candidate).count() == 1
    # expires_at must NOT be refreshed for a decided candidate
    assert c2.expires_at == datetime(2026, 6, 16)


def test_upsert_candidate_refreshes_expires_at_for_non_decided(session):
    session.add(models.Route(id=2, origin="VNO", destination="MAD", zone="MED"))
    session.flush()
    fields = dict(route_id=2, origin="VNO", destination="MAD", zone="MED", trip_type="oneway",
                  travel_date=date(2026, 8, 1), return_date=None, price=45.0, currency="EUR",
                  baseline_price=70.0, discount_pct=35.0,
                  expires_at=datetime(2026, 6, 16))
    key = "VNO|MAD|oneway|2026-08-01|45"
    now = datetime(2026, 6, 2)

    c1, created1 = repo.upsert_candidate(session, key, fields, now)
    assert created1 is True
    # status remains "new" (non-decided)

    c2, created2 = repo.upsert_candidate(
        session, key, {**fields, "price": 43.0, "expires_at": datetime(2026, 6, 17)},
        datetime(2026, 6, 3))
    assert created2 is False
    assert c2.id == c1.id
    # expires_at MUST be refreshed for non-decided candidates
    assert c2.expires_at == datetime(2026, 6, 17)
