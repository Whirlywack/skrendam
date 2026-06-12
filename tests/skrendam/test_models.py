from datetime import date, datetime

from skrendam.db import models


def test_can_persist_core_rows(session):
    z = models.Zone(zone="MEDITERRANEAN", haul_type="short",
                     threshold_price_eur=60, min_abs_savings_eur=30, min_discount_pct=25)
    r = models.Route(origin="VNO", destination="BCN", zone="MEDITERRANEAN", enabled=True)
    aud = models.AudienceSegment(slug="families", name="Families",
                                 default_itinerary_tolerance="strict")
    mom = models.TravelMoment(slug="summer", name="Summer", moment_type="seasonal")
    session.add_all([z, r, aud, mom])
    session.flush()

    tpl = models.DealTemplate(slug="summer-sun", name="Summer sun", enabled=True,
                              audience_segment_id=aud.id, travel_moment_id=mom.id,
                              trip_type="roundtrip", date_window_type="seasonal",
                              season_start_mmdd="06-01", season_end_mmdd="08-31",
                              included_zones=["MEDITERRANEAN"], trip_len_min_days=4,
                              trip_len_max_days=10, priority=10)
    session.add(tpl)
    session.flush()

    cand = models.Candidate(route_id=r.id, origin="VNO", destination="BCN",
                            zone="MEDITERRANEAN", trip_type="roundtrip",
                            travel_date=date(2026, 7, 10), price=120, currency="EUR",
                            baseline_price=200, discount_pct=40, status="new",
                            deal_group_key="VNO|BCN|roundtrip|2026-07-10|120",
                            first_seen_at=datetime(2026, 6, 2), last_seen_at=datetime(2026, 6, 2))
    session.add(cand)
    session.flush()

    m = models.CandidateTemplateMatch(candidate_id=cand.id, deal_template_id=tpl.id,
                                      match_score=0.82, reason_text="40% below baseline")
    session.add(m)
    session.commit()

    assert cand.id is not None
    assert m.candidate_id == cand.id
    assert session.query(models.Candidate).count() == 1


def test_0008_columns_exist(session):
    session.add(models.Zone(zone="MED", haul_type="short"))
    r = models.Route(origin="VNO", destination="BCN", zone="MED")
    session.add(r)
    session.flush()
    assert r.core is False  # default

    t_cols = models.DealTemplate.__table__.columns
    assert "min_departure_dates" in t_cols
    c_cols = models.Candidate.__table__.columns
    assert "departure_date_count" in c_cols
