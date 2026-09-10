"""Drift guard for the shared IATA name maps.

skrendam/*.json is canonical; site/ and web/ carry copies because Turbopack
cannot import outside the app root. Copy with `cp skrendam/airports.json
site/src/lib/ web/src/lib/` (same for airlines.json) whenever the source changes.

cities-lt.json (IATA -> Lithuanian city grammar) is the odd one out: the web
copy lives next to the mail renderers that use it (`web/src/lib/email/`), so
COPY_PATH maps it there. Copy with `cp skrendam/cities-lt.json site/src/lib/`
and `cp skrendam/cities-lt.json web/src/lib/email/`.
"""

import json
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]

# Where each app keeps its copy, relative to <app>/src/lib/. Default is the
# file name itself; override when an app keeps the copy deeper.
COPY_PATH: dict[tuple[str, str], str] = {
    ("web", "cities-lt.json"): "email/cities-lt.json",
}


def app_copy(app: str, name: str) -> Path:
    return ROOT / app / "src" / "lib" / COPY_PATH.get((app, name), name)


@pytest.mark.parametrize(
    "name",
    ["airports.json", "airlines.json", "personas.json", "demand_tiers.json", "cities-lt.json"],
)
@pytest.mark.parametrize("app", ["site", "web"])
def test_app_copy_matches_canonical(name, app):
    canonical = json.loads((ROOT / "skrendam" / name).read_text(encoding="utf-8"))
    path = app_copy(app, name)
    copy = json.loads(path.read_text(encoding="utf-8"))
    assert copy == canonical, f"{path.relative_to(ROOT)} drifted from skrendam/{name}"


def test_every_seeded_airport_has_a_city():
    # Read the ROUTES table itself, not a regex over seeds.py: a route added with
    # a different literal shape (a new origin, a tuple split over lines) used to
    # slip past the scrape and ship an airport with no city name.
    from skrendam.seeds import ROUTES

    airports = json.loads((ROOT / "skrendam" / "airports.json").read_text(encoding="utf-8"))
    codes = {origin for origin, _, _, _ in ROUTES} | {dest for _, dest, _, _ in ROUTES}
    assert len(codes) > 100, "ROUTES looks truncated — the check would pass vacuously"
    missing = sorted(codes - airports.keys())
    assert not missing, f"no city name for seeded airports: {missing}"
