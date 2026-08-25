"""Seed editorial drafts from a template's copy patterns. Curator edits before publishing."""

import json
from datetime import date
from importlib import resources

from skrendam.db import models

# IATA -> {city, country}; shared with site/ and web/ (they import the same JSON).
_AIRPORTS: dict[str, dict[str, str]] = json.loads(
    resources.files("skrendam").joinpath("airports.json").read_text(encoding="utf-8")
)


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
    deep_enough = bool(baseline) and (baseline - price) / baseline >= WAS_PRICE_MIN_DISCOUNT
    angle = (angle or "").strip().rstrip(".")
    why = f" — {angle[0].lower() + angle[1:]}" if angle else ""
    usually = f" (usually €{baseline:.0f})" if deep_enough else ""
    fare_word = "one-way to" if trip_type == "oneway" else "return to"
    return f"€{price:.0f} {fare_word} {city(destination)}{usually}{why}."


def build_content_draft(
    origin: str,
    destination: str,
    price: float,
    baseline: float | None,
    travel_date: date,
    template: "models.DealTemplate",
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
    return {
        "headline": headline,
        "tiktok_hook": fill(template.tiktok_hook_template),
        "newsletter_snippet": fill(template.content_angle),
        "body": None,
        "cta_text": None,
        "created_by": "system",
        "status": "draft",
    }
