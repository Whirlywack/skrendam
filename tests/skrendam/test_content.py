from datetime import date

from skrendam.db import models
from skrendam.scanning.content import build_content_draft


def test_fills_templates_with_fare_facts():
    tpl = models.DealTemplate(
        slug="x",
        name="x",
        trip_type="oneway",
        suggested_headline_template=(
            "{origin}->{destination} just EUR{price} (usually EUR{baseline})"
        ),
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
    assert draft["headline"] == "VNO->BCN just EUR30 (usually EUR49)"
    assert "EUR30" in draft["tiktok_hook"]
    assert draft["created_by"] == "system"


def test_missing_templates_fall_back_to_generic_headline():
    tpl = models.DealTemplate(slug="x", name="x", trip_type="oneway")
    draft = build_content_draft(
        origin="KUN",
        destination="AGP",
        price=25,
        baseline=60,
        travel_date=date(2026, 7, 12),
        template=tpl,
    )
    assert "KUN" in draft["headline"] and "25" in draft["headline"]
