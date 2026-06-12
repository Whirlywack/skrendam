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
    # new zone: conservative until calibrated (run `skrendam calibrate` after a week of history)
    ("MIDDLE_EAST", "medium", 110, 50, 30),
    # new zone: conservative until calibrated (run `skrendam calibrate` after a week of history)
    ("CAUCASUS", "medium", 110, 50, 30),
]

# (origin, destination, zone, core) - 2026 VNO/KUN/RIX scheduled passenger network.
# Researched from Wikipedia airport route tables (Task 7); seasonal scheduled routes count,
# charter-only excluded. `core` routes scan every day and seed the deal templates; the rest
# rotate. Pilot scope is VNO/KUN/RIX only (no TLL, founder decision). Zone assignment:
# MEDITERRANEAN = Med-coast/island/Red-Sea/Madeira leisure; CANARIES = Canary Islands;
# SCANDINAVIA = Nordics; CITY_BREAKS = central/western city pairs; WESTERN_EUROPE = UK/IE/FR/
# BE/NL/DE regional & low-cost (incl. VFR corridors); MIDDLE_EAST = DXB/TLV; CAUCASUS = Georgia/
# Armenia; LONG_HAUL = beyond-Europe far-haul nonstop (only RIX-TAS qualifies in 2026).
ROUTES = [
    # VNO (50 routes)
    ("VNO", "BCN", "MEDITERRANEAN", True),  # core: proven cheap leisure (feeds sun templates)
    ("VNO", "AGP", "MEDITERRANEAN", True),  # core: proven cheap leisure (feeds sun templates)
    ("VNO", "LCA", "MEDITERRANEAN", False),
    ("VNO", "MLA", "MEDITERRANEAN", False),
    ("VNO", "ATH", "MEDITERRANEAN", False),
    ("VNO", "CFU", "MEDITERRANEAN", False),
    ("VNO", "HER", "MEDITERRANEAN", False),
    ("VNO", "CTA", "MEDITERRANEAN", False),
    ("VNO", "PMI", "MEDITERRANEAN", False),
    ("VNO", "LIS", "MEDITERRANEAN", False),
    ("VNO", "NCE", "MEDITERRANEAN", False),
    ("VNO", "TIA", "MEDITERRANEAN", False),
    ("VNO", "TFS", "CANARIES", False),
    ("VNO", "LPA", "CANARIES", False),
    ("VNO", "CPH", "SCANDINAVIA", False),
    ("VNO", "OSL", "SCANDINAVIA", True),  # core: VFR corridor (in vfr-watch destinations)
    ("VNO", "ARN", "SCANDINAVIA", False),
    ("VNO", "HEL", "SCANDINAVIA", False),
    ("VNO", "BGO", "SCANDINAVIA", False),
    ("VNO", "KEF", "SCANDINAVIA", False),
    ("VNO", "BLL", "SCANDINAVIA", False),
    ("VNO", "STN", "CITY_BREAKS", True),  # core: VFR corridor (in vfr-watch destinations)
    ("VNO", "LTN", "CITY_BREAKS", False),
    ("VNO", "VIE", "CITY_BREAKS", True),  # core: city-break staple (feeds xmas + last-minute)
    ("VNO", "PRG", "CITY_BREAKS", False),
    ("VNO", "BER", "CITY_BREAKS", False),
    ("VNO", "BUD", "CITY_BREAKS", False),
    ("VNO", "KRK", "CITY_BREAKS", False),
    ("VNO", "WAW", "CITY_BREAKS", False),
    ("VNO", "AMS", "CITY_BREAKS", False),
    ("VNO", "CDG", "CITY_BREAKS", False),
    ("VNO", "BGY", "CITY_BREAKS", False),
    ("VNO", "MXP", "CITY_BREAKS", False),
    ("VNO", "FCO", "CITY_BREAKS", False),
    ("VNO", "CIA", "CITY_BREAKS", False),
    ("VNO", "BRU", "CITY_BREAKS", False),
    ("VNO", "IST", "CITY_BREAKS", False),
    ("VNO", "MUC", "CITY_BREAKS", False),
    ("VNO", "FRA", "CITY_BREAKS", False),
    ("VNO", "ZRH", "CITY_BREAKS", False),
    ("VNO", "DUB", "WESTERN_EUROPE", False),
    ("VNO", "EIN", "WESTERN_EUROPE", False),
    ("VNO", "BVA", "WESTERN_EUROPE", False),
    ("VNO", "DTM", "WESTERN_EUROPE", False),
    ("VNO", "HHN", "WESTERN_EUROPE", False),
    ("VNO", "GDN", "WESTERN_EUROPE", False),
    ("VNO", "RMO", "WESTERN_EUROPE", False),
    ("VNO", "DXB", "MIDDLE_EAST", False),
    ("VNO", "TLV", "MIDDLE_EAST", False),
    ("VNO", "KUT", "CAUCASUS", False),
    # KUN (25 routes)
    ("KUN", "AGP", "MEDITERRANEAN", True),  # core: proven cheap leisure (feeds sun templates)
    ("KUN", "ALC", "MEDITERRANEAN", False),
    ("KUN", "MAD", "MEDITERRANEAN", False),
    ("KUN", "PMI", "MEDITERRANEAN", False),
    ("KUN", "NAP", "MEDITERRANEAN", False),
    ("KUN", "BRI", "MEDITERRANEAN", False),
    ("KUN", "PSA", "MEDITERRANEAN", False),
    ("KUN", "PFO", "MEDITERRANEAN", False),
    ("KUN", "RHO", "MEDITERRANEAN", False),
    ("KUN", "BOJ", "MEDITERRANEAN", False),
    ("KUN", "STN", "CITY_BREAKS", False),
    ("KUN", "LTN", "CITY_BREAKS", False),
    ("KUN", "BGY", "CITY_BREAKS", False),
    ("KUN", "CIA", "CITY_BREAKS", False),
    ("KUN", "CGN", "CITY_BREAKS", False),
    ("KUN", "CPH", "SCANDINAVIA", False),
    ("KUN", "ARN", "SCANDINAVIA", False),
    ("KUN", "GOT", "SCANDINAVIA", False),
    ("KUN", "DUB", "WESTERN_EUROPE", True),  # core: VFR corridor (in vfr-watch destinations)
    ("KUN", "EDI", "WESTERN_EUROPE", False),
    ("KUN", "BRS", "WESTERN_EUROPE", False),
    ("KUN", "LPL", "WESTERN_EUROPE", False),
    ("KUN", "SNN", "WESTERN_EUROPE", False),
    ("KUN", "CRL", "WESTERN_EUROPE", False),
    ("KUN", "RIX", "WESTERN_EUROPE", False),
    # RIX (71 routes)
    ("RIX", "BCN", "MEDITERRANEAN", False),
    ("RIX", "AGP", "MEDITERRANEAN", False),
    ("RIX", "MAD", "MEDITERRANEAN", False),
    ("RIX", "LCA", "MEDITERRANEAN", False),
    ("RIX", "MLA", "MEDITERRANEAN", False),
    ("RIX", "ATH", "MEDITERRANEAN", False),
    ("RIX", "AYT", "MEDITERRANEAN", False),
    ("RIX", "ALC", "MEDITERRANEAN", False),
    ("RIX", "CTA", "MEDITERRANEAN", False),
    ("RIX", "CFU", "MEDITERRANEAN", False),
    ("RIX", "HER", "MEDITERRANEAN", False),
    ("RIX", "RHO", "MEDITERRANEAN", False),
    ("RIX", "PMI", "MEDITERRANEAN", False),
    ("RIX", "FAO", "MEDITERRANEAN", False),
    ("RIX", "LIS", "MEDITERRANEAN", False),
    ("RIX", "SPU", "MEDITERRANEAN", False),
    ("RIX", "DBV", "MEDITERRANEAN", False),
    ("RIX", "TIA", "MEDITERRANEAN", False),
    ("RIX", "RAK", "MEDITERRANEAN", False),
    ("RIX", "HRG", "MEDITERRANEAN", False),
    ("RIX", "SSH", "MEDITERRANEAN", False),
    ("RIX", "SKG", "MEDITERRANEAN", False),
    ("RIX", "FNC", "MEDITERRANEAN", False),
    ("RIX", "TFS", "CANARIES", True),  # core: proven cheap leisure (feeds sun templates)
    ("RIX", "LPA", "CANARIES", False),
    ("RIX", "CPH", "SCANDINAVIA", False),
    ("RIX", "OSL", "SCANDINAVIA", False),
    ("RIX", "ARN", "SCANDINAVIA", False),
    ("RIX", "HEL", "SCANDINAVIA", False),
    ("RIX", "BGO", "SCANDINAVIA", False),
    ("RIX", "KEF", "SCANDINAVIA", False),
    ("RIX", "BLL", "SCANDINAVIA", False),
    ("RIX", "OUL", "SCANDINAVIA", False),
    ("RIX", "TMP", "SCANDINAVIA", False),
    ("RIX", "PRG", "CITY_BREAKS", True),  # core: city-break staple (feeds xmas + last-minute)
    ("RIX", "VIE", "CITY_BREAKS", False),
    ("RIX", "BER", "CITY_BREAKS", False),
    ("RIX", "BUD", "CITY_BREAKS", False),
    ("RIX", "AMS", "CITY_BREAKS", False),
    ("RIX", "CDG", "CITY_BREAKS", False),
    ("RIX", "FCO", "CITY_BREAKS", False),
    ("RIX", "MXP", "CITY_BREAKS", False),
    ("RIX", "BGY", "CITY_BREAKS", False),
    ("RIX", "MUC", "CITY_BREAKS", False),
    ("RIX", "FRA", "CITY_BREAKS", False),
    ("RIX", "ZRH", "CITY_BREAKS", False),
    ("RIX", "WAW", "CITY_BREAKS", False),
    ("RIX", "KRK", "CITY_BREAKS", False),
    ("RIX", "BRU", "CITY_BREAKS", False),
    ("RIX", "IST", "CITY_BREAKS", False),
    ("RIX", "BEG", "CITY_BREAKS", False),
    ("RIX", "OTP", "CITY_BREAKS", False),
    ("RIX", "SOF", "CITY_BREAKS", False),
    ("RIX", "LJU", "CITY_BREAKS", False),
    ("RIX", "DUB", "WESTERN_EUROPE", False),
    ("RIX", "LGW", "WESTERN_EUROPE", True),  # core: VFR corridor (in vfr-watch destinations)
    ("RIX", "STN", "WESTERN_EUROPE", False),
    ("RIX", "MAN", "WESTERN_EUROPE", False),
    ("RIX", "EDI", "WESTERN_EUROPE", False),
    ("RIX", "EMA", "WESTERN_EUROPE", False),
    ("RIX", "CRL", "WESTERN_EUROPE", False),
    ("RIX", "FMM", "WESTERN_EUROPE", False),
    ("RIX", "RMO", "WESTERN_EUROPE", False),
    ("RIX", "PLQ", "WESTERN_EUROPE", False),
    ("RIX", "TSF", "WESTERN_EUROPE", False),
    ("RIX", "DXB", "MIDDLE_EAST", False),
    ("RIX", "TLV", "MIDDLE_EAST", False),
    ("RIX", "TBS", "CAUCASUS", False),
    ("RIX", "EVN", "CAUCASUS", False),
    ("RIX", "BUS", "CAUCASUS", False),
    ("RIX", "TAS", "LONG_HAUL", True),  # core: only nonstop far-haul (feeds long-haul-opportunist)
]

AUDIENCES = [
    ("families", "Families", "strict"),
    ("couples", "Couples", "normal"),
    ("flexible_adults", "Flexible adults", "relaxed"),
    ("budget", "Budget travelers", "relaxed"),
    ("city_break", "City-break travelers", "normal"),
    ("vfr", "Visiting friends & family", "relaxed"),
]

MOMENTS = [
    ("school_holidays", "School holidays", "seasonal", "School-holiday sun without package prices"),
    ("sept_shoulder", "September shoulder", "seasonal", "Still warm, fewer families, cheaper"),
    ("last_warm_days", "Last warm days", "seasonal", "One last sun trip before winter"),
    ("xmas_markets", "Christmas markets", "fixed_dates", "Cheap Christmas-market weekends"),
    ("last_minute", "Last-minute weekends", "relative", "Leave this weekend"),
    (
        "plan_ahead_summer",
        "Plan-ahead summer",
        "relative",
        "Book summer early when the fare is good",
    ),
    ("vfr_visit", "VFR visit", "relative", "Cheap weekend to visit family abroad"),
    ("long_haul_chance", "Long-haul chance", "relative", "A long-haul fare worth planning around"),
]


def _get_or_create(session, model, defaults, **key):
    """Insert-only: returns the existing row unchanged if the key already exists."""
    obj = session.scalar(select(model).filter_by(**key))
    if obj:
        return obj
    obj = model(**key, **{k: v for k, v in defaults.items() if k not in key})
    session.add(obj)
    session.flush()
    return obj


def seed_all(session: Session) -> None:
    for zone, haul, thr, mas, mdp in ZONES:
        _get_or_create(
            session,
            models.Zone,
            dict(
                haul_type=haul,
                threshold_price_eur=thr,
                min_abs_savings_eur=mas,
                min_discount_pct=mdp,
            ),
            zone=zone,
        )
    for o, d, z, core in ROUTES:
        _get_or_create(
            session, models.Route, dict(zone=z, enabled=True, core=core), origin=o, destination=d
        )
    aud = {
        s: _get_or_create(
            session, models.AudienceSegment, dict(name=n, default_itinerary_tolerance=t), slug=s
        )
        for s, n, t in AUDIENCES
    }
    mom = {
        s: _get_or_create(
            session,
            models.TravelMoment,
            dict(name=n, moment_type=mt, default_content_angle=ca),
            slug=s,
        )
        for s, n, mt, ca in MOMENTS
    }

    # NOTE: insert-only — value changes to already-seeded rows need a one-off SQL update on
    # live DBs (see plan Task 10).
    templates = [
        dict(
            slug="family-school-holiday-sun",
            name="Family school-holiday sun",
            audience="families",
            moment="school_holidays",
            trip_type="roundtrip",
            date_window_type="seasonal",
            season_start_mmdd="06-01",
            season_end_mmdd="08-31",
            included_zones=["MEDITERRANEAN", "CANARIES"],
            trip_len_min_days=7,
            trip_len_max_days=14,
            max_stops=1,
            allow_overnight_layover=False,
            allow_airport_change=False,
            family_friendly_times_only=True,
            max_price_eur=400,
            min_discount_pct=20,
            min_departure_dates=5,
            public_label="Family sun",
            newsletter_tag="family_sun",
            suggested_headline_template="{origin}->{destination} EUR{price} return - school-holiday sun",
            content_angle="School-holiday sun without package prices",
        ),
        dict(
            slug="september-sun",
            name="September sun, fewer crowds",
            audience="couples",
            moment="sept_shoulder",
            trip_type="roundtrip",
            date_window_type="seasonal",
            season_start_mmdd="09-01",
            season_end_mmdd="09-30",
            included_zones=["MEDITERRANEAN", "CANARIES"],
            trip_len_min_days=3,
            trip_len_max_days=7,
            max_stops=1,
            min_discount_pct=25,
            min_departure_dates=5,
            public_label="September sun",
            newsletter_tag="sept_sun",
            content_angle="Still warm, fewer families, cheaper",
        ),
        dict(
            slug="last-warm-days",
            name="Last warm days",
            audience="flexible_adults",
            moment="last_warm_days",
            trip_type="roundtrip",
            date_window_type="seasonal",
            season_start_mmdd="10-01",
            season_end_mmdd="11-30",
            included_zones=["MEDITERRANEAN", "CANARIES"],
            trip_len_min_days=3,
            trip_len_max_days=10,
            max_stops=1,
            max_price_eur=150,
            min_discount_pct=25,
            public_label="Last warm days",
            newsletter_tag="last_warm",
            content_angle="One last sun trip before winter",
        ),
        dict(
            slug="christmas-markets",
            name="Christmas markets",
            audience="city_break",
            moment="xmas_markets",
            trip_type="roundtrip",
            date_window_type="seasonal",
            season_start_mmdd="12-01",
            season_end_mmdd="12-23",
            included_zones=["CITY_BREAKS", "WESTERN_EUROPE"],
            trip_len_min_days=2,
            trip_len_max_days=4,
            max_stops=1,
            prefer_direct=True,
            min_discount_pct=25,
            min_departure_dates=5,
            public_label="Christmas markets",
            newsletter_tag="xmas",
            content_angle="Cheap Christmas-market weekends",
        ),
        dict(
            slug="last-minute-weekends",
            name="Last-minute long weekends",
            audience="budget",
            moment="last_minute",
            trip_type="oneway",
            date_window_type="relative",
            rel_offset_start_days=3,
            rel_offset_end_days=21,
            included_zones=["CITY_BREAKS", "WESTERN_EUROPE"],
            preferred_departure_days=["FRI", "SAT"],
            psychological_price_threshold_eur=40,
            allow_smaller_discount_if_under_price=True,
            max_stops=1,
            public_label="Leave this weekend",
            newsletter_tag="last_minute",
            suggested_headline_template="{origin}->{destination} just EUR{price} - leave this weekend",
            content_angle="Leave this weekend",
        ),
        dict(
            slug="plan-ahead-summer",
            name="Plan-ahead summer",
            audience="families",
            moment="plan_ahead_summer",
            trip_type="roundtrip",
            date_window_type="relative",
            rel_offset_start_days=60,
            rel_offset_end_days=180,
            included_zones=["MEDITERRANEAN", "CANARIES"],
            trip_len_min_days=7,
            trip_len_max_days=14,
            max_stops=1,
            min_discount_pct=30,
            min_departure_dates=5,
            public_label="Plan-ahead summer",
            newsletter_tag="plan_summer",
            content_angle="Book summer early when the fare is good",
        ),
        # included_destinations must stay in sync with the ROUTES seed
        # (Task 7 coverage test enforces).
        dict(
            slug="vfr-watch",
            name="VFR corridor watch",
            audience="vfr",
            moment="vfr_visit",
            trip_type="roundtrip",
            date_window_type="relative",
            rel_offset_start_days=7,
            rel_offset_end_days=90,
            included_destinations=["STN", "LTN", "LGW", "DUB", "OSL"],
            trip_len_min_days=3,
            trip_len_max_days=14,
            max_stops=1,
            psychological_price_threshold_eur=80,
            allow_smaller_discount_if_under_price=True,
            min_departure_dates=5,
            public_label="Visit-home fares",
            newsletter_tag="vfr",
            suggested_headline_template="{origin}->{destination} EUR{price} return",
            content_angle="Cheap weekend to visit family abroad",
        ),
        dict(
            slug="long-haul-opportunist",
            name="Long-haul opportunist",
            audience="flexible_adults",
            moment="long_haul_chance",
            trip_type="roundtrip",
            date_window_type="relative",
            rel_offset_start_days=30,
            rel_offset_end_days=300,
            included_zones=["LONG_HAUL"],
            trip_len_min_days=7,
            trip_len_max_days=21,
            max_stops=2,
            min_discount_pct=30,
            public_label="Long-haul steal",
            newsletter_tag="long_haul",
            content_angle="A long-haul fare worth planning around",
        ),
    ]
    for t in templates:
        a, m = aud[str(t.pop("audience"))], mom[str(t.pop("moment"))]
        _get_or_create(
            session,
            models.DealTemplate,
            dict(audience_segment_id=a.id, travel_moment_id=m.id, enabled=True, **t),
            slug=str(t.pop("slug")),
        )
    session.commit()
