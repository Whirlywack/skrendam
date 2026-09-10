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
    assert session.query(models.DealTemplate).count() == 18
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
    exempt = [
        "last-minute-weekends",
        "last-warm-days",
        "last-warm-days-november",
        "long-haul-opportunist",
        # fixed school-break windows are ~6 days wide; a 5-near-price-dates
        # gate would starve them structurally
        "family-autumn-sun",
        "family-feb-sun",
        "family-easter-sun",
    ]
    assert all(by_slug[s].min_departure_dates == 5 for s in planable)
    assert all(by_slug[s].min_departure_dates is None for s in exempt)
    assert by_slug["christmas-markets"].min_discount_pct == 25  # 06-03 flood watch-item
    # family-xmas-sun sits between planable (5) and exempt (None): a fixed
    # ~10-day window can support a 3-near-date gate but not a 5-date one.
    assert by_slug["family-xmas-sun"].min_departure_dates == 3


def test_moment_structure_audit_2026_08_29(session):
    """Locks in the audit fixes: windows, warm sets, lead, weekend gate wiring."""
    seed_all(session)
    by_slug = {t.slug: t for t in session.query(models.DealTemplate).all()}

    # plan-ahead-summer targets actual summer, with a 60-day booking lead
    pas = by_slug["plan-ahead-summer"]
    assert pas.date_window_type == "seasonal"
    assert (pas.season_start_mmdd, pas.season_end_mmdd) == ("06-01", "08-31")
    assert pas.rel_offset_start_days == 60

    # last-warm-days: October broad, November restricted to the verified-warm set
    assert by_slug["last-warm-days"].season_end_mmdd == "10-31"
    nov = by_slug["last-warm-days-november"]
    assert nov.included_zones is None and "BCN" not in nov.included_destinations
    assert {"LCA", "TFS", "HRG"} <= set(nov.included_destinations)

    # winter-sun cedes November to last-warm-days
    assert by_slug["winter-sun-escape"].season_start_mmdd == "12-01"

    # school holidays: autumn/Feb/Easter breaks exist with ŠMSM 2026-27 fixed dates
    assert by_slug["family-autumn-sun"].fixed_start_date == date(2026, 10, 30)
    assert by_slug["family-feb-sun"].fixed_start_date == date(2027, 2, 12)
    assert by_slug["family-easter-sun"].fixed_end_date == date(2027, 3, 31)

    # weekend promise is enforceable: the gate field is set on last-minute-weekends
    lmw = by_slug["last-minute-weekends"]
    assert lmw.preferred_departure_days == ["FRI", "SAT"]
    assert lmw.rel_offset_end_days == 24

    # no dead destinations: every included destination has a seeded route
    from skrendam.seeds import ROUTES

    seeded = {d for _, d, *_ in ROUTES}
    for t in by_slug.values():
        for d in t.included_destinations or []:
            assert d in seeded, f"{t.slug}: {d} has no route"


LT_ORIGINS = {"VNO", "KUN", "RIX"}
# WP7 reverse diaspora origins (abroad → home); see docs/plans/2026-09-10-wp7-home-persona-plan.md
HOME_ORIGINS = {"STN", "LTN", "DUB", "OSL", "CPH", "BGO", "LPL"}
HOME_VFR_ROUTES = {
    ("STN", "KUN"),
    ("STN", "VNO"),
    ("LTN", "KUN"),
    ("LTN", "VNO"),
    ("DUB", "KUN"),
    ("DUB", "VNO"),
    ("OSL", "VNO"),
    ("CPH", "KUN"),
    ("BGO", "VNO"),
    ("LPL", "KUN"),
}


def test_route_list_size_and_validity():
    from fli.models import Airport
    from skrendam.seeds import ROUTES, ZONES

    assert 150 <= len(ROUTES) <= 175
    zone_names = {z[0] for z in ZONES}
    assert len(ROUTES) == len({(o, d) for o, d, *_ in ROUTES})  # no dupes
    for o, d, z, *_rest in ROUTES:
        assert o in LT_ORIGINS | HOME_ORIGINS, f"{o}-{d}: origin outside pilot + home scope"
        if z == "HOME_VFR":
            assert o in HOME_ORIGINS, f"{o}-{d}: HOME_VFR origin must be abroad"
            assert d in {"VNO", "KUN"}, f"{o}-{d}: HOME_VFR destination must be home"
        else:
            assert o in LT_ORIGINS, f"{o}-{d}: pilot scope is VNO/KUN/RIX only"
        assert o in Airport.__members__, f"unknown origin {o}"
        assert d in Airport.__members__, f"unknown destination {d} ({o}-{d})"
        assert z in zone_names, f"{o}-{d}: zone {z} not seeded"


def test_home_vfr_routes_are_exactly_the_verified_ten():
    from skrendam.seeds import ROUTES, ZONES

    assert ("HOME_VFR", "short", 50, 25, 25) in ZONES
    home = {(o, d) for o, d, z, *_ in ROUTES if z == "HOME_VFR"}
    assert home == HOME_VFR_ROUTES
    assert all(core for _o, _d, z, core in ROUTES if z == "HOME_VFR")


def test_no_zone_filtered_template_references_home_vfr(session):
    # HOME_VFR exists to keep the reverse routes out of zone-filtered templates
    # (otherwise ten routes × every matching template would triple the scan cost).
    # The home-* templates are the intended consumers: they pair the zone with a
    # destination filter (VNO/KUN), so only they may reference it.
    seed_all(session)
    zoned = [t for t in session.query(models.DealTemplate) if t.included_zones]
    assert zoned, "seed should contain zone-filtered templates"
    for t in zoned:
        if t.included_destinations:
            continue
        assert "HOME_VFR" not in t.included_zones, f"{t.slug} references HOME_VFR"
    referencing = {t.slug for t in zoned if "HOME_VFR" in t.included_zones}
    assert referencing == {"home-xmas", "home-easter", "home-summer"}


HOME_TEMPLATE_WINDOWS = {
    # slug -> (PEAK_WINDOWS slug, fixed_start, fixed_end)
    "home-xmas": ("home-xmas-2026", date(2026, 12, 18), date(2027, 1, 6)),
    "home-easter": ("home-easter-2027", date(2027, 3, 25), date(2027, 4, 5)),
    "home-summer": ("home-summer-2027", date(2027, 6, 20), date(2027, 7, 5)),
}


def test_home_templates_fixed_windows_match_peak_windows(session):
    seed_all(session)
    windows = {w.slug: w for w in session.query(models.PeakWindow).all()}
    by_slug = {t.slug: t for t in session.query(models.DealTemplate).all()}
    for slug, (wslug, start, end) in HOME_TEMPLATE_WINDOWS.items():
        t, w = by_slug[slug], windows[wslug]
        assert t.date_window_type == "fixed"
        assert (t.fixed_start_date, t.fixed_end_date) == (start, end), slug
        # the template window spans the peak window's outbound AND return ranges
        assert t.fixed_start_date == w.start_date
        assert t.fixed_end_date == (w.return_end_date or w.end_date)
        assert t.included_zones == ["HOME_VFR"] and t.included_destinations == ["VNO", "KUN"]
        assert t.newsletter_tag == "home" and t.trip_type == "roundtrip"
        assert t.priority == 100 and t.min_departure_dates is None
        assert t.suggested_headline_template is None  # brand-voice fallback owns the headline
        assert t.trip_len_min_days is not None and t.trip_len_max_days is not None
        assert t.trip_len_min_days <= (end - start).days
    # Only home-xmas scans at launch (+10 specs/day). The other two ship disabled and
    # are switched on by one-off SQL: scripts/2027-01-07_enable_home_easter.sql and
    # scripts/2027-03-01_enable_home_summer.sql.
    assert by_slug["home-xmas"].enabled
    assert by_slug["home-easter"].enabled is False
    assert by_slug["home-summer"].enabled is False


def test_home_xmas_min_stay_lands_in_the_return_range(session):
    # The resolver feeds ONE calendar duration (trip_len_min_days). At 12 days a
    # Dec 21–23 departure returns Jan 2–4, inside home-xmas-2026's Jan 2–6 return
    # range; Dec 18–20 departures still peak via kaledos-2026 (Dec 18 – Jan 3).
    from datetime import timedelta

    from skrendam.scanning.resolver import resolve

    seed_all(session)
    tpl = session.query(models.DealTemplate).filter_by(slug="home-xmas").one()
    assert (tpl.trip_len_min_days, tpl.trip_len_max_days) == (12, 19)
    w = session.query(models.PeakWindow).filter_by(slug="home-xmas-2026").one()
    home_routes = session.query(models.Route).filter_by(zone="HOME_VFR", enabled=True).all()
    specs = resolve(tpl, home_routes, date(2026, 9, 10))
    assert specs and all(s.duration_days == 12 for s in specs)
    spec = specs[0]
    assert spec.window_start <= date(2026, 12, 23) <= spec.window_end
    assert w.return_start_date <= date(2026, 12, 23) + timedelta(days=spec.duration_days)
    assert date(2026, 12, 23) + timedelta(days=spec.duration_days) <= w.return_end_date


def test_home_vfr_routes_feed_only_home_templates(session):
    # The headroom arithmetic (plan Global Constraints) assumes the ten reverse
    # routes cost specs ONLY through the home-* templates.
    from skrendam.scanning.resolver import resolve

    seed_all(session)
    home_routes = session.query(models.Route).filter_by(zone="HOME_VFR", enabled=True).all()
    assert {(r.origin, r.destination) for r in home_routes} == HOME_VFR_ROUTES
    today = date(2026, 9, 10)
    for tpl in session.query(models.DealTemplate).filter_by(enabled=True).all():
        specs = resolve(tpl, home_routes, today)
        if tpl.slug.startswith("home-"):
            assert {(s.origin, s.destination) for s in specs} == HOME_VFR_ROUTES, tpl.slug
        else:
            assert specs == [], f"{tpl.slug} would scan HOME_VFR routes"


def test_core_composition_feeds_every_enabled_template(session):
    from skrendam.scanning.resolver import resolve

    seed_all(session)
    routes = session.query(models.Route).filter_by(enabled=True).all()
    core = [r for r in routes if r.core]
    assert 26 <= len(core) <= 40
    today = date(2026, 6, 15)
    enabled = session.query(models.DealTemplate).filter_by(enabled=True).all()
    slugs = {t.slug for t in enabled}
    assert "home-xmas" in slugs and not ({"home-easter", "home-summer"} & slugs)
    for tpl in enabled:
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


def test_peak_windows_aligned_with_family_windows(session):
    seed_all(session)
    rows = {w.slug: w for w in session.query(models.PeakWindow).all()}
    assert len(rows) == 13
    # The four school-break windows open on the family templates' departure
    # windows (the Friday before the break), not on the break's first school-free
    # day — otherwise the Friday fare the template searches for scores date_fit 1.0.
    assert rows["kaledos-2026"].start_date == date(2026, 12, 18)
    assert rows["kaledos-2026"].end_date == date(2027, 1, 3)
    assert rows["rudens-2026"].start_date == date(2026, 10, 30)
    assert rows["ziemos-2027"].start_date == date(2027, 2, 12)
    assert rows["pavasario-2027"].start_date == date(2027, 3, 19)
    tpl = {
        t.slug: t
        for t in session.query(models.DealTemplate).filter(
            models.DealTemplate.slug.in_(
                ["family-autumn-sun", "family-feb-sun", "family-easter-sun", "family-xmas-sun"]
            )
        )
    }
    for window_slug, tpl_slug in [
        ("rudens-2026", "family-autumn-sun"),
        ("ziemos-2027", "family-feb-sun"),
        ("pavasario-2027", "family-easter-sun"),
        ("kaledos-2026", "family-xmas-sun"),
    ]:
        assert rows[window_slug].start_date == tpl[tpl_slug].fixed_start_date
    assert set(rows["kaledos-2026"].pref_codes) == {"family", "home"}
    assert rows["home-xmas-2026"].return_start_date == date(2027, 1, 2)
    assert rows["home-xmas-2026"].return_end_date == date(2027, 1, 6)
    assert {w.kind for w in rows.values()} == {
        "school_break",
        "public_holiday",
        "long_weekend",
        "custom",
    }
    seed_all(session)  # insert-only
    assert session.query(models.PeakWindow).count() == 13


def test_family_xmas_sun_is_seeded_with_the_date_archetype_window(session):
    seed_all(session)
    t = session.query(models.DealTemplate).filter_by(slug="family-xmas-sun").one()
    assert (t.fixed_start_date, t.fixed_end_date) == (date(2026, 12, 18), date(2026, 12, 28))
    assert t.included_destinations == ["TFS", "LPA", "HRG", "SSH", "DXB", "RAK"]
    assert (t.max_price_eur, t.min_discount_pct, t.min_departure_dates) == (450, 20, 3)
    assert t.family_friendly_times_only and t.newsletter_tag == "family_sun"
