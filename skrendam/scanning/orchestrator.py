"""run_scan: the 11-step pass that wires resolver -> adapter -> baseline -> matching -> DB (spec §7)."""

from dataclasses import dataclass
from datetime import date, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from skrendam.db import models, repositories as repo
from skrendam.fli_adapter.adapter import FliAdapter
from skrendam.fli_adapter.errors import ScanError
from skrendam.fli_adapter.pacing import CircuitBreaker
from skrendam.scanning import baseline as baseline_mod
from skrendam.scanning import content as content_mod
from skrendam.scanning import matching as matching_mod
from skrendam.scanning.dedup import deal_group_key
from skrendam.scanning.resolver import resolve

CANDIDATE_TTL_DAYS = 14


@dataclass
class ScanSummary:
    templates_scanned: int = 0
    routes_scanned: int = 0
    candidates_found: int = 0
    matches_created: int = 0
    errors: int = 0


def _flagged(points, baseline, zone):
    cut = baseline.decile
    if zone.threshold_price_eur is not None:
        cut = max(cut, zone.threshold_price_eur)
    return [p for p in points if p.price <= cut]


def run_scan(session: Session, today: date, adapter: FliAdapter,
             scanner_version: str = "0.1.0", circuit_breaker_threshold: int = 5) -> ScanSummary:
    now = datetime(today.year, today.month, today.day)
    run = models.ScanRun(scanner_version=scanner_version, status="running")
    session.add(run)
    session.flush()
    summary = ScanSummary()
    breaker = CircuitBreaker(circuit_breaker_threshold)

    templates = list(session.scalars(
        select(models.DealTemplate).where(models.DealTemplate.enabled.is_(True))))
    routes = list(session.scalars(select(models.Route)))
    zones = {z.zone: z for z in session.scalars(select(models.Zone))}
    route_by_pair = {(r.origin, r.destination): r for r in routes}

    aborted = False
    for tpl in templates:
        if aborted:
            break
        summary.templates_scanned += 1
        for spec in resolve(tpl, routes, today):
            summary.routes_scanned += 1
            try:
                points = adapter.search_calendar(spec)
                breaker.record_success()
            except ScanError:
                summary.errors += 1
                breaker.record_failure()
                if breaker.is_open():
                    aborted = True
                    break
                continue
            route = route_by_pair[(spec.origin, spec.destination)]
            zone = zones[route.zone]
            for p in points:
                session.add(models.PriceLog(
                    run_id=run.id, route_id=route.id, trip_type=spec.trip_type,
                    travel_date=p.travel_date, return_date=p.return_date, price=p.price,
                    currency="EUR", scanner_version=scanner_version, scanned_at=now))
            base = baseline_mod.compute_baseline(points)
            if base is None:
                continue
            for p in _flagged(points, base, zone):
                try:
                    fares = adapter.search_flights(spec.origin, spec.destination,
                                                   p.travel_date, p.return_date, spec.cabin)
                    breaker.record_success()
                except ScanError:
                    summary.errors += 1
                    breaker.record_failure()
                    if breaker.is_open():
                        aborted = True
                        break
                    continue
                if not fares:
                    continue
                fare = min(fares, key=lambda f: f.price)
                _persist_fare(session, run, route, zone, spec, p, fare, base,
                              templates, now, scanner_version, summary)
            if aborted:
                break

    _expire_stale(session, now)
    run.finished_at = now
    run.status = "failed" if aborted else "completed"
    run.templates_scanned = summary.templates_scanned
    run.routes_scanned = summary.routes_scanned
    run.candidates_found = summary.candidates_found
    run.matches_created = summary.matches_created
    run.api_calls = adapter.api_calls
    run.errors = summary.errors
    session.commit()
    return summary


def _persist_fare(session, run, route, zone, spec, point, fare, base, templates,
                  now, scanner_version, summary):
    discount = None if base.median <= 0 else round((base.median - fare.price) / base.median * 100, 1)
    key = deal_group_key(spec.origin, spec.destination, spec.trip_type,
                         point.travel_date, point.return_date, fare.price)
    fields = dict(run_id=run.id, route_id=route.id, origin=spec.origin,
                  destination=spec.destination, zone=route.zone, trip_type=spec.trip_type,
                  travel_date=point.travel_date, return_date=point.return_date,
                  price=fare.price, currency=fare.currency, baseline_price=base.median,
                  discount_pct=discount, itinerary_snapshot=fare.raw,
                  search_params={"cabin": spec.cabin}, scanner_version=scanner_version,
                  expires_at=now + timedelta(days=CANDIDATE_TTL_DAYS))
    is_new = session.scalar(
        select(models.Candidate.id).where(models.Candidate.deal_group_key == key)) is None
    cand = repo.upsert_candidate(session, key, fields, now)
    if is_new:
        summary.candidates_found += 1

    # Evaluate this fare against EVERY applicable template (not just the one that fetched it).
    for tpl in templates:
        if tpl.trip_type != spec.trip_type:
            continue
        if not _fare_in_template_scope(tpl, route, point, today=now.date()):
            continue
        result = matching_mod.match(fare, tpl, base, zone)
        if result is None:
            continue
        repo.upsert_match(session, cand.id, tpl.id, result.match_score,
                          result.reason_text, result.gate_results)
        summary.matches_created += 1
        draft = content_mod.build_content_draft(spec.origin, spec.destination, fare.price,
                                                base.median, point.travel_date, tpl)
        repo.ensure_content_draft(session, cand.id, tpl.id, draft)


def _fare_in_template_scope(tpl, route, point, today) -> bool:
    from skrendam.scanning.resolver import _destinations_ok, _window
    if not _destinations_ok(tpl, route):
        return False
    start, end = _window(tpl, today)
    return start <= point.travel_date <= end


def _expire_stale(session, now):
    stale = session.scalars(
        select(models.Candidate).where(
            models.Candidate.status.in_(("new", "seen", "maybe")),
            models.Candidate.expires_at.is_not(None),
            models.Candidate.expires_at < now))
    for c in stale:
        c.status = "expired"
    session.flush()
