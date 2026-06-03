# Engine Tuning (Tiered) + Curator Config Editors — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **UI work MUST use the `yip-design-system` skill.**

**Goal:** Make the candidate queue trustworthy by tiering it (great + maybe) and tuning thresholds from real data, and finish the admin with config-CRUD editors for all 5 engine config tables (which double as the tuning knobs).

**Architecture:** Branch `feat/engine-tuning-config-editors` (off `main`). **No schema migration** — tiers derive from the stored `match_score`; the calibrate fix is matching-logic only; soft-disable uses existing `enabled` flags. Engine work in `skrendam/`; admin work in `web/` (Next.js 16, Drizzle, Server Actions). Spec: `docs/superpowers/specs/2026-06-03-engine-tuning-config-editors-design.md`.

**Tech Stack:** Python 3.13 (SQLAlchemy, argparse, pytest) · Next.js 16 + TS (Drizzle `neon-http`, Server Actions, vitest, Playwright) · yip-design-system tokens.

---

## File Structure

**Engine (Python):**
- Create `skrendam/analyze.py` — read-only aggregation over real data → an `AnalysisReport` dataclass + `format_report()`.
- Modify `skrendam/cli.py` — add the `analyze` subcommand.
- Modify `skrendam/scanning/matching.py` — C5 fix: scope `zone.threshold_price_eur` fallback to one-way templates.
- Test: `tests/skrendam/test_analyze.py` (new); extend `tests/skrendam/test_matching.py`.

**Web — tiering:**
- Create `web/src/lib/tiers.ts` — `GREAT_THRESHOLD` + `tierForScore()`.
- Modify `web/src/lib/types.ts` — add `tier` to `CandidateView`.
- Modify `web/src/lib/mappers.ts` — set `tier`.
- Modify `web/src/components/QueueBoard.tsx`, `QueueRow.tsx` — render great-first + maybe-secondary + a tier badge.
- Test: `web/src/lib/tiers.test.ts` (new); extend `web/src/lib/mappers.test.ts`.

**Web — config editors:**
- Create `web/src/lib/config-queries.ts` — list reads for the 5 config entities.
- Create `web/src/app/config-actions.ts` — `'use server'` upsert + toggle-enabled actions for the 5 entities.
- Create per-entity pages + forms under `web/src/app/(app)/config/`:
  - `config/page.tsx` (config index), `config/zones/{page.tsx,ZoneForm.tsx}`, `config/templates/{page.tsx,TemplateForm.tsx}`, `config/audiences/{page.tsx,AudienceForm.tsx}`, `config/moments/{page.tsx,MomentForm.tsx}`, `config/routes/{page.tsx,RouteForm.tsx}`.
  - Create `web/src/components/ConfigShell.tsx` — shared list/section chrome.
- Modify `web/src/components/Sidebar.tsx` — wire the config nav items.
- Test: extend the config-action coverage; `web/e2e/config.spec.ts` (new).

**Drizzle identifiers (confirmed via the committed `web/src/db/generated/schema.ts`):** tables `dealTemplates`, `zones`, `audienceSegments`, `travelMoments`, `routes`; columns are camelCase (`thresholdPriceEur`, `minDiscountPct`, `maxPriceEur`, `psychologicalPriceThresholdEur`, `minAbsSavingsEur`, `haulType`, `defaultItineraryTolerance`, `momentType`, `defaultContentAngle`, etc.). **Each task that writes a query/action MUST confirm the exact identifier in `schema.ts` before finalizing.**

---

# Milestone A — Tune the engine (tiered)

### Task 1: `skrendam analyze` — data-analysis pass

**Files:**
- Create: `skrendam/analyze.py`
- Modify: `skrendam/cli.py`
- Test: `tests/skrendam/test_analyze.py`

- [ ] **Step 1: Write the failing test**

Create `tests/skrendam/test_analyze.py`:
```python
from datetime import date, datetime

from skrendam.db import models
from skrendam import analyze


def _seed(session):
    session.add(models.Zone(zone="MED", haul_type="short", threshold_price_eur=150.0))
    session.add(models.Route(id=1, origin="VNO", destination="BCN", zone="MED"))
    session.add(models.AudienceSegment(id=1, slug="couples", name="Couples"))
    session.add(models.TravelMoment(id=1, slug="sept", name="September", moment_type="seasonal"))
    session.add(models.DealTemplate(id=1, slug="sept-sun", name="September sun",
                                    audience_segment_id=1, travel_moment_id=1, trip_type="roundtrip"))
    for i, (price, disc, score) in enumerate([(96.0, 67.0, 0.9), (150.0, 40.0, 0.7), (180.0, 20.0, 0.5)]):
        c = models.Candidate(id=i + 1, route_id=1, origin="VNO", destination="BCN", zone="MED",
                             trip_type="roundtrip", travel_date=date(2026, 9, 10), price=price,
                             baseline_price=290.0, discount_pct=disc, status="new",
                             deal_group_key=f"k{i}")
        session.add(c)
        session.add(models.CandidateTemplateMatch(candidate_id=i + 1, deal_template_id=1,
                                                  match_score=score))
    session.commit()


def test_analyze_summarizes_real_data(session):
    _seed(session)
    rep = analyze.analyze(session, great_threshold=0.8)
    assert rep.candidate_count == 3
    assert rep.match_count == 3
    # discount percentiles are computed over candidate discount_pct
    assert rep.discount_p50 == 40.0
    # per-template volume
    assert rep.per_template[0].template == "September sun"
    assert rep.per_template[0].count == 3
    # tier preview: 1 great (score>=0.8), 2 maybe
    assert rep.tier_preview.great == 1
    assert rep.tier_preview.maybe == 2


def test_format_report_is_nonempty_string(session):
    _seed(session)
    rep = analyze.analyze(session, great_threshold=0.8)
    out = analyze.format_report(rep)
    assert "candidates" in out.lower() and "September sun" in out
```

- [ ] **Step 2: Run it; verify it fails**

Run: `uv run pytest tests/skrendam/test_analyze.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'skrendam.analyze'`.

- [ ] **Step 3: Implement `skrendam/analyze.py`**
```python
"""Read-only analysis over real scan data — informs threshold tuning (spec A1)."""

from __future__ import annotations

import statistics
from dataclasses import dataclass, field

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from skrendam.db import models


@dataclass
class TemplateVolume:
    template: str
    count: int


@dataclass
class TierPreview:
    great: int
    maybe: int


@dataclass
class AnalysisReport:
    candidate_count: int
    match_count: int
    price_log_count: int
    discount_p10: float
    discount_p50: float
    discount_p90: float
    per_template: list[TemplateVolume] = field(default_factory=list)
    per_zone: list[TemplateVolume] = field(default_factory=list)
    tier_preview: TierPreview = field(default_factory=lambda: TierPreview(0, 0))


def _percentile(values: list[float], pct: float) -> float:
    if not values:
        return 0.0
    s = sorted(values)
    k = max(0, min(len(s) - 1, round((pct / 100.0) * (len(s) - 1))))
    return round(s[k], 1)


def analyze(session: Session, great_threshold: float = 0.8) -> AnalysisReport:
    discounts = [d for (d,) in session.execute(
        select(models.Candidate.discount_pct).where(models.Candidate.discount_pct.is_not(None))
    )]
    scores = [s for (s,) in session.execute(select(models.CandidateTemplateMatch.match_score))]
    per_tmpl = session.execute(
        select(models.DealTemplate.name, func.count(models.CandidateTemplateMatch.id))
        .join(models.CandidateTemplateMatch,
              models.CandidateTemplateMatch.deal_template_id == models.DealTemplate.id)
        .group_by(models.DealTemplate.name)
        .order_by(func.count(models.CandidateTemplateMatch.id).desc())
    ).all()
    per_zone = session.execute(
        select(models.Candidate.zone, func.count(models.Candidate.id))
        .group_by(models.Candidate.zone)
        .order_by(func.count(models.Candidate.id).desc())
    ).all()
    great = sum(1 for s in scores if s >= great_threshold)
    return AnalysisReport(
        candidate_count=session.scalar(select(func.count(models.Candidate.id))) or 0,
        match_count=len(scores),
        price_log_count=session.scalar(select(func.count(models.PriceLog.id))) or 0,
        discount_p10=_percentile(discounts, 10),
        discount_p50=_percentile(discounts, 50),
        discount_p90=_percentile(discounts, 90),
        per_template=[TemplateVolume(t, c) for (t, c) in per_tmpl],
        per_zone=[TemplateVolume(z, c) for (z, c) in per_zone],
        tier_preview=TierPreview(great=great, maybe=len(scores) - great),
    )


def format_report(rep: AnalysisReport) -> str:
    lines = [
        "=== Skrendam tuning analysis ===",
        f"candidates: {rep.candidate_count} | matches: {rep.match_count} | price points: {rep.price_log_count}",
        f"discount % (p10/p50/p90): {rep.discount_p10} / {rep.discount_p50} / {rep.discount_p90}",
        f"tier preview: {rep.tier_preview.great} great / {rep.tier_preview.maybe} maybe",
        "-- candidates per template --",
        *[f"  {t.template}: {t.count}" for t in rep.per_template],
        "-- candidates per zone --",
        *[f"  {z.template}: {z.count}" for z in rep.per_zone],
    ]
    return "\n".join(lines)
```

- [ ] **Step 4: Run it; verify it passes**

Run: `uv run pytest tests/skrendam/test_analyze.py -v`
Expected: PASS (both tests).

- [ ] **Step 5: Add the `analyze` CLI subcommand**

In `skrendam/cli.py`: add `sub.add_parser("analyze")` alongside the others, and in `main()`:
```python
    elif args.cmd == "analyze":
        from skrendam import analyze
        session = make_sessionmaker()()
        print(analyze.format_report(analyze.analyze(session)))
```

- [ ] **Step 6: Smoke + full suite + mypy**
```bash
uv run skrendam analyze --help            # argparse lists 'analyze'
uv run pytest tests/skrendam/test_analyze.py -q
uv run mypy skrendam
```
Expected: all pass; mypy clean.

- [ ] **Step 7: Commit**
```bash
git add skrendam/analyze.py skrendam/cli.py tests/skrendam/test_analyze.py
git commit -m "feat(skrendam): analyze command — real-data tuning report

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 2: Calibrate C5 fix — scope the zone ceiling to one-way

**Files:**
- Modify: `skrendam/scanning/matching.py:34`
- Test: extend `tests/skrendam/test_matching.py`

- [ ] **Step 1: Write the failing test**

Append to `tests/skrendam/test_matching.py` (mirror the existing fixtures there — a `Zone`, a `DealTemplate`, a `FareItinerary`, a `Baseline`; check the file for the exact helpers and reuse them):
```python
def test_roundtrip_template_ignores_oneway_zone_ceiling():
    from skrendam.scanning.matching import match
    from skrendam.scanning.types import Baseline, FareItinerary
    from skrendam.db import models
    zone = models.Zone(zone="MED", haul_type="short", threshold_price_eur=150.0)
    # round-trip template, no own max_price, no discount bar
    tpl = models.DealTemplate(slug="rt", name="RT", audience_segment_id=1, travel_moment_id=1,
                              trip_type="roundtrip", max_price_eur=None, min_discount_pct=None)
    base = Baseline(minimum=180.0, median=200.0, decile=160.0, sample_size=30)
    # fare €149 is under the €150 one-way zone ceiling but only ~25% below median
    fare = FareItinerary(price=149.0, currency="EUR", stops=0, duration_minutes=240, legs=[])
    # round-trip must NOT pass on the one-way zone ceiling alone
    assert match(fare, tpl, base, zone) is None


def test_oneway_template_still_uses_zone_ceiling():
    from skrendam.scanning.matching import match
    from skrendam.scanning.types import Baseline, FareItinerary
    from skrendam.db import models
    zone = models.Zone(zone="MED", haul_type="short", threshold_price_eur=150.0)
    tpl = models.DealTemplate(slug="ow", name="OW", audience_segment_id=1, travel_moment_id=1,
                              trip_type="oneway", max_price_eur=None, min_discount_pct=None)
    base = Baseline(minimum=180.0, median=200.0, decile=160.0, sample_size=30)
    fare = FareItinerary(price=149.0, currency="EUR", stops=0, duration_minutes=240, legs=[])
    # one-way under the zone ceiling still passes the price-anomaly gate
    assert match(fare, tpl, base, zone) is not None
```
(Confirm `Baseline`/`FareItinerary`/`DealTemplate` constructor args against `skrendam/scanning/types.py` + `models.py`; adjust if the existing test file builds them differently — reuse its helpers.)

- [ ] **Step 2: Run; verify the round-trip test FAILS** (today the round-trip passes on the zone ceiling)

Run: `uv run pytest tests/skrendam/test_matching.py -k "zone_ceiling" -v`
Expected: `test_roundtrip_template_ignores_oneway_zone_ceiling` FAILS (currently returns a MatchResult).

- [ ] **Step 3: Implement the fix** in `skrendam/scanning/matching.py` — replace the `max_price` line (currently `max_price = tpl.max_price_eur if tpl.max_price_eur is not None else zone.threshold_price_eur`) with:
```python
    # C5: the zone ceiling is calibrated from ONE-WAY scans, so only use it as a
    # fallback for one-way templates. Round-trips must clear their own max_price_eur.
    if tpl.trip_type == "oneway":
        max_price = tpl.max_price_eur if tpl.max_price_eur is not None else zone.threshold_price_eur
    else:
        max_price = tpl.max_price_eur
```

- [ ] **Step 4: Run; verify both pass + full matching suite green**
```bash
uv run pytest tests/skrendam/test_matching.py -v
uv run mypy skrendam
```
Expected: both new tests pass; no regressions; mypy clean.

- [ ] **Step 5: Commit**
```bash
git add skrendam/scanning/matching.py tests/skrendam/test_matching.py
git commit -m "fix(skrendam): scope zone price ceiling to one-way (C5)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 3: Tier the queue (derive from match_score)

**Files:**
- Create: `web/src/lib/tiers.ts`, `web/src/lib/tiers.test.ts`
- Modify: `web/src/lib/types.ts`, `web/src/lib/mappers.ts`, `web/src/components/QueueBoard.tsx`, `web/src/components/QueueRow.tsx`
- Test: extend `web/src/lib/mappers.test.ts`

- [ ] **Step 1: Write failing tests** — `web/src/lib/tiers.test.ts`:
```ts
import { expect, test } from 'vitest';
import { tierForScore, GREAT_THRESHOLD } from './tiers';

test('great at/above threshold, maybe below', () => {
  expect(tierForScore(GREAT_THRESHOLD)).toBe('great');
  expect(tierForScore(GREAT_THRESHOLD - 1)).toBe('maybe');
  expect(tierForScore(95)).toBe('great');
  expect(tierForScore(60)).toBe('maybe');
});
```
And extend `web/src/lib/mappers.test.ts` with a case asserting `toCandidateView` sets `tier: 'great'` for a `match_score` of 0.92 and `'maybe'` for 0.6.

- [ ] **Step 2: Run; verify fail**: `cd web && npm test` → FAIL (tiers module missing / no `tier` field).

- [ ] **Step 3: Implement** `web/src/lib/tiers.ts`:
```ts
export const GREAT_THRESHOLD = 80; // match_score on the 0–100 scale; tuned from `skrendam analyze`
export type Tier = 'great' | 'maybe';
export function tierForScore(score: number): Tier {
  return score >= GREAT_THRESHOLD ? 'great' : 'maybe';
}
```
In `web/src/lib/types.ts` add to `CandidateView`: `tier: import('./tiers').Tier;` (or import `Tier` at top and add `tier: Tier;`).
In `web/src/lib/mappers.ts`: import `{ tierForScore }`, compute `const score = Math.round(Number(r.score) * 100);` once, and add `tier: tierForScore(score),` to the returned object (reuse the `score` for the existing `score:` field too).

- [ ] **Step 4: Run; verify pass**: `cd web && npm test` → PASS.

- [ ] **Step 5: Tier the queue UI.** In `QueueBoard.tsx`, within each template group split `items` into `great = items.filter(c => c.tier === 'great')` and `maybe = items.filter(c => c.tier === 'maybe')`; render the **great** rows first under the template heading, then a **"Maybe (N)"** subheading/toggle for the maybe rows (use a `useState` collapse). In `QueueRow.tsx` add a small tier chip (mono, `var(--font-mono)`; great = sea, maybe = sand) next to the score. Keep all existing `curator.css` classes. **Use the `yip-design-system` skill.**

- [ ] **Step 6: Verify + commit**
```bash
cd web && npx tsc --noEmit && npm run lint && npm test && npm run build 2>&1 | tail -6 && cd ..
git add web/src/lib/tiers.ts web/src/lib/tiers.test.ts web/src/lib/types.ts web/src/lib/mappers.ts web/src/lib/mappers.test.ts web/src/components/QueueBoard.tsx web/src/components/QueueRow.tsx
git commit -m "feat(web): tier the queue (great + maybe) derived from match_score

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

# Milestone B — Config editors (edit + soft-disable)

All editors are auth-gated (Server Actions call `requireAdmin()` — mirror `web/src/app/actions.ts`), validate inputs, use **FormData-based** Server Actions (the idiomatic Next `<form action={...}>` CRUD pattern), and `revalidatePath` the relevant config route. **Use the `yip-design-system` skill** for all forms/lists (tokens + `curator.css` classes). Confirm every Drizzle identifier against `web/src/db/generated/schema.ts` before finalizing.

### Task 4: Config data layer — read queries + write actions

**Files:**
- Create: `web/src/lib/config-queries.ts`, `web/src/app/config-actions.ts`

- [ ] **Step 1: `web/src/lib/config-queries.ts`** (list reads):
```ts
import { asc } from 'drizzle-orm';
import { db } from '@/db';
import { dealTemplates, zones, audienceSegments, travelMoments, routes } from '@/db/generated/schema';

export const listTemplates = () => db.select().from(dealTemplates).orderBy(asc(dealTemplates.priority), asc(dealTemplates.name));
export const listZones = () => db.select().from(zones).orderBy(asc(zones.zone));
export const listAudiences = () => db.select().from(audienceSegments).orderBy(asc(audienceSegments.slug));
export const listMoments = () => db.select().from(travelMoments).orderBy(asc(travelMoments.slug));
export const listRoutes = () => db.select().from(routes).orderBy(asc(routes.origin), asc(routes.destination));
```
(Verify `priority`/`zone`/`slug`/`origin` column identifiers in `schema.ts`.)

- [ ] **Step 2: `web/src/app/config-actions.ts`** — `'use server'`, one upsert per entity (FormData) + toggle-enabled for templates/routes. Helpers + a representative action; implement the rest the same way with each entity's columns:
```ts
'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { db } from '@/db';
import { dealTemplates, zones, audienceSegments, travelMoments, routes } from '@/db/generated/schema';

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) redirect('/login');
}
const numOrNull = (v: FormDataEntryValue | null) => {
  const s = (v ?? '').toString().trim();
  return s === '' ? null : Number(s);
};
const strOrNull = (v: FormDataEntryValue | null) => {
  const s = (v ?? '').toString().trim();
  return s === '' ? null : s;
};

// ZONES — threshold_price_eur, min_abs_savings_eur, min_discount_pct, haul_type (PK = zone string)
export async function upsertZone(form: FormData): Promise<void> {
  await requireAdmin();
  const zone = (form.get('zone') ?? '').toString().trim();
  if (!zone) throw new Error('zone is required');
  const values = {
    haulType: (form.get('haul_type') ?? 'short').toString(),
    thresholdPriceEur: numOrNull(form.get('threshold_price_eur')),
    minAbsSavingsEur: numOrNull(form.get('min_abs_savings_eur')),
    minDiscountPct: numOrNull(form.get('min_discount_pct')),
  };
  const updated = await db.update(zones).set(values).where(eq(zones.zone, zone)).returning({ z: zones.zone });
  if (updated.length === 0) await db.insert(zones).values({ zone, ...values });
  revalidatePath('/config/zones');
}

// ROUTES — origin, destination, zone, cabin, enabled (soft-disable). id autoincrement.
export async function upsertRoute(form: FormData): Promise<void> {
  await requireAdmin();
  const id = numOrNull(form.get('id'));
  const values = {
    origin: (form.get('origin') ?? '').toString().trim().toUpperCase(),
    destination: (form.get('destination') ?? '').toString().trim().toUpperCase(),
    zone: (form.get('zone') ?? '').toString().trim(),
    cabin: (form.get('cabin') ?? 'ECONOMY').toString(),
  };
  if (!values.origin || !values.destination || !values.zone) throw new Error('origin, destination, zone required');
  if (id !== null) await db.update(routes).set(values).where(eq(routes.id, id));
  else await db.insert(routes).values({ ...values, enabled: true });
  revalidatePath('/config/routes');
}
export async function toggleRouteEnabled(form: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(form.get('id'));
  const enabled = form.get('enabled') === 'true';
  await db.update(routes).set({ enabled: !enabled }).where(eq(routes.id, id));
  revalidatePath('/config/routes');
}
export async function toggleTemplateEnabled(form: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(form.get('id'));
  const enabled = form.get('enabled') === 'true';
  await db.update(dealTemplates).set({ enabled: !enabled }).where(eq(dealTemplates.id, id));
  revalidatePath('/config/templates');
}

// AUDIENCES — slug, name, description, default_itinerary_tolerance
export async function upsertAudience(form: FormData): Promise<void> {
  await requireAdmin();
  const id = numOrNull(form.get('id'));
  const values = {
    slug: (form.get('slug') ?? '').toString().trim(),
    name: (form.get('name') ?? '').toString().trim(),
    description: strOrNull(form.get('description')),
    defaultItineraryTolerance: (form.get('default_itinerary_tolerance') ?? 'normal').toString(),
  };
  if (!values.slug || !values.name) throw new Error('slug + name required');
  if (id !== null) await db.update(audienceSegments).set(values).where(eq(audienceSegments.id, id));
  else await db.insert(audienceSegments).values(values);
  revalidatePath('/config/audiences');
}

// MOMENTS — slug, name, description, moment_type, default_content_angle
export async function upsertMoment(form: FormData): Promise<void> {
  await requireAdmin();
  const id = numOrNull(form.get('id'));
  const values = {
    slug: (form.get('slug') ?? '').toString().trim(),
    name: (form.get('name') ?? '').toString().trim(),
    description: strOrNull(form.get('description')),
    momentType: (form.get('moment_type') ?? 'relative').toString(),
    defaultContentAngle: strOrNull(form.get('default_content_angle')),
  };
  if (!values.slug || !values.name) throw new Error('slug + name required');
  if (id !== null) await db.update(travelMoments).set(values).where(eq(travelMoments.id, id));
  else await db.insert(travelMoments).values(values);
  revalidatePath('/config/moments');
}

// TEMPLATES — the editorial editor (Task 6). Many fields; parse the editorial groups.
export async function upsertDealTemplate(form: FormData): Promise<void> {
  await requireAdmin();
  const id = numOrNull(form.get('id'));
  const values = {
    slug: (form.get('slug') ?? '').toString().trim(),
    name: (form.get('name') ?? '').toString().trim(),
    audienceSegmentId: Number(form.get('audience_segment_id')),
    travelMomentId: Number(form.get('travel_moment_id')),
    tripType: (form.get('trip_type') ?? 'roundtrip').toString(),
    priority: numOrNull(form.get('priority')) ?? 0,
    publicLabel: strOrNull(form.get('public_label')),
    newsletterTag: strOrNull(form.get('newsletter_tag')),
    // "what's cheap" — the tuning knobs
    maxPriceEur: numOrNull(form.get('max_price_eur')),
    minDiscountPct: numOrNull(form.get('min_discount_pct')),
    psychologicalPriceThresholdEur: numOrNull(form.get('psychological_price_threshold_eur')),
    minAbsSavingsEur: numOrNull(form.get('min_abs_savings_eur')),
    // "itinerary pain"
    maxStops: numOrNull(form.get('max_stops')),
    maxTotalDurationMinutes: numOrNull(form.get('max_total_duration_minutes')),
    // "content angle"
    contentAngle: strOrNull(form.get('content_angle')),
    suggestedHeadlineTemplate: strOrNull(form.get('suggested_headline_template')),
    tiktokHookTemplate: strOrNull(form.get('tiktok_hook_template')),
  };
  if (!values.slug || !values.name) throw new Error('slug + name required');
  if (id !== null) await db.update(dealTemplates).set(values).where(eq(dealTemplates.id, id));
  else await db.insert(dealTemplates).values(values);
  revalidatePath('/config/templates');
}
```
(Confirm every camelCase column against `schema.ts`. NOT-NULL columns without DB defaults — e.g. `dealTemplates` boolean/enabled — may need an explicit value on insert; check the generated types and add defaults as the publish action does.)

- [ ] **Step 3: Typecheck + commit**
```bash
cd web && npx tsc --noEmit && cd ..
git add web/src/lib/config-queries.ts web/src/app/config-actions.ts
git commit -m "feat(web): config data layer — list queries + upsert/toggle actions

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 5: Config index + sidebar wiring + the Zones editor (establishes the pattern)

**Files:**
- Create: `web/src/components/ConfigShell.tsx`, `web/src/app/(app)/config/page.tsx`, `web/src/app/(app)/config/zones/page.tsx`, `web/src/app/(app)/config/zones/ZoneForm.tsx`
- Modify: `web/src/components/Sidebar.tsx`

- [ ] **Step 1: Sidebar wiring.** In `Sidebar.tsx`, point the config items at real routes (they're currently `href: null`): `Templates → /config/templates`, `Audience → /config/audiences`, `Settings → /config` (config index). Add nav items for `Zones → /config/zones`, `Moments → /config/moments`, `Routes → /config/routes` (icons from lucide-react, e.g. `Map`, `CalendarDays`, `Plane`). Keep the `.navi`/`.on` active styling + `usePathname` (use `pathname.startsWith(href)` for the config subroutes so child pages stay highlighted).

- [ ] **Step 2: `ConfigShell.tsx`** — a small presentational wrapper: a page heading (`var(--font-display)`) + a list container styled with `curator.css` tokens (reuse `.card`/`.topbar`-style classes). Props `{ title: string; children: React.ReactNode }`.

- [ ] **Step 3: `config/page.tsx`** — a config index (server component) linking to the 5 editors with a one-line description each (uses `ConfigShell`).

- [ ] **Step 4: `config/zones/page.tsx`** (server component) — `const rows = await listZones();` then render `ConfigShell` + a `<ZoneForm>` per row (edit) + one empty `<ZoneForm>` (create). Zones have no `enabled` column → edit + create only (no disable).

- [ ] **Step 5: `config/zones/ZoneForm.tsx`** (`'use client'`) — a `<form action={upsertZone}>` (import from `@/app/config-actions`) with a hidden `zone` (readonly when editing the PK) + number inputs `threshold_price_eur`, `min_abs_savings_eur`, `min_discount_pct` + a `haul_type` select (short/medium/long), styled with `.draftbox`/`.btn`. Use `useTransition` + a saved/error toast (mirror `CopyDrafter`'s pattern, incl. the `try/catch` error toast). A small note: "Used as the one-way price ceiling for routes in this zone."

- [ ] **Step 6: Verify the zones editor end-to-end** — `cd web && npx tsc --noEmit && npm run lint && npm run build 2>&1 | tail -8 && cd ..` (build includes `/config` + `/config/zones`). With the dev server, edit a zone's `threshold_price_eur`, confirm it persists (reload).

- [ ] **Step 7: Commit**
```bash
git add web/src/components/Sidebar.tsx web/src/components/ConfigShell.tsx web/src/app/\(app\)/config/page.tsx web/src/app/\(app\)/config/zones
git commit -m "feat(web): config index + sidebar wiring + zones editor

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 6: Deal Templates editor (the editorial one)

**Files:**
- Create: `web/src/app/(app)/config/templates/page.tsx`, `web/src/app/(app)/config/templates/TemplateForm.tsx`

- [ ] **Step 1: `config/templates/page.tsx`** (server component) — `const [tmpls, auds, moments] = await Promise.all([listTemplates(), listAudiences(), listMoments()]);` render `ConfigShell` + a list of templates (name · audience · moment · trip_type · enabled toggle via a `<form action={toggleTemplateEnabled}>` mini-form) + an expandable `<TemplateForm>` per template (edit) + a create `<TemplateForm>`. Pass `auds`/`moments` for the select options.

- [ ] **Step 2: `config/templates/TemplateForm.tsx`** (`'use client'`) — a `<form action={upsertDealTemplate}>` grouped into the **editorial sections** (each a labelled fieldset, mono section eyebrow):
  - *Identity*: slug, name, priority, trip_type (oneway/roundtrip), public_label, newsletter_tag.
  - *Who*: audience_segment_id (select from `auds`).
  - *When*: travel_moment_id (select from `moments`). (Date-window fields — relative/seasonal/fixed — are a documented follow-up; out of scope for this form unless trivially added as raw inputs.)
  - **What's cheap (tuning knobs)**: max_price_eur, min_discount_pct, psychological_price_threshold_eur, min_abs_savings_eur.
  - *Itinerary pain*: max_stops, max_total_duration_minutes.
  - *Content angle*: content_angle, suggested_headline_template, tiktok_hook_template.
  Hidden `id` when editing. `useTransition` + save/error toast. Number inputs for the numeric knobs; selects for audience/moment/trip_type. Style with `curator.css` (`.draftbox`, `.btn`, `.sec` eyebrows).

- [ ] **Step 3: Verify + commit**
```bash
cd web && npx tsc --noEmit && npm run lint && npm run build 2>&1 | tail -6 && cd ..
git add web/src/app/\(app\)/config/templates
git commit -m "feat(web): deal-templates editorial editor (the tuning cockpit)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 7: Audiences, Moments, Routes editors

**Files:**
- Create: `config/audiences/{page.tsx,AudienceForm.tsx}`, `config/moments/{page.tsx,MomentForm.tsx}`, `config/routes/{page.tsx,RouteForm.tsx}`

- [ ] **Step 1: Audiences** — `page.tsx` lists `listAudiences()` + a `<AudienceForm>` (action `upsertAudience`) per row + create. Fields: slug, name, description (textarea), default_itinerary_tolerance (select: strict/normal/relaxed). No disable (no `enabled` column).

- [ ] **Step 2: Moments** — `page.tsx` lists `listMoments()` + `<MomentForm>` (action `upsertMoment`). Fields: slug, name, description, moment_type (select: relative/seasonal/fixed_dates), default_content_angle (textarea). No disable.

- [ ] **Step 3: Routes** — `page.tsx` lists `listRoutes()` + `<RouteForm>` (action `upsertRoute`) per row + create + an enable/disable mini-form (`toggleRouteEnabled`). Fields: origin, destination, zone (select from `listZones()`), cabin (select). Routes have `enabled` → soft-disable.

  Each form mirrors `ZoneForm`'s pattern (`'use client'`, `<form action={...}>`, `useTransition`, save/error toast, `curator.css` styling).

- [ ] **Step 4: Verify + commit**
```bash
cd web && npx tsc --noEmit && npm run lint && npm run build 2>&1 | tail -8 && cd ..
git add web/src/app/\(app\)/config/audiences web/src/app/\(app\)/config/moments web/src/app/\(app\)/config/routes
git commit -m "feat(web): audiences, moments, routes config editors

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

# Milestone C — QA + tune

### Task 8: QA gauntlet for this milestone

- [ ] **Step 1: Types + lint + unit tests (web) + engine**
```bash
cd web && npx tsc --noEmit && npm run lint && npm test && cd ..
uv run pytest tests/skrendam -q
uv run mypy skrendam
```
Expected: all green (new `analyze`, matching C5, tiers + mapper tests pass).

- [ ] **Step 2: Playwright — config edit journey.** Create `web/e2e/config.spec.ts`: login → go to `/config/zones` → change a zone's `threshold_price_eur` → submit → reload → assert the new value is shown. (Reuse the login helper pattern from `journey.spec.ts`; `reuseExistingServer`.) Run `cd web && npx playwright test e2e/config.spec.ts`.

- [ ] **Step 3: `/code-review high` + `security-review`** on the branch diff (new Server Actions = new mutation surface — confirm each config action calls `requireAdmin()` + validates). Process via `superpowers:receiving-code-review`. Fix real findings.

- [ ] **Step 4: Commit any fixes.**

### Task 9: Tuning pass (judgment-driven — run the analysis, set the values)

This is calibration, not TDD — it uses Task 1's report + your gut-check.

- [ ] **Step 1: Run the analysis** against the dev DB:
```bash
SKRENDAM_DATABASE_URL='<neon dev url>' uv run skrendam analyze
```
Read the discount percentiles, per-template/zone volume, and the tier preview.

- [ ] **Step 2: Re-calibrate zone ceilings** (now one-way-correct): `SKRENDAM_DATABASE_URL='<neon dev>' uv run skrendam calibrate` (live; paced). Inspect `zones.threshold_price_eur` after.

- [ ] **Step 3: Set thresholds from the data.** Based on the report + your judgment of the current candidates: adjust `GREAT_THRESHOLD` (`web/src/lib/tiers.ts`) so the "great" tier is the size you want, adjust `SEND_THRESHOLD` (`skrendam/scanning/matching.py`) if the maybe tier is too noisy/sparse, and tune per-template/zone knobs (`max_price_eur`, `min_discount_pct`, etc.) **via the new config editors**. Re-scan (`skrendam run-scan`) or rely on the next scheduled scan; re-open the tiered queue and confirm it matches your sense of "great vs maybe."

- [ ] **Step 4: Commit** any constant changes; record the tuning rationale in `docs/research/2026-06-03-tuning-analysis.md`.

- [ ] **Step 5: Finish the branch** — use `superpowers:finishing-a-development-branch` (PR `feat/engine-tuning-config-editors` → `main`).

---

## Self-review (run against the spec)

**Spec coverage:**

| Spec section | Task |
|---|---|
| A1 data-analysis pass | Task 1 (`skrendam analyze`) ✅ |
| A2 calibrate C5 (one-way ceiling) | Task 2 ✅ |
| A3 tier the queue (derive from score) | Task 3 ✅ |
| B config data layer | Task 4 ✅ |
| B zones editor | Task 5 ✅ |
| B deal-templates editor | Task 6 ✅ |
| B audiences/moments/routes editors | Task 7 ✅ |
| Soft-disable (templates/routes) / edit-only (ref tables) | Tasks 4–7 ✅ |
| Testing (analyze, matching, tiers, config actions, Playwright) | Tasks 1–3, 8 ✅ |
| Tune + iterate | Task 9 ✅ |
| No migration | ✅ (tiers derived, ceiling scoped, soft-disable via existing flags) |

**Placeholder scan:** code given for every step; editors share the `ZoneForm`/`upsert*` pattern with each entity's specific fields shown (not "similar to"). The one judgment-driven task (9) is explicitly calibration, not code. Repeated verification note: confirm Drizzle camelCase identifiers against `schema.ts` (flagged in Tasks 4/5/6/7).

**Type consistency:** `tier`/`Tier` consistent across `tiers.ts` → `types.ts` → `mappers.ts` → `QueueBoard`. Action names consistent: `upsertZone/upsertRoute/upsertAudience/upsertMoment/upsertDealTemplate`, `toggleRouteEnabled/toggleTemplateEnabled`. Query names: `listTemplates/listZones/listAudiences/listMoments/listRoutes`.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-03-engine-tuning-config-editors.md`. Two execution options:

**1. Subagent-Driven (recommended)** — fresh subagent per task + two-stage review. REQUIRED SUB-SKILL: `superpowers:subagent-driven-development`.

**2. Inline Execution** — checkpoints in this session. REQUIRED SUB-SKILL: `superpowers:executing-plans`.
