from datetime import date

from skrendam.db import models
from skrendam import analyze


def _seed(session):
    session.add(models.Zone(zone="MED", haul_type="short", threshold_price_eur=150.0))
    session.add(models.Route(id=1, origin="VNO", destination="BCN", zone="MED"))
    session.add(models.AudienceSegment(id=1, slug="couples", name="Couples"))
    session.add(models.TravelMoment(id=1, slug="sept", name="September", moment_type="seasonal"))
    session.add(models.DealTemplate(id=1, slug="sept-sun", name="September sun",
                                    audience_segment_id=1, travel_moment_id=1, trip_type="roundtrip"))
    for i, (price, disc, score) in enumerate([(96.0, 67.0, 0.9), (150.0, 40.0, 0.7), (180.0, 20.0, 0.5)]):
        c = models.Candidate(id=i + 1, route_id=1, origin="VNO", destination="BCN", zone="MED",
                             trip_type="roundtrip", travel_date=date(2026, 9, 10), price=price,
                             baseline_price=290.0, discount_pct=disc, status="new",
                             deal_group_key=f"k{i}")
        session.add(c)
        session.add(models.CandidateTemplateMatch(candidate_id=i + 1, deal_template_id=1,
                                                  match_score=score))
    session.commit()


def test_analyze_summarizes_real_data(session):
    _seed(session)
    rep = analyze.analyze(session, great_threshold=0.8)
    assert rep.candidate_count == 3
    assert rep.match_count == 3
    assert rep.discount_p50 == 40.0
    assert rep.per_template[0].template == "September sun"
    assert rep.per_template[0].count == 3
    assert rep.tier_preview.great == 1
    assert rep.tier_preview.maybe == 2


def test_format_report_is_nonempty_string(session):
    _seed(session)
    rep = analyze.analyze(session, great_threshold=0.8)
    out = analyze.format_report(rep)
    assert "candidates" in out.lower() and "September sun" in out
