from datetime import date, datetime

from skrendam.db import models
from skrendam.db import repositories as repo


def test_upsert_candidate_is_idempotent_and_preserves_decision(session):
    session.add(models.Route(id=1, origin="VNO", destination="BCN", zone="MED"))
    session.flush()
    fields = {
        "route_id": 1,
        "origin": "VNO",
        "destination": "BCN",
        "zone": "MED",
        "trip_type": "oneway",
        "travel_date": date(2026, 7, 29),
        "return_date": None,
        "price": 30.0,
        "currency": "EUR",
        "baseline_price": 49.0,
        "discount_pct": 39.0,
        "expires_at": datetime(2026, 6, 16),
    }
    key = "VNO|BCN|oneway|2026-07-29|30"
    now = datetime(2026, 6, 2)

    c1, created1 = repo.upsert_candidate(session, key, fields, now)
    assert created1 is True
    c1.status = "rejected"  # curator decision
    session.flush()

    c2, created2 = repo.upsert_candidate(
        session,
        key,
        {**fields, "price": 28.0, "expires_at": datetime(2026, 6, 17)},
        datetime(2026, 6, 3),
    )
    assert created2 is False
    assert c2.id == c1.id  # same row
    assert c2.status == "rejected"  # decision preserved (no resurrection)
    assert c2.last_seen_at == datetime(2026, 6, 3)
    assert session.query(models.Candidate).count() == 1
    # expires_at must NOT be refreshed for a decided candidate
    assert c2.expires_at == datetime(2026, 6, 16)


def test_upsert_candidate_refreshes_expires_at_for_non_decided(session):
    session.add(models.Route(id=2, origin="VNO", destination="MAD", zone="MED"))
    session.flush()
    fields = {
        "route_id": 2,
        "origin": "VNO",
        "destination": "MAD",
        "zone": "MED",
        "trip_type": "oneway",
        "travel_date": date(2026, 8, 1),
        "return_date": None,
        "price": 45.0,
        "currency": "EUR",
        "baseline_price": 70.0,
        "discount_pct": 35.0,
        "expires_at": datetime(2026, 6, 16),
    }
    key = "VNO|MAD|oneway|2026-08-01|45"
    now = datetime(2026, 6, 2)

    c1, created1 = repo.upsert_candidate(session, key, fields, now)
    assert created1 is True
    # status remains "new" (non-decided)

    c2, created2 = repo.upsert_candidate(
        session,
        key,
        {**fields, "price": 43.0, "expires_at": datetime(2026, 6, 17)},
        datetime(2026, 6, 3),
    )
    assert created2 is False
    assert c2.id == c1.id
    # expires_at MUST be refreshed for non-decided candidates
    assert c2.expires_at == datetime(2026, 6, 17)


def test_upsert_candidate_refreshes_departure_date_count_for_non_decided(session):
    session.add(models.Route(id=3, origin="VNO", destination="AMS", zone="WEU"))
    session.flush()
    fields = {
        "route_id": 3,
        "origin": "VNO",
        "destination": "AMS",
        "zone": "WEU",
        "trip_type": "oneway",
        "travel_date": date(2026, 8, 10),
        "return_date": None,
        "price": 60.0,
        "currency": "EUR",
        "baseline_price": 90.0,
        "discount_pct": 33.0,
        "expires_at": datetime(2026, 6, 16),
        "departure_date_count": 3,
    }
    key = "VNO|AMS|oneway|2026-08-10|60"
    now = datetime(2026, 6, 2)

    c1, created1 = repo.upsert_candidate(session, key, fields, now)
    assert created1 is True
    assert c1.departure_date_count == 3
    # status remains "new" (non-decided)

    c2, created2 = repo.upsert_candidate(
        session, key, {**fields, "departure_date_count": 7}, datetime(2026, 6, 3)
    )
    assert created2 is False
    assert c2.id == c1.id
    # departure_date_count MUST be refreshed for non-decided candidates
    assert c2.departure_date_count == 7


def test_upsert_candidate_preserves_departure_date_count_for_approved(session):
    session.add(models.Route(id=4, origin="VNO", destination="LHR", zone="WEU"))
    session.flush()
    fields = {
        "route_id": 4,
        "origin": "VNO",
        "destination": "LHR",
        "zone": "WEU",
        "trip_type": "oneway",
        "travel_date": date(2026, 9, 1),
        "return_date": None,
        "price": 55.0,
        "currency": "EUR",
        "baseline_price": 85.0,
        "discount_pct": 35.0,
        "expires_at": datetime(2026, 6, 16),
        "departure_date_count": 3,
    }
    key = "VNO|LHR|oneway|2026-09-01|55"
    now = datetime(2026, 6, 2)

    c1, created1 = repo.upsert_candidate(session, key, fields, now)
    assert created1 is True
    c1.status = "approved"  # curator decision
    session.flush()

    c2, created2 = repo.upsert_candidate(
        session, key, {**fields, "departure_date_count": 7}, datetime(2026, 6, 3)
    )
    assert created2 is False
    assert c2.id == c1.id
    assert c2.status == "approved"
    # departure_date_count must NOT be refreshed for a curator-decided candidate
    assert c2.departure_date_count == 3
