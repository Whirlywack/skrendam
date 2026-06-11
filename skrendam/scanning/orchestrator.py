"""run_scan: the 11-step pass that wires resolver -> adapter -> baseline -> matching -> DB (spec §7)."""

from dataclasses import dataclass
from datetime import date, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from skrendam.db import models, repositories as repo
from skrendam.fli_adapter.adapter import FliAdapter
from skrendam.fli_adapter.errors import RateLimitedError, ScanError
from skrendam.fli_adapter.pacing import CircuitBreaker
from skrendam.scanning import baseline as baseline_mod
from skrendam.scanning import content as content_mod
from skrendam.scanning.dedup import deal_group_key
from skrendam.scanning.history import DbPriceHistory
from skrendam.scanning.resolver import resolve
from skrendam.scanning.scoring.base import ScoringContext
from skrendam.scanning.scoring.eligibility import in_template_scope
from skrendam.scanning.scoring.registry import enabled_scorers

CANDIDATE_TTL_DAYS = 14


@dataclass
class ScanSummary:
    templates_scanned: int = 0
    routes_scanned: int = 0
    candidates_found: int = 0
    matches_created: int = 0
    errors: int = 0
    http_429s: int = 0


def _flagged(points, baseline, _zone):
    # Flag the window's relatively-cheap dates (<= 10th-percentile). This is the
    # tier-2 trigger and is naturally bounded (~10% of the window). The absolute
    # "interesting price" ceiling (zone.threshold_price_eur / template.max_price_eur)
    # is enforced later in matching, not here, so tier-2 fetches stay bounded.
    return [p for p in points if p.price <= baseline.decile]


def run_scan(session: Session, today: date, adapter: FliAdapter,
             scanner_version: str = "0.1.0", circuit_breaker_threshold: int = 5) -> ScanSummary:
    now = datetime(today.year, today.month, today.day)
    run = models.ScanRun(scanner_version=scanner_version, status="running", started_at=now)
    session.add(run)
    session.flush()
    summary = ScanSummary()
    breaker = CircuitBreaker(circuit_breaker_threshold)
    history = DbPriceHistory(session, now)

    templates = list(session.scalars(
        select(models.DealTemplate).where(models.DealTemplate.enabled.is_(True))))
    routes = list(session.scalars(select(models.Route)))
    zones = {z.zone: z for z in session.scalars(select(models.Zone))}
    route_by_pair = {(r.origin, r.destination): r for r in routes if r.enabled}

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
            except ScanError as exc:
                summary.errors += 1
                if isinstance(exc, RateLimitedError):
                    summary.http_429s += 1
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
                except ScanError as exc:
                    summary.errors += 1
                    if isinstance(exc, RateLimitedError):
                        summary.http_429s += 1
                    breaker.record_failure()
                    if breaker.is_open():
                        aborted = True
                        break
                    continue
                if not fares:
                    continue
                fare = min(fares, key=lambda f: f.price)
                _persist_fare(session, run, route, zone, spec, p, fare, base,
                              templates, now, scanner_version, summary, history)
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
    run.http_429s = summary.http_429s
    session.commit()
    return summary


def _persist_fare(session, run, route, zone, spec, point, fare, base, templates,
                  now, scanner_version, summary, history):
    # Score against every applicable template with every enabled scorer (pure, no writes).
    hist_series = history.for_route(route.id, spec.trip_type)
    prev = hist_series.previous_price(point.travel_date, now)
    matched = []  # (tpl, headline_score, all_scores)
    for tpl in templates:
        if tpl.trip_type != spec.trip_type:
            continue
        if not in_template_scope(tpl, route, point, today=now.date()):
            continue
        ctx = ScoringContext(fare=fare, baseline=base, zone=zone, template=tpl,
                             history=hist_series, previous_price=prev)
        scores = [s for sc in enabled_scorers() if (s := sc.score(ctx)) is not None]
        if not scores:
            continue
        primary_name = tpl.primary_scorer or "weighted"
        headline = next((s for s in scores if s.scorer == primary_name), None)
        if headline is None:
            headline = max(scores, key=lambda s: s.score_0_100)
        matched.append((tpl, headline, scores))
    if not matched:
        return  # nothing flagged -> not a candidate, don't persist an orphan

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
    cand, created = repo.upsert_candidate(session, key, fields, now)
    if created:
        summary.candidates_found += 1

    for tpl, headline, scores in matched:
        _match, created = repo.upsert_match(
            session, cand.id, tpl.id, headline.value, headline.reason_text, headline.signals,
            score_0_100=headline.score_0_100, quality_tier=headline.quality_tier,
            primary_scorer=headline.scorer)
        if created:
            summary.matches_created += 1
        for sc in scores:
            repo.upsert_score(session, cand.id, tpl.id, sc)
        draft = content_mod.build_content_draft(spec.origin, spec.destination, fare.price,
                                                base.median, point.travel_date, tpl)
        repo.ensure_content_draft(session, cand.id, tpl.id, draft)


def _expire_stale(session, now):
    stale = session.scalars(
        select(models.Candidate).where(
            models.Candidate.status.in_(("new", "seen", "maybe")),
            models.Candidate.expires_at.is_not(None),
            models.Candidate.expires_at < now))
    for c in stale:
        c.status = "expired"
    session.flush()
