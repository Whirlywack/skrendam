from datetime import date, datetime

import pytest

from skrendam.db import models
from skrendam.fli_adapter.adapter import FliAdapter
from skrendam.fli_adapter.errors import ScanError
from skrendam.verification import DealCheck, recheck_candidate, verify_deal


def _seed(session, price=96.0, *, baseline=275.0, snapshot=None, missed_checks=0):
    """Seed a live EUR96 one-way deal (EUR275 baseline: a +25 % recheck still clears the gate)."""
    session.add(models.Route(id=1, origin="VNO", destination="BCN", zone="MED"))
    cand = models.Candidate(
        id=1,
        route_id=1,
        origin="VNO",
        destination="BCN",
        zone="MED",
        trip_type="oneway",
        travel_date=date(2026, 9, 12),
        price=price,
        baseline_price=baseline,
        deal_group_key="k",
        first_seen_at=datetime(2026, 6, 2),
        last_seen_at=datetime(2026, 6, 2),
        itinerary_snapshot=snapshot,
    )
    session.add(cand)
    session.add(
        models.PublishedDeal(
            id=1,
            candidate_id=1,
            deal_template_id=1,
            headline="h",
            origin="VNO",
            destination="BCN",
            trip_type="oneway",
            travel_date=date(2026, 9, 12),
            price=price,
            baseline_price=baseline,
            status="live",
            tier="free",
            published_at=datetime(2026, 6, 2),
            missed_checks=missed_checks,
        )
    )
    session.commit()
    return cand


def _deal_checks(session, deal_id=1):
    return (
        session.query(models.DealPriceCheck)
        .filter_by(deal_id=deal_id)
        .order_by(models.DealPriceCheck.id)
        .all()
    )


class _Backend:
    def __init__(self, fares):
        self._fares = fares

    def search_flights(self, *a, **k):
        return self._fares


def _fare(price):
    return [
        {
            "price": price,
            "currency": "EUR",
            "stops": 0,
            "duration": 200,
            "legs": [{"airline": {"code": "BT"}}],
            "booking_url": "https://x",
        }
    ]


def test_recheck_marks_going_fast_when_price_rises(session):
    cand = _seed(session, price=96.0)
    adapter = FliAdapter(_Backend(_fare(120.0)), pace=lambda: None)  # +25%
    recheck_candidate(session, cand, adapter, now=datetime(2026, 6, 3))
    pd = session.get(models.PublishedDeal, 1)
    assert pd.going_fast is True
    # +25 % is beyond the drift tolerance but still clears the gate (56 % off the EUR275
    # baseline): a hand recheck moves the deal exactly as the daily step would (N1).
    assert pd.status == "changed"
    assert pd.last_seen_at == datetime(2026, 6, 3)


def test_recheck_no_flag_when_stable(session):
    cand = _seed(session, price=96.0)
    adapter = FliAdapter(_Backend(_fare(98.0)), pace=lambda: None)  # +2%, under threshold
    recheck_candidate(session, cand, adapter, now=datetime(2026, 6, 3))
    pd = session.get(models.PublishedDeal, 1)
    assert pd.going_fast is False and pd.status == "live"


def test_recheck_empty_keeps_deal_live_and_marks_unverified(session):
    """Empty fli results must NOT expire live deals.

    The pipe may be gated (the silent-empty mode), not the fare gone.
    """
    cand = _seed(session, price=96.0)
    adapter = FliAdapter(_Backend([]), pace=lambda: None)  # no fares
    recheck_candidate(session, cand, adapter, now=datetime(2026, 6, 3))
    pd = session.get(models.PublishedDeal, 1)
    assert pd.status == "live"
    assert pd.unverified_since == datetime(2026, 6, 3)
    assert pd.last_seen_at is None  # an unverifiable check is not a sighting
    # An empty hand recheck is not the daily step's "missed day": no row, no miss, no stamp.
    assert pd.missed_checks == 0 and pd.verified_at is None and pd.current_price is None
    assert _deal_checks(session) == []


def test_second_empty_recheck_keeps_first_unverified_timestamp(session):
    cand = _seed(session, price=96.0)
    adapter = FliAdapter(_Backend([]), pace=lambda: None)
    recheck_candidate(session, cand, adapter, now=datetime(2026, 6, 3))
    recheck_candidate(session, cand, adapter, now=datetime(2026, 6, 4))
    pd = session.get(models.PublishedDeal, 1)
    assert pd.status == "live"
    assert pd.unverified_since == datetime(2026, 6, 3)


def test_successful_recheck_clears_unverified(session):
    cand = _seed(session, price=96.0)
    recheck_candidate(
        session, cand, FliAdapter(_Backend([]), pace=lambda: None), now=datetime(2026, 6, 3)
    )
    recheck_candidate(
        session,
        cand,
        FliAdapter(_Backend(_fare(98.0)), pace=lambda: None),
        now=datetime(2026, 6, 4),
    )
    pd = session.get(models.PublishedDeal, 1)
    assert pd.unverified_since is None
    assert pd.status == "live"
    assert pd.last_seen_at == datetime(2026, 6, 4)


def test_recheck_scan_error_leaves_published_deal_live(session):
    """A transient ScanError must NOT expire live published deals."""
    cand = _seed(session, price=96.0)

    class _ErrorBackend:
        def search_flights(self, *a, **k):
            raise ScanError("connection timeout")

    adapter = FliAdapter(_ErrorBackend(), pace=lambda: None)
    recheck_candidate(session, cand, adapter, now=datetime(2026, 6, 3))
    pd = session.get(models.PublishedDeal, 1)
    assert pd.status == "live", "ScanError must not expire a live published deal"
    assert pd.going_fast is False  # unchanged from seed default
    assert pd.unverified_since is None  # errors are no evidence; only emptiness stamps the marker
    assert pd.verified_at is None and _deal_checks(session) == []


def test_recheck_resets_going_fast_when_price_falls(session):
    """going_fast must clear when a recheck price no longer warrants it."""
    cand = _seed(session, price=96.0)
    # Manually set the published deal as going_fast=True (as if a previous recheck flagged it)
    pd = session.get(models.PublishedDeal, 1)
    pd.going_fast = True
    session.commit()

    # Recheck returns a price at or below the published price — no 5% rise
    adapter = FliAdapter(_Backend(_fare(96.0)), pace=lambda: None)  # same price, 0% rise
    recheck_candidate(session, cand, adapter, now=datetime(2026, 6, 3))
    session.expire(pd)
    pd = session.get(models.PublishedDeal, 1)
    assert pd.going_fast is False, (
        "going_fast must reset when recheck price no longer rises above threshold"
    )
    assert pd.status == "live"


def test_manual_recheck_leaves_candidate_price_unchanged(session):
    """The desk recheck must not overwrite the discovery price (WP9)."""
    cand = _seed(session, price=96.0)
    adapter = FliAdapter(_Backend(_fare(124.0)), pace=lambda: None)
    check = recheck_candidate(session, cand, adapter, now=datetime(2026, 6, 3))
    session.expire_all()
    cand = session.get(models.Candidate, 1)
    assert check.price == 124.0  # the observed price lives on the check row
    assert cand.price == 96.0
    assert cand.verified_at == datetime(2026, 6, 3)
    assert cand.last_seen_at == datetime(2026, 6, 3)


def test_manual_recheck_flags_going_fast_on_changed_deals_too(session):
    _seed(session, price=96.0)
    pd = session.get(models.PublishedDeal, 1)
    pd.status = "changed"
    session.commit()
    cand = session.get(models.Candidate, 1)
    recheck_candidate(
        session,
        cand,
        FliAdapter(_Backend(_fare(120.0)), pace=lambda: None),
        now=datetime(2026, 6, 3),
    )
    session.expire_all()
    pd = session.get(models.PublishedDeal, 1)
    assert pd.status == "changed" and pd.going_fast is True


# --- manual Recheck stamps the verification fields (final review N1) ----------------


def test_manual_recheck_stamps_verification_fields_and_writes_a_manual_row(session):
    """A real answer from the desk's Recheck is the same evidence as the daily step's."""
    cand = _seed(session, price=96.0, snapshot={"legs": [_leg("1913")]})
    fares = [_itin(90.0, [_leg("777", "FR")]), _itin(100.0, [_leg("1913")])]
    now = datetime(2026, 6, 3, 9, 30)
    recheck_candidate(session, cand, _adapter(fares), now=now)
    session.expire_all()
    pd = session.get(models.PublishedDeal, 1)
    assert pd.status == "live"  # EUR100 against EUR96 is within the 10 % tolerance
    # The exact itinerary's price (flight-number match), not the day's cheapest fare.
    assert pd.current_price == 100.0 and pd.current_price_at == now
    assert pd.window_min_price == 90.0 and pd.window_min_date == date(2026, 9, 12)
    assert pd.verified_at == now and pd.last_seen_at == now
    assert pd.missed_checks == 0 and pd.unverified_since is None
    (row,) = _deal_checks(session)
    assert (row.source, row.available, row.price, row.window_min_price) == (
        "manual",
        True,
        100.0,
        90.0,
    )
    assert row.window_min_date == date(2026, 9, 12) and row.checked_at == now
    assert row.run_id is None  # no scan run behind a hand recheck


def test_manual_recheck_without_flight_numbers_uses_the_day_min(session):
    cand = _seed(session, price=96.0)  # snapshot None: the itinerary cannot be identified
    recheck_candidate(session, cand, _adapter(_fare(98.0)), now=datetime(2026, 6, 3))
    session.expire_all()
    pd = session.get(models.PublishedDeal, 1)
    assert pd.status == "live" and pd.current_price == 98.0 and pd.window_min_price == 98.0
    (row,) = _deal_checks(session)
    assert row.price is None and row.window_min_price == 98.0  # same shape as verify_deal


def test_manual_recheck_moves_a_deal_to_changed_like_the_scan(session):
    cand = _seed(session, price=96.0)  # EUR275 baseline: EUR124 is still 55 % off
    recheck_candidate(session, cand, _adapter(_fare(124.0)), now=datetime(2026, 6, 3))
    session.expire_all()
    pd = session.get(models.PublishedDeal, 1)
    assert pd.status == "changed" and pd.current_price == 124.0
    assert pd.expired_at is None and pd.missed_checks == 0


def test_manual_recheck_expires_a_deal_that_fails_the_gate(session):
    """No baseline, no template, no zone: EUR124 clears nothing -> expired, like the scan."""
    cand = _seed(session, price=96.0, baseline=None)
    now = datetime(2026, 6, 3, 9, 30)
    recheck_candidate(session, cand, _adapter(_fare(124.0)), now=now)
    session.expire_all()
    pd = session.get(models.PublishedDeal, 1)
    assert pd.status == "expired" and pd.expired_at == now
    assert pd.current_price == 124.0 and pd.verified_at == now


def test_manual_recheck_uses_the_template_gates(session):
    """The template's ceiling keeps EUR124 a deal even without a baseline (shared gate)."""
    cand = _seed(session, price=96.0, baseline=None)
    session.add(
        models.DealTemplate(
            id=1,
            slug="t",
            name="t",
            enabled=True,
            audience_segment_id=1,
            travel_moment_id=1,
            trip_type="oneway",
            date_window_type="relative",
            included_zones=["MED"],
            max_price_eur=150,
        )
    )
    session.commit()
    recheck_candidate(session, cand, _adapter(_fare(124.0)), now=datetime(2026, 6, 3))
    session.expire_all()
    assert session.get(models.PublishedDeal, 1).status == "changed"


def test_manual_recheck_resets_missed_checks_on_a_real_answer(session):
    cand = _seed(session, price=96.0, missed_checks=1)
    recheck_candidate(session, cand, _adapter(_fare(96.0)), now=datetime(2026, 6, 3))
    session.expire_all()
    pd = session.get(models.PublishedDeal, 1)
    assert pd.missed_checks == 0 and pd.status == "live"


def test_manual_recheck_leaves_deals_off_the_site_alone(session):
    cand = _seed(session, price=96.0)
    pd = session.get(models.PublishedDeal, 1)
    pd.status = "expired"
    session.commit()
    recheck_candidate(session, cand, _adapter(_fare(96.0)), now=datetime(2026, 6, 3))
    session.expire_all()
    pd = session.get(models.PublishedDeal, 1)
    assert pd.status == "expired" and pd.verified_at is None and _deal_checks(session) == []


# --- verify_deal: the exact itinerary check (WP9) -----------------------------------


def _leg(flight_number, airline="W6"):
    return {"airline": {"code": airline}, "flight_number": flight_number}


def _itin(price, legs):
    return {
        "price": price,
        "currency": "EUR",
        "stops": len(legs) - 1,
        "duration": 200,
        "legs": legs,
        "booking_url": "https://www.google.com/x",
    }


def _adapter(backend_or_fares):
    if hasattr(backend_or_fares, "search_flights"):
        return FliAdapter(backend_or_fares, pace=lambda: None)
    backend = _Backend(backend_or_fares)
    return FliAdapter(backend, pace=lambda: None)


class _SpyBackend(_Backend):
    def __init__(self, fares):
        super().__init__(fares)
        self.calls = []

    def search_flights(self, *a, **k):
        self.calls.append(a)
        return self._fares


def _published_deal(**overrides):
    fields = {
        "id": 4,
        "candidate_id": 448,
        "deal_template_id": 9,
        "headline": "h",
        "origin": "VNO",
        "destination": "STN",
        "trip_type": "roundtrip",
        "travel_date": date(2026, 12, 4),
        "return_date": date(2026, 12, 6),
        "price": 93.0,
        "baseline_price": 275.0,
        "status": "live",
    }
    fields.update(overrides)
    return models.PublishedDeal(**fields)


SNAPSHOT = {"price": 93.0, "legs": [_leg("1913"), _leg("1914")]}
NOW = datetime(2026, 9, 11, 8, 0)


def test_verify_deal_prices_the_exact_itinerary_and_the_day_minimum():
    backend = _SpyBackend(
        [
            _itin(90.0, [_leg("777", "FR")]),
            _itin(124.0, [_leg("1913"), _leg("1914")]),
            _itin(140.0, [_leg("1913"), _leg("1916")]),
        ]
    )
    adapter = FliAdapter(backend, pace=lambda: None)
    check = verify_deal(_published_deal(), adapter, now=NOW, snapshot=SNAPSHOT)
    assert check == DealCheck(
        available=True,
        price=124.0,
        window_min_price=90.0,
        window_min_date=date(2026, 12, 4),
        source="flights",
        checked_at=NOW,
    )
    assert adapter.api_calls == 1
    assert backend.calls == [("VNO", "STN", date(2026, 12, 4), date(2026, 12, 6), "ECONOMY")]


def test_verify_deal_passes_cabin_and_one_way_dates():
    backend = _SpyBackend([])
    deal = _published_deal(trip_type="oneway", return_date=None)
    verify_deal(deal, FliAdapter(backend, pace=lambda: None), now=NOW, cabin="BUSINESS")
    assert backend.calls == [("VNO", "STN", date(2026, 12, 4), None, "BUSINESS")]


def test_verify_deal_normalises_flight_numbers():
    fares = [_itin(100.0, [_leg(" w6 1913"), _leg("1914 ")])]
    snapshot = {"legs": [_leg("W61913"), _leg("1914")]}
    check = verify_deal(_published_deal(), _adapter(fares), now=NOW, snapshot=snapshot)
    assert check.price == 100.0


def test_verify_deal_requires_legs_in_order():
    fares = [_itin(100.0, [_leg("1914"), _leg("1913")])]
    check = verify_deal(_published_deal(), _adapter(fares), now=NOW, snapshot=SNAPSHOT)
    assert check.available is True
    assert check.price is None
    assert check.window_min_price == 100.0


def test_verify_deal_itinerary_gone_but_day_has_fares():
    fares = [_itin(150.0, [_leg("2001", "FR")]), _itin(110.0, [_leg("2002", "FR")])]
    check = verify_deal(_published_deal(), _adapter(fares), now=NOW, snapshot=SNAPSHOT)
    assert check == DealCheck(True, None, 110.0, date(2026, 12, 4), "flights", NOW)


def test_verify_deal_without_a_snapshot_cannot_identify_the_itinerary():
    fares = [_itin(93.0, [_leg("1913"), _leg("1914")])]
    check = verify_deal(_published_deal(), _adapter(fares), now=NOW, snapshot=None)
    assert check.available is True and check.price is None and check.window_min_price == 93.0


def test_verify_deal_snapshot_legs_without_numbers_cannot_match():
    fares = [_itin(93.0, [{"airline": {"code": "W6"}}, {"airline": {"code": "W6"}}])]
    snapshot = {"legs": [{"airline": {"code": "W6"}}, {"airline": {"code": "W6"}}]}
    check = verify_deal(_published_deal(), _adapter(fares), now=NOW, snapshot=snapshot)
    assert check.available is True and check.price is None and check.window_min_price == 93.0


def test_verify_deal_empty_answer_is_unavailable_with_no_prices():
    check = verify_deal(_published_deal(), _adapter([]), now=NOW, snapshot=SNAPSHOT)
    assert check == DealCheck(False, None, None, None, "flights", NOW)


def test_verify_deal_lets_scan_errors_propagate():
    """An error is not an empty answer: it must never count as a missed check."""

    class _ErrorBackend:
        def search_flights(self, *a, **k):
            raise ScanError("connection timeout")

    with pytest.raises(ScanError):
        verify_deal(_published_deal(), _adapter(_ErrorBackend()), now=NOW, snapshot=SNAPSHOT)
