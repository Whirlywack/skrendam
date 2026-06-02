"""Seed each zone's thresholds from a real broad scan (spec §12). Re-runnable."""

from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from skrendam.config import Settings
from skrendam.db.session import make_sessionmaker
from skrendam.fli_adapter.adapter import FliAdapter
from skrendam.fli_adapter.pacing import TokenBucket
from skrendam.scanning.baseline import compute_baseline
from skrendam.scanning.types import SearchSpec
from skrendam.db import models


def calibrate_thresholds(session: Session, backend, today: date) -> None:
    routes = list(session.scalars(select(models.Route).where(models.Route.enabled.is_(True))))
    adapter = FliAdapter(backend, pace=lambda: None)
    by_zone: dict[str, list[float]] = {}
    for r in routes:
        spec = SearchSpec(r.origin, r.destination, "oneway", today + timedelta(days=14),
                          today + timedelta(days=120), None, r.cabin or "ECONOMY")
        points = adapter.search_calendar(spec)
        base = compute_baseline(points)
        if base:
            by_zone.setdefault(r.zone, []).append(base.decile)
    for zone, deciles in by_zone.items():
        z = session.get(models.Zone, zone)
        if z and deciles:
            # "interesting" ceiling = the typical cheap-end price across the zone's routes.
            z.threshold_price_eur = round(sum(deciles) / len(deciles), 0)
    session.commit()


def calibrate() -> None:
    from skrendam.fli_adapter.live_backend import LiveFliBackend
    settings = Settings()
    session = make_sessionmaker(settings)()
    bucket = TokenBucket(settings.min_call_interval_seconds, settings.pacing_jitter_seconds)
    backend = LiveFliBackend(settings)
    # Pace the live calibration scan by wrapping the adapter inside calibrate_thresholds:
    calibrate_thresholds(session, backend=_PacedBackend(backend, bucket), today=date.today())


class _PacedBackend:
    def __init__(self, inner, bucket):
        self.inner, self.bucket = inner, bucket
    def search_calendar(self, spec):
        self.bucket.acquire()
        return self.inner.search_calendar(spec)
    def search_flights(self, *a, **k):
        self.bucket.acquire()
        return self.inner.search_flights(*a, **k)
