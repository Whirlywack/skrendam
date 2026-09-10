import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_personas_map_every_seeded_newsletter_tag(session):
    import re

    from skrendam.db import models
    from skrendam.seeds import seed_all

    personas = json.loads((ROOT / "skrendam" / "personas.json").read_text(encoding="utf-8"))
    seeds = (ROOT / "skrendam" / "seeds.py").read_text(encoding="utf-8")

    tags = set(re.findall(r'newsletter_tag="([a-z_]+)"', seeds))
    assert tags, "the newsletter_tag scrape found nothing — the check would pass vacuously"
    assert tags <= set(personas), f"newsletter tags without persona mapping: {tags - set(personas)}"

    # The scrape only sees literals. Assert against what seed_all actually INSERTS,
    # so a tag built dynamically (or one that never reaches the DB) is caught too.
    seed_all(session)
    seeded = {
        t for (t,) in session.query(models.DealTemplate.newsletter_tag).distinct() if t is not None
    }
    assert seeded, "seed_all inserted no template with a newsletter_tag"
    assert seeded <= set(personas), f"seeded tags without persona mapping: {seeded - set(personas)}"

    codes = {c for v in personas.values() for c in v}
    assert codes <= {"sun", "city", "family", "weekend", "last_minute", "home"}


def test_demand_tiers_shape():
    tiers = json.loads((ROOT / "skrendam" / "demand_tiers.json").read_text(encoding="utf-8"))
    assert tiers["weights"] == {"A": 1.0, "B": 0.85, "C": 0.7}
    assert not set(tiers["A"]) & set(tiers["B"]), "an airport can't be in two tiers"
    assert {"STN", "DUB", "OSL"} <= set(tiers["vfr"])
