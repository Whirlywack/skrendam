from skrendam.db import models
from skrendam.seeds import seed_all


def test_seed_is_idempotent(session):
    seed_all(session)
    seed_all(session)  # second run must not duplicate
    assert session.query(models.Zone).count() >= 4
    assert session.query(models.Route).count() >= 10
    assert session.query(models.AudienceSegment).count() == 5
    assert session.query(models.TravelMoment).count() == 8
    assert session.query(models.DealTemplate).count() == 8
    # every template references a real audience + moment
    for t in session.query(models.DealTemplate):
        assert t.audience_segment_id and t.travel_moment_id
        assert t.trip_type in ("oneway", "roundtrip")
