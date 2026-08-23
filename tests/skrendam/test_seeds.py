from datetime import date

from skrendam.db import models
from skrendam.seeds import seed_all


def test_seed_is_idempotent(session):
    seed_all(session)
    seed_all(session)  # second run must not duplicate
    assert session.query(models.Zone).count() >= 4
    assert session.query(models.Route).count() >= 10
    assert session.query(models.AudienceSegment).count() == 6
    assert session.query(models.TravelMoment).count() == 10
    assert session.query(models.DealTemplate).count() == 10
    # every template references a real audience + moment
    for t in session.query(models.DealTemplate):
        assert t.audience_segment_id and t.travel_moment_id
        assert t.trip_type in ("oneway", "roundtrip")


def test_every_roundtrip_template_sets_trip_len_min_days(session):
    seed_all(session)
    rts = session.query(models.DealTemplate).filter_by(trip_type="roundtrip").all()
    assert rts, "seed should contain roundtrip templates"
    missing = [t.slug for t in rts if t.trip_len_min_days is None]
    # resolver derives the RT calendar duration from trip_len_min_days alone;
    # NULL would flow duration=None into a roundtrip date search.
    assert missing == []


def test_new_templates_and_gate_values(session):
    seed_all(session)
    by_slug = {t.slug: t for t in session.query(models.DealTemplate).all()}

    vfr = by_slug["vfr-watch"]
    assert vfr.trip_type == "roundtrip" and vfr.trip_len_min_days == 3
    assert vfr.min_departure_dates == 5
    assert set(vfr.included_destinations) == {"STN", "LTN", "LGW", "DUB", "OSL"}

    lh = by_slug["long-haul-opportunist"]
    assert lh.min_departure_dates is None and lh.trip_len_min_days == 7

    planable = [
        "family-school-holiday-sun",
        "september-sun",
        "christmas-markets",
        "plan-ahead-summer",
        "vfr-watch",
    ]
    exempt = ["last-minute-weekends", "last-warm-days", "long-haul-opportunist"]
    assert all(by_slug[s].min_departure_dates == 5 for s in planable)
    assert all(by_slug[s].min_departure_dates is None for s in exempt)
    assert by_slug["christmas-markets"].min_discount_pct == 25  # 06-03 flood watch-item


def test_route_list_size_and_validity():
    from fli.models import Airport
    from skrendam.seeds import ROUTES, ZONES

    assert 150 <= len(ROUTES) <= 175
    zone_names = {z[0] for z in ZONES}
    assert len(ROUTES) == len({(o, d) for o, d, *_ in ROUTES})  # no dupes
    for o, d, z, *_rest in ROUTES:
        assert o in {"VNO", "KUN", "RIX"}, f"{o}-{d}: pilot scope is VNO/KUN/RIX only"
        assert o in Airport.__members__, f"unknown origin {o}"
        assert d in Airport.__members__, f"unknown destination {d} ({o}-{d})"
        assert z in zone_names, f"{o}-{d}: zone {z} not seeded"


def test_core_composition_feeds_every_enabled_template(session):
    from skrendam.scanning.resolver import resolve

    seed_all(session)
    routes = session.query(models.Route).filter_by(enabled=True).all()
    core = [r for r in routes if r.core]
    assert 26 <= len(core) <= 34
    today = date(2026, 6, 15)
    for tpl in session.query(models.DealTemplate).filter_by(enabled=True).all():
        specs = resolve(tpl, core, today)
        assert specs, f"template {tpl.slug} has no core route feeding it"


def test_seed_never_reenables_disabled_route(session):
    seed_all(session)
    r = session.query(models.Route).first()
    r.enabled = False
    session.commit()
    seed_all(session)  # idempotent re-run
    session.refresh(r)
    assert r.enabled is False
