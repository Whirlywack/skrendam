"""Seed editorial drafts from a template's copy patterns. Curator edits before publishing."""

import json
import re
from datetime import date
from importlib import resources

from skrendam.db import models
from skrendam.scanning.scoring import demand
from skrendam.scanning.scoring.eligibility import leg_hour_bounds
from skrendam.scanning.types import FareItinerary

# IATA -> {city, country}; shared with site/ and web/ (they import the same JSON).
_AIRPORTS: dict[str, dict[str, str]] = json.loads(
    resources.files("skrendam").joinpath("airports.json").read_text(encoding="utf-8")
)


# Verified monthly mean daily highs (°C, Jan..Dec) for the sun-template destinations
# only (seeds NOV_WARM ∪ WINTER_WARM ∪ EASTER_WARM). Every row is copied from a
# Wikipedia "Climate data" table (station + normals period cited in the task-3
# report); a destination without a sourced row is absent, never estimated.
_CLIMATE: dict[str, list[int]] = json.loads(
    resources.files("skrendam").joinpath("climate.json").read_text(encoding="utf-8")
)

LT_MONTHS_LOC = [
    "sausį",
    "vasarį",
    "kovą",
    "balandį",
    "gegužę",
    "birželį",
    "liepą",
    "rugpjūtį",
    "rugsėjį",
    "spalį",
    "lapkritį",
    "gruodį",
]
# Origins are a closed set (VNO/KUN/RIX), so their genitive is safe to hardcode;
# airports.json has no declension field, so destinations stay nominative.
_ORIGIN_GENITIVE = {"VNO": "Vilniaus", "KUN": "Kauno", "RIX": "Rygos"}

CARD_FROM_VILNIUS = "Iš Vilniaus: 59 min traukiniu"  # KUN
CARD_FROM_RIGA = "Iš Vilniaus: traukinys nuo €9.60, ~4 val."  # RIX
CARD_BAG_ONLY_HAND = "Tik rankinis bagažas — registruotas pagal tarifą"
CARD_FAMILY_TOTAL = "Šeimai iš keturių: €{total:.0f}"
CARD_EARLY_DEPARTURE = "Išvyksta prieš 07:00"
EARLY_DEP_HOUR = 7
WEATHER_LINE = "{city} {month}: ~{temp} °C dieną"
# Seeded window names carry a year and a scope note for the desk
# ("Pavasario atostogos 2027 (1–10 kl.)"); copy wants only the label.
_WINDOW_NOISE = re.compile(r"\s*\(.*?\)\s*$|\s+\d{4}\s*$")


def city(iata: str) -> str:
    return _AIRPORTS.get(iata, {}).get("city", iata)


# Keep in sync with web/src/lib/format.ts and site/src/lib/format-rules.ts
# (WAS_PRICE_MIN_DROP_PCT = 30).
WAS_PRICE_MIN_DISCOUNT = 0.30


def fallback_headline(
    destination: str,
    price: float,
    baseline: float | None,
    angle: str | None,
    trip_type: str = "roundtrip",
) -> str:
    """Brand-voice headline when a template has no pattern of its own.

    yip-design-system: numbers are the hero, sentence case, the "why" after a dash —
    "€140 return to Larnaca — one last sun trip before winter." The template's
    content_angle supplies the why. Reference-price rule (deal-detection synthesis
    2026-08-22): a was-price only helps on deep deals, so the "usually" clause only
    appears above WAS_PRICE_MIN_DISCOUNT.
    """
    deep_enough = _deep_enough(price, baseline)
    angle = (angle or "").strip().rstrip(".")
    why = f" — {angle[0].lower() + angle[1:]}" if angle else ""
    usually = f" (usually €{baseline:.0f})" if deep_enough else ""
    fare_word = "one-way to" if trip_type == "oneway" else "return to"
    return f"€{price:.0f} {fare_word} {city(destination)}{usually}{why}."


def _deep_enough(price: float, reference: float | None) -> bool:
    return bool(reference) and (reference - price) / reference >= WAS_PRICE_MIN_DISCOUNT


def _stops_lt(n: int) -> str:
    if n == 1:
        return "1 persėdimas"
    if n < 10:
        return f"{n} persėdimai"
    return f"{n} persėdimų"


def _window_label(name: str) -> str:
    """Window name as it reads in copy: no trailing year, no parenthetical."""
    label = name.strip()
    while True:
        cleaned = _WINDOW_NOISE.sub("", label)
        if cleaned == label:
            return label
        label = cleaned


def body_lines(
    origin: str,
    destination: str,
    price: float,
    baseline: float | None,
    travel_date: date,
    template: "models.DealTemplate",
    signals: dict | None = None,
    fare: FareItinerary | None = None,
    window_name: str | None = None,
) -> tuple[str, list[str]]:
    """Rules-written Lithuanian body: (why it's worth it, the catches). Pure.

    Why line, first rule that holds: the demand window's own typical price
    (date deal), the month median (destination deal), else the bare route.
    Both price references obey WAS_PRICE_MIN_DISCOUNT — a shallow "usually" is
    hype. The family x4 total rides along as a second sentence only when
    assess() found a positive family saving. Catches are facts only (stops,
    early departure, transfer from Vilnius, sourced weather, bags); the desk
    curator edits before publishing. No label prefixes, no banned words.
    """
    signals = signals or {}
    typical = signals.get("window_typical")
    if window_name and _deep_enough(price, typical):
        why = f"{_window_label(window_name)} — €{price:.0f}, įprastai apie €{typical:.0f}"
    elif _deep_enough(price, baseline):
        why = f"€{price:.0f} vietoj įprastų €{baseline:.0f}"
    else:
        gen = _ORIGIN_GENITIVE.get(origin)
        why = f"€{price:.0f} — {city(destination)}" + (f", iš {gen}" if gen else "")
    saving_family = signals.get("saving_family")
    if isinstance(saving_family, (int, float)) and saving_family > 0:
        why += ". " + CARD_FAMILY_TOTAL.format(total=price * demand.FAMILY_SEATS)

    catches: list[str] = []
    if fare is not None:
        if fare.stops >= 1:
            catches.append(_stops_lt(fare.stops))
        earliest, _ = leg_hour_bounds(fare)
        if earliest is not None and earliest < EARLY_DEP_HOUR:
            catches.append(CARD_EARLY_DEPARTURE)
    if origin == "KUN":
        catches.append(CARD_FROM_VILNIUS)
    elif origin == "RIX":
        catches.append(CARD_FROM_RIGA)
    # climate.json is sized to the sun destinations, so the destination alone
    # decides: family sun templates (persona "family") get the line too.
    if destination in _CLIMATE:
        catches.append(
            WEATHER_LINE.format(
                city=city(destination),
                month=LT_MONTHS_LOC[travel_date.month - 1],
                temp=_CLIMATE[destination][travel_date.month - 1],
            )
        )
    # fli's FlightResult carries no fare-brand/baggage field, so nothing sets
    # raw["bags"] today: the check stays so a future adapter key lights it up.
    if fare is not None and fare.raw.get("bags") == "hand_only":
        catches.append(CARD_BAG_ONLY_HAND)
    return why, catches


def build_content_draft(
    origin: str,
    destination: str,
    price: float,
    baseline: float | None,
    travel_date: date,
    template: "models.DealTemplate",
    *,
    signals: dict | None = None,
    fare: FareItinerary | None = None,
    window_name: str | None = None,
) -> dict:
    fields = {
        "origin": origin,
        "destination": destination,
        "city": city(destination),
        "from_city": city(origin),
        "price": f"{price:.0f}",
        "baseline": f"{baseline:.0f}" if baseline else "",
        "date": travel_date.isoformat(),
    }

    def fill(pattern: str | None) -> str | None:
        if not pattern:
            return None
        try:
            return pattern.format(**fields)
        except Exception:  # noqa: BLE001 — curator-authored free text: a bad format
            # spec (e.g. '{price:.0f}' on a pre-rendered string -> ValueError) must
            # fall back to the raw pattern, never abort the scan run.
            return pattern

    # Template-authored headlines are the curator's own copy and are not touched.
    headline = fill(template.suggested_headline_template) or fallback_headline(
        destination, price, baseline, template.content_angle, template.trip_type
    )
    why, catches = body_lines(
        origin, destination, price, baseline, travel_date, template, signals, fare, window_name
    )
    return {
        "headline": headline,
        "tiktok_hook": fill(template.tiktok_hook_template),
        "newsletter_snippet": fill(template.content_angle),
        "body": why + ("\n" + " · ".join(catches) if catches else ""),
        "cta_text": None,
        "created_by": "system",
        "status": "draft",
    }
