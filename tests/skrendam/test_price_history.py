from datetime import date, datetime

from sqlalchemy import create_engine
from sqlalchemy.orm import Session as SASession

from skrendam.db import models as m
from skrendam.db.base import Base
from skrendam.scanning.history import (
    DbPriceHistory,
    HistoryPoint,
    InMemoryPriceHistory,
    PriceHistorySeries,
)


def _series(prices):
    pts = tuple(
        HistoryPoint(scanned_at=datetime(2026, 1, d + 1), travel_date=date(2026, 6, 1), price=p)
        for d, p in enumerate(prices)
    )
    return PriceHistorySeries(route_id=1, trip_type="oneway", points=pts)


def test_min_seen_and_percentile():
    s = _series([100, 200, 300, 400])
    assert s.min_seen() == 100
    assert s.percentile(100) == 0.25  # 1 of 4 at or below
    assert s.percentile(400) == 1.0


def test_previous_price_picks_latest_before_cutoff():
    s = _series([300, 250])  # scanned Jan 1 then Jan 2, same travel_date
    assert s.previous_price(date(2026, 6, 1), before=datetime(2026, 1, 3)) == 250
    assert s.previous_price(date(2026, 6, 1), before=datetime(2026, 1, 2)) == 300
    assert s.previous_price(date(2026, 6, 1), before=datetime(2026, 1, 1)) is None


def test_inmemory_for_route_returns_empty_when_missing():
    hist = InMemoryPriceHistory({(1, "oneway"): _series([100, 200])})
    assert hist.for_route(1, "oneway").min_seen() == 100
    assert hist.for_route(9, "oneway").points == ()


def _seed_session():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    s = SASession(engine)
    s.add(m.Zone(zone="EU_SHORT", haul_type="short"))
    s.add(m.Route(id=1, origin="VNO", destination="AMS", zone="EU_SHORT"))
    s.add(m.ScanRun(id=1, scanner_version="t"))
    s.flush()
    for day, price in enumerate([300.0, 250.0, 120.0], start=1):
        s.add(
            m.PriceLog(
                run_id=1,
                route_id=1,
                trip_type="oneway",
                travel_date=date(2026, 6, 1),
                price=price,
                scanner_version="t",
                scanned_at=datetime(2026, 1, day),
            )
        )
    s.flush()
    return s


def test_db_price_history_reads_log():
    s = _seed_session()
    hist = DbPriceHistory(s, now=datetime(2026, 2, 1))
    series = hist.for_route(1, "oneway")
    assert series.min_seen() == 120.0
    assert series.previous_price(date(2026, 6, 1), before=datetime(2026, 1, 3)) == 250.0


def test_db_price_history_respects_window():
    s = _seed_session()
    hist = DbPriceHistory(s, now=datetime(2026, 6, 1), window_days=30)  # excludes Jan rows
    assert hist.for_route(1, "oneway").points == ()


def test_db_price_history_excludes_current_scan():
    # Rows are scanned_at Jan 1 (300), Jan 2 (250), Jan 3 (120). With now == Jan 2,
    # history must be STRICTLY PRIOR: only the Jan 1 row, so the current scan's own
    # freshly-logged prices can't become a fare's floor/percentile.
    s = _seed_session()
    hist = DbPriceHistory(s, now=datetime(2026, 1, 2))
    series = hist.for_route(1, "oneway")
    assert [p.scanned_at for p in series.points] == [datetime(2026, 1, 1)]
    assert series.min_seen() == 300.0
