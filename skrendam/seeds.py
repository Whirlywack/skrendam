"""Idempotent seed of starter config (spec §12). Destinations are a starter set; expand in admin."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from skrendam.db import models

ZONES = [
    ("WESTERN_EUROPE", "short", 50, 25, 25),
    ("MEDITERRANEAN", "short", 60, 30, 25),
    ("SCANDINAVIA", "short", 50, 25, 25),
    ("CANARIES", "medium", 110, 50, 30),
    ("CITY_BREAKS", "short", 45, 20, 25),
    ("LONG_HAUL", "long", 350, 150, 30),
]

# (origin, destination, zone) - starter set across VNO/KUN/RIX; expand later in admin.
ROUTES = [
    ("VNO", "BCN", "MEDITERRANEAN"), ("VNO", "AGP", "MEDITERRANEAN"),
    ("VNO", "STN", "CITY_BREAKS"), ("VNO", "CPH", "SCANDINAVIA"),
    ("VNO", "VIE", "CITY_BREAKS"), ("VNO", "LCA", "MEDITERRANEAN"),
    ("KUN", "AGP", "MEDITERRANEAN"), ("KUN", "BGY", "CITY_BREAKS"),
    ("KUN", "STN", "CITY_BREAKS"), ("KUN", "CIA", "CITY_BREAKS"),
    ("RIX", "TFS", "CANARIES"), ("RIX", "AYT", "MEDITERRANEAN"),
    ("RIX", "BCN", "MEDITERRANEAN"), ("RIX", "PRG", "CITY_BREAKS"),
]

AUDIENCES = [
    ("families", "Families", "strict"),
    ("couples", "Couples", "normal"),
    ("flexible_adults", "Flexible adults", "relaxed"),
    ("budget", "Budget travelers", "relaxed"),
    ("city_break", "City-break travelers", "normal"),
]

MOMENTS = [
    ("school_holidays", "School holidays", "seasonal", "School-holiday sun without package prices"),
    ("sept_shoulder", "September shoulder", "seasonal", "Still warm, fewer families, cheaper"),
    ("last_warm_days", "Last warm days", "seasonal", "One last sun trip before winter"),
    ("xmas_markets", "Christmas markets", "fixed_dates", "Cheap Christmas-market weekends"),
    ("last_minute", "Last-minute weekends", "relative", "Leave this weekend"),
    ("plan_ahead_summer", "Plan-ahead summer", "relative", "Book summer early when the fare is good"),
    ("winter_sun", "Winter sun", "seasonal", "Escape the dark months for real warmth"),
    ("ski_season", "Ski season", "seasonal", "The Alps at a Baltic-friendly price"),
]


def _get_or_create(session, model, defaults, **key):
    obj = session.scalar(select(model).filter_by(**key))
    if obj:
        return obj
    obj = model(**key, **{k: v for k, v in defaults.items() if k not in key})
    session.add(obj)
    session.flush()
    return obj


def seed_all(session: Session) -> None:
    for zone, haul, thr, mas, mdp in ZONES:
        _get_or_create(session, models.Zone, dict(haul_type=haul, threshold_price_eur=thr,
                       min_abs_savings_eur=mas, min_discount_pct=mdp), zone=zone)
    for o, d, z in ROUTES:
        _get_or_create(session, models.Route, dict(zone=z, enabled=True), origin=o, destination=d)
    aud = {s: _get_or_create(session, models.AudienceSegment,
           dict(name=n, default_itinerary_tolerance=t), slug=s) for s, n, t in AUDIENCES}
    mom = {s: _get_or_create(session, models.TravelMoment,
           dict(name=n, moment_type=mt, default_content_angle=ca), slug=s)
           for s, n, mt, ca in MOMENTS}

    templates = [
        dict(slug="family-school-holiday-sun", name="Family school-holiday sun",
             audience="families", moment="school_holidays", trip_type="roundtrip",
             date_window_type="seasonal", season_start_mmdd="06-01", season_end_mmdd="08-31",
             included_zones=["MEDITERRANEAN", "CANARIES"], trip_len_min_days=7, trip_len_max_days=14,
             max_stops=1, allow_overnight_layover=False, allow_airport_change=False,
             family_friendly_times_only=True, max_price_eur=400, min_discount_pct=20,
             public_label="Family sun", newsletter_tag="family_sun",
             suggested_headline_template="{origin}->{destination} EUR{price} return - school-holiday sun",
             content_angle="School-holiday sun without package prices"),
        dict(slug="september-sun", name="September sun, fewer crowds",
             audience="couples", moment="sept_shoulder", trip_type="roundtrip",
             date_window_type="seasonal", season_start_mmdd="09-01", season_end_mmdd="09-30",
             included_zones=["MEDITERRANEAN", "CANARIES"], trip_len_min_days=3, trip_len_max_days=7,
             max_stops=1, min_discount_pct=25, public_label="September sun",
             newsletter_tag="sept_sun", content_angle="Still warm, fewer families, cheaper"),
        dict(slug="last-warm-days", name="Last warm days",
             audience="flexible_adults", moment="last_warm_days", trip_type="roundtrip",
             date_window_type="seasonal", season_start_mmdd="10-01", season_end_mmdd="11-30",
             included_zones=["MEDITERRANEAN", "CANARIES"], trip_len_min_days=3, trip_len_max_days=10,
             max_stops=1, max_price_eur=150, min_discount_pct=25, public_label="Last warm days",
             newsletter_tag="last_warm", content_angle="One last sun trip before winter"),
        dict(slug="christmas-markets", name="Christmas markets",
             audience="city_break", moment="xmas_markets", trip_type="roundtrip",
             date_window_type="seasonal", season_start_mmdd="12-01", season_end_mmdd="12-23",
             included_zones=["CITY_BREAKS", "WESTERN_EUROPE"],
             trip_len_min_days=2, trip_len_max_days=4, max_stops=1, prefer_direct=True,
             public_label="Christmas markets", newsletter_tag="xmas",
             content_angle="Cheap Christmas-market weekends"),
        dict(slug="last-minute-weekends", name="Last-minute long weekends",
             audience="budget", moment="last_minute", trip_type="oneway",
             date_window_type="relative", rel_offset_start_days=3, rel_offset_end_days=21,
             included_zones=["CITY_BREAKS", "WESTERN_EUROPE"], preferred_departure_days=["FRI", "SAT"],
             psychological_price_threshold_eur=40, allow_smaller_discount_if_under_price=True,
             max_stops=1, public_label="Leave this weekend", newsletter_tag="last_minute",
             suggested_headline_template="{origin}->{destination} just EUR{price} - leave this weekend",
             content_angle="Leave this weekend"),
        dict(slug="plan-ahead-summer", name="Plan-ahead summer",
             audience="families", moment="plan_ahead_summer", trip_type="roundtrip",
             date_window_type="relative", rel_offset_start_days=60, rel_offset_end_days=180,
             included_zones=["MEDITERRANEAN", "CANARIES"], trip_len_min_days=7, trip_len_max_days=14,
             max_stops=1, min_discount_pct=30, public_label="Plan-ahead summer",
             newsletter_tag="plan_summer", content_angle="Book summer early when the fare is good"),
        # Discount-gated, no max_price: Med p10 ~EUR170 vs Canaries p10 ~EUR407, one cap
        # can't serve both. Revisit ~Dec 1 with real winter history (research 2026-08-21).
        dict(slug="winter-sun-escape", name="Winter sun escape",
             audience="flexible_adults", moment="winter_sun", trip_type="roundtrip",
             date_window_type="seasonal", season_start_mmdd="11-01", season_end_mmdd="03-31",
             included_zones=["MEDITERRANEAN", "CANARIES", "MIDDLE_EAST"],
             trip_len_min_days=4, trip_len_max_days=10,
             max_stops=1, allow_overnight_layover=False, allow_airport_change=False,
             min_discount_pct=25, public_label="Winter sun", newsletter_tag="winter_sun",
             suggested_headline_template="{origin}->{destination} EUR{price} return - winter sun",
             content_angle="Escape the dark months for real warmth"),
        # Inert until Alps routes are seeded (route refresh rides with PR #8).
        # Deal copy must mention LCC ski-bag fees (EUR40-60 each way).
        dict(slug="ski-alps", name="Ski trip to the Alps",
             audience="flexible_adults", moment="ski_season", trip_type="roundtrip",
             date_window_type="seasonal", season_start_mmdd="12-01", season_end_mmdd="03-31",
             included_destinations=["GVA", "GNB", "TRN", "SZG", "ZRH", "MUC"],
             trip_len_min_days=3, trip_len_max_days=8,
             max_stops=1, allow_overnight_layover=False, allow_airport_change=False,
             min_discount_pct=25, public_label="Ski season", newsletter_tag="ski",
             suggested_headline_template="{origin}->{destination} EUR{price} return - ski the Alps",
             content_angle="The Alps at a Baltic-friendly price"),
    ]
    for t in templates:
        a, m = aud[str(t.pop("audience"))], mom[str(t.pop("moment"))]
        _get_or_create(session, models.DealTemplate,
                       dict(audience_segment_id=a.id, travel_moment_id=m.id, enabled=True, **t),
                       slug=str(t.pop("slug")))
    session.commit()
