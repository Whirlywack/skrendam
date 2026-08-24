"""run_scan: the 11-step pass that wires resolver -> adapter -> baseline -> matching -> DB (spec §7)."""

from dataclasses import dataclass
from datetime import date, datetime, timedelta

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from skrendam.db import models
from skrendam.db import repositories as repo
from skrendam.fli_adapter.adapter import FliAdapter
from skrendam.fli_adapter.errors import RateLimitedError, ScanError
from skrendam.fli_adapter.health import HealthVerdict, assess, health_json
from skrendam.fli_adapter.pacing import CircuitBreaker
from skrendam.scanning import baseline as baseline_mod
from skrendam.scanning import content as content_mod
from skrendam.scanning.dedup import deal_group_key
from skrendam.scanning.history import DbPriceHistory
from skrendam.scanning.resolver import resolve
from skrendam.scanning.scoring.base import ScoringContext
from skrendam.scanning.scoring.eligibility import in_template_scope
from skrendam.scanning.scoring.registry import enabled_scorers, pick_headline

CANDIDATE_TTL_DAYS = 14
NEAR_PRICE_FRAC = 1.10  # a date "supports" a fare if its calendar price is within +10%


def due_routes(routes, today: date, rotation_days: int, all_routes: bool = False) -> list:
    """Routes to scan today: enabled AND (core OR today's rotation slot).

    The tail slice is computed, not stored - retuning rotation_days never
    rewrites route rows. A width retune can leave a route unscanned for up to
    old-N days before its new slot comes up: harmless, self-healing, by design.

    Args:
        routes: All Route rows loaded from the database.
        today: The date being scanned.
        rotation_days: Cohort window width N; tail routes scan when id % N == ordinal % N.
        all_routes: When True, return all enabled routes, bypassing cohort logic.

    Returns:
        List of Route objects due for scanning today.

    """
    enabled = [r for r in routes if r.enabled]
    if all_routes:
        return enabled
    slot = today.toordinal() % rotation_days
    return [r for r in enabled if r.core or r.id % rotation_days == slot]


@dataclass
class ScanSummary:
    templates_scanned: int = 0
    routes_scanned: int = 0
    candidates_found: int = 0
    matches_created: int = 0
    errors: int = 0
    http_429s: int = 0
    health: HealthVerdict | None = None
    aborted: bool = False


def _flagged(points, baseline, _zone):
    # Flag relatively-cheap dates (<= 10th-percentile) — but per travel MONTH,
    # not per window: a whole-window decile is monopolized by the cheap season
    # (all-January flags on a Nov-Mar template), starving other months of
    # tier-2 fetches. Month-local deciles keep the ~10% bound while spreading
    # flags across seasons; thin months (<5 pts) fall back to the window decile.
    # Absolute price ceilings are enforced later in matching, not here.
    def cutoff(p):
        m = baseline.month_stats(p.travel_date)
        return m.decile if m is not None else baseline.decile

    return [p for p in points if p.price <= cutoff(p)]


def run_scan(
    session: Session,
    today: date,
    adapter: FliAdapter,
    scanner_version: str = "0.1.0",
    circuit_breaker_threshold: int = 5,
    tail_rotation_days: int = 10,
    all_routes: bool = False,
    now: datetime | None = None,
) -> ScanSummary:
    # Production callers (cli, worker) pass the real wall clock so same-day runs
    # get distinct timestamps (earlier runs stay visible in price history and
    # last_seen_at never moves backwards). The midnight default keeps direct
    # test calls deterministic.
    now = now if now is not None else datetime(today.year, today.month, today.day)
    run = models.ScanRun(scanner_version=scanner_version, status="running", started_at=now)
    session.add(run)
    session.flush()
    summary = ScanSummary()
    breaker = CircuitBreaker(circuit_breaker_threshold)
    history = DbPriceHistory(session, now)

    templates = list(
        session.scalars(select(models.DealTemplate).where(models.DealTemplate.enabled.is_(True)))
    )
    routes = due_routes(
        list(session.scalars(select(models.Route))), today, tail_rotation_days, all_routes
    )
    zones = {z.zone: z for z in session.scalars(select(models.Zone))}
    route_by_pair = {(r.origin, r.destination): r for r in routes if r.enabled}

    core_n = sum(1 for r in routes if r.core)
    spec_lists = [(tpl, resolve(tpl, routes, today)) for tpl in templates]
    plan = {
        "core": core_n,
        "tail": len(routes) - core_n,
        "specs_planned": sum(len(s) for _, s in spec_lists),
    }

    aborted = False
    for _tpl, specs in spec_lists:  # _tpl reserved for future per-template plan metadata
        if aborted:
            break
        summary.templates_scanned += 1
        for spec in specs:
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
                session.add(
                    models.PriceLog(
                        run_id=run.id,
                        route_id=route.id,
                        trip_type=spec.trip_type,
                        travel_date=p.travel_date,
                        return_date=p.return_date,
                        price=p.price,
                        currency="EUR",
                        scanner_version=scanner_version,
                        scanned_at=now,
                    )
                )
            base = baseline_mod.compute_baseline(points)
            if base is None:
                continue
            for p in _flagged(points, base, zone):
                # Window-relative: counted against THIS spec's calendar points; a second
                # template with a different window stores whichever spec found the candidate
                # first (see Candidate.departure_date_count).
                near_dates = sum(1 for q in points if q.price <= p.price * NEAR_PRICE_FRAC)
                try:
                    fares = adapter.search_flights(
                        spec.origin, spec.destination, p.travel_date, p.return_date, spec.cabin
                    )
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
                _persist_fare(
                    session,
                    run,
                    route,
                    zone,
                    spec,
                    p,
                    fare,
                    base,
                    templates,
                    now,
                    scanner_version,
                    summary,
                    history,
                    near_dates,
                )
            if aborted:
                break

    # Persist the scan's findings before the sweep/finalize touch the DB again.
    # The search loop can leave the connection idle long enough for Neon to kill
    # it; before this commit, that rolled back the ENTIRE run (2026-08-24: the
    # retry scanned for 15 minutes, died at the sweep below, and left no trace).
    # pool_pre_ping then hands the next block a validated connection. A crash
    # after this point leaves the run in status "running" with finished_at NULL,
    # which the watchdog's staleness check reports.
    session.commit()

    _expire_stale(session, now)
    _expire_published_past_date(session, today)

    price_rows = (
        session.scalar(
            select(func.count())
            .select_from(models.PriceLog)
            .where(models.PriceLog.run_id == run.id)
        )
        or 0
    )
    # degraded runs count as a cliff baseline on purpose: CLIFF_PRIOR_MIN_ROWS guards
    # against a low-data baseline, and sustained outages are the ratio signal's job.
    prior_run_id = session.scalar(
        select(models.ScanRun.id)
        .where(models.ScanRun.id != run.id, models.ScanRun.status.in_(("completed", "degraded")))
        .order_by(models.ScanRun.id.desc())
        .limit(1)
    )
    prior_rows = None
    if prior_run_id is not None:
        prior_rows = (
            session.scalar(
                select(func.count())
                .select_from(models.PriceLog)
                .where(models.PriceLog.run_id == prior_run_id)
            )
            or 0
        )
    verdict = assess(adapter.call_log, price_rows, prior_rows)
    summary.health = verdict

    run.finished_at = now
    if aborted:
        run.status = "failed"
        summary.aborted = True
    elif verdict.degraded:
        run.status = "degraded"
    else:
        run.status = "completed"
    run.health = health_json(verdict, adapter.call_log, plan=plan)
    run.templates_scanned = summary.templates_scanned
    run.routes_scanned = summary.routes_scanned
    run.candidates_found = summary.candidates_found
    run.matches_created = summary.matches_created
    run.api_calls = adapter.api_calls
    run.errors = summary.errors
    run.http_429s = summary.http_429s
    session.commit()
    return summary


def _persist_fare(
    session,
    run,
    route,
    zone,
    spec,
    point,
    fare,
    base,
    templates,
    now,
    scanner_version,
    summary,
    history,
    departure_date_count,
):
    # Score against every applicable template with every enabled scorer (pure, no writes).
    hist_series = history.for_route(route.id, spec.trip_type)
    prev_pt = hist_series.previous_point(point.travel_date, now)
    prev = prev_pt.price if prev_pt else None
    prev_age = (now - prev_pt.scanned_at).days if prev_pt else None
    matched = []  # (tpl, headline_score, all_scores)
    for tpl in templates:
        if tpl.trip_type != spec.trip_type:
            continue
        if not in_template_scope(tpl, route, point, today=now.date()):
            continue
        if tpl.min_departure_dates is not None and departure_date_count < tpl.min_departure_dates:
            continue  # marketability gate: not enough near-price dates to plan around
        ctx = ScoringContext(
            fare=fare,
            baseline=base,
            zone=zone,
            template=tpl,
            history=hist_series,
            previous_price=prev,
            previous_price_age_days=prev_age,
            travel_date=point.travel_date,
        )
        scores = [s for sc in enabled_scorers() if (s := sc.score(ctx)) is not None]
        if not scores:
            continue
        matched.append((tpl, pick_headline(scores, tpl.primary_scorer), scores))
    if not matched:
        return  # nothing flagged -> not a candidate, don't persist an orphan

    # Persist the honest, month-local numbers: baseline_price is the travel
    # month's median (fallback: window), so the published was-price never
    # borrows a Christmas peak to flatter a January fare.
    local_median = base.local_median(point.travel_date)
    discount = (
        None if local_median <= 0 else round((local_median - fare.price) / local_median * 100, 1)
    )
    key = deal_group_key(
        spec.origin,
        spec.destination,
        spec.trip_type,
        point.travel_date,
        point.return_date,
        fare.price,
    )
    fields = dict(
        run_id=run.id,
        route_id=route.id,
        origin=spec.origin,
        destination=spec.destination,
        zone=route.zone,
        trip_type=spec.trip_type,
        travel_date=point.travel_date,
        return_date=point.return_date,
        price=fare.price,
        currency=fare.currency,
        baseline_price=local_median,
        discount_pct=discount,
        itinerary_snapshot=fare.raw,
        search_params={"cabin": spec.cabin},
        scanner_version=scanner_version,
        expires_at=now + timedelta(days=CANDIDATE_TTL_DAYS),
        departure_date_count=departure_date_count,
    )
    cand, created = repo.upsert_candidate(session, key, fields, now)
    if created:
        summary.candidates_found += 1

    for tpl, headline, scores in matched:
        _match, created = repo.upsert_match(
            session,
            cand.id,
            tpl.id,
            headline.value,
            headline.reason_text,
            headline.signals,
            score_0_100=headline.score_0_100,
            quality_tier=headline.quality_tier,
            primary_scorer=headline.scorer,
        )
        if created:
            summary.matches_created += 1
        for sc in scores:
            repo.upsert_score(session, cand.id, tpl.id, sc)
        draft = content_mod.build_content_draft(
            spec.origin, spec.destination, fare.price, local_median, point.travel_date, tpl
        )
        repo.ensure_content_draft(session, cand.id, tpl.id, draft)


def _expire_stale(session, now):
    stale = session.scalars(
        select(models.Candidate).where(
            models.Candidate.status.in_(("new", "seen", "maybe")),
            models.Candidate.expires_at.is_not(None),
            models.Candidate.expires_at < now,
        )
    )
    for c in stale:
        c.status = "expired"
    session.flush()


def _expire_published_past_date(session, today):
    """Date-based expiry for live published deals.

    Pure calendar logic — works identically during an fli outage, which is the
    point: empty rechecks never expire deals (verification.py), so dates and
    humans are the only expirers. NULL dates drop out of the comparisons: a
    dateless deal stays curator-managed.
    """
    stale = session.scalars(
        select(models.PublishedDeal).where(
            models.PublishedDeal.status == "live",
            or_(models.PublishedDeal.valid_until < today, models.PublishedDeal.travel_date < today),
        )
    )
    for pd in stale:
        pd.status = "expired"
    session.flush()
