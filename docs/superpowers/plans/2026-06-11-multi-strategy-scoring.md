# Multi-strategy, history-aware deal scoring — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the engine's single `match()` function into a swappable `Scorer` seam fed by a `ScoringContext`, give the engine memory via a `PriceHistory` read-module over `price_log`, persist every scorer's verdict in an additive `candidate_scores` table, and compute tier meaning once at the source so web/site/analyze stop re-deriving it.

**Architecture:** New `skrendam/scanning/scoring/` subpackage holds the `Scorer` protocol, the `Score`/`ScoringContext` data, a single `tiering` source of truth, the lifted `WeightedScorer`, and three new detectors (`drop`, `error_fare`, `rarity`). `skrendam/scanning/history.py` exposes a `PriceHistory` read-module with a prod (`DbPriceHistory`) and test (`InMemoryPriceHistory`) adapter. The orchestrator builds a context per fare, runs every enabled scorer, picks a headline by the template's `primary_scorer`, and writes the headline to `candidate_template_matches` plus every score to `candidate_scores`.

**Tech Stack:** Python 3.10+, SQLAlchemy 2.0, Alembic, pytest (`uv run pytest`); Drizzle + Neon Postgres and Vitest for web/site.

**Refinement vs spec:** web/ and site/ already read the headline match via a join (their current `r.score`). We read the new `score_0_100`/`quality_tier` from `candidate_template_matches` through that existing join rather than snapshotting onto `published_deals`. This drops two migration columns and the publish-path change.

---

## File Structure

**Create:**
- `skrendam/scanning/scoring/__init__.py` — subpackage marker
- `skrendam/scanning/scoring/base.py` — `Score`, `ScoringContext`, `Scorer` protocol
- `skrendam/scanning/scoring/tiering.py` — `GREAT`/`RARE`, `to_score_100`, `quality_tier` (single source of truth)
- `skrendam/scanning/scoring/eligibility.py` — `eff`, `itinerary_ok`, `in_template_scope`
- `skrendam/scanning/scoring/weighted.py` — `WeightedScorer` + weight constants (lifted from matching.py)
- `skrendam/scanning/scoring/registry.py` — scorer registry
- `skrendam/scanning/scoring/drop.py` — `PriceDropScorer`
- `skrendam/scanning/scoring/error_fare.py` — `ErrorFareScorer`
- `skrendam/scanning/scoring/rarity.py` — `RarityScorer`
- `skrendam/scanning/history.py` — `HistoryPoint`, `PriceHistorySeries`, `PriceHistory`, `DbPriceHistory`, `InMemoryPriceHistory`
- `alembic/versions/0006_multi_strategy_scoring.py` — additive migration
- `tests/skrendam/test_tiering.py`, `test_scoring_weighted.py`, `test_price_history.py`, `test_scoring_drop.py`, `test_scoring_error_fare.py`, `test_scoring_rarity.py`, `test_candidate_scores.py`
- `CONTEXT.md` — domain vocabulary

**Modify:**
- `skrendam/scanning/matching.py` — reduce to a shim delegating to `WeightedScorer`
- `skrendam/db/models.py` — `CandidateScore` table; headline columns on `CandidateTemplateMatch`; `primary_scorer` on `DealTemplate`; composite index on `PriceLog`
- `skrendam/db/repositories.py` — `upsert_score`; extend `upsert_match` with headline fields
- `skrendam/scanning/orchestrator.py` — build `DbPriceHistory`; rewrite `_persist_fare` to run all scorers + headline selection
- `skrendam/analyze.py` — count `quality_tier` instead of recomputing from `0.88`
- `tests/skrendam/test_orchestrator.py` — extend `FakeBackend` assertions
- web: `src/lib/queries.ts`, `src/lib/mappers.ts`, `src/lib/tiers.ts`, `src/components/ScoreBadge.tsx`, dashboard threshold, `src/lib/mappers.test.ts`
- site: `src/lib/queries.ts`, `src/lib/mappers.ts`, `src/lib/quality.ts`, `src/lib/mappers.test.ts`

---

## Stage 0 — Vocabulary

### Task 0: Create CONTEXT.md with the scoring vocabulary

**Files:**
- Create: `CONTEXT.md`

- [ ] **Step 1: Write the file**

```markdown
# Domain Context

## Scoring

- **Scorer** — a named strategy implementing `score(ctx: ScoringContext) -> Score | None`. `None` means "this strategy does not flag this fare." Lives in `skrendam/scanning/scoring/`.
- **ScoringContext** — the immutable bundle a scorer may read: the `FareItinerary`, the window `Baseline`, the route's `PriceHistorySeries` (may be `None`), the `Zone`, the `DealTemplate`, and `previous_price`. New signals become new context fields, never new positional args.
- **Score** — a scorer's verdict: `scorer`, `value` (0–1), `score_0_100`, `quality_tier`, `reason_text`, `signals`.
- **PriceHistory** — read-module over `price_log` returning a route's `PriceHistorySeries` and derived stats (`min_seen`, `percentile`, `previous_price`). `DbPriceHistory` in prod, `InMemoryPriceHistory` in tests.
- **quality_tier** — `rare` (score_0_100 ≥ 94) | `great` (≥ 88) | `None`. Single source of truth: `skrendam/scanning/scoring/tiering.py`. Distinct from `published_deals.tier` (access tier: free/pro).
- **primary_scorer** — the `DealTemplate` field (default `weighted`) naming which scorer produces the headline `match_score`. If it doesn't fire, the headline falls back to the highest-scoring strategy that did.
```

- [ ] **Step 2: Commit**

```bash
git add CONTEXT.md
git commit -m "docs(skrendam): add CONTEXT.md scoring vocabulary"
```

---

## Stage 1 — Scorer seam (pure, no DB)

### Task 1: tiering — single source of truth for normalization + thresholds

**Files:**
- Create: `skrendam/scanning/scoring/__init__.py`
- Create: `skrendam/scanning/scoring/tiering.py`
- Test: `tests/skrendam/test_tiering.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/skrendam/test_tiering.py
from skrendam.scanning.scoring import tiering


def test_to_score_100_rounds_and_clamps():
    assert tiering.to_score_100(0.881) == 88
    assert tiering.to_score_100(1.5) == 100
    assert tiering.to_score_100(-0.2) == 0


def test_quality_tier_bands():
    assert tiering.quality_tier(95) == "rare"
    assert tiering.quality_tier(94) == "rare"
    assert tiering.quality_tier(88) == "great"
    assert tiering.quality_tier(87) is None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/skrendam/test_tiering.py -vv`
Expected: FAIL (`ModuleNotFoundError: skrendam.scanning.scoring`)

- [ ] **Step 3: Write minimal implementation**

```python
# skrendam/scanning/scoring/__init__.py
"""Scoring strategies: Scorer seam, ScoringContext, tiering, and adapters."""
```

```python
# skrendam/scanning/scoring/tiering.py
"""Single source of truth for score normalization and quality tiers.

Engine-side meaning of a score. Downstream (web tiers.ts / site quality.ts /
analyze.py) reads the result; it must not re-encode these thresholds.
"""

GREAT = 88
RARE = 94


def to_score_100(value: float) -> int:
    """Normalize a 0..1 scorer value to a clamped 0..100 integer."""
    return max(0, min(100, round(value * 100)))


def quality_tier(score_100: int) -> str | None:
    """Map a 0..100 score to a quality tier label (or None below GREAT)."""
    if score_100 >= RARE:
        return "rare"
    if score_100 >= GREAT:
        return "great"
    return None
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/skrendam/test_tiering.py -vv`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add skrendam/scanning/scoring/__init__.py skrendam/scanning/scoring/tiering.py tests/skrendam/test_tiering.py
git commit -m "feat(skrendam): tiering module — single source of truth for score→tier"
```

---

### Task 2: base — Score, ScoringContext, Scorer protocol

**Files:**
- Create: `skrendam/scanning/scoring/base.py`
- Test: covered via Task 3 (no standalone test for plain dataclasses)

- [ ] **Step 1: Write the implementation**

```python
# skrendam/scanning/scoring/base.py
"""The Scorer seam: the interface and the immutable data it moves."""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Protocol

from skrendam.scanning.types import Baseline, FareItinerary

if TYPE_CHECKING:
    from skrendam.db import models
    from skrendam.scanning.history import PriceHistorySeries


@dataclass(frozen=True)
class Score:
    scorer: str
    value: float            # 0..1 native confidence
    score_0_100: int        # normalized for display + tiering
    quality_tier: str | None
    reason_text: str
    signals: dict


@dataclass(frozen=True)
class ScoringContext:
    fare: FareItinerary
    baseline: Baseline
    zone: "models.Zone"
    template: "models.DealTemplate"
    history: "PriceHistorySeries | None" = None
    previous_price: float | None = None


class Scorer(Protocol):
    name: str

    def score(self, ctx: ScoringContext) -> Score | None: ...
```

- [ ] **Step 2: Verify it imports**

Run: `uv run python -c "from skrendam.scanning.scoring.base import Score, ScoringContext, Scorer; print('ok')"`
Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add skrendam/scanning/scoring/base.py
git commit -m "feat(skrendam): Scorer protocol + Score/ScoringContext data"
```

---

### Task 3: eligibility + WeightedScorer (behaviour parity with match())

**Files:**
- Create: `skrendam/scanning/scoring/eligibility.py`
- Create: `skrendam/scanning/scoring/weighted.py`
- Test: `tests/skrendam/test_scoring_weighted.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/skrendam/test_scoring_weighted.py
from types import SimpleNamespace

from skrendam.scanning.scoring.base import ScoringContext
from skrendam.scanning.scoring.weighted import WeightedScorer
from skrendam.scanning.types import Baseline, FareItinerary


def _tpl(**over):
    base = dict(trip_type="oneway", max_price_eur=None, min_discount_pct=None,
                min_abs_savings_eur=None, psychological_price_threshold_eur=None,
                allow_smaller_discount_if_under_price=False, max_stops=None,
                max_total_duration_minutes=None, allow_self_transfer=True,
                allow_mixed_cabin=True, allow_airport_change=True,
                allow_overnight_layover=True)
    base.update(over)
    return SimpleNamespace(**base)


def _zone(**over):
    base = dict(threshold_price_eur=None, min_discount_pct=None, min_abs_savings_eur=None)
    base.update(over)
    return SimpleNamespace(**base)


def _fare(price, stops=0, **over):
    return FareItinerary(price=price, currency="EUR", stops=stops,
                         duration_minutes=over.pop("duration_minutes", 120),
                         legs=[], **over)


def _ctx(fare, tpl, baseline, zone):
    return ScoringContext(fare=fare, baseline=baseline, zone=zone, template=tpl)


def test_strong_discount_scores_and_fires():
    base = Baseline(minimum=100.0, median=200.0, decile=110.0, sample_size=60)
    s = WeightedScorer().score(_ctx(_fare(100.0), _tpl(min_discount_pct=20), base, _zone()))
    assert s is not None
    assert s.scorer == "weighted"
    assert 0.0 < s.value <= 1.0
    assert s.score_0_100 == round(s.value * 100)
    assert s.signals["price_anomaly"] is True


def test_weak_discount_returns_none():
    base = Baseline(minimum=180.0, median=200.0, decile=190.0, sample_size=60)
    s = WeightedScorer().score(_ctx(_fare(196.0), _tpl(min_discount_pct=20), base, _zone()))
    assert s is None


def test_itinerary_gate_rejects_too_many_stops():
    base = Baseline(minimum=100.0, median=200.0, decile=110.0, sample_size=60)
    s = WeightedScorer().score(_ctx(_fare(100.0, stops=2), _tpl(min_discount_pct=20, max_stops=1), base, _zone()))
    assert s is None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/skrendam/test_scoring_weighted.py -vv`
Expected: FAIL (`ModuleNotFoundError: ...weighted`)

- [ ] **Step 3: Write eligibility helpers**

```python
# skrendam/scanning/scoring/eligibility.py
"""Shared pure gate helpers. Scorers may apply these; none is forced upstream."""

from skrendam.scanning.types import FareItinerary


def eff(tpl, zone, name):
    """Template value if set, else the zone default."""
    v = getattr(tpl, name, None)
    return v if v is not None else getattr(zone, name, None)


def itinerary_ok(fare: FareItinerary, tpl) -> bool:
    """v1 itinerary-sanity gate (lifted from matching.match)."""
    if tpl.max_stops is not None and fare.stops > tpl.max_stops:
        return False
    if tpl.max_total_duration_minutes and fare.duration_minutes > tpl.max_total_duration_minutes:
        return False
    if not tpl.allow_self_transfer and fare.self_transfer:
        return False
    if not tpl.allow_mixed_cabin and fare.mixed_cabin:
        return False
    if not tpl.allow_airport_change and fare.airport_change:
        return False
    if not tpl.allow_overnight_layover and fare.overnight_layover:
        return False
    return True


def in_template_scope(tpl, route, point, today) -> bool:
    """Destination + date-window scope check (re-homed from orchestrator)."""
    from skrendam.scanning.resolver import _destinations_ok, _window
    if not _destinations_ok(tpl, route):
        return False
    start, end = _window(tpl, today)
    return start <= point.travel_date <= end
```

- [ ] **Step 4: Write WeightedScorer (verbatim logic from matching.match)**

```python
# skrendam/scanning/scoring/weighted.py
"""The default scorer: per-template gates + weighted blend. Parity with the
historical matching.match() — same gates, same weights, same thresholds."""

from skrendam.scanning.scoring import tiering
from skrendam.scanning.scoring.base import Score, ScoringContext
from skrendam.scanning.scoring.eligibility import eff, itinerary_ok

WEIGHTS = {"price_anomaly": 0.50, "itinerary_quality": 0.20,
           "bookability": 0.15, "urgency": 0.15}
SEND_THRESHOLD = 0.55
STRONG_ANOMALY_DISCOUNT = 0.20


class WeightedScorer:
    name = "weighted"

    def score(self, ctx: ScoringContext) -> Score | None:
        fare, tpl, baseline, zone = ctx.fare, ctx.template, ctx.baseline, ctx.zone
        gates: dict = {}
        discount = 0.0 if baseline.median <= 0 else (baseline.median - fare.price) / baseline.median
        abs_savings = max(0.0, baseline.median - fare.price)

        # Gate 1: price anomaly (hard). One-way templates may fall back to the
        # zone ceiling; round-trips must set their own max_price_eur.
        if tpl.trip_type == "oneway":
            max_price = tpl.max_price_eur if tpl.max_price_eur is not None else zone.threshold_price_eur
        else:
            max_price = tpl.max_price_eur
        min_disc = eff(tpl, zone, "min_discount_pct")
        min_disc_frac = (min_disc / 100.0) if min_disc else 0.0
        under_price = max_price is not None and fare.price <= max_price
        under_psych = (tpl.psychological_price_threshold_eur is not None
                       and fare.price <= tpl.psychological_price_threshold_eur)
        needed_disc = 0.0 if (tpl.allow_smaller_discount_if_under_price and under_psych) else min_disc_frac
        price_anomaly = (discount >= needed_disc) or under_price or under_psych
        gates["price_anomaly"] = bool(price_anomaly)
        if not price_anomaly:
            return None

        # Gate 2: itinerary sanity (hard)
        ok = itinerary_ok(fare, tpl)
        gates["itinerary_sanity"] = ok
        if not ok:
            return None

        # Gate 3: marketability (soft - informs score)
        min_abs = eff(tpl, zone, "min_abs_savings_eur") or 0
        marketable = (abs_savings >= min_abs) or under_psych
        gates["marketability"] = bool(marketable)

        s_anom = min(1.0, discount / 0.5) if discount > 0 else (0.4 if under_price or under_psych else 0.0)
        s_itin = 1.0 if fare.stops == 0 else (0.6 if fare.stops == 1 else 0.3)
        s_book = 1.0 if (not fare.self_transfer and not fare.mixed_cabin) else 0.4
        s_urg = 1.0 if marketable else 0.6
        score = (WEIGHTS["price_anomaly"] * s_anom + WEIGHTS["itinerary_quality"] * s_itin
                 + WEIGHTS["bookability"] * s_book + WEIGHTS["urgency"] * s_urg)

        discount_floor = min_disc_frac if min_disc_frac > 0 else STRONG_ANOMALY_DISCOUNT
        strong_anomaly = discount >= discount_floor or under_psych or under_price
        if score < SEND_THRESHOLD or not strong_anomaly:
            return None

        pct = round(discount * 100)
        reason = (f"EUR{fare.price:.0f} - {pct}% below the {baseline.sample_size}-day median "
                  f"(EUR{baseline.median:.0f}); {'nonstop' if fare.stops == 0 else f'{fare.stops} stop(s)'}.")
        value = round(score, 3)
        s100 = tiering.to_score_100(value)
        return Score(scorer="weighted", value=value, score_0_100=s100,
                     quality_tier=tiering.quality_tier(s100), reason_text=reason, signals=gates)
```

- [ ] **Step 5: Run test to verify it passes**

Run: `uv run pytest tests/skrendam/test_scoring_weighted.py -vv`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add skrendam/scanning/scoring/eligibility.py skrendam/scanning/scoring/weighted.py tests/skrendam/test_scoring_weighted.py
git commit -m "feat(skrendam): WeightedScorer + eligibility helpers (parity with match())"
```

---

### Task 4: registry + reduce matching.py to a shim

**Files:**
- Create: `skrendam/scanning/scoring/registry.py`
- Modify: `skrendam/scanning/matching.py` (replace whole file)
- Test: `tests/skrendam/test_matching.py` (existing — must still pass)

- [ ] **Step 1: Write the registry**

```python
# skrendam/scanning/scoring/registry.py
"""Scorer registry. enabled_scorers() returns all registered scorers in a
deterministic order; the orchestrator runs every one per in-scope template."""

from skrendam.scanning.scoring.base import Scorer
from skrendam.scanning.scoring.weighted import WeightedScorer

_REGISTRY: dict[str, Scorer] = {}


def register(scorer: Scorer) -> None:
    _REGISTRY[scorer.name] = scorer


def get(name: str) -> Scorer | None:
    return _REGISTRY.get(name)


def enabled_scorers() -> list[Scorer]:
    return [_REGISTRY[k] for k in sorted(_REGISTRY)]


register(WeightedScorer())
```

- [ ] **Step 2: Replace matching.py with a shim**

```python
# skrendam/scanning/matching.py
"""Back-compat shim. The scoring logic now lives in skrendam.scanning.scoring;
this delegates to WeightedScorer so legacy callers and tests keep working.

New code should use skrendam.scanning.scoring (registry + ScoringContext)."""

from skrendam.scanning.scoring.base import ScoringContext
from skrendam.scanning.scoring.weighted import (  # noqa: F401  (re-exported)
    SEND_THRESHOLD,
    STRONG_ANOMALY_DISCOUNT,
    WEIGHTS,
    WeightedScorer,
)
from skrendam.scanning.types import Baseline, FareItinerary, MatchResult

_WEIGHTED = WeightedScorer()


def match(fare: FareItinerary, tpl, baseline: Baseline, zone) -> MatchResult | None:
    """Delegate to WeightedScorer and adapt to the legacy MatchResult shape."""
    ctx = ScoringContext(fare=fare, baseline=baseline, zone=zone, template=tpl)
    s = _WEIGHTED.score(ctx)
    if s is None:
        return None
    return MatchResult(match_score=s.value, reason_text=s.reason_text, gate_results=s.signals)
```

- [ ] **Step 3: Run the existing matching tests to verify parity**

Run: `uv run pytest tests/skrendam/test_matching.py -vv`
Expected: PASS (all existing cases). If a test imports a removed internal like `_eff`, update that import to `from skrendam.scanning.scoring.eligibility import eff` — do not change assertions.

- [ ] **Step 4: Run the full skrendam suite to confirm nothing regressed**

Run: `uv run pytest tests/skrendam -vv`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add skrendam/scanning/scoring/registry.py skrendam/scanning/matching.py
git commit -m "refactor(skrendam): matching.match() is now a shim over WeightedScorer + registry"
```

---

## Stage 2 — PriceHistory read-module

### Task 5: PriceHistorySeries + InMemoryPriceHistory (pure)

**Files:**
- Create: `skrendam/scanning/history.py`
- Test: `tests/skrendam/test_price_history.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/skrendam/test_price_history.py
from datetime import date, datetime

from skrendam.scanning.history import HistoryPoint, InMemoryPriceHistory, PriceHistorySeries


def _series(prices):
    pts = tuple(
        HistoryPoint(scanned_at=datetime(2026, 1, d + 1), travel_date=date(2026, 6, 1), price=p)
        for d, p in enumerate(prices)
    )
    return PriceHistorySeries(route_id=1, trip_type="oneway", points=pts)


def test_min_seen_and_percentile():
    s = _series([100, 200, 300, 400])
    assert s.min_seen() == 100
    assert s.percentile(100) == 0.25      # 1 of 4 at or below
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/skrendam/test_price_history.py -vv`
Expected: FAIL (`ModuleNotFoundError: ...history`)

- [ ] **Step 3: Write the module (series + in-memory adapter only)**

```python
# skrendam/scanning/history.py
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

    def previous_price(self, travel_date: date, before: datetime) -> float | None:
        """Most recent recorded price for this travel_date strictly before `before`."""
        cands = [p for p in self.points if p.travel_date == travel_date and p.scanned_at < before]
        if not cands:
            return None
        return max(cands, key=lambda p: p.scanned_at).price


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
    index added in the 0006 migration."""

    def __init__(self, session: Session, now: datetime, window_days: int = 180):
        self._session = session
        self._cutoff = now - timedelta(days=window_days)
        self._cache: dict[tuple[int, str], PriceHistorySeries] = {}

    def for_route(self, route_id: int, trip_type: str) -> PriceHistorySeries:
        key = (route_id, trip_type)
        if key not in self._cache:
            rows = self._session.execute(
                select(models.PriceLog.scanned_at, models.PriceLog.travel_date, models.PriceLog.price)
                .where(models.PriceLog.route_id == route_id,
                       models.PriceLog.trip_type == trip_type,
                       models.PriceLog.scanned_at >= self._cutoff)
                .order_by(models.PriceLog.scanned_at)
            ).all()
            pts = tuple(HistoryPoint(scanned_at=r[0], travel_date=r[1], price=r[2]) for r in rows)
            self._cache[key] = PriceHistorySeries(route_id=route_id, trip_type=trip_type, points=pts)
        return self._cache[key]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/skrendam/test_price_history.py -vv`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add skrendam/scanning/history.py tests/skrendam/test_price_history.py
git commit -m "feat(skrendam): PriceHistory read-module (series stats + in-memory/db adapters)"
```

---

### Task 6: DbPriceHistory against SQLite

**Files:**
- Test: `tests/skrendam/test_price_history.py` (append)

- [ ] **Step 1: Add the failing test**

```python
# append to tests/skrendam/test_price_history.py
from skrendam.db.base import Base
from skrendam.db import models as m
from skrendam.scanning.history import DbPriceHistory
from sqlalchemy import create_engine
from sqlalchemy.orm import Session as SASession


def _seed_session():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    s = SASession(engine)
    s.add(m.Zone(zone="EU_SHORT", haul_type="short"))
    s.add(m.Route(id=1, origin="VNO", destination="AMS", zone="EU_SHORT"))
    s.add(m.ScanRun(id=1, scanner_version="t"))
    s.flush()
    for day, price in enumerate([300.0, 250.0, 120.0], start=1):
        s.add(m.PriceLog(run_id=1, route_id=1, trip_type="oneway",
                         travel_date=date(2026, 6, 1), price=price,
                         scanner_version="t", scanned_at=datetime(2026, 1, day)))
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
```

- [ ] **Step 2: Run test to verify it passes**

Run: `uv run pytest tests/skrendam/test_price_history.py -vv`
Expected: PASS (tables built via `Base.metadata.create_all`; no migration needed for tests)

- [ ] **Step 3: Commit**

```bash
git add tests/skrendam/test_price_history.py
git commit -m "test(skrendam): DbPriceHistory reads price_log + respects window"
```

---

## Stage 3 — Persistence + orchestrator wiring

### Task 7: Schema additions (models)

**Files:**
- Modify: `skrendam/db/models.py`

- [ ] **Step 1: Add `Index` to the imports**

Change line 5 from:
```python
from sqlalchemy import JSON, Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, text
```
to:
```python
from sqlalchemy import (JSON, Boolean, Date, DateTime, Float, ForeignKey, Index,
                        Integer, String, Text, text)
```

- [ ] **Step 2: Add the composite index to PriceLog**

Append to the `PriceLog` class body (after `scanned_at`):
```python
    __table_args__ = (
        Index("ix_price_log_route_trip_date_scanned",
              "route_id", "trip_type", "travel_date", "scanned_at"),
    )
```

- [ ] **Step 3: Add `primary_scorer` to DealTemplate**

In `DealTemplate`, after the `rules_json` line, add:
```python
    primary_scorer: Mapped[str] = mapped_column(String, default="weighted", server_default="weighted")
```

- [ ] **Step 4: Add headline columns to CandidateTemplateMatch**

In `CandidateTemplateMatch`, after `gate_results`, add:
```python
    score_0_100: Mapped[int | None] = mapped_column(Integer, nullable=True)
    quality_tier: Mapped[str | None] = mapped_column(String, nullable=True)
    primary_scorer: Mapped[str | None] = mapped_column(String, nullable=True)
```

- [ ] **Step 5: Add the CandidateScore table (after CandidateTemplateMatch)**

```python
class CandidateScore(Base):
    __tablename__ = "candidate_scores"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    candidate_id: Mapped[int] = mapped_column(ForeignKey("candidates.id"), index=True)
    deal_template_id: Mapped[int] = mapped_column(ForeignKey("deal_templates.id"), index=True)
    scorer: Mapped[str] = mapped_column(String)
    value: Mapped[float] = mapped_column(Float)
    score_0_100: Mapped[int] = mapped_column(Integer)
    quality_tier: Mapped[str | None] = mapped_column(String, nullable=True)
    reason_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    signals: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
```

- [ ] **Step 6: Verify the models import and build a schema**

Run: `uv run python -c "from skrendam.db.base import Base; from skrendam.db import models; from sqlalchemy import create_engine; Base.metadata.create_all(create_engine('sqlite://')); print('ok')"`
Expected: `ok`

- [ ] **Step 7: Commit**

```bash
git add skrendam/db/models.py
git commit -m "feat(skrendam): schema — candidate_scores, headline columns, primary_scorer, price_log index"
```

---

### Task 8: repositories — upsert_score + extend upsert_match

**Files:**
- Modify: `skrendam/db/repositories.py`
- Test: `tests/skrendam/test_candidate_scores.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/skrendam/test_candidate_scores.py
from datetime import date, datetime

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session as SASession

from skrendam.db import models as m
from skrendam.db import repositories as repo
from skrendam.db.base import Base
from skrendam.scanning.scoring.base import Score


def _session():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    return SASession(engine)


def _seed_candidate(s):
    s.add(m.Zone(zone="EU_SHORT", haul_type="short"))
    s.add(m.Route(id=1, origin="VNO", destination="AMS", zone="EU_SHORT"))
    s.add(m.AudienceSegment(id=1, slug="a", name="a"))
    s.add(m.TravelMoment(id=1, slug="t", name="t", moment_type="relative"))
    s.add(m.DealTemplate(id=1, slug="d", name="d", audience_segment_id=1, travel_moment_id=1))
    s.add(m.Candidate(id=1, route_id=1, origin="VNO", destination="AMS", zone="EU_SHORT",
                      trip_type="oneway", travel_date=date(2026, 6, 1), price=100.0,
                      deal_group_key="k1"))
    s.flush()


def _score(scorer="drop", value=0.4):
    return Score(scorer=scorer, value=value, score_0_100=round(value * 100),
                 quality_tier=None, reason_text="r", signals={"x": 1})


def test_upsert_score_inserts_then_updates():
    s = _session()
    _seed_candidate(s)
    _row, created = repo.upsert_score(s, 1, 1, _score(value=0.4))
    assert created is True
    _row, created = repo.upsert_score(s, 1, 1, _score(value=0.7))
    assert created is False
    rows = s.scalars(select(m.CandidateScore).where(m.CandidateScore.scorer == "drop")).all()
    assert len(rows) == 1
    assert rows[0].value == 0.7


def test_upsert_match_writes_headline_fields():
    s = _session()
    _seed_candidate(s)
    repo.upsert_match(s, 1, 1, 0.9, "reason", {"price_anomaly": True},
                      score_0_100=90, quality_tier="great", primary_scorer="weighted")
    row = s.scalar(select(m.CandidateTemplateMatch))
    assert row.score_0_100 == 90
    assert row.quality_tier == "great"
    assert row.primary_scorer == "weighted"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/skrendam/test_candidate_scores.py -vv`
Expected: FAIL (`upsert_score` missing; `upsert_match` rejects new kwargs)

- [ ] **Step 3: Extend `upsert_match` (replace the function)**

```python
def upsert_match(session: Session, candidate_id: int, template_id: int,
                 match_score: float, reason_text: str, gate_results: dict,
                 score_0_100: int | None = None, quality_tier: str | None = None,
                 primary_scorer: str | None = None) -> tuple[models.CandidateTemplateMatch, bool]:
    """Return (match, created). Headline fields default to None for legacy callers."""
    existing = session.scalar(
        select(models.CandidateTemplateMatch).where(
            models.CandidateTemplateMatch.candidate_id == candidate_id,
            models.CandidateTemplateMatch.deal_template_id == template_id))
    if existing is None:
        m = models.CandidateTemplateMatch(
            candidate_id=candidate_id, deal_template_id=template_id, match_score=match_score,
            reason_text=reason_text, gate_results=gate_results, score_0_100=score_0_100,
            quality_tier=quality_tier, primary_scorer=primary_scorer)
        session.add(m)
        session.flush()
        return m, True
    existing.match_score = match_score
    existing.reason_text = reason_text
    existing.gate_results = gate_results
    existing.score_0_100 = score_0_100
    existing.quality_tier = quality_tier
    existing.primary_scorer = primary_scorer
    session.flush()
    return existing, False
```

- [ ] **Step 4: Add `upsert_score` (append to repositories.py)**

```python
def upsert_score(session: Session, candidate_id: int, template_id: int,
                 score) -> tuple[models.CandidateScore, bool]:
    """Insert or update the (candidate, template, scorer) score row.

    `score` is a skrendam.scanning.scoring.base.Score (duck-typed here to avoid a
    scanning->db import cycle)."""
    existing = session.scalar(
        select(models.CandidateScore).where(
            models.CandidateScore.candidate_id == candidate_id,
            models.CandidateScore.deal_template_id == template_id,
            models.CandidateScore.scorer == score.scorer))
    if existing is None:
        row = models.CandidateScore(
            candidate_id=candidate_id, deal_template_id=template_id, scorer=score.scorer,
            value=score.value, score_0_100=score.score_0_100, quality_tier=score.quality_tier,
            reason_text=score.reason_text, signals=score.signals)
        session.add(row)
        session.flush()
        return row, True
    existing.value = score.value
    existing.score_0_100 = score.score_0_100
    existing.quality_tier = score.quality_tier
    existing.reason_text = score.reason_text
    existing.signals = score.signals
    session.flush()
    return existing, False
```

- [ ] **Step 5: Run test to verify it passes**

Run: `uv run pytest tests/skrendam/test_candidate_scores.py -vv`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add skrendam/db/repositories.py tests/skrendam/test_candidate_scores.py
git commit -m "feat(skrendam): upsert_score + headline fields on upsert_match"
```

---

### Task 9: Alembic migration 0006 (additive)

**Files:**
- Create: `alembic/versions/0006_multi_strategy_scoring.py`

- [ ] **Step 1: Find the current head revision**

Run: `uv run alembic heads`
Expected: prints `adb4f0192c7e (head)` (the subscribers early-alerts revision). Use it as `down_revision`. If it differs, use the printed value.

- [ ] **Step 2: Write the migration**

```python
# alembic/versions/0006_multi_strategy_scoring.py
"""multi-strategy scoring: candidate_scores, headline columns, primary_scorer, price_log index

Revision ID: 0006_multi_strategy_scoring
Revises: adb4f0192c7e
Create Date: 2026-06-11
"""

import sqlalchemy as sa
from alembic import op

revision = "0006_multi_strategy_scoring"
down_revision = "adb4f0192c7e"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "candidate_scores",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("candidate_id", sa.Integer(), sa.ForeignKey("candidates.id"), index=True),
        sa.Column("deal_template_id", sa.Integer(), sa.ForeignKey("deal_templates.id"), index=True),
        sa.Column("scorer", sa.String(), nullable=False),
        sa.Column("value", sa.Float(), nullable=False),
        sa.Column("score_0_100", sa.Integer(), nullable=False),
        sa.Column("quality_tier", sa.String(), nullable=True),
        sa.Column("reason_text", sa.Text(), nullable=True),
        sa.Column("signals", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
    )
    op.add_column("candidate_template_matches", sa.Column("score_0_100", sa.Integer(), nullable=True))
    op.add_column("candidate_template_matches", sa.Column("quality_tier", sa.String(), nullable=True))
    op.add_column("candidate_template_matches", sa.Column("primary_scorer", sa.String(), nullable=True))
    op.add_column("deal_templates",
                  sa.Column("primary_scorer", sa.String(), nullable=False, server_default="weighted"))
    op.create_index("ix_price_log_route_trip_date_scanned", "price_log",
                    ["route_id", "trip_type", "travel_date", "scanned_at"])


def downgrade() -> None:
    op.drop_index("ix_price_log_route_trip_date_scanned", table_name="price_log")
    op.drop_column("deal_templates", "primary_scorer")
    op.drop_column("candidate_template_matches", "primary_scorer")
    op.drop_column("candidate_template_matches", "quality_tier")
    op.drop_column("candidate_template_matches", "score_0_100")
    op.drop_table("candidate_scores")
```

- [ ] **Step 3: Verify the migration applies to a scratch SQLite DB**

Run:
```bash
SKRENDAM_DATABASE_URL="sqlite:///./_scratch_migration.db" uv run alembic upgrade head && \
SKRENDAM_DATABASE_URL="sqlite:///./_scratch_migration.db" uv run alembic downgrade -1 && \
rm -f _scratch_migration.db
```
Expected: upgrade then downgrade run without error. (If `alembic.ini`/`env.py` reads a different env var for the URL, use that var — check `alembic/env.py`.)

- [ ] **Step 4: Commit**

```bash
git add alembic/versions/0006_multi_strategy_scoring.py
git commit -m "feat(skrendam): additive migration 0006 — scoring tables/columns/index"
```

---

### Task 10: Orchestrator runs all scorers + headline selection

**Files:**
- Modify: `skrendam/scanning/orchestrator.py`
- Test: `tests/skrendam/test_orchestrator.py` (extend)

- [ ] **Step 1: Add a failing assertion to the orchestrator test**

Open `tests/skrendam/test_orchestrator.py`. After the existing end-to-end scan assertions, add:
```python
def test_scan_persists_per_scorer_rows(session_factory):
    # Reuse the existing FakeBackend + seed helpers in this module to run a scan,
    # then assert at least one candidate_scores row exists for the "weighted" scorer.
    from sqlalchemy import select
    from skrendam.db import models as m
    s = _run_a_scan(session_factory)  # existing helper that runs run_scan and returns the session
    weighted_rows = s.scalars(
        select(m.CandidateScore).where(m.CandidateScore.scorer == "weighted")).all()
    assert weighted_rows, "expected weighted scores persisted to candidate_scores"
    match = s.scalar(select(m.CandidateTemplateMatch))
    assert match.primary_scorer == "weighted"
    assert match.score_0_100 == round(match.match_score * 100)
```
If the existing test file does not expose a `_run_a_scan` helper / `session_factory` fixture, adapt these two assertions into the existing end-to-end test instead of adding a new function — the goal is: after a scan, `candidate_scores` has a weighted row and the match carries `primary_scorer`/`score_0_100`.

- [ ] **Step 2: Run to verify it fails**

Run: `uv run pytest tests/skrendam/test_orchestrator.py -vv`
Expected: FAIL (no `candidate_scores` rows / `primary_scorer` is None)

- [ ] **Step 3: Update imports in orchestrator.py**

Replace:
```python
from skrendam.scanning import matching as matching_mod
```
with:
```python
from skrendam.scanning.history import DbPriceHistory
from skrendam.scanning.scoring.base import ScoringContext
from skrendam.scanning.scoring.eligibility import in_template_scope
from skrendam.scanning.scoring.registry import enabled_scorers
```

- [ ] **Step 4: Pass a PriceHistory into the scan loop**

In `run_scan`, immediately after `breaker = CircuitBreaker(circuit_breaker_threshold)`:
```python
    history = DbPriceHistory(session, now)
```
Then change the `_persist_fare(...)` call (currently around line 101) to pass it:
```python
                _persist_fare(session, run, route, zone, spec, p, fare, base,
                              templates, now, scanner_version, summary, history)
```

- [ ] **Step 5: Rewrite `_persist_fare` (replace the whole function and the `_fare_in_template_scope` helper)**

```python
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
```
Then delete the now-unused `_fare_in_template_scope` function (its logic lives in `eligibility.in_template_scope`).

- [ ] **Step 6: Run the orchestrator tests**

Run: `uv run pytest tests/skrendam/test_orchestrator.py -vv`
Expected: PASS

- [ ] **Step 7: Run the full skrendam suite**

Run: `uv run pytest tests/skrendam -vv`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add skrendam/scanning/orchestrator.py tests/skrendam/test_orchestrator.py
git commit -m "feat(skrendam): orchestrator runs all scorers, picks headline, persists per-scorer scores"
```

---

## Stage 4 — New detectors

### Task 11: PriceDropScorer

**Files:**
- Create: `skrendam/scanning/scoring/drop.py`
- Test: `tests/skrendam/test_scoring_drop.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/skrendam/test_scoring_drop.py
from types import SimpleNamespace

from skrendam.scanning.scoring.base import ScoringContext
from skrendam.scanning.scoring.drop import PriceDropScorer
from skrendam.scanning.types import Baseline, FareItinerary


def _ctx(price, previous_price):
    return ScoringContext(
        fare=FareItinerary(price=price, currency="EUR", stops=0, duration_minutes=120, legs=[]),
        baseline=Baseline(minimum=price, median=price, decile=price, sample_size=1),
        zone=SimpleNamespace(), template=SimpleNamespace(primary_scorer="weighted"),
        history=None, previous_price=previous_price)


def test_drop_fires_on_big_fall():
    s = PriceDropScorer().score(_ctx(100.0, previous_price=200.0))  # 50% drop
    assert s is not None
    assert s.scorer == "drop"
    assert s.value == 1.0
    assert s.signals["drop_frac"] == 0.5


def test_drop_ignores_small_fall():
    assert PriceDropScorer().score(_ctx(190.0, previous_price=200.0)) is None  # 5%


def test_drop_none_without_previous():
    assert PriceDropScorer().score(_ctx(100.0, previous_price=None)) is None
```

- [ ] **Step 2: Run to verify it fails**

Run: `uv run pytest tests/skrendam/test_scoring_drop.py -vv`
Expected: FAIL (`ModuleNotFoundError: ...drop`)

- [ ] **Step 3: Write the scorer**

```python
# skrendam/scanning/scoring/drop.py
"""PriceDropScorer: flags a fare that fell sharply versus the last recorded price."""

from skrendam.scanning.scoring import tiering
from skrendam.scanning.scoring.base import Score, ScoringContext

MIN_DROP_FRAC = 0.20   # must be at least 20% below the previous recorded price
FULL_DROP_FRAC = 0.50  # a 50% drop is full confidence


class PriceDropScorer:
    name = "drop"

    def score(self, ctx: ScoringContext) -> Score | None:
        prev = ctx.previous_price
        if not prev or prev <= 0:
            return None
        drop = (prev - ctx.fare.price) / prev
        if drop < MIN_DROP_FRAC:
            return None
        value = round(min(1.0, drop / FULL_DROP_FRAC), 3)
        s100 = tiering.to_score_100(value)
        reason = (f"EUR{ctx.fare.price:.0f} - down {round(drop * 100)}% from "
                  f"EUR{prev:.0f} since the last scan.")
        return Score(scorer="drop", value=value, score_0_100=s100,
                     quality_tier=tiering.quality_tier(s100), reason_text=reason,
                     signals={"previous_price": prev, "drop_frac": round(drop, 3)})
```

- [ ] **Step 4: Run to verify it passes**

Run: `uv run pytest tests/skrendam/test_scoring_drop.py -vv`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add skrendam/scanning/scoring/drop.py tests/skrendam/test_scoring_drop.py
git commit -m "feat(skrendam): PriceDropScorer"
```

---

### Task 12: ErrorFareScorer

**Files:**
- Create: `skrendam/scanning/scoring/error_fare.py`
- Test: `tests/skrendam/test_scoring_error_fare.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/skrendam/test_scoring_error_fare.py
from datetime import date, datetime
from types import SimpleNamespace

from skrendam.scanning.history import HistoryPoint, PriceHistorySeries
from skrendam.scanning.scoring.base import ScoringContext
from skrendam.scanning.scoring.error_fare import ErrorFareScorer
from skrendam.scanning.types import Baseline, FareItinerary


def _series(prices):
    pts = tuple(HistoryPoint(scanned_at=datetime(2026, 1, i + 1),
                             travel_date=date(2026, 6, 1), price=p) for i, p in enumerate(prices))
    return PriceHistorySeries(route_id=1, trip_type="oneway", points=pts)


def _ctx(price, series):
    return ScoringContext(
        fare=FareItinerary(price=price, currency="EUR", stops=0, duration_minutes=120, legs=[]),
        baseline=Baseline(minimum=price, median=price, decile=price, sample_size=1),
        zone=SimpleNamespace(), template=SimpleNamespace(primary_scorer="weighted"),
        history=series, previous_price=None)


def test_error_fare_fires_far_below_floor():
    series = _series([200, 210, 205, 220, 215, 230, 208, 225])  # floor 200, 8 points
    s = ErrorFareScorer().score(_ctx(120.0, series))  # 40% below floor
    assert s is not None
    assert s.scorer == "error_fare"
    assert s.signals["floor"] == 200


def test_error_fare_quiet_near_floor():
    series = _series([200, 210, 205, 220, 215, 230, 208, 225])
    assert ErrorFareScorer().score(_ctx(190.0, series)) is None  # only 5% below floor


def test_error_fare_needs_enough_history():
    series = _series([200, 210, 120])  # < MIN_HISTORY
    assert ErrorFareScorer().score(_ctx(120.0, series)) is None
```

- [ ] **Step 2: Run to verify it fails**

Run: `uv run pytest tests/skrendam/test_scoring_error_fare.py -vv`
Expected: FAIL (`ModuleNotFoundError: ...error_fare`)

- [ ] **Step 3: Write the scorer**

```python
# skrendam/scanning/scoring/error_fare.py
"""ErrorFareScorer: flags a fare implausibly far below the cheapest price ever
recorded for the route. Lenient on itinerary on purpose — an error fare is worth
surfacing even if ugly."""

from skrendam.scanning.scoring import tiering
from skrendam.scanning.scoring.base import Score, ScoringContext

MIN_BELOW_MIN_FRAC = 0.30  # at least 30% below the recorded floor
MIN_HISTORY = 8            # need enough history to trust the floor


class ErrorFareScorer:
    name = "error_fare"

    def score(self, ctx: ScoringContext) -> Score | None:
        hist = ctx.history
        if hist is None or len(hist.points) < MIN_HISTORY:
            return None
        floor = hist.min_seen()
        if not floor or floor <= 0 or ctx.fare.price >= floor:
            return None
        below = (floor - ctx.fare.price) / floor
        if below < MIN_BELOW_MIN_FRAC:
            return None
        value = round(min(1.0, 0.6 + below), 3)  # error fares rank high
        s100 = tiering.to_score_100(value)
        reason = (f"EUR{ctx.fare.price:.0f} - {round(below * 100)}% below the "
                  f"{len(hist.points)}-point floor of EUR{floor:.0f}. Possible error fare.")
        return Score(scorer="error_fare", value=value, score_0_100=s100,
                     quality_tier=tiering.quality_tier(s100), reason_text=reason,
                     signals={"floor": floor, "below_floor_frac": round(below, 3),
                              "history_points": len(hist.points)})
```

- [ ] **Step 4: Run to verify it passes**

Run: `uv run pytest tests/skrendam/test_scoring_error_fare.py -vv`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add skrendam/scanning/scoring/error_fare.py tests/skrendam/test_scoring_error_fare.py
git commit -m "feat(skrendam): ErrorFareScorer"
```

---

### Task 13: RarityScorer

**Files:**
- Create: `skrendam/scanning/scoring/rarity.py`
- Test: `tests/skrendam/test_scoring_rarity.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/skrendam/test_scoring_rarity.py
from datetime import date, datetime
from types import SimpleNamespace

from skrendam.scanning.history import HistoryPoint, PriceHistorySeries
from skrendam.scanning.scoring.base import ScoringContext
from skrendam.scanning.scoring.rarity import RarityScorer
from skrendam.scanning.types import Baseline, FareItinerary


def _series(prices):
    pts = tuple(HistoryPoint(scanned_at=datetime(2026, 1, i + 1),
                             travel_date=date(2026, 6, 1), price=p) for i, p in enumerate(prices))
    return PriceHistorySeries(route_id=1, trip_type="oneway", points=pts)


def _ctx(price, series):
    return ScoringContext(
        fare=FareItinerary(price=price, currency="EUR", stops=0, duration_minutes=120, legs=[]),
        baseline=Baseline(minimum=price, median=price, decile=price, sample_size=1),
        zone=SimpleNamespace(), template=SimpleNamespace(primary_scorer="weighted"),
        history=series, previous_price=None)


def test_rarity_fires_when_cheapest_in_history():
    series = _series([200, 210, 205, 220, 215, 230, 208, 225, 240, 250])  # 10 points
    s = RarityScorer().score(_ctx(150.0, series))  # cheaper than all -> percentile 0.0
    assert s is not None
    assert s.scorer == "rarity"
    assert s.value == 1.0


def test_rarity_quiet_for_common_price():
    series = _series([200, 210, 205, 220, 215, 230, 208, 225, 240, 250])
    assert RarityScorer().score(_ctx(245.0, series)) is None  # above the 10th percentile


def test_rarity_needs_enough_history():
    series = _series([200, 150])  # < MIN_HISTORY
    assert RarityScorer().score(_ctx(150.0, series)) is None
```

- [ ] **Step 2: Run to verify it fails**

Run: `uv run pytest tests/skrendam/test_scoring_rarity.py -vv`
Expected: FAIL (`ModuleNotFoundError: ...rarity`)

- [ ] **Step 3: Write the scorer**

```python
# skrendam/scanning/scoring/rarity.py
"""RarityScorer: scores how rarely a route is ever this cheap, from the full
recorded-price percentile."""

from skrendam.scanning.scoring import tiering
from skrendam.scanning.scoring.base import Score, ScoringContext

RARE_PCTILE = 0.10  # price must sit in the cheapest 10% of recorded prices
MIN_HISTORY = 10


class RarityScorer:
    name = "rarity"

    def score(self, ctx: ScoringContext) -> Score | None:
        hist = ctx.history
        if hist is None or len(hist.points) < MIN_HISTORY:
            return None
        pct = hist.percentile(ctx.fare.price)  # fraction at or below
        if pct > RARE_PCTILE:
            return None
        value = round(min(1.0, 1.0 - pct), 3)  # cheaper => rarer => higher
        s100 = tiering.to_score_100(value)
        reason = (f"EUR{ctx.fare.price:.0f} - in the cheapest {round(pct * 100)}% of "
                  f"{len(hist.points)} recorded prices for this route.")
        return Score(scorer="rarity", value=value, score_0_100=s100,
                     quality_tier=tiering.quality_tier(s100), reason_text=reason,
                     signals={"percentile": round(pct, 3), "history_points": len(hist.points)})
```

- [ ] **Step 4: Run to verify it passes**

Run: `uv run pytest tests/skrendam/test_scoring_rarity.py -vv`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add skrendam/scanning/scoring/rarity.py tests/skrendam/test_scoring_rarity.py
git commit -m "feat(skrendam): RarityScorer"
```

---

### Task 14: Register the three detectors + prove an error-fare-only candidate surfaces

**Files:**
- Modify: `skrendam/scanning/scoring/registry.py`
- Test: `tests/skrendam/test_orchestrator.py` (extend)

- [ ] **Step 1: Register the detectors**

In `registry.py`, add imports under the WeightedScorer import:
```python
from skrendam.scanning.scoring.drop import PriceDropScorer
from skrendam.scanning.scoring.error_fare import ErrorFareScorer
from skrendam.scanning.scoring.rarity import RarityScorer
```
and after `register(WeightedScorer())` add:
```python
register(PriceDropScorer())
register(ErrorFareScorer())
register(RarityScorer())
```

- [ ] **Step 2: Add a failing test — an error-fare the weighted scorer misses still surfaces**

Add to `tests/skrendam/test_scoring_weighted.py` a registry-level test (no DB):
```python
def test_registry_lets_error_fare_fire_when_weighted_is_silent():
    from datetime import date, datetime
    from types import SimpleNamespace
    from skrendam.scanning.history import HistoryPoint, PriceHistorySeries
    from skrendam.scanning.scoring.base import ScoringContext
    from skrendam.scanning.scoring.registry import enabled_scorers
    from skrendam.scanning.types import Baseline, FareItinerary

    # Baseline median == price -> weighted sees no discount and stays silent...
    pts = tuple(HistoryPoint(scanned_at=datetime(2026, 1, i + 1), travel_date=date(2026, 6, 1),
                             price=p) for i, p in enumerate([200, 210, 205, 220, 215, 230, 208, 225]))
    ctx = ScoringContext(
        fare=FareItinerary(price=120.0, currency="EUR", stops=0, duration_minutes=120, legs=[]),
        baseline=Baseline(minimum=120.0, median=120.0, decile=120.0, sample_size=8),
        zone=SimpleNamespace(threshold_price_eur=None, min_discount_pct=None, min_abs_savings_eur=None),
        template=SimpleNamespace(trip_type="oneway", max_price_eur=None, min_discount_pct=None,
                                 min_abs_savings_eur=None, psychological_price_threshold_eur=None,
                                 allow_smaller_discount_if_under_price=False, max_stops=None,
                                 max_total_duration_minutes=None, allow_self_transfer=True,
                                 allow_mixed_cabin=True, allow_airport_change=True,
                                 allow_overnight_layover=True, primary_scorer="weighted"),
        history=PriceHistorySeries(route_id=1, trip_type="oneway", points=pts),
        previous_price=None)
    fired = {s.scorer for sc in enabled_scorers() if (s := sc.score(ctx))}
    assert "weighted" not in fired       # weighted stays silent
    assert "error_fare" in fired         # ...but the error-fare detector surfaces it
```

- [ ] **Step 3: Run to verify it passes**

Run: `uv run pytest tests/skrendam/test_scoring_weighted.py -vv`
Expected: PASS

- [ ] **Step 4: Run the full skrendam suite**

Run: `uv run pytest tests/skrendam -vv`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add skrendam/scanning/scoring/registry.py tests/skrendam/test_scoring_weighted.py
git commit -m "feat(skrendam): register drop/error_fare/rarity; error-fares surface past silent weighted"
```

---

## Stage 5 — Close the tier-meaning leak downstream

### Task 15: analyze.py counts quality_tier

**Files:**
- Modify: `skrendam/analyze.py`
- Test: `tests/skrendam/test_analyze.py` (existing — keep green)

- [ ] **Step 1: Read analyze.py around the tier-preview computation**

Run: `uv run python -c "import pathlib; print(pathlib.Path('skrendam/analyze.py').read_text())"`
Locate where it selects `CandidateTemplateMatch.match_score` and computes `great = sum(1 for s in scores if s >= great_threshold)`.

- [ ] **Step 2: Change the tier-preview to read `quality_tier` with a fallback**

Replace the score-selection + `great` computation with a version that reads the stored tier, falling back to `match_score` for un-backfilled rows:
```python
    rows = session.execute(
        select(models.CandidateTemplateMatch.quality_tier,
               models.CandidateTemplateMatch.match_score)).all()
    great = sum(1 for tier, ms in rows
                if (tier in ("great", "rare")) or (tier is None and ms is not None and ms >= great_threshold))
    maybe = len(rows) - great
```
Keep the existing `great_threshold: float = 0.88` default. Update the sync comment to point at the new source:
```python
# quality_tier is written by the engine via skrendam/scanning/scoring/tiering.py
# (GREAT=88, RARE=94). great_threshold (0.88) is only the fallback for old rows.
```

- [ ] **Step 3: Run the analyze tests**

Run: `uv run pytest tests/skrendam/test_analyze.py -vv`
Expected: PASS (add/adjust an assertion if the test seeds matches — set `quality_tier` on at least one seeded match and assert it is counted as great).

- [ ] **Step 4: Commit**

```bash
git add skrendam/analyze.py tests/skrendam/test_analyze.py
git commit -m "refactor(skrendam): analyze counts quality_tier (fallback to match_score)"
```

---

### Task 16: Regenerate Drizzle schemas (web + site)

**Files:**
- Modify (generated): `web/src/db/generated/*`, `site/src/db/generated/*`

> Requires the migration applied to a database the apps introspect. This task runs AFTER Task 18 applies it. If you are executing in order, do Task 18 first, then return here. (Kept here for narrative grouping.)

- [ ] **Step 1: Re-pull web schema**

Run: `cd web && npm run db:pull`
Expected: `candidate_scores` table and the new `candidate_template_matches.score_0_100`/`quality_tier`/`primary_scorer` columns appear in `web/src/db/generated/`.

- [ ] **Step 2: Re-pull site schema**

Run: `cd site && npm run db:pull`
Expected: the new columns appear in `site/src/db/generated/`.

- [ ] **Step 3: Commit**

```bash
git add web/src/db/generated site/src/db/generated
git commit -m "chore(web,site): re-pull Drizzle schema for scoring columns"
```

---

### Task 17: web + site read score_0_100 / quality_tier (delete ×100 guesses)

**Files:**
- Modify: `web/src/lib/queries.ts`, `web/src/lib/mappers.ts`, `web/src/lib/tiers.ts`, `web/src/components/ScoreBadge.tsx`, web dashboard threshold
- Modify: `site/src/lib/queries.ts`, `site/src/lib/mappers.ts`, `site/src/lib/quality.ts`
- Test: `web/src/lib/mappers.test.ts`, `site/src/lib/mappers.test.ts`

- [ ] **Step 1: Read the current web mapper + queries**

Run: `cd web && cat src/lib/mappers.ts src/lib/queries.ts src/lib/tiers.ts src/components/ScoreBadge.tsx`
Confirm the join that currently surfaces `score` (the `candidate_template_matches.match_score`).

- [ ] **Step 2: Add the new columns to the web queue select**

In `web/src/lib/queries.ts`, in the `queueBase()` select object, add alongside the existing `score: candidateTemplateMatches.matchScore`:
```ts
    score100: candidateTemplateMatches.score_0_100,
    qualityTier: candidateTemplateMatches.quality_tier,
```
(Use the exact generated column identifiers from the re-pulled schema — they may be camelCased as `score0100`/`qualityTier`.)

- [ ] **Step 3: Write the failing web mapper test**

In `web/src/lib/mappers.test.ts` add:
```ts
import { describe, it, expect } from 'vitest';
import { toCandidateView } from './mappers';

describe('toCandidateView score source', () => {
  it('uses stored score100 when present', () => {
    const row: any = { score: 0.91, score100: 91, qualityTier: 'rare', /* …minimal row fields… */ };
    const view = toCandidateView(row);
    expect(view.score).toBe(91);
  });
  it('falls back to round(score*100) when score100 is null', () => {
    const row: any = { score: 0.7, score100: null, qualityTier: null };
    const view = toCandidateView(row);
    expect(view.score).toBe(70);
  });
});
```
Fill the `/* minimal row fields */` with whatever non-null fields `toCandidateView` dereferences (read the function first).

- [ ] **Step 4: Update the web mapper to prefer the stored value**

In `web/src/lib/mappers.ts`, replace `const score = Math.round(Number(r.score) * 100);` with:
```ts
const score = r.score100 != null ? Number(r.score100) : Math.round(Number(r.score) * 100);
const tier = r.qualityTier ?? tierForScore(score);
```
Use `tier` where the view currently calls `tierForScore(score)`.

- [ ] **Step 5: Re-point the stray 80/60 thresholds at the shared constant**

In `web/src/components/ScoreBadge.tsx`, import `GREAT_THRESHOLD` from `../lib/tiers` and replace the hardcoded `80`/`60` cutoffs with values derived from it (e.g. `hi = GREAT_THRESHOLD`, `mid = GREAT_THRESHOLD - 28`), removing the drift. In the dashboard (`web/src/app/(app)/page.tsx` and `DashboardCards.tsx`), replace the literal `80` high-score filter/caption with `GREAT_THRESHOLD` and `` `score ≥ ${GREAT_THRESHOLD}` ``.

- [ ] **Step 6: Run web tests**

Run: `cd web && npm run test`
Expected: PASS

- [ ] **Step 7: Repeat for site (read the files first)**

Run: `cd site && cat src/lib/mappers.ts src/lib/queries.ts src/lib/quality.ts`
- In `site/src/lib/queries.ts`, add `score100`/`qualityTier` to every select that currently surfaces `score` (live deals, inspiration, deal-by-id, similar).
- Add a failing test in `site/src/lib/mappers.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { toTicket } from './mappers';

describe('toTicket score source', () => {
  it('uses stored score100 + quality_tier when present', () => {
    const row: any = { score: 0.95, score100: 95, qualityTier: 'rare', /* …minimal fields… */ };
    const t = toTicket(row, new Date('2026-06-11'));
    expect(t.quality).toBe('rare');
  });
});
```
- In `site/src/lib/mappers.ts`, replace each `Math.round(Number(r.score ?? 0) * 100)` with `r.score100 != null ? Number(r.score100) : Math.round(Number(r.score ?? 0) * 100)`, and prefer `r.qualityTier ?? qualityTag(score)` where quality is derived.

- [ ] **Step 8: Run site tests**

Run: `cd site && npm run test`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add web/src site/src
git commit -m "feat(web,site): read engine score_0_100/quality_tier; kill ×100 guesses and 80/88 drift"
```

---

## Stage 6 — Apply to live Neon + verify

### Task 18: Apply the migration to live Neon

**Files:** none (operational)

- [ ] **Step 1: Confirm the full Python suite is green first**

Run: `uv run pytest tests/skrendam -vv`
Expected: PASS. Do not proceed otherwise.

- [ ] **Step 2: Confirm the live target with the user**

Print the target host (without secrets) and get an explicit go-ahead:
Run: `uv run python -c "import os,urllib.parse as u; d=os.environ.get('SKRENDAM_DATABASE_URL') or os.environ.get('DATABASE_URL') or ''; p=u.urlparse(d); print('target host:', p.hostname, 'db:', (p.path or '').lstrip('/'))"`
Expected: prints the Neon host. Pause for the user's explicit "yes" before Step 3.

- [ ] **Step 3: Apply the migration**

Run: `uv run alembic upgrade head`
Expected: `Running upgrade adb4f0192c7e -> 0006_multi_strategy_scoring`.

- [ ] **Step 4: Verify the schema landed**

Run: `uv run python -c "from sqlalchemy import create_engine, inspect; import os; e=create_engine(os.environ['SKRENDAM_DATABASE_URL']); i=inspect(e); print('candidate_scores' in i.get_table_names()); print([c['name'] for c in i.get_columns('candidate_template_matches') if c['name'] in ('score_0_100','quality_tier','primary_scorer')])"`
Expected: `True` then `['score_0_100', 'quality_tier', 'primary_scorer']`.

- [ ] **Step 5: (Optional) backfill existing matches**

Run:
```bash
uv run python -c "
from sqlalchemy import create_engine, text
import os
e = create_engine(os.environ['SKRENDAM_DATABASE_URL'])
with e.begin() as c:
    c.execute(text('UPDATE candidate_template_matches SET score_0_100 = ROUND(match_score*100) WHERE score_0_100 IS NULL'))
    c.execute(text(\"UPDATE candidate_template_matches SET quality_tier = CASE WHEN score_0_100>=94 THEN 'rare' WHEN score_0_100>=88 THEN 'great' ELSE NULL END WHERE quality_tier IS NULL AND score_0_100 IS NOT NULL\"))
print('backfilled')
"
```
Expected: `backfilled`.

- [ ] **Step 6: Now run Task 16 (Drizzle re-pull) against the live schema, then Task 17 if not already done.**

- [ ] **Step 7: No commit** (operational step). Note completion in the PR description.

---

## Self-Review

**Spec coverage:** Module 1 → Tasks 1–4; Module 2 → Tasks 5–6; Module 3 → Tasks 7–9; Module 4 → Task 10; Module 5 → Tasks 11–14; Module 6 → Tasks 15–17; migration → Tasks 9, 18. All spec sections map to a task.

**Type consistency:** `Score(scorer, value, score_0_100, quality_tier, reason_text, signals)` and `ScoringContext(fare, baseline, zone, template, history, previous_price)` are used identically across base, weighted, drop, error_fare, rarity, repositories, and orchestrator. `to_score_100`/`quality_tier` come only from `tiering`. `upsert_match(..., score_0_100, quality_tier, primary_scorer)` and `upsert_score(session, candidate_id, template_id, score)` signatures match their call sites in `_persist_fare`. `PriceHistorySeries.for_route/min_seen/percentile/previous_price` are used consistently in history tests, DbPriceHistory, and the scorers.

**Placeholder scan:** the two web/site mapper tests intentionally leave `/* minimal row fields */` to be filled after reading the exact mapper — they are gated by an explicit "read the file first" step, not silent TODOs. No other placeholders.
