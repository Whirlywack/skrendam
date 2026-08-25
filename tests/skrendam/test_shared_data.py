"""Drift guard for the shared IATA name maps.

skrendam/*.json is canonical; site/ and web/ carry copies because Turbopack
cannot import outside the app root. Copy with `cp skrendam/airports.json
site/src/lib/ web/src/lib/` (same for airlines.json) whenever the source changes.
"""

import json
import re
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]


@pytest.mark.parametrize("name", ["airports.json", "airlines.json"])
@pytest.mark.parametrize("app", ["site", "web"])
def test_app_copy_matches_canonical(name, app):
    canonical = json.loads((ROOT / "skrendam" / name).read_text(encoding="utf-8"))
    copy = json.loads((ROOT / app / "src" / "lib" / name).read_text(encoding="utf-8"))
    assert copy == canonical, f"{app}/src/lib/{name} drifted from skrendam/{name}"


def test_every_seeded_airport_has_a_city():
    airports = json.loads((ROOT / "skrendam" / "airports.json").read_text(encoding="utf-8"))
    seeds = (ROOT / "skrendam" / "seeds.py").read_text(encoding="utf-8")
    codes = set(re.findall(r'\("(?:VNO|KUN|RIX|TLL)",\s*"([A-Z]{3})"', seeds)) | {
        "VNO",
        "KUN",
        "RIX",
    }
    missing = sorted(codes - airports.keys())
    assert not missing, f"no city name for seeded airports: {missing}"
