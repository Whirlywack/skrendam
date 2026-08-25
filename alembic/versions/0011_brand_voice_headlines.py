"""Brand-voice headlines: drop machine headline templates, rewrite system drafts.

The five seeded templates carried `{origin}->{destination} EUR{price} return`
patterns, which rendered on the public site as "VNO->LCA just EUR140". The
scan's fallback headline is now brand voice ("€140 return to Larnaca — one last
sun trip before winter."), so:

1. those template patterns are nulled to let the fallback apply, and
2. every *system-written, still-draft* content_draft whose headline matches the
   machine pattern is rewritten with the same fallback.

Curator-authored templates, curator-edited drafts, and published_deals are
untouched (published headlines were approved by a human; the site guards the
machine pattern at render time anyway).

Revision ID: 0011_brand_voice_headlines
Revises: 0010_merge_heads
Create Date: 2026-08-23
"""

import sqlalchemy as sa

from alembic import op

revision = "0011_brand_voice_headlines"
down_revision = "0010_merge_heads"
branch_labels = None
depends_on = None

MACHINE_PREFIX = "{origin}->{destination}"

# ---------------------------------------------------------------------------
# FROZEN copy of the brand-voice fallback as of this revision. Deliberately
# NOT imported from skrendam.scanning.content: alembic imports every version
# file on every command, so importing live app code makes all future upgrades
# hostage to today's function names/data files, and editing the app copy would
# silently change what this migration writes on a fresh DB (review 08-25).
# ---------------------------------------------------------------------------
_WAS_PRICE_MIN_DISCOUNT = 0.30
_CITY = {
    "AGP": "Málaga",
    "ALC": "Alicante",
    "AMS": "Amsterdam",
    "ARN": "Stockholm",
    "ATH": "Athens",
    "AYT": "Antalya",
    "BCN": "Barcelona",
    "BEG": "Belgrade",
    "BER": "Berlin",
    "BGO": "Bergen",
    "BGY": "Bergamo",
    "BKK": "Bangkok",
    "BLL": "Billund",
    "BOJ": "Burgas",
    "BRI": "Bari",
    "BRS": "Bristol",
    "BRU": "Brussels",
    "BUD": "Budapest",
    "BUS": "Batumi",
    "BVA": "Paris",
    "CDG": "Paris",
    "CFU": "Corfu",
    "CGN": "Cologne",
    "CIA": "Rome",
    "CPH": "Copenhagen",
    "CRL": "Brussels",
    "CTA": "Catania",
    "DBV": "Dubrovnik",
    "DTM": "Dortmund",
    "DUB": "Dublin",
    "DUS": "Düsseldorf",
    "DXB": "Dubai",
    "EDI": "Edinburgh",
    "EIN": "Eindhoven",
    "EMA": "East Midlands",
    "EVN": "Yerevan",
    "FAO": "Faro",
    "FCO": "Rome",
    "FMM": "Memmingen",
    "FNC": "Madeira",
    "FRA": "Frankfurt",
    "GDN": "Gdańsk",
    "GNB": "Grenoble",
    "GOT": "Gothenburg",
    "GVA": "Geneva",
    "HAM": "Hamburg",
    "HEL": "Helsinki",
    "HER": "Crete",
    "HHN": "Frankfurt Hahn",
    "HRG": "Hurghada",
    "IST": "Istanbul",
    "JFK": "New York",
    "KEF": "Reykjavík",
    "KRK": "Kraków",
    "KUN": "Kaunas",
    "KUT": "Kutaisi",
    "LCA": "Larnaca",
    "LGW": "London",
    "LIS": "Lisbon",
    "LJU": "Ljubljana",
    "LPA": "Gran Canaria",
    "LPL": "Liverpool",
    "LTN": "London",
    "MAD": "Madrid",
    "MAN": "Manchester",
    "MLA": "Malta",
    "MUC": "Munich",
    "MXP": "Milan",
    "NAP": "Naples",
    "NCE": "Nice",
    "NRN": "Weeze",
    "NRT": "Tokyo",
    "NUE": "Nuremberg",
    "OSL": "Oslo",
    "OTP": "Bucharest",
    "OUL": "Oulu",
    "PFO": "Paphos",
    "PLQ": "Palanga",
    "PMI": "Palma de Mallorca",
    "PRG": "Prague",
    "PSA": "Pisa",
    "RAK": "Marrakech",
    "RHO": "Rhodes",
    "RIX": "Riga",
    "RMO": "Chișinău",
    "SKG": "Thessaloniki",
    "SNN": "Shannon",
    "SOF": "Sofia",
    "SPU": "Split",
    "SSH": "Sharm El Sheikh",
    "STN": "London",
    "TAS": "Tashkent",
    "TBS": "Tbilisi",
    "TFS": "Tenerife",
    "TGD": "Podgorica",
    "TIA": "Tirana",
    "TKU": "Turku",
    "TLL": "Tallinn",
    "TLV": "Tel Aviv",
    "TMP": "Tampere",
    "TRN": "Turin",
    "TSF": "Treviso",
    "VIE": "Vienna",
    "VNO": "Vilnius",
    "WAW": "Warsaw",
    "ZRH": "Zurich",
}


def _headline(
    destination: str, price: float, baseline, angle, trip_type: str = "roundtrip"
) -> str:
    deep = bool(baseline) and (baseline - price) / baseline >= _WAS_PRICE_MIN_DISCOUNT
    angle = (angle or "").strip().rstrip(".")
    why = f" — {angle[0].lower() + angle[1:]}" if angle else ""
    usually = f" (usually €{baseline:.0f})" if deep else ""
    fare_word = "one-way to" if trip_type == "oneway" else "return to"
    return f"€{price:.0f} {fare_word} {_CITY.get(destination, destination)}{usually}{why}."


def upgrade() -> None:
    """Null machine-pattern templates; rewrite system drafts that used them."""
    bind = op.get_bind()
    bind.execute(
        sa.text(
            "UPDATE deal_templates SET suggested_headline_template = NULL "
            "WHERE suggested_headline_template LIKE :p"
        ),
        {"p": f"{MACHINE_PREFIX}%"},
    )
    rows = bind.execute(
        sa.text(
            "SELECT d.id, c.destination, c.price, c.baseline_price, t.content_angle, t.trip_type "
            "FROM content_drafts d "
            "JOIN candidates c ON c.id = d.candidate_id "
            "JOIN deal_templates t ON t.id = d.deal_template_id "
            "WHERE d.created_by = 'system' AND d.status = 'draft' "
            "AND d.headline LIKE '___->___%'"
        )
    ).fetchall()
    for draft_id, destination, price, baseline, angle, trip_type in rows:
        bind.execute(
            sa.text("UPDATE content_drafts SET headline = :h WHERE id = :id"),
            {"h": _headline(destination, float(price), baseline, angle, trip_type), "id": draft_id},
        )


def downgrade() -> None:
    """Data-only; the old machine patterns are not worth restoring."""
