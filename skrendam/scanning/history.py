"""PriceHistory: a read-module over price_log that turns the write-only log into
queryable route memory. DbPriceHistory in prod, InMemoryPriceHistory in tests."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Protocol

from sqlalchemy import select
from sqlalchemy.orm import Session

from skrendam.db import models


@dataclass(frozen=True)
class HistoryPoint:
    scanned_at: datetime
    travel_date: date
    price: float


@dataclass(frozen=True)
class PriceHistorySeries:
    route_id: int
    trip_type: str
    points: tuple[HistoryPoint, ...]

    def min_seen(self) -> float | None:
        return min((p.price for p in self.points), default=None)

    def percentile(self, price: float) -> float:
        """Fraction of recorded prices at or below `price` (0..1). 1.0 if empty."""
        if not self.points:
            return 1.0
        at_or_below = sum(1 for p in self.points if p.price <= price)
        return at_or_below / len(self.points)

    def previous_point(self, travel_date: date, before: datetime) -> HistoryPoint | None:
        """Most recent recorded point for this travel_date strictly before `before`."""
        cands = [p for p in self.points if p.travel_date == travel_date and p.scanned_at < before]
        if not cands:
            return None
        return max(cands, key=lambda p: p.scanned_at)

    def previous_price(self, travel_date: date, before: datetime) -> float | None:
        """Most recent recorded price for this travel_date strictly before `before`."""
        pt = self.previous_point(travel_date, before)
        return pt.price if pt else None


class PriceHistory(Protocol):
    def for_route(self, route_id: int, trip_type: str) -> PriceHistorySeries: ...


class InMemoryPriceHistory:
    """Test adapter. Backed by a dict of (route_id, trip_type) -> PriceHistorySeries."""

    def __init__(self, series_by_route: dict[tuple[int, str], PriceHistorySeries]):
        self._series = series_by_route

    def for_route(self, route_id: int, trip_type: str) -> PriceHistorySeries:
        return self._series.get(
            (route_id, trip_type),
            PriceHistorySeries(route_id=route_id, trip_type=trip_type, points=()),
        )


class DbPriceHistory:
    """Prod adapter. Prefetches each route's recent price_log series once, then
    serves from memory. Bounded by window_days; relies on the price_log composite
    index added in the 0006 migration.

    History is STRICTLY PRIOR to ``now``: the orchestrator writes the current
    scan's price_log rows (scanned_at == now) before scoring, and SQLAlchemy
    autoflush would otherwise pull them into this query — making a fare its own
    floor (ErrorFareScorer could never fire) and polluting RarityScorer's
    percentile. The ``scanned_at < now`` bound excludes the current scan."""

    def __init__(self, session: Session, now: datetime, window_days: int = 180):
        self._session = session
        self._now = now
        self._cutoff = now - timedelta(days=window_days)
        self._cache: dict[tuple[int, str], PriceHistorySeries] = {}

    def for_route(self, route_id: int, trip_type: str) -> PriceHistorySeries:
        key = (route_id, trip_type)
        if key not in self._cache:
            rows = self._session.execute(
                select(models.PriceLog.scanned_at, models.PriceLog.travel_date, models.PriceLog.price)
                .where(models.PriceLog.route_id == route_id,
                       models.PriceLog.trip_type == trip_type,
                       models.PriceLog.scanned_at >= self._cutoff,
                       models.PriceLog.scanned_at < self._now)
                .order_by(models.PriceLog.scanned_at)
            ).all()
            pts = tuple(HistoryPoint(scanned_at=r[0], travel_date=r[1], price=r[2]) for r in rows)
            self._cache[key] = PriceHistorySeries(route_id=route_id, trip_type=trip_type, points=pts)
        return self._cache[key]
