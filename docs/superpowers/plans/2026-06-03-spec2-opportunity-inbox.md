# Yip public site v1 — the opportunity inbox · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the public Yip homepage as a decision-support "opportunity inbox" — a separate, read-only Next.js app that turns the engine's published deals into scannable browse cards and full decision/detail pages, proving the copilot.

**Architecture:** A new `site/` Next.js 16 app (mirrors `web/`'s setup) reads Neon **read-only** (`published_deals`, `price_log`, `routes`, `candidate_template_matches`) via Drizzle introspection. It never calls `fli`/the engine and never writes engine-domain tables (its only write is its own `subscribers` table). One small engine change adds an **observed-only** `going_fast` signal + freshness to published deals on recheck. All on-page claims derive from existing data (`price_log` for the comparison, `last_seen_at` for freshness).

**Tech Stack:** Next.js 16.2.7 (App Router, SSR/ISR), React 19, Drizzle ORM 0.45.2 + `@neondatabase/serverless` (neon-http), Neon Postgres, Vitest 4, Playwright; Python deal engine + Alembic for the one migration. Yip design system tokens.

**Spec:** `docs/superpowers/specs/2026-06-03-spec2-opportunity-inbox-design.md`. **Approved mockups** (visual source of truth) live under `.superpowers/brainstorm/20008-1780501486/content/` (`homepage-v1.html`, `cards-two-tier.html`, `deal-detail-v2.html`); Task 4 copies them into the repo.

---

## File Structure

**Engine (one migration + recheck signal):**
- Modify `skrendam/db/models.py` — add `going_fast` to `PublishedDeal`.
- Create `alembic/versions/0003_published_deal_going_fast.py` — add the column.
- Modify `skrendam/verification.py` — on recheck, update the candidate's live published deals (freshness + observed `going_fast` + expire-if-gone).
- Create `alembic/versions/0004_subscribers.py` + `skrendam/db/models.py` `Subscriber` — the capture table (Task 9).
- Test `tests/skrendam/test_verification_published.py`.

**New app `site/` (one responsibility per file):**
- Config: `site/package.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `drizzle.config.ts`, `vitest.config.ts`, `playwright.config.ts`, `.env.example`.
- DB: `site/src/db/index.ts` (read client) + `site/src/db/generated/{schema,relations}.ts` (drizzle-kit pull).
- Styles: `site/src/styles/{colors_and_type,logo,site}.css`, `site/src/app/globals.css`.
- Libs (pure, unit-tested): `site/src/lib/{airports,format,quality,booking,priceContext,types}.ts`.
- Data layer: `site/src/lib/{queries,mappers}.ts`.
- App: `site/src/app/{layout,page}.tsx`, `site/src/app/deal/[id]/page.tsx`, `site/src/app/subscribe-action.ts`.
- Components: `site/src/components/{Header,Hero,Tabs,BrowseCard,QualityTag,StatusLine,CaptureBand,DealDetail,PriceSparkline,Itinerary,BookingCta}.tsx`.
- Reference: `site/design-reference/*.html` (copied mockups).
- E2E: `site/e2e/{homepage,deal-detail}.spec.ts`.

---

## Task 1: Engine — `going_fast` + observed recheck signals on published deals

**Files:**
- Modify: `skrendam/db/models.py` (PublishedDeal)
- Create: `alembic/versions/0003_published_deal_going_fast.py`
- Modify: `skrendam/verification.py`
- Test: `tests/skrendam/test_verification_published.py`

Rationale: the public "Checked Nh ago" / "Going fast" / "Gone" signals must be live. The recheck path updates the *candidate*; we extend it to also update that candidate's **live published deals** with freshness + an **observed-only** urgency flag. `going_fast` is true only when a recheck sees the price rise materially; unavailability expires the deal.

- [ ] **Step 1: Write the failing test**

```python
# tests/skrendam/test_verification_published.py
from datetime import date, datetime
from skrendam.db import models
from skrendam.fli_adapter.adapter import FliAdapter
from skrendam.verification import recheck_candidate


def _seed(session, price=96.0):
    session.add(models.Route(id=1, origin="VNO", destination="BCN", zone="MED"))
    cand = models.Candidate(id=1, route_id=1, origin="VNO", destination="BCN", zone="MED",
                            trip_type="oneway", travel_date=date(2026, 9, 12), price=price,
                            deal_group_key="k", first_seen_at=datetime(2026, 6, 2),
                            last_seen_at=datetime(2026, 6, 2))
    session.add(cand)
    session.add(models.PublishedDeal(id=1, candidate_id=1, deal_template_id=1, headline="h",
                                     origin="VNO", destination="BCN", trip_type="oneway",
                                     price=price, status="live", tier="free",
                                     published_at=datetime(2026, 6, 2)))
    session.commit()
    return cand


class _Backend:
    def __init__(self, fares): self._fares = fares
    def search_flights(self, *a, **k): return self._fares


def _fare(price):
    return [{"price": price, "currency": "EUR", "stops": 0, "duration": 200,
             "legs": [{"airline": {"code": "BT"}}], "booking_url": "https://x"}]


def test_recheck_marks_going_fast_when_price_rises(session):
    cand = _seed(session, price=96.0)
    adapter = FliAdapter(_Backend(_fare(120.0)), pace=lambda: None)  # +25%
    recheck_candidate(session, cand, adapter, now=datetime(2026, 6, 3))
    pd = session.get(models.PublishedDeal, 1)
    assert pd.going_fast is True
    assert pd.status == "live"
    assert pd.last_seen_at == datetime(2026, 6, 3)


def test_recheck_no_flag_when_stable(session):
    cand = _seed(session, price=96.0)
    adapter = FliAdapter(_Backend(_fare(98.0)), pace=lambda: None)  # +2%, under threshold
    recheck_candidate(session, cand, adapter, now=datetime(2026, 6, 3))
    pd = session.get(models.PublishedDeal, 1)
    assert pd.going_fast is False and pd.status == "live"


def test_recheck_expires_when_gone(session):
    cand = _seed(session, price=96.0)
    adapter = FliAdapter(_Backend([]), pace=lambda: None)  # no fares
    recheck_candidate(session, cand, adapter, now=datetime(2026, 6, 3))
    pd = session.get(models.PublishedDeal, 1)
    assert pd.status == "expired"
```

- [ ] **Step 2: Run to verify it fails**

Run: `uv run pytest tests/skrendam/test_verification_published.py -q`
Expected: FAIL — `PublishedDeal` has no `going_fast` attribute.

- [ ] **Step 3: Add the model column**

In `skrendam/db/models.py`, in `class PublishedDeal`, after the `status` line add:

```python
    going_fast: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
```

Ensure `Boolean` is imported at the top (`from sqlalchemy import ... Boolean`). If not present, add it.

- [ ] **Step 4: Write the Alembic migration**

```python
# alembic/versions/0003_published_deal_going_fast.py
"""add going_fast to published_deals

Revision ID: a3f10c2b77e1
Revises: e2f66796e0e9
Create Date: 2026-06-03 16:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'a3f10c2b77e1'
down_revision: Union[str, Sequence[str], None] = 'e2f66796e0e9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('published_deals',
                  sa.Column('going_fast', sa.Boolean(), nullable=False, server_default='false'))


def downgrade() -> None:
    op.drop_column('published_deals', 'going_fast')
```

- [ ] **Step 5: Extend recheck to update live published deals**

In `skrendam/verification.py`, add a module-level constant + helper, and call it from `recheck_candidate` right after the candidate fields are set (after `candidate.last_seen_at = now`):

```python
GOING_FAST_RISE = 0.05  # a recheck price >= published price * (1 + this) is an observed "going fast"


def _update_published_for_candidate(session, candidate_id, available, price, now):
    """Propagate a recheck result to the candidate's LIVE published deals (public signals)."""
    deals = session.scalars(
        select(models.PublishedDeal).where(
            models.PublishedDeal.candidate_id == candidate_id,
            models.PublishedDeal.status == "live"))
    for pd in deals:
        if not available:
            pd.status = "expired"
            continue
        pd.last_seen_at = now
        if price is not None:
            pd.going_fast = price >= pd.price * (1 + GOING_FAST_RISE)
```

Add `from sqlalchemy import select` if not already imported. Then in `recheck_candidate`, after the `if available and price is not None:` block that sets candidate fields, add (unconditionally, so an unavailable fare expires the deal):

```python
    _update_published_for_candidate(session, candidate.id, available, price, now)
```

(Place it before `session.commit()`.)

- [ ] **Step 6: Run tests to verify pass + apply migration on the dev branch**

Run: `uv run pytest tests/skrendam/test_verification_published.py -q`
Expected: PASS (3 passed).

Apply the migration to the Neon **dev** branch (read the URL from `web/.env.local` `DATABASE_URL_UNPOOLED`, normalise `postgres://`→`postgresql://`, unescape `\$`):
```bash
export SKRENDAM_DATABASE_URL=<dev unpooled url>   # confirm host contains ep-spring-rice-ag3lozh6
uv run alembic upgrade head
```
Expected: `Running upgrade e2f66796e0e9 -> a3f10c2b77e1`.

- [ ] **Step 7: Verify engine suite + commit**

Run: `uv run pytest tests/skrendam -q` (expected: all pass) and `uv run mypy skrendam` (expected: clean).
```bash
git add skrendam/db/models.py alembic/versions/0003_published_deal_going_fast.py skrendam/verification.py tests/skrendam/test_verification_published.py
git commit -m "feat(skrendam): going_fast + freshness on published_deals via recheck (observed-only)"
```

---

## Task 2: Scaffold the `site/` app

**Files:** Create `site/package.json`, `site/tsconfig.json`, `site/next.config.ts`, `site/eslint.config.mjs`, `site/drizzle.config.ts`, `site/vitest.config.ts`, `site/playwright.config.ts`, `site/.env.example`; modify root `.gitignore`.

- [ ] **Step 1: package.json** (read-only public app — no auth/bcrypt; keep zod for capture validation, lucide-react for icons)

```json
{
  "name": "site",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev -p 3001",
    "build": "next build",
    "start": "next start -p 3001",
    "lint": "eslint",
    "test": "vitest run",
    "db:pull": "drizzle-kit pull"
  },
  "dependencies": {
    "@neondatabase/serverless": "^1.1.0",
    "drizzle-orm": "^0.45.2",
    "lucide-react": "^1.17.0",
    "next": "^16.2.7",
    "react": "^19.2.7",
    "react-dom": "^19.2.7",
    "zod": "^4.4.3"
  },
  "devDependencies": {
    "@playwright/test": "^1.60.0",
    "@types/node": "^20.19.41",
    "@types/react": "^19.2.16",
    "@types/react-dom": "^19.2.3",
    "drizzle-kit": "^0.31.10",
    "eslint": "^9",
    "eslint-config-next": "16.2.7",
    "typescript": "^6.0.3",
    "vitest": "^4.1.8"
  }
}
```

- [ ] **Step 2: Mirror config files** — copy `web/tsconfig.json`, `web/next.config.ts`, `web/eslint.config.mjs`, `web/vitest.config.ts` verbatim into `site/` (identical contents; the `@/*`→`./src/*` alias, turbopack root, etc. all apply unchanged).

`site/drizzle.config.ts` (identical to web's):
```typescript
import { defineConfig } from 'drizzle-kit';
export default defineConfig({
  dialect: 'postgresql',
  out: './src/db/generated',
  dbCredentials: { url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL! },
  schemaFilter: ['public'],
});
```

`site/playwright.config.ts` (port 3001 so it can run alongside the admin):
```typescript
import { defineConfig } from '@playwright/test';
import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());
export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://localhost:3001' },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3001',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

`site/.env.example`:
```
# Neon dev branch — READ access for published_deals/price_log/routes; the only WRITE is subscribers.
DATABASE_URL=postgresql://USER:PASS@HOST/neondb?sslmode=require
DATABASE_URL_UNPOOLED=postgresql://USER:PASS@DIRECT_HOST/neondb?sslmode=require
```

- [ ] **Step 3: gitignore** — In root `.gitignore`, mirror the `web/` block for `site/`:
```
# Next.js public site (site/)
site/node_modules/
site/.next/
site/out/
site/.env*.local
site/playwright-report/
site/test-results/
!site/src/lib/
!site/src/lib/**
```

- [ ] **Step 4: Install + verify**
```bash
cd site && npm install
cp .env.example .env.local   # then fill DATABASE_URL(_UNPOOLED) from the dev branch (single-quote/escape $ if present)
```
Create a placeholder `site/src/app/layout.tsx` + `site/src/app/page.tsx` (minimal) so build passes:
```tsx
// site/src/app/layout.tsx
export const metadata = { title: 'Yip' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en"><body>{children}</body></html>);
}
```
```tsx
// site/src/app/page.tsx
export default function Home() { return <main>Yip</main>; }
```
Run: `cd site && npm run lint && npm run build`
Expected: lint clean; build succeeds.

- [ ] **Step 5: Commit**
```bash
git add site/package.json site/package-lock.json site/tsconfig.json site/next.config.ts site/eslint.config.mjs site/drizzle.config.ts site/vitest.config.ts site/playwright.config.ts site/.env.example site/src/app/layout.tsx site/src/app/page.tsx .gitignore
git commit -m "chore(site): scaffold read-only public Next.js app (port 3001)"
```

---

## Task 3: Read-only DB client + introspected schema

**Files:** Create `site/src/db/index.ts`, `site/src/db/generated/{schema,relations}.ts`.

- [ ] **Step 1: Pull the schema** (Task 1's migration must be applied first, so `going_fast` is included)
```bash
cd site && node --env-file=.env.local node_modules/.bin/drizzle-kit pull
```
Expected: writes `src/db/generated/schema.ts` + `relations.ts`. Confirm `publishedDeals` includes `goingFast: boolean("going_fast")`.

- [ ] **Step 2: DB client** (read client; mirrors web's)
```typescript
// site/src/db/index.ts
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './generated/schema';
import * as relations from './generated/relations';

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle({ client: sql, schema: { ...schema, ...relations } });
export * from './generated/schema';
```

- [ ] **Step 3: Verify typecheck + commit**

Run: `cd site && npx tsc --noEmit` (expected: clean).
```bash
git add site/src/db
git commit -m "feat(site): read-only neon-http drizzle client + introspected schema"
```

---

## Task 4: Design tokens, base layout, mockup reference

**Files:** Create `site/src/styles/{colors_and_type,logo,site}.css`, `site/src/app/globals.css`, update `site/src/app/layout.tsx`; copy mockups to `site/design-reference/`.

- [ ] **Step 1: Copy tokens + the approved mockups**
```bash
cp web/src/styles/colors_and_type.css site/src/styles/colors_and_type.css
cp web/src/styles/logo.css site/src/styles/logo.css
mkdir -p site/design-reference
cp .superpowers/brainstorm/20008-1780501486/content/homepage-v1.html site/design-reference/homepage.html
cp .superpowers/brainstorm/20008-1780501486/content/cards-two-tier.html site/design-reference/cards.html
cp .superpowers/brainstorm/20008-1780501486/content/deal-detail-v2.html site/design-reference/deal-detail.html
```
These three HTML files are the **exact visual source of truth** for the components in Tasks 7–8 (Yip styling, copy, layout). Build components to match them.

- [ ] **Step 2: site.css** — create `site/src/styles/site.css` and lift the component CSS from the mockups (the `.bc`, `.dc`, `.spark`, `.flag-*`, `.tag-*`, `.cap`, etc. rules in `homepage.html` + `deal-detail.html`), scoped under a `.yip-site` root. (Copy the `<style>` blocks from the mockups; they already use the Yip tokens.)

- [ ] **Step 3: globals.css + layout**
```css
/* site/src/app/globals.css */
@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=Hanken+Grotesk:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap');
@import '../styles/colors_and_type.css';
@import '../styles/logo.css';
@import '../styles/site.css';
body { background: var(--bg-page); color: var(--fg-1); font-family: var(--font-body); margin: 0; }
```
```tsx
// site/src/app/layout.tsx
import './globals.css';
export const metadata = {
  title: 'Yip — cheap flights from the Baltics, found and checked by hand',
  description: 'We find the best cheap flights from Vilnius, Kaunas, Riga and nearby — and tell you why each is good, and the catch.',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en"><body><div className="yip-site">{children}</div></body></html>);
}
```

- [ ] **Step 4: Verify + commit**

Run: `cd site && npm run build` (expected: succeeds).
```bash
git add site/src/styles site/src/app/globals.css site/src/app/layout.tsx site/design-reference
git commit -m "feat(site): yip tokens + base layout + approved design references"
```

---

## Task 5: Pure libs — airports, format, quality, booking, priceContext, types

**Files:** Create `site/src/lib/{airports,format,quality,booking,priceContext,types}.ts` + co-located `*.test.ts`.

- [ ] **Step 1: Reuse airports + format** — copy `web/src/lib/airports.ts` and `web/src/lib/format.ts` verbatim into `site/src/lib/`. (Used for `city()`/`country()` and `formatDates()`/`timeAgo()`.)

- [ ] **Step 2: quality.ts — write the failing test**
```typescript
// site/src/lib/quality.test.ts
import { expect, test } from 'vitest';
import { qualityTag, RARE_THRESHOLD, GREAT_THRESHOLD } from './quality';
test('bands', () => {
  expect(qualityTag(RARE_THRESHOLD)).toBe('rare');   // 94
  expect(qualityTag(GREAT_THRESHOLD)).toBe('great'); // 88
  expect(qualityTag(GREAT_THRESHOLD - 1)).toBeNull();
  expect(qualityTag(100)).toBe('rare');
});
```
- [ ] **Step 3: quality.ts — implement**
```typescript
// site/src/lib/quality.ts
// match_score on the 0–100 scale. Mirrors web/src/lib/tiers.ts (GREAT_THRESHOLD=88, engine analyze 0.88).
export const GREAT_THRESHOLD = 88;
export const RARE_THRESHOLD = 94; // top band — "rare deal"
export type QualityTag = 'rare' | 'great';
export function qualityTag(score: number): QualityTag | null {
  if (score >= RARE_THRESHOLD) return 'rare';
  if (score >= GREAT_THRESHOLD) return 'great';
  return null;
}
```
- [ ] **Step 4: Run** `cd site && npx vitest run src/lib/quality.test.ts` → PASS.

- [ ] **Step 5: booking.ts — write the failing test**
```typescript
// site/src/lib/booking.test.ts
import { expect, test } from 'vitest';
import { bookingCta } from './booking';
test('google fallback (v1 default — stored tfs link)', () => {
  const c = bookingCta('https://www.google.com/travel/flights?tfs=ABC');
  expect(c.kind).toBe('google');
  expect(c.button).toBe('Open in Google Flights');
});
test('airline-direct upgrade (fast-follow data)', () => {
  const c = bookingCta('https://airbaltic.com/x', 'airBaltic', 'airline');
  expect(c.button).toBe('Book with airBaltic');
  expect(c.sub).toMatch(/Airline-direct/);
});
test('ota', () => {
  expect(bookingCta('https://ota/x', null, 'ota').button).toBe('Open booking partner');
});
```
- [ ] **Step 6: booking.ts — implement** (built for all 3 variants; v1 data feeds only `google`)
```typescript
// site/src/lib/booking.ts
export type BookingKind = 'airline' | 'ota' | 'google';
export interface BookingCta { kind: BookingKind; button: string; sub: string; url: string; }
// v1: published_deals stores the Google Flights tfs deep link → 'google'. The 'airline'/'ota'
// variants need engine vendor-resolution (get_booking_options) — a flagged fast-follow.
export function bookingCta(bookingUrl: string | null, vendor: string | null = null,
                           kind: BookingKind = 'google'): BookingCta {
  const url = bookingUrl ?? 'https://www.google.com/travel/flights';
  if (kind === 'airline' && vendor)
    return { kind, button: `Book with ${vendor}`, sub: 'Airline-direct · live price shown there', url };
  if (kind === 'ota')
    return { kind, button: 'Open booking partner', sub: 'Live price shown before you pay', url };
  return { kind: 'google', button: 'Open in Google Flights', sub: 'Use this to check live availability & book', url };
}
```

- [ ] **Step 7: Run** `cd site && npx vitest run src/lib/booking.test.ts` → PASS.

- [ ] **Step 8: priceContext.ts — write the failing test for the pure stats helper**
```typescript
// site/src/lib/priceContext.test.ts
import { expect, test } from 'vitest';
import { priceStats } from './priceContext';
test('thin history → no claim', () => {
  expect(priceStats([100, 110], 96).hasHistory).toBe(false);
});
test('full history → percentile + range', () => {
  const prices = Array.from({ length: 20 }, (_, i) => 90 + i * 10); // 90..280
  const s = priceStats(prices, 96);
  expect(s.hasHistory).toBe(true);
  expect(s.low).toBe(90); expect(s.high).toBe(280);
  expect(s.percentile).toBeLessThanOrEqual(10); // 96 is near the bottom
});
```
- [ ] **Step 9: priceContext.ts — implement** (pure `priceStats` + DB-backed `priceContext`)
```typescript
// site/src/lib/priceContext.ts
import { and, asc, eq, gte } from 'drizzle-orm';
import { db } from '@/db';
import { priceLog, routes } from '@/db/generated/schema';

export interface PriceStats { hasHistory: boolean; low: number; median: number; high: number; percentile: number | null; series: number[]; }
const MIN_SAMPLES = 14;
const WINDOW_DAYS = 90;

export function priceStats(prices: number[], dealPrice: number): PriceStats {
  const clean = prices.filter((p) => p > 0);
  if (clean.length < MIN_SAMPLES)
    return { hasHistory: false, low: dealPrice, median: dealPrice, high: dealPrice, percentile: null, series: clean };
  const sorted = [...clean].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const belowOrEqual = sorted.filter((p) => p <= dealPrice).length;
  return {
    hasHistory: true, low: sorted[0], high: sorted[sorted.length - 1], median,
    percentile: Math.max(1, Math.round((belowOrEqual / sorted.length) * 100)),
    series: clean, // chronological (caller passes chronological)
  };
}

export async function priceContext(origin: string, destination: string, tripType: string,
                                   dealPrice: number, now: Date): Promise<PriceStats> {
  const since = new Date(now.getTime() - WINDOW_DAYS * 86_400_000).toISOString();
  const rows = await db
    .select({ price: priceLog.price, scannedAt: priceLog.scannedAt })
    .from(priceLog)
    .innerJoin(routes, eq(priceLog.routeId, routes.id))
    .where(and(eq(routes.origin, origin), eq(routes.destination, destination),
               eq(priceLog.tripType, tripType), gte(priceLog.scannedAt, since)))
    .orderBy(asc(priceLog.scannedAt));
  return priceStats(rows.map((r) => Number(r.price)), dealPrice);
}
```
- [ ] **Step 10: Run** `cd site && npx vitest run src/lib/priceContext.test.ts` → PASS.

- [ ] **Step 11: types.ts — the public view models**
```typescript
// site/src/lib/types.ts
import type { QualityTag } from './quality';
import type { BookingCta } from './booking';
export type StatusKind = 'fresh' | 'going_fast' | 'gone';
export interface PublicDeal {
  id: number;               // published_deals.id
  destination: string; origin: string; route: string; tripType: string;
  dates: string; stops: number;
  price: number; baseline: number | null; drop: number;
  quality: QualityTag;      // floored to 'great' for published deals
  verdict: string;          // "Book this — it rarely drops this low."
  why: string;              // "−36% vs typical" (browse) / "−36% vs the 90-day median (€X)" (detail)
  catchLine: string | null; // "Catch: 3h Riga layover"
  status: { kind: StatusKind; label: string };
  booking: BookingCta;
  airline: string;
}
```
- [ ] **Step 12: Commit**
```bash
git add site/src/lib/airports.ts site/src/lib/format.ts site/src/lib/quality.ts site/src/lib/quality.test.ts site/src/lib/booking.ts site/src/lib/booking.test.ts site/src/lib/priceContext.ts site/src/lib/priceContext.test.ts site/src/lib/types.ts
git commit -m "feat(site): pure libs — quality bands, booking CTA rule, price-history stats, view types"
```

---

## Task 6: Data layer — read queries + mappers

**Files:** Create `site/src/lib/queries.ts`, `site/src/lib/mappers.ts` + `site/src/lib/mappers.test.ts`.

Note the **two distinct "tier" concepts** (trap): `published_deals.tier` is the *access* tier (`free`/`paid`) — **not** quality. Public quality comes from `match_score`, joined from `candidate_template_matches` on `candidate_id` + `deal_template_id`.

- [ ] **Step 1: queries.ts** — Book now = live deals; Inspiration = expired (past finds); detail = one deal + its match score; plus the itinerary snapshot from the candidate.
```typescript
// site/src/lib/queries.ts
import { and, desc, eq, ne } from 'drizzle-orm';
import { db } from '@/db';
import { publishedDeals, candidates, candidateTemplateMatches } from '@/db/generated/schema';

function dealBase() {
  return db.select({
    pd: publishedDeals,
    score: candidateTemplateMatches.matchScore,
    snapshot: candidates.itinerarySnapshot,
    candLastSeen: candidates.lastSeenAt,
  })
    .from(publishedDeals)
    .leftJoin(candidates, eq(publishedDeals.candidateId, candidates.id))
    .leftJoin(candidateTemplateMatches, and(
      eq(candidateTemplateMatches.candidateId, publishedDeals.candidateId),
      eq(candidateTemplateMatches.dealTemplateId, publishedDeals.dealTemplateId)));
}
export async function getLiveDeals() {
  return dealBase().where(eq(publishedDeals.status, 'live')).orderBy(desc(publishedDeals.publishedAt));
}
export async function getInspirationDeals(limit = 12) {
  return dealBase().where(eq(publishedDeals.status, 'expired')).orderBy(desc(publishedDeals.publishedAt)).limit(limit);
}
export async function getDeal(id: number) {
  const rows = await dealBase().where(eq(publishedDeals.id, id)).limit(1);
  return rows[0] ?? null;
}
```

- [ ] **Step 2: mappers.test.ts — failing test**
```typescript
// site/src/lib/mappers.test.ts
import { describe, it, expect } from 'vitest';
import { toPublicDeal } from './mappers';

type Row = Awaited<ReturnType<typeof import('./queries').getLiveDeals>>[number];
function row(over: Partial<Record<string, unknown>> = {}): Row {
  return {
    pd: { id: 1, origin: 'VNO', destination: 'BCN', tripType: 'oneway', price: 96,
          baselinePrice: 150, discountPct: 36, travelDate: '2026-09-12', returnDate: '2026-09-19',
          bookingUrl: 'https://www.google.com/travel/flights?tfs=X', lastSeenAt: '2026-06-03T10:00:00',
          goingFast: false, status: 'live', ...((over.pd as object) ?? {}) },
    score: over.score ?? 0.96,
    snapshot: over.snapshot ?? { stops: 1, duration_minutes: 440, airline: 'BT', self_transfer: false },
    candLastSeen: '2026-06-03T10:00:00',
  } as unknown as Row;
}
describe('toPublicDeal', () => {
  it('maps quality, drop, route, booking', () => {
    const d = toPublicDeal(row(), new Date('2026-06-03T12:00:00Z'));
    expect(d.quality).toBe('rare');           // score 0.96 → 96 → rare
    expect(d.drop).toBe(36);
    expect(d.route).toBe('VNO → BCN');
    expect(d.booking.button).toBe('Open in Google Flights');
    expect(d.status.kind).toBe('fresh');
  });
  it('going_fast flag wins the status', () => {
    const d = toPublicDeal(row({ pd: { goingFast: true } }), new Date('2026-06-03T12:00:00Z'));
    expect(d.status.kind).toBe('going_fast');
    expect(d.status.label).toBe('Going fast');
  });
});
```

- [ ] **Step 3: mappers.ts — implement**
```typescript
// site/src/lib/mappers.ts
import type { PublicDeal } from './types';
import { qualityTag } from './quality';
import { bookingCta } from './booking';
import { city } from './airports';
import { formatDates, timeAgo } from './format';

type Row = Awaited<ReturnType<typeof import('./queries').getLiveDeals>>[number];

function legs(snapshot: unknown): { stops: number; airline: string } {
  const s = (snapshot ?? {}) as Record<string, unknown>;
  return { stops: Number(s.stops ?? 0), airline: String(s.airline ?? '—') };
}
export function toPublicDeal(r: Row, now: Date): PublicDeal {
  const pd = r.pd;
  const { stops, airline } = legs(r.snapshot);
  const score = Math.round(Number(r.score ?? 0) * 100);
  const drop = Math.round(Number(pd.discountPct ?? 0));
  const fresh = pd.lastSeenAt ?? r.candLastSeen ?? null;
  const status = pd.goingFast
    ? { kind: 'going_fast' as const, label: 'Going fast' }
    : { kind: 'fresh' as const, label: fresh ? `Checked ${timeAgo(String(fresh))}` : 'Checked recently' };
  return {
    id: pd.id, destination: city(pd.destination), origin: city(pd.origin),
    route: `${pd.origin} → ${pd.destination}`, tripType: pd.tripType,
    dates: formatDates(String(pd.travelDate), pd.returnDate ? String(pd.returnDate) : null),
    stops, airline,
    price: Number(pd.price), baseline: pd.baselinePrice == null ? null : Number(pd.baselinePrice), drop,
    quality: qualityTag(score) ?? 'great',
    verdict: 'Book this — it rarely drops this low.',
    why: drop ? `${drop}% below typical` : 'Below typical',
    catchLine: stops >= 1 ? `Catch: ${stops} stop${stops > 1 ? 's' : ''}` : null,
    status,
    booking: bookingCta(pd.bookingUrl ?? null), // v1 → google variant
    airline,
  };
}
```
(The detail page computes the richer `why`/`catch` from `priceContext` + the itinerary; the browse card uses these defaults.)

- [ ] **Step 4: Run** `cd site && npx vitest run src/lib/mappers.test.ts` → PASS. Then `npx tsc --noEmit` → clean.
- [ ] **Step 5: Commit**
```bash
git add site/src/lib/queries.ts site/src/lib/mappers.ts site/src/lib/mappers.test.ts
git commit -m "feat(site): read queries (live/inspiration/detail) + published-deal → PublicDeal mapper"
```

---

## Task 7: Browse card + homepage (the opportunity inbox)

**Files:** Create `site/src/components/{QualityTag,StatusLine,BrowseCard,Header,Hero,Tabs,CaptureBand}.tsx`, `site/src/app/page.tsx`. **Markup/CSS source of truth:** `site/design-reference/homepage.html` + `cards.html`.

- [ ] **Step 1: Small presentational components** — `QualityTag` ({quality}: amber "Rare deal" / sea "Great deal"), `StatusLine` ({status}: grey "Checked Nh ago" / coral "Going fast"). Match the `.tag-rare`/`.tag-great`/`.st`/`.st-fast` classes already in `site.css` (from the mockups).
```tsx
// site/src/components/QualityTag.tsx
import type { QualityTag as Q } from '@/lib/quality';
export function QualityTag({ quality }: { quality: Q }) {
  return <span className={`tag ${quality === 'rare' ? 'tag-rare' : 'tag-great'}`}>{quality === 'rare' ? 'Rare deal' : 'Great deal'}</span>;
}
```
```tsx
// site/src/components/StatusLine.tsx
import type { PublicDeal } from '@/lib/types';
export function StatusLine({ status }: { status: PublicDeal['status'] }) {
  return <div className={`st ${status.kind === 'going_fast' ? 'st-fast' : ''}`}>{status.kind === 'going_fast' ? '▲ ' : ''}{status.label}</div>;
}
```

- [ ] **Step 2: BrowseCard** — a server-rendered link to `/deal/{id}`, matching the `.bc` markup in `cards.html`/`homepage.html` (tag · destination · route+dates · price · why · catch · status · "See the deal →").
```tsx
// site/src/components/BrowseCard.tsx
import Link from 'next/link';
import type { PublicDeal } from '@/lib/types';
import { QualityTag } from './QualityTag';
import { StatusLine } from './StatusLine';
export function BrowseCard({ deal }: { deal: PublicDeal }) {
  return (
    <div className="bc">
      <QualityTag quality={deal.quality} />
      <div className="dest">{deal.destination}</div>
      <div className="rt">{deal.route} · {deal.tripType === 'roundtrip' ? 'ret' : 'one-way'} · {deal.dates}</div>
      <div className="pr">€{deal.price} <small>{deal.tripType === 'roundtrip' ? 'return' : 'one-way'}</small></div>
      <div className="why">{deal.why}</div>
      {deal.catchLine && <div className="catch">{deal.catchLine}</div>}
      <StatusLine status={deal.status} />
      <Link className="see" href={`/deal/${deal.id}`}>See the deal →</Link>
    </div>
  );
}
```

- [ ] **Step 3: Header / Hero / Tabs / CaptureBand** — port verbatim structure + copy from `homepage.html` (`.hbar`, `.hero`, `.tabs`, `.cap`). `Tabs` is a client component holding `useState('book')` and rendering the matching grid; Header/Hero/CaptureBand are server components. (CaptureBand's form wires to Task 9.)

- [ ] **Step 4: Homepage page** — server component: fetch live + inspiration deals, map, render.
```tsx
// site/src/app/page.tsx
import { getLiveDeals, getInspirationDeals } from '@/lib/queries';
import { toPublicDeal } from '@/lib/mappers';
import { Header } from '@/components/Header';
import { Hero } from '@/components/Hero';
import { Tabs } from '@/components/Tabs';
import { CaptureBand } from '@/components/CaptureBand';

export const revalidate = 300; // ISR: refresh the feed every 5 min

export default async function Home() {
  const now = new Date();
  const live = (await getLiveDeals()).map((r) => toPublicDeal(r, now));
  const inspiration = (await getInspirationDeals()).map((r) => toPublicDeal(r, now));
  return (
    <main className="home">
      <Header />
      <Hero newCount={live.length} />
      <Tabs bookNow={live} inspiration={inspiration} />
      <CaptureBand />
    </main>
  );
}
```
(`Tabs` renders the `.grid` of `BrowseCard`s for the active tab, matching `homepage.html`.)

- [ ] **Step 5: Verify + commit**

Run: `cd site && npm run build && npx tsc --noEmit` → clean. Manual: `npm run dev` → open http://localhost:3001, confirm the feed renders real deals (needs the dev DB to have live `published_deals`; if none, seed via the admin or note empty state).
```bash
git add site/src/components site/src/app/page.tsx
git commit -m "feat(site): browse card + homepage opportunity inbox (Book now / Inspiration)"
```

---

## Task 8: Deal detail page (decide + proof)

**Files:** Create `site/src/components/{DealDetail,PriceSparkline,Itinerary,BookingCta}.tsx`, `site/src/app/deal/[id]/page.tsx`. **Markup/CSS source of truth:** `site/design-reference/deal-detail.html`.

- [ ] **Step 1: PriceSparkline** — renders the `.spark` bars from a `number[]` series, marking the lowest/most-recent amber + the "Today €X" tag + the `best/typical/highest` range row (matching `deal-detail.html`). Heights = `price / max * 100`.
```tsx
// site/src/components/PriceSparkline.tsx
import type { PriceStats } from '@/lib/priceContext';
export function PriceSparkline({ stats, todayPrice }: { stats: PriceStats; todayPrice: number }) {
  if (!stats.hasHistory) return null;
  const max = Math.max(...stats.series, todayPrice);
  const bars = stats.series.slice(-14);
  return (
    <div className="sec">
      <h3>Why it&apos;s a good deal</h3>
      <div className="bignote">Cheapest {stats.percentile}% we&apos;ve seen in 90 days.</div>
      <div className="spark-wrap">
        <span className="nowtag">Today €{todayPrice}</span>
        <div className="spark">
          {bars.map((p, i) => <i key={i} style={{ height: `${Math.round((p / max) * 100)}%` }} />)}
          <i className="lo" style={{ height: `${Math.round((todayPrice / max) * 100)}%` }} />
        </div>
      </div>
      <div className="rangelbl"><span>best <b>€{stats.low}</b></span><span>typical <b>€{stats.median}</b></span><span>highest <b>€{stats.high}</b></span></div>
    </div>
  );
}
```

- [ ] **Step 2: Itinerary + BookingCta + DealDetail** — `Itinerary` renders legs from the candidate snapshot with the coral `.flag-bad` catch + sea `.flag-ok` all-clear; `BookingCta` renders `{deal.booking}` (button + sub-line) per `deal-detail.html`; `DealDetail` composes left (decide) + right (proof: PriceSparkline, Itinerary, "Good to know" + the quiet "Want to be sure? Check it in Google Flights →" link). Port markup/copy verbatim from `deal-detail.html`.
```tsx
// site/src/components/BookingCta.tsx
import type { PublicDeal } from '@/lib/types';
export function BookingCta({ booking }: { booking: PublicDeal['booking'] }) {
  return (<>
    <a className="btn" href={booking.url} target="_blank" rel="noopener noreferrer">{booking.button} →</a>
    <div className="bookmeta">{booking.sub}</div>
  </>);
}
```

- [ ] **Step 3: Detail page** — fetch the deal + price context; 404 if missing.
```tsx
// site/src/app/deal/[id]/page.tsx
import { notFound } from 'next/navigation';
import { getDeal } from '@/lib/queries';
import { toPublicDeal } from '@/lib/mappers';
import { priceContext } from '@/lib/priceContext';
import { DealDetail } from '@/components/DealDetail';

export const revalidate = 300;

export default async function DealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await getDeal(Number(id));
  if (!row) notFound();
  const now = new Date();
  const deal = toPublicDeal(row, now);
  const stats = await priceContext(row.pd.origin, row.pd.destination, row.pd.tripType, deal.price, now);
  // richer detail copy: when we have history, lead the "why" with the median
  if (stats.hasHistory) deal.why = `−${deal.drop}% vs the 90-day median (€${stats.median})`;
  return <DealDetail deal={deal} stats={stats} snapshot={row.snapshot} />;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await getDeal(Number(id));
  if (!row) return { title: 'Deal — Yip' };
  const d = toPublicDeal(row, new Date());
  return { title: `${d.destination} €${d.price} — Yip`, description: `${d.route} · ${d.dates} · ${d.why}. Found and checked by hand.` };
}
```

- [ ] **Step 4: Verify + commit**

Run: `cd site && npm run build && npx tsc --noEmit` → clean. Manual: open `/deal/<a real published id>` → sparkline + itinerary + booking render.
```bash
git add site/src/components site/src/app/deal
git commit -m "feat(site): deal detail page — price-history proof, fare-health, booking CTA"
```

---

## Task 9: Email capture (subscribers)

**Files:** Modify `skrendam/db/models.py` (+ `alembic/versions/0004_subscribers.py`); create `site/src/app/subscribe-action.ts`; wire `CaptureBand`. Test `tests/skrendam/test_subscribers_model.py` (light).

Decision: v1 stores subscribers in a **`subscribers` table** (the public app's only write — its own table, not engine-domain). Newsletter *sending* is out of scope.

- [ ] **Step 1: Model + migration**
```python
# in skrendam/db/models.py
class Subscriber(Base):
    __tablename__ = "subscribers"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String, unique=True)
    source: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
```
```python
# alembic/versions/0004_subscribers.py
"""add subscribers table
Revision ID: b7c41d9e2a02
Revises: a3f10c2b77e1
Create Date: 2026-06-03 16:30:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
revision: str = 'b7c41d9e2a02'
down_revision: Union[str, Sequence[str], None] = 'a3f10c2b77e1'
branch_labels = None
depends_on = None
def upgrade() -> None:
    op.create_table('subscribers',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('email', sa.String(), nullable=False),
        sa.Column('source', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('email'))
def downgrade() -> None:
    op.drop_table('subscribers')
```
Apply on the dev branch: `uv run alembic upgrade head` (expects `-> b7c41d9e2a02`). Then re-pull the site schema: `cd site && node --env-file=.env.local node_modules/.bin/drizzle-kit pull` (adds `subscribers`).

- [ ] **Step 2: Server action** (the only write; validate with zod; idempotent on duplicate email)
```typescript
// site/src/app/subscribe-action.ts
'use server';
import { z } from 'zod';
import { db } from '@/db';
import { subscribers } from '@/db/generated/schema';

export async function subscribe(form: FormData): Promise<{ ok: boolean; error?: string }> {
  const email = z.string().email().safeParse((form.get('email') ?? '').toString().trim());
  if (!email.success) return { ok: false, error: 'Enter a valid email.' };
  await db.insert(subscribers).values({ email: email.data, source: 'homepage' })
    .onConflictDoNothing({ target: subscribers.email });
  return { ok: true };
}
```

- [ ] **Step 3: Wire CaptureBand** — make it a client component: `useTransition` + the form posting to `subscribe`, swap to a "You're in — check your inbox." confirmation on `{ok:true}`, inline error on `{ok:false}`. Match the `.cap` markup from `homepage.html`.

- [ ] **Step 4: Verify + commit**

Run: `cd site && npm run build && npx tsc --noEmit` → clean; `uv run pytest tests/skrendam -q` → pass.
```bash
git add skrendam/db/models.py alembic/versions/0004_subscribers.py site/src/db site/src/app/subscribe-action.ts site/src/components/CaptureBand.tsx
git commit -m "feat(site,skrendam): email capture — subscribers table + homepage signup"
```

---

## Task 10: SEO, caching, polish

**Files:** Modify `site/src/app/layout.tsx`, `site/src/app/page.tsx`, deal page; create `site/src/app/{robots,sitemap}.ts`.

- [ ] **Step 1: Metadata + OG** — confirm `layout.tsx` metadata (Task 4) + per-deal `generateMetadata` (Task 8). Add `metadataBase` and default OpenGraph (title/description/type=website) in layout.
- [ ] **Step 2: robots + sitemap** — `site/src/app/robots.ts` (allow all) and `site/src/app/sitemap.ts` (homepage + one URL per live `published_deals` id via `getLiveDeals`).
- [ ] **Step 3: ISR confirm** — `export const revalidate = 300` on homepage + deal page (already in Tasks 7–8). Verify the feed updates within 5 min of a scan.
- [ ] **Step 4: A11y pass** — semantic landmarks (`main`/`nav`/`section`), the "See the deal" links have discernible text, color-contrast on tags (warm palette is AA-minded), focus-visible on the capture input + buttons.
- [ ] **Step 5: Verify + commit**

Run: `cd site && npm run build` → clean (no metadata warnings).
```bash
git add site/src/app
git commit -m "feat(site): SEO metadata + robots/sitemap + ISR + a11y pass"
```

---

## Task 11: QA gauntlet (Playwright + reviews)

**Files:** Create `site/e2e/{homepage,deal-detail}.spec.ts`.

- [ ] **Step 1: Homepage journey** — `homepage.spec.ts`: load `/`, assert the hero H1, that the Book now grid shows ≥1 `.bc` (skip-or-seed if the dev DB has no live deals), tab to Inspiration, submit the capture form with a test email → confirmation appears. Run: `cd site && npx playwright test e2e/homepage.spec.ts` → PASS (paste output).
- [ ] **Step 2: Deal-detail journey** — `deal-detail.spec.ts`: from the homepage click the first "See the deal", assert the detail URL, the price + the booking button text, the sparkline (`.spark`) when history exists, and the "Check it in Google Flights" verify link. Run → PASS (paste output).
- [ ] **Step 3: Full green-check** — `cd site && npx tsc --noEmit && npm run lint && npx vitest run`; `uv run pytest tests/skrendam -q && uv run mypy skrendam`. All green.
- [ ] **Step 4: `/code-review high`** on the branch diff (`main...HEAD`) — focus: the read-only invariant (no engine-table writes except `subscribers`), the `priceStats`/percentile correctness, the `going_fast` recheck logic, the mapper's tier-vs-quality trap. Fix real findings.
- [ ] **Step 5: `security-review`** on the branch — focus: the `subscribe` action (zod validation, parameterized insert, no PII leak), no secrets, the deal page's `Number(id)`/`notFound` handling, external booking links use `rel="noopener noreferrer"`. Fix real findings.
- [ ] **Step 6: Commit any fixes**, then this milestone is ready for the finishing-a-development-branch flow (PR).

---

## Self-Review (run against the spec)

**Spec coverage:**
- §3.1 homepage / inbox → Task 7. §3.2 browse card → Task 7. §3.3 detail page → Task 8. §3.4 triage language → QualityTag/StatusLine (Task 7) + mapper (Task 6). §3.5 booking CTA rule → `booking.ts` (Task 5) + BookingCta (Task 8).
- §4 availability engine: comparison → `priceContext` (Task 5) + sparkline (Task 8); freshness → mapper status + recheck `last_seen_at` (Tasks 1, 6); "Going fast" observed-only → Task 1; quality bands → `quality.ts` (Task 5).
- §5 architecture (separate read-only app) → Tasks 2–3. §6 data-model (`going_fast`) → Task 1. §7 capture → Task 9. §8 SEO/perf/a11y → Task 10. §9 deps (recheck reliability) → Task 1 + flagged. §11 build sequence → Tasks 1–11 order.
- **Gap noted:** §3.5's airline-direct/OTA CTA variants ship as *copy-ready but data-fed only by the Google fallback* in v1 — vendor-resolution via `get_booking_options` is a flagged fast-follow (an extra engine task), called out to the user before execution.
- **Refinement noted:** §3.1 "Inspiration" is implemented as *past/expired finds* (populated, honest) rather than maybe-tier (which may be empty if only great deals are published).

**Placeholder scan:** none — every step has concrete code/commands.

**Type consistency:** `PublicDeal`, `PriceStats`, `QualityTag`, `BookingCta`, `BookingKind`, `qualityTag()`, `bookingCta()`, `priceStats()`, `priceContext()`, `toPublicDeal()`, `getLiveDeals/getInspirationDeals/getDeal` are used consistently across Tasks 5–11. `published_deals.tier` (access) is explicitly distinguished from quality (match_score) in Task 6.
