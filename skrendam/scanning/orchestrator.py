"""run_scan: the 11-step pass that wires resolver -> adapter -> baseline -> matching -> DB (spec §7)."""

from dataclasses import dataclass
from datetime import date, datetime, time, timedelta

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
from skrendam.scanning.checkpoint import ScanCheckpoint
from skrendam.scanning.dedup import deal_group_key
from skrendam.scanning.history import DbPriceHistory
from skrendam.scanning.resolver import resolve
from skrendam.scanning.scoring import demand, tiering
from skrendam.scanning.scoring.base import ScoringContext
from skrendam.scanning.scoring.eligibility import in_template_scope, itinerary_ok
from skrendam.scanning.scoring.registry import enabled_scorers, pick_headline
from skrendam.verification import (
    EXACT_CHECK_MAX_AGE_DAYS,
    LIVE_STATUSES,
    PRICE_DRIFT_TOLERANCE_PCT,
    VERIFY_CALLS_PER_DAY,
    DealCheck,
    gates_for,
    transition,
    verify_deal,
)

CANDIDATE_TTL_DAYS = 14
NEAR_PRICE_FRAC = 1.10  # a date "supports" a fare if its calendar price is within +10%
# A run still "running" this long after it started never finished (laptop slept,
# process killed). The longest healthy full-network run observed is ~80 min; the
# desk applies the same cutoff when deciding whether a run is in progress
# (web/src/lib/mappers.ts SCAN_ORPHAN_AFTER_MS).
ORPHAN_RUN_AFTER = timedelta(hours=6)
# Public deals for the verification step = the site's free window: the newest
# FREE_WINDOW live/changed deals ordered `published_at DESC, id DESC` are shown in
# full, everything after them is locked (site/src/lib/scarcity.ts FREE_WINDOW,
# site/src/lib/queries.ts getFreeWindowIds / LIVE_ORDER). Mirrored here, not
# imported, so a visitor-visible price is the one re-checked daily.
FREE_WINDOW = 3
# "Mailed recently" for the verification priority: issues.sent_at within this window.
MAILED_WINDOW = timedelta(hours=48)


@dataclass(frozen=True)
class DemandContext:
    windows: list
    audience_slug: dict
    personas: dict
    tiers: dict

    def window_name(self, slug: str | None) -> str | None:
        if slug is None:
            return None
        return next((w.name for w in self.windows if w.slug == slug), None)


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
    # Live-deal verification step (WP9): see VerifyStats.
    deals_verified: int = 0
    deals_changed: int = 0
    deals_expired: int = 0
    verify_calls: int = 0


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
    checkpoint: "ScanCheckpoint | None" = None,
) -> ScanSummary:
    # Production callers (cli, worker) pass the real wall clock so same-day runs
    # get distinct timestamps (earlier runs stay visible in price history and
    # last_seen_at never moves backwards). The midnight default keeps direct
    # test calls deterministic.
    now = now if now is not None else datetime(today.year, today.month, today.day)
    _fail_orphaned_runs(session, now)
    run = models.ScanRun(scanner_version=scanner_version, status="running", started_at=now)
    session.add(run)
    session.flush()
    summary = ScanSummary()
    breaker = CircuitBreaker(circuit_breaker_threshold)
    history = DbPriceHistory(session, now)

    templates = list(
        session.scalars(select(models.DealTemplate).where(models.DealTemplate.enabled.is_(True)))
    )
    demand_ctx = DemandContext(
        windows=demand.windows_from_rows(
            session.scalars(
                select(models.PeakWindow).order_by(
                    models.PeakWindow.start_date, models.PeakWindow.id
                )
            ).all()
        ),
        audience_slug={a.id: a.slug for a in session.scalars(select(models.AudienceSegment))},
        personas=demand.load_personas(),
        tiers=demand.load_demand_tiers(),
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
    if checkpoint is not None and checkpoint.done:
        plan["resumed_from_checkpoint"] = len(checkpoint.done)

    aborted = False
    skipped_specs = 0
    for _tpl, specs in spec_lists:  # _tpl reserved for future per-template plan metadata
        if aborted:
            break
        summary.templates_scanned += 1
        for spec in specs:
            # Resume: an earlier attempt TODAY already scanned and committed this
            # spec — skip it so retry mornings cost ~1 pass of Google load, not N
            # (BotGuard punishes repetition; see scanning/checkpoint.py).
            if checkpoint is not None and checkpoint.is_done(spec):
                skipped_specs += 1
                continue
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
                # Calendar scanned and rows staged: still a finished spec.
                session.commit()
                if checkpoint is not None:
                    checkpoint.mark(spec)
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
                    demand_ctx,
                )
            if aborted:
                break
            # Checkpoint boundary: commit THIS spec's work, then record it done.
            # Order matters — a death between the two just redoes one spec; the
            # reverse would skip work that was never persisted. Per-spec commits
            # also shrink what a mid-run connection death can roll back.
            session.commit()
            if checkpoint is not None:
                checkpoint.mark(spec)

    # Persist the scan's findings before the sweep/finalize touch the DB again.
    # The search loop can leave the connection idle long enough for Neon to kill
    # it; before this commit, that rolled back the ENTIRE run (2026-08-24: the
    # retry scanned for 15 minutes, died at the sweep below, and left no trace).
    # pool_pre_ping then hands the next block a validated connection. A crash
    # after this point leaves the run in status "running" with finished_at NULL,
    # which the watchdog's staleness check reports.
    session.commit()

    _expire_stale(session, now)
    _expire_published_past_date(session, today, now)
    _purge_unsubscribed(session, now)

    price_rows = (
        session.scalar(
            select(func.count())
            .select_from(models.PriceLog)
            .where(models.PriceLog.run_id == run.id)
        )
        or 0
    )
    if skipped_specs:
        # Resumed attempt: this run's own rows only cover the remainder, which
        # would false-trigger the cliff detector. Judge the DAY's harvest.
        price_rows = (
            session.scalar(
                select(func.count())
                .select_from(models.PriceLog)
                .where(models.PriceLog.scanned_at >= datetime(today.year, today.month, today.day))
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

    # Ordering (WP9): the health verdict is computed HERE, before the live-deal
    # verification step, because the step must know whether today's pipe is
    # trustworthy — a degraded or aborted run makes zero verification calls and
    # changes nothing (an empty answer during a gated window is "blocked", not
    # "gone"). The verdict therefore judges the discovery pass only; the step's
    # own flights calls still land in adapter.call_log / api_calls and the final
    # scan_runs write below carries the full metrics plus the step's counters.
    run_healthy = not aborted and not verdict.degraded
    vstats = _verify_live_deals(
        session, adapter, today=today, now=now, run=run, run_healthy=run_healthy
    )
    summary.deals_verified = vstats.deals_verified
    summary.deals_changed = vstats.deals_changed
    summary.deals_expired = vstats.deals_expired
    summary.verify_calls = vstats.verify_calls
    summary.errors += vstats.errors
    verdict = HealthVerdict(
        status=verdict.status,
        reasons=verdict.reasons,
        metrics={**verdict.metrics, **vstats.as_metrics()},
    )
    summary.health = verdict

    # Fresh wall clock, NOT the run-start `now`: the watchdog's "did today's
    # 06:00 scan finish" gate and its age math read finished_at, and a
    # multi-hour full-network run start-stamps would skew both (review 08-25).
    run.finished_at = datetime.utcnow()
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
    # The adapter counts every network call it makes, verification included;
    # nothing is added here so exact checks are never double counted.
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
    demand_ctx,
):
    # Score against every applicable template with every enabled scorer (pure, no writes).
    # ONE series per fare, partitioned by trip duration: scoring and the demand
    # layer must share the same notion of "this route's history" (review A3).
    hist_series = history.for_route(route.id, spec.trip_type, spec.duration_days)
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
        if not itinerary_ok(fare, tpl):
            continue  # itinerary/time gate BEFORE scoring: ErrorFareScorer never calls it
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

    # Per-fare work hoisted out of the per-template loop: commodity_share depends
    # only on (series, price, now) and window_typical only on (series, window), so
    # both are computed once and shared across this fare's templates (review A7).
    share = demand.commodity_share(hist_series, fare.price, now)
    typical_cache: dict[str, float | None] = {}
    for tpl, headline, scores in matched:
        dm = demand.assess(
            headline=headline,
            scores=scores,
            template=tpl,
            audience_slug=demand_ctx.audience_slug.get(tpl.audience_segment_id),
            destination=spec.destination,
            fare=fare,
            travel_date=point.travel_date,
            return_date=point.return_date,
            series=hist_series,
            local_median=local_median,
            discount_pct=discount,
            departure_date_count=departure_date_count,
            now=now,
            windows=demand_ctx.windows,
            personas=demand_ctx.personas,
            tiers=demand_ctx.tiers,
            share=share,
            typical_cache=typical_cache,
        )
        _match, created = repo.upsert_match(
            session,
            cand.id,
            tpl.id,
            headline.value,
            headline.reason_text,
            headline.signals,
            score_0_100=headline.score_0_100,
            quality_tier=tiering.quality_tier(dm.score_v2),  # D6: tier follows score_v2
            primary_scorer=headline.scorer,
            score_v2=dm.score_v2,
            archetype=dm.archetype,
            demand_signals=dm.signals,
        )
        if created:
            summary.matches_created += 1
        for sc in scores:
            repo.upsert_score(session, cand.id, tpl.id, sc)
        draft = content_mod.build_content_draft(
            spec.origin,
            spec.destination,
            fare.price,
            local_median,
            point.travel_date,
            tpl,
            signals=dm.signals,
            fare=fare,
            window_name=demand_ctx.window_name(dm.signals.get("window_slug")),
        )
        repo.ensure_content_draft(session, cand.id, tpl.id, draft)


def _fail_orphaned_runs(session, now):
    """Reconcile runs that died without finishing (desk journey review 2026-09-11).

    An interrupted run leaves `status='running'`, `finished_at NULL` and zero
    counters forever; the desk read the newest row and reported a phantom
    "running.." scan with "checked 0 fares" for days. Nothing else ever touches
    those rows, so the next run marks any running row older than
    ORPHAN_RUN_AFTER as failed. Committed on its own so a crash later in this
    run can't undo the reconcile.
    """
    cutoff = now - ORPHAN_RUN_AFTER
    orphans = session.scalars(
        select(models.ScanRun).where(
            models.ScanRun.status == "running", models.ScanRun.started_at < cutoff
        )
    )
    for r in orphans:
        r.status = "failed"
        r.finished_at = now
        r.health = {"reasons": ["orphaned: never finished"]}
    session.commit()


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


UNSUBSCRIBE_PURGE_DAYS = 30


def _purge_unsubscribed(session, now):
    """Erase subscribers who left more than 30 days ago (/privatumas promise).

    A hard delete, not a flag: the privacy page tells people their data is
    deleted within 30 days of unsubscribing, and the daily scan is the only
    process that runs every day. The 30-day grace also leaves room to undo an
    accidental unsubscribe before the row is gone.
    """
    cutoff = now - timedelta(days=UNSUBSCRIBE_PURGE_DAYS)
    gone = session.scalars(
        select(models.Subscriber).where(
            models.Subscriber.unsubscribed_at.is_not(None),
            models.Subscriber.unsubscribed_at < cutoff,
        )
    )
    for sub in gone:
        session.delete(sub)
    session.flush()


def _expire_published_past_date(session, today, now):
    """Date-based expiry for live published deals.

    Pure calendar logic — works identically during an fli outage, which is the
    point: empty rechecks never expire deals (verification.py), so dates and
    humans are the only expirers. NULL dates drop out of the comparisons: a
    dateless deal stays curator-managed. `expired_at` is stamped with the run's
    `now` so emails can say when a deal a reader saw went away (WP6).
    """
    stale = session.scalars(
        select(models.PublishedDeal).where(
            models.PublishedDeal.status == "live",
            or_(models.PublishedDeal.valid_until < today, models.PublishedDeal.travel_date < today),
        )
    )
    for pd in stale:
        pd.status = "expired"
        pd.expired_at = now
    session.flush()


@dataclass
class VerifyStats:
    """Counters from the live-deal verification step (also merged into health metrics)."""

    deals_verified: int = 0  # deals that received at least one check row this run
    deals_changed: int = 0  # deals whose status flipped to 'changed' in this step
    deals_expired: int = 0  # deals whose status flipped to 'expired' in this step
    verify_calls: int = 0  # network flights calls spent (adapter cache hits are free)
    errors: int = 0  # ScanErrors from exact checks (no evidence: no row, no transition)

    def as_metrics(self) -> dict:
        """Return the counters persisted into ``scan_runs.health.metrics``."""
        return {
            "deals_verified": self.deals_verified,
            "deals_changed": self.deals_changed,
            "deals_expired": self.deals_expired,
            "verify_calls": self.verify_calls,
        }


def _verify_live_deals(
    session,
    adapter: FliAdapter,
    *,
    today: date,
    now: datetime,
    run,
    run_healthy: bool,
    cap: int = VERIFY_CALLS_PER_DAY,
) -> VerifyStats:
    """Daily re-check of every live/changed deal (WP9 spec §3–4), after the route pass.

    Runs only on a healthy run (a degraded or aborted run returns at once with zero
    calls and zero writes). Per deal, in the site's newest-first order:

    1. Opportunistic ``calendar`` check, 0 calls: when today's ``price_log`` already
       holds the deal's exact ``(route, trip_type, travel_date, return_date)`` pair,
       that price is the day's price for the sample date (and the window min).
    2. Exact ``flights`` check (one ``verify_deal`` call on the candidate's itinerary
       snapshot) for deals that need one: public (free window), no calendar hit today,
       calendar price moved beyond ``PRICE_DRIFT_TOLERANCE_PCT``, or last real answer
       older than ``EXACT_CHECK_MAX_AGE_DAYS`` — in priority order public → mailed in
       the last 48 h (``issues.deal_ids``) → newest ``published_at``, until ``cap``
       network calls are spent.

    Every check writes a ``deal_price_checks`` row and applies ``transition``; deals
    already checked today (``verified_at`` or a check row today) and dateless deals
    (curator-managed) are skipped. Deals beyond the cap keep their state.
    """
    stats = VerifyStats()
    if not run_healthy:
        return stats
    day_start = datetime.combine(today, time.min)
    deals = session.scalars(
        select(models.PublishedDeal)
        .where(models.PublishedDeal.status.in_(LIVE_STATUSES))
        .order_by(models.PublishedDeal.published_at.desc(), models.PublishedDeal.id.desc())
    ).all()
    if not deals:
        return stats
    # The free window as the site showed it this morning, BEFORE any transition below.
    public_ids = {d.id for d in deals[:FREE_WINDOW]}
    checked_today = set(
        session.scalars(
            select(models.DealPriceCheck.deal_id).where(
                models.DealPriceCheck.checked_at >= day_start
            )
        )
    )
    checked_today |= {
        d.id for d in deals if d.verified_at is not None and d.verified_at >= day_start
    }
    mailed_ids: set[int] = set()
    for ids in session.scalars(
        select(models.Issue.deal_ids).where(
            models.Issue.sent_at.is_not(None), models.Issue.sent_at >= now - MAILED_WINDOW
        )
    ):
        mailed_ids.update(int(i) for i in (ids or []))
    zones = {z.zone: z for z in session.scalars(select(models.Zone))}
    status_before = {d.id: d.status for d in deals}
    verified_ids: set[int] = set()

    def apply(deal, check, gates):
        decision = transition(deal, check, gates=gates, today=today, run_healthy=run_healthy)
        session.add(
            models.DealPriceCheck(
                deal_id=deal.id,
                checked_at=check.checked_at,
                source=check.source,
                available=check.available,
                price=check.price,
                window_min_price=check.window_min_price,
                window_min_date=check.window_min_date,
                run_id=run.id,
            )
        )
        if check.available:
            # A real answer. When the exact itinerary is gone (price None) the day's
            # cheapest fare is the current price: the site and the desk render a
            # `changed` deal with a NULL current_price at the published price.
            deal.current_price = (
                check.price if check.price is not None else check.window_min_price
            )
            deal.current_price_at = now
            deal.window_min_price = check.window_min_price
            deal.window_min_date = check.window_min_date
            deal.verified_at = now
            deal.last_seen_at = now
            deal.unverified_since = None
        elif deal.unverified_since is None:
            deal.unverified_since = now  # same semantics as the manual recheck
        deal.status = decision.status
        deal.missed_checks = decision.missed_checks
        if decision.expired_at is not None:
            deal.expired_at = now  # the run's wall clock, not midnight
        verified_ids.add(deal.id)

    exact_due = []  # (deal, candidate, gates)
    for deal in deals:
        if deal.id in checked_today or deal.travel_date is None:
            continue
        cand = session.get(models.Candidate, deal.candidate_id)
        route = session.get(models.Route, cand.route_id) if cand is not None else None
        tpl = session.get(models.DealTemplate, deal.deal_template_id)
        gates = gates_for(tpl, zones.get(route.zone) if route is not None else None)
        # Age is judged on the last real answer BEFORE today's calendar stamp: the
        # calendar sees the day's cheapest fare, not the sample itinerary, so an
        # exact check is still due every EXACT_CHECK_MAX_AGE_DAYS (never verified
        # counts as stale).
        stale = deal.verified_at is None or deal.verified_at < now - timedelta(
            days=EXACT_CHECK_MAX_AGE_DAYS
        )
        cal = _calendar_price(session, cand, deal, day_start) if cand is not None else None
        due = deal.id in public_ids or stale or cal is None
        if cal is not None:
            apply(deal, DealCheck(True, cal, cal, deal.travel_date, "calendar", now), gates)
            if abs(cal - deal.price) > deal.price * PRICE_DRIFT_TOLERANCE_PCT / 100:
                due = True
        if due and deal.status in LIVE_STATUSES:
            exact_due.append((deal, cand, gates))

    # Stable sort: within a tier the newest-first order from the query is kept.
    def tier(item):
        deal_id = item[0].id
        return 0 if deal_id in public_ids else 1 if deal_id in mailed_ids else 2

    exact_due.sort(key=tier)
    for deal, cand, gates in exact_due:
        if stats.verify_calls >= cap:
            break
        snapshot = cand.itinerary_snapshot if cand is not None else None
        cabin = ((cand.search_params if cand is not None else None) or {}).get("cabin", "ECONOMY")
        before = adapter.api_calls
        try:
            check = verify_deal(deal, adapter, now=now, snapshot=snapshot, cabin=cabin)
        except ScanError:
            stats.errors += 1  # no evidence: no row, no transition, but the call was spent
            continue
        finally:
            stats.verify_calls += adapter.api_calls - before
        apply(deal, check, gates)

    session.flush()
    stats.deals_verified = len(verified_ids)
    for deal in deals:
        if deal.status != status_before[deal.id]:
            if deal.status == "changed":
                stats.deals_changed += 1
            elif deal.status == "expired":
                stats.deals_expired += 1
    return stats


def _calendar_price(session, cand, deal, day_start) -> float | None:
    """Today's calendar price for the deal's exact date pair, or None without evidence.

    Reads by ``scanned_at >= today`` rather than ``run_id`` so a resumed attempt
    (checkpoint) sees the rows its earlier attempt committed, like the price-row
    count above. Absence means "no calendar evidence" (the day's specs did not
    cover this pair — research §0.1), never "date gone".
    """
    stmt = select(func.min(models.PriceLog.price)).where(
        models.PriceLog.route_id == cand.route_id,
        models.PriceLog.trip_type == deal.trip_type,
        models.PriceLog.travel_date == deal.travel_date,
        models.PriceLog.scanned_at >= day_start,
    )
    if deal.return_date is None:
        stmt = stmt.where(models.PriceLog.return_date.is_(None))
    else:
        stmt = stmt.where(models.PriceLog.return_date == deal.return_date)
    return session.scalar(stmt)
