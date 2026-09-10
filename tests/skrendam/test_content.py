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
    # trip_type="oneway" fixture → "one-way to", never "return to" (review 08-25)
    assert draft["headline"] == (
        "€25 one-way to Málaga (usually €60) — one last sun trip before winter."
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
    assert draft["headline"] == "€25 one-way to ZZZ."


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
    assert draft["headline"] == "€80 one-way to Copenhagen."


def test_oneway_template_fallback_says_oneway_not_return():
    # Review 08-25: 'last-minute-weekends' is trip_type='oneway'; its drafts must
    # never claim "return".
    tpl = models.DealTemplate(
        slug="z", name="z", trip_type="oneway", content_angle="Leave this weekend"
    )
    draft = build_content_draft(
        origin="KUN",
        destination="BER",
        price=40,
        baseline=None,
        travel_date=date(2026, 9, 5),
        template=tpl,
    )
    assert draft["headline"] == "€40 one-way to Berlin — leave this weekend."


# ── Task 3 (WP3): rules-written LT body — why it's worth it + the catches ─────────

from skrendam.scanning import content  # noqa: E402
from skrendam.scanning.content import body_lines  # noqa: E402
from skrendam.scanning.types import FareItinerary  # noqa: E402

XMAS = date(2026, 12, 18)


def _tpl(**over) -> models.DealTemplate:
    return models.DealTemplate(**{"slug": "t", "name": "t", "trip_type": "roundtrip", **over})


def _fare(stops=0, legs=None, raw=None) -> FareItinerary:
    return FareItinerary(
        price=190.0,
        currency="EUR",
        stops=stops,
        duration_minutes=240,
        legs=legs or [],
        raw=raw or {},
    )


def _lines(**over):
    kw = {
        "origin": "VNO",
        "destination": "LCA",
        "price": 190,
        "baseline": None,
        "travel_date": XMAS,
        "template": _tpl(),
        "signals": None,
        "fare": None,
        "window_name": None,
    }
    return body_lines(**{**kw, **over})


def test_why_date_deal_names_the_window_and_its_typical_price():
    why, _ = _lines(
        signals={"window_slug": "kaledos-2026", "window_typical": 420.0, "archetype": "date"},
        window_name="Kalėdų atostogos",
    )
    assert why == "Kalėdų atostogos — €190, įprastai apie €420"


def test_why_shallow_window_typical_falls_back_to_baseline_rule():
    # typical only ~20% above the fare: the window clause would spend credibility
    # for nothing (WAS_PRICE_MIN_DISCOUNT) -> baseline rule instead.
    signals = {"window_slug": "kaledos-2026", "window_typical": 236.0}
    why, _ = _lines(signals=signals, window_name="Kalėdų atostogos", baseline=300)
    assert why == "€190 vietoj įprastų €300"
    # baseline also only ~20% above -> plain route line. airports.json carries no
    # Lithuanian declension field (only city/country), so the destination stays in
    # the honest nominative; the origin genitive comes from the closed VNO/KUN/RIX set.
    why, _ = _lines(signals=signals, window_name="Kalėdų atostogos", baseline=236)
    assert why == "€190 — Larnaca, iš Vilniaus"


def test_why_destination_deal_quotes_the_usual_price():
    why, _ = _lines(price=120, baseline=300)
    assert why == "€120 vietoj įprastų €300"


def test_family_total_is_appended_as_a_second_sentence():
    why, catches = _lines(price=95, baseline=300, signals={"saving_family": 240})
    assert why == "€95 vietoj įprastų €300. Šeimai iš keturių: €380"
    assert "Šeimai iš keturių: €380" not in catches


def test_catch_stops_lithuanian_plural_forms():
    assert _lines(fare=_fare(stops=1))[1] == ["1 persėdimas"]
    assert _lines(fare=_fare(stops=2))[1] == ["2 persėdimai"]
    assert content._stops_lt(10) == "10 persėdimų"


def test_catch_early_departure_from_any_leg():
    fare = _fare(
        legs=[{"departure_time": "2026-12-18T05:40:00", "arrival_time": "2026-12-18T09:10:00"}]
    )
    assert _lines(fare=fare)[1] == ["Išvyksta prieš 07:00"]
    late = _fare(legs=[{"departure_time": "2026-12-18T07:00:00"}])
    assert _lines(fare=late)[1] == []


def test_catch_origin_transfer_lines_for_kaunas_and_riga():
    assert _lines(origin="KUN")[1] == ["Iš Vilniaus: 59 min traukiniu"]
    assert _lines(origin="RIX")[1] == ["Iš Vilniaus: traukinys nuo €9.60, ~4 val."]
    assert _lines(origin="VNO")[1] == []


def test_catch_weather_line_only_for_sun_templates_with_climate_data():
    # climate.json["LCA"][0] == 17: Larnaca Airport 1991–2020 mean daily maximum, January
    # (Wikipedia "Larnaca", climate table).
    assert content._CLIMATE["LCA"][0] == 17
    sun = _tpl(newsletter_tag="winter_sun")
    assert _lines(template=sun, travel_date=date(2027, 1, 12))[1] == ["Larnaca sausį: ~17 °C dieną"]
    # not a sun persona -> no weather line even with climate data
    assert _lines(template=_tpl(newsletter_tag="xmas"), travel_date=date(2027, 1, 12))[1] == []
    # sun persona but destination without a sourced climate row -> no line
    assert _lines(template=sun, destination="BCN", travel_date=date(2027, 1, 12))[1] == []


def test_catch_no_bag_line_without_bag_info_and_no_fare_catches_without_fare():
    fare = _fare(stops=1, raw={"price": 190.0, "legs": []})
    _, catches = _lines(fare=fare)
    assert content.CARD_BAG_ONLY_HAND not in catches
    assert _lines(fare=None)[1] == []


def test_catch_bag_line_when_itinerary_says_hand_only():
    _, catches = _lines(fare=_fare(raw={"bags": "hand_only"}))
    assert catches == [content.CARD_BAG_ONLY_HAND]


def test_draft_body_is_why_plus_catches_joined_with_middle_dots():
    tpl = _tpl(newsletter_tag="family_sun")
    fare = _fare(stops=1, legs=[{"departure_time": "2026-12-18T05:40:00"}])
    draft = build_content_draft(
        "KUN",
        "LCA",
        190,
        300,
        XMAS,
        tpl,
        signals={"window_slug": "kaledos-2026", "window_typical": 420.0, "saving_family": 440},
        fare=fare,
        window_name="Kalėdų atostogos",
    )
    why, catches = body_lines(
        "KUN",
        "LCA",
        190,
        300,
        XMAS,
        tpl,
        {"window_slug": "kaledos-2026", "window_typical": 420.0, "saving_family": 440},
        fare,
        "Kalėdų atostogos",
    )
    assert catches == ["1 persėdimas", "Išvyksta prieš 07:00", "Iš Vilniaus: 59 min traukiniu"]
    assert draft["body"] == why + "\n" + " · ".join(catches)
    assert draft["body"].startswith(
        "Kalėdų atostogos — €190, įprastai apie €420. Šeimai iš keturių: €760\n"
    )


def test_draft_body_without_catches_is_just_the_why_line():
    draft = build_content_draft("VNO", "LCA", 120, 300, XMAS, _tpl())
    assert draft["body"] == "€120 vietoj įprastų €300"
    for banned in ("akcija", "superkaina", "nepraleisk", "sken", "scan", "Kodėl verta", "Kabliuk"):
        assert banned not in draft["body"].lower()
