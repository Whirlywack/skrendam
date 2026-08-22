import os
from datetime import date, timedelta

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from skrendam.fli_adapter.live_backend import LiveFliBackend
from skrendam.scanning.types import SearchSpec

pytestmark = pytest.mark.skipif(
    os.getenv("FLI_E2E") != "1", reason="live API test; set FLI_E2E=1 to run"
)


def test_live_calendar_returns_real_prices():
    backend = LiveFliBackend()
    start = date.today() + timedelta(days=30)
    spec = SearchSpec("VNO", "BCN", "oneway", start, start + timedelta(days=45), None, "ECONOMY")
    rows = backend.search_calendar(spec)
    assert rows and all(p > 0 for (_, _, p) in rows)


def test_live_full_scan_end_to_end():
    """Full bounded scan using a tiny hand-seeded scope (1 zone, 1 route, 1 template).

    Keeps real API calls to a handful.  Live prices vary so we
    only assert structural outcomes (run completed, price_log populated) — no
    candidate counts — to keep the test non-flaky.
    """
    from skrendam.db import models  # noqa: F401 — register all tables
    from skrendam.db.base import Base
    from skrendam.fli_adapter.adapter import FliAdapter
    from skrendam.fli_adapter.pacing import TokenBucket
    from skrendam.scanning.orchestrator import run_scan

    engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()

    try:
        # ── Minimal seed: one zone, one route, one oneway relative template ──────────
        session.add(
            models.Zone(
                zone="CITY_BREAKS",
                haul_type="short",
                threshold_price_eur=45,
                min_abs_savings_eur=20,
                min_discount_pct=25,
            )
        )
        session.add(models.Route(origin="VNO", destination="STN", zone="CITY_BREAKS", enabled=True))
        aud = models.AudienceSegment(
            slug="budget_e2e", name="Budget (e2e)", default_itinerary_tolerance="relaxed"
        )
        mom = models.TravelMoment(
            slug="lm_e2e",
            name="Last-minute (e2e)",
            moment_type="relative",
            default_content_angle="Leave this weekend",
        )
        session.add_all([aud, mom])
        session.flush()
        session.add(
            models.DealTemplate(
                slug="e2e-lm-oneway",
                name="E2E last-minute oneway",
                enabled=True,
                audience_segment_id=aud.id,
                travel_moment_id=mom.id,
                trip_type="oneway",
                date_window_type="relative",
                rel_offset_start_days=3,
                rel_offset_end_days=60,
                included_zones=["CITY_BREAKS"],
                max_stops=1,
                content_angle="Leave this weekend",
            )
        )
        session.commit()

        adapter = FliAdapter(
            LiveFliBackend(),
            pace=TokenBucket(1.0, 0.0).acquire,
        )
        run_scan(session, today=date.today(), adapter=adapter, scanner_version="e2e")

        run = session.query(models.ScanRun).one()
        assert run.status == "completed"
        assert run.templates_scanned >= 1
        assert session.query(models.PriceLog).count() > 0
        # Do NOT assert candidate counts — live prices vary.

    finally:
        session.close()
        engine.dispose()
