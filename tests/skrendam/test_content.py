from datetime import date

from skrendam.db import models
from skrendam.scanning.content import build_content_draft


def test_fills_templates_with_fare_facts():
    tpl = models.DealTemplate(
        slug="x",
        name="x",
        trip_type="oneway",
        suggested_headline_template="€{price} return to {city} from {from_city}",
        tiktok_hook_template="POV: you leave {origin} for EUR{price}",
        content_angle="Leave this weekend",
    )
    draft = build_content_draft(
        origin="VNO",
        destination="BCN",
        price=30,
        baseline=49,
        travel_date=date(2026, 7, 29),
        template=tpl,
    )
    assert draft["headline"] == "€30 return to Barcelona from Vilnius"
    assert "EUR30" in draft["tiktok_hook"]
    assert draft["created_by"] == "system"


def test_missing_templates_fall_back_to_brand_voice_headline():
    # Brand voice: "€ price return to City — content angle." (sentence case, € not EUR,
    # city name not IATA code). Baseline shown because 25 vs 60 is a deep drop.
    tpl = models.DealTemplate(
        slug="x", name="x", trip_type="oneway", content_angle="One last sun trip before winter"
    )
    draft = build_content_draft(
        origin="KUN",
        destination="AGP",
        price=25,
        baseline=60,
        travel_date=date(2026, 7, 12),
        template=tpl,
    )
    assert draft["headline"] == (
        "€25 return to Málaga (usually €60) — one last sun trip before winter."
    )


def test_fallback_without_angle_or_unknown_airport():
    tpl = models.DealTemplate(slug="x", name="x", trip_type="oneway")
    draft = build_content_draft(
        origin="KUN",
        destination="ZZZ",
        price=25,
        baseline=None,
        travel_date=date(2026, 7, 12),
        template=tpl,
    )
    assert draft["headline"] == "€25 return to ZZZ."


def test_shallow_discount_suppresses_was_price_in_fallback():
    # Reference-price rule: below 30% the "usually €x" clause spends
    # credibility for nothing — the generic headline must omit it.
    tpl = models.DealTemplate(slug="y", name="y", trip_type="oneway")
    draft = build_content_draft(
        origin="VNO",
        destination="CPH",
        price=80,
        baseline=100,  # only 20% below
        travel_date=date(2026, 7, 12),
        template=tpl,
    )
    assert "usually" not in draft["headline"]
    assert draft["headline"] == "€80 return to Copenhagen."
