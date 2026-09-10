import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_personas_map_every_seeded_newsletter_tag():
    from skrendam.seeds import seed_all  # noqa: F401  (import guards the module path)

    personas = json.loads((ROOT / "skrendam" / "personas.json").read_text(encoding="utf-8"))
    seeds = (ROOT / "skrendam" / "seeds.py").read_text(encoding="utf-8")
    import re

    tags = set(re.findall(r'newsletter_tag="([a-z_]+)"', seeds))
    assert tags <= set(personas), f"newsletter tags without persona mapping: {tags - set(personas)}"
    codes = {c for v in personas.values() for c in v}
    assert codes <= {"sun", "city", "family", "weekend", "last_minute", "home"}


def test_demand_tiers_shape():
    tiers = json.loads((ROOT / "skrendam" / "demand_tiers.json").read_text(encoding="utf-8"))
    assert tiers["weights"] == {"A": 1.0, "B": 0.85, "C": 0.7}
    assert not set(tiers["A"]) & set(tiers["B"]), "an airport can't be in two tiers"
    assert {"STN", "DUB", "OSL"} <= set(tiers["vfr"])
