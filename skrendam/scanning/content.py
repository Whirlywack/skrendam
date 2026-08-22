"""Seed editorial drafts from a template's copy patterns. Curator edits before publishing."""

from datetime import date

from skrendam.db import models


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

    # Reference-price rule (deal-detection synthesis 2026-08-22): a was-price
    # only helps on deep deals; on shallow ones it spends credibility. Suppress
    # the "usually" clause below 30% discount in the generic fallback headline.
    # (Template-authored headlines are the curator's own copy and are not touched.)
    deep_enough = bool(baseline) and (baseline - price) / baseline >= 0.30
    headline = fill(template.suggested_headline_template) or (
        f"{origin}->{destination} just EUR{price:.0f}"
        + (f" (usually EUR{baseline:.0f})" if deep_enough else "")
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
