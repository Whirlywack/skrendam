# Slice 2 — Deal Surfaces Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make yip.lt show what the backend already produces (verification time, price-check history, changed and expired states, lasted duration, window minimum) exactly as the founder-approved mockups show it, and give phones the reduced poster-first layout.

**Architecture:** Two PRs off `main`. PR A (Tasks 1–5) adds pure helpers, mapper fields, one query, and the desktop rendering. PR B (Tasks 6–9) adds the mobile layout as CSS-toggled markup on the same pages (`.m-only` / `.d-only`), no separate routes. Every new *word* is a key in `site/src/lib/lt.ts` with an **empty string**; the UI renders that slot only when the key is non-empty, so the copy pass (founder, later) switches it on by filling the key. Numbers, dates, prices and existing strings ship now.

**Tech Stack:** Next.js 16 app router (`site/`), React 19, drizzle-orm on Neon, vitest (`cd site && npx vitest run`), plain CSS in `site/src/styles/v2.css`.

**Spec:** the approved canvas https://claude.ai/code/artifact/d1439891-b6db-46d9-9523-0b2c58bf5519 (v11: desktop boards Main/HomeEmpty/DealLive/DealChanged/DealExpired + mobile boards *Mobile). Its generator is committed as `docs/plans/2026-09-12-slice2-mockups-generator.py` (the HTML/CSS there is the reference; copy values from it). Gap list: `docs/plans/2026-09-12-site-page-inventory.md` §3.

## Global Constraints

- **No new Lithuanian wording.** Founder 2026-09-12: copy comes later. Any new label is an `lt.ts` key set to `''` with the comment `// copy pass` and is rendered only when non-empty. Existing keys may be reused. Numbers/dates/prices are data, not copy.
- **Never say „180 days".** Price history is ~24 scan-days; production already gates the chart at 14 samples (`priceContext.ts` `MIN_SAMPLES`). Do not change the gate.
- **Real data only.** No fabricated proof; hide a slot when its field is null.
- **Design tokens** come from `site/src/styles/poster-bead.css` and `v2.css`; no new colors except the strike coral `#B53017` already used for dead rows.
- **Padding rule:** never `padding: X 0 Y` on an element that also has class `wrap` — use `padding-block` (the mobile-gutter bug, PR #55).
- **Mobile breakpoint** is `@media (max-width: 720px)` (existing block in `v2.css`).
- **Process:** worktree off `main` created from the main checkout, one PR per package (PR A = Tasks 1–5, PR B = Tasks 6–9), `gh run watch --exit-status` before merge, commit trailers as configured, Fable subagents only.
- **Tests:** `cd site && npx vitest run` must stay green; `npx tsc --noEmit` clean; `npx next build` green before each PR.

---

## File map

| File | Responsibility |
|---|---|
| `site/src/lib/format.ts` | pure LT formatting: add `lasted()`, `clockLT()` |
| `site/src/lib/types.ts` | `TicketView`/`PublicDeal` gain `verifiedTime`, `lasted` |
| `site/src/lib/mappers.ts` | fill the two new fields |
| `site/src/lib/lt.ts` | gated empty keys + `moreLocked` |
| `site/src/lib/queries.ts` | `getPriceChecks(dealId)` |
| `site/src/lib/priceChecks.ts` (new) | pure `toCheckItems(rows)` |
| `site/src/lib/scarcity.ts` | `splitLockedRows(locked, 4)` |
| `site/src/components/v2/CheckLine.tsx` (new) | the mono check line |
| `site/src/components/v2/Rows.tsx` | trophy duration, collapsed locked row |
| `site/src/components/v2/Poster.tsx` | facts + trust lines (mobile-only markup) |
| `site/src/components/PriceSparkline.tsx` | `dead` prop |
| `site/src/app/page.tsx` | hero stamp time, empty-state mobile rows |
| `site/src/app/deal/[id]/page.tsx` | check line, gated slots, expired variant |
| `site/src/app/buvo/page.tsx` | duration in archive rows |
| `site/src/components/v2/Masthead.tsx`, `V2Footer.tsx` | mobile compaction |
| `site/src/styles/v2.css` | all new CSS |

---

### Task 1: Pure helpers `lasted()` and `clockLT()`

**Files:**
- Modify: `site/src/lib/format.ts` (append after `ascii()`)
- Test: `site/src/lib/format.test.ts`

**Interfaces:**
- Produces: `lasted(publishedAt: string, expiredAt: string | null): string | null` → `'7 val.'` under 48 h, else `'14 d.'`; `null` when `expiredAt` is null or not after `publishedAt`.
- Produces: `clockLT(iso: string | null): string | null` → `'06:41'` in Europe/Vilnius; `null` for null input.

- [ ] **Step 1: Write the failing tests** — append to `site/src/lib/format.test.ts` (import line already imports from `./format`; add `lasted, clockLT`):

```ts
test('lasted: hours under 48 h, days after, null when not expired', () => {
  expect(lasted('2026-08-29T00:00:00', '2026-08-29T06:36:40')).toBe('7 val.');
  expect(lasted('2026-08-28T10:00:00', '2026-09-11T10:21:49')).toBe('14 d.');
  expect(lasted('2026-08-28T10:00:00', null)).toBeNull();
  expect(lasted('2026-08-28T10:00:00', '2026-08-28T09:00:00')).toBeNull();
});

test('clockLT: HH:MM in Vilnius time from a naive-UTC DB stamp', () => {
  expect(clockLT('2026-09-12 03:41:00')).toBe('06:41');   // UTC+3 in September
  expect(clockLT('2026-01-12T03:41:00Z')).toBe('05:41');  // UTC+2 in January
  expect(clockLT(null)).toBeNull();
});
```

- [ ] **Step 2: Run to verify it fails** — `cd site && npx vitest run src/lib/format.test.ts` → FAIL (`lasted is not a function`).

- [ ] **Step 3: Implement** — append to `site/src/lib/format.ts`:

```ts
/** How long a published deal stayed bookable: under 48 h in hours („7 val."),
 *  otherwise whole days („14 d."). Null when it has not expired (or the stamps
 *  are inconsistent) so callers hide the slot. Units only — the label word in
 *  front is a copy-pass key (S.lastedLabel). */
export function lasted(publishedAt: string, expiredAt: string | null): string | null {
  if (!expiredAt) return null;
  const ms = utcMs(expiredAt) - utcMs(publishedAt);
  if (!(ms > 0)) return null;
  const h = Math.round(ms / 3_600_000);
  return h < 48 ? `${Math.max(1, h)} val.` : `${Math.round(h / 24)} d.`;
}

/** „06:41" — the verification clock in Lithuanian local time. */
export function clockLT(iso: string | null): string | null {
  if (!iso) return null;
  return new Intl.DateTimeFormat('lt-LT', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/Vilnius',
  }).format(new Date(utcMs(iso)));
}
```

- [ ] **Step 4: Run tests** — `npx vitest run src/lib/format.test.ts` → PASS.

- [ ] **Step 5: Commit** — `git add site/src/lib/format.ts site/src/lib/format.test.ts && git commit -m "feat(site): lasted() and clockLT() formatting helpers"` (with the configured trailers).

---

### Task 2: Mapper fields + gated copy keys

**Files:**
- Modify: `site/src/lib/types.ts` (both interfaces)
- Modify: `site/src/lib/mappers.ts` (`toTicket`, `toPublicDeal`)
- Modify: `site/src/lib/lt.ts` (end of the `S` object, before `} as const;`)
- Test: `site/src/lib/mappers.ticket.test.ts`

**Interfaces:**
- Consumes: `lasted`, `clockLT` from Task 1.
- Produces: `TicketView.verifiedTime: string | null`, `TicketView.lasted: string | null`, same two on `PublicDeal`.
- Produces keys on `S`: `lastedLabel: ''`, `priceRoseFlag: ''`, `windowMinLabel: ''`, `checkGone: ''` (all copy-pass), `moreLocked: '+ dar'` (approved on the board).

- [ ] **Step 1: Failing tests** — append to `mappers.ticket.test.ts`:

```ts
describe('slice 2 fields', () => {
  it('verifiedTime comes from pd.verifiedAt in Vilnius time, null otherwise', () => {
    expect(toTicket(row({ pd: { verifiedAt: '2026-09-12 03:41:00' } }), new Date()).verifiedTime).toBe('06:41');
    expect(toTicket(row(), new Date()).verifiedTime).toBeNull();
  });
  it('lasted is set only for expired rows with expiredAt after publishedAt', () => {
    const t = toTicket(row({ pd: { status: 'expired', publishedAt: '2026-08-28T10:00:00', expiredAt: '2026-09-11T10:21:49' } }), new Date());
    expect(t.lasted).toBe('14 d.');
    expect(toTicket(row({ pd: { publishedAt: '2026-08-28T10:00:00', expiredAt: null } }), new Date()).lasted).toBeNull();
  });
});
```

- [ ] **Step 2: Run** — `npx vitest run src/lib/mappers.ticket.test.ts` → FAIL (property undefined).

- [ ] **Step 3: Implement**

`types.ts` — add to `TicketView` after `goingFast: boolean;` and to `PublicDeal` after `savingFamily`:

```ts
  verifiedTime: string | null;  // „06:41" from published_deals.verified_at (WP9), else null
  lasted: string | null;        // „14 d." / „7 val." from expired_at − published_at, else null
```

`mappers.ts` — import `clockLT, lasted` from `./format`; in `toTicket` return object add:

```ts
    verifiedTime: clockLT(pd.verifiedAt ?? null),
    lasted: lasted(String(pd.publishedAt), pd.expiredAt ?? null),
```

and the same two lines in `toPublicDeal`.

`lt.ts` — before `} as const;`:

```ts
  // Slice 2 slots (2026-09-12). Empty = the UI hides the slot. The founder's
  // copy pass fills these; do not draft wording here. // copy pass
  lastedLabel: '',     // word before „14 d." on expired rows and the expired page
  priceRoseFlag: '',   // eyebrow flag on a changed deal
  windowMinLabel: '',  // catch-column line before „gruod. 14 · 78 €"
  checkGone: '',       // check line value when the itinerary was gone
  moreLocked: '+ dar', // collapsed locked row: „+ dar 5 radiniai" (approved on the board)
```

- [ ] **Step 4: Run** — `npx vitest run` → all PASS; `npx tsc --noEmit` clean.

- [ ] **Step 5: Commit** — `git commit -am "feat(site): verifiedTime and lasted on tickets; gated slice-2 copy keys"`.

---

### Task 3: Price-check query + pure line mapper

**Files:**
- Modify: `site/src/lib/queries.ts`
- Create: `site/src/lib/priceChecks.ts`
- Test: `site/src/lib/priceChecks.test.ts`

**Interfaces:**
- Produces: `getPriceChecks(dealId: number, limit = 3): Promise<{ checkedAt: string; price: number | null; available: boolean }[]>` — newest first from `deal_price_checks`.
- Produces: `toCheckItems(rows, gone: string): CheckItem[]` with `CheckItem = { date: string; value: string; up: boolean }`, oldest first, `date` via `formatDates(checkedAt.slice(0,10), null)`, `value` = `eur(price)` or `gone` when `!available || price == null`, `up` = price rose vs the previous item.

- [ ] **Step 1: Failing test** — create `site/src/lib/priceChecks.test.ts`:

```ts
import { expect, test } from 'vitest';
import { toCheckItems } from './priceChecks';

test('toCheckItems: oldest first, eur values, up flag on a rise, gone label when unavailable', () => {
  const rows = [
    { checkedAt: '2026-09-12 04:02:00', price: 64, available: true },
    { checkedAt: '2026-09-11 04:01:00', price: 47, available: true },
    { checkedAt: '2026-09-10 04:00:00', price: 47, available: true },
  ];
  expect(toCheckItems(rows, '—')).toEqual([
    { date: 'rugs. 10', value: '47 €', up: false },
    { date: 'rugs. 11', value: '47 €', up: false },
    { date: 'rugs. 12', value: '64 €', up: true },
  ]);
  expect(toCheckItems([{ checkedAt: '2026-09-11 04:00:00', price: null, available: false }], '—'))
    .toEqual([{ date: 'rugs. 11', value: '—', up: false }]);
  expect(toCheckItems([], '—')).toEqual([]);
});
```

- [ ] **Step 2: Run** → FAIL (module not found).

- [ ] **Step 3: Implement**

`site/src/lib/priceChecks.ts`:

```ts
import { eur, formatDates } from './format';

export interface CheckRow { checkedAt: string; price: number | null; available: boolean }
export interface CheckItem { date: string; value: string; up: boolean }

/** The last N daily checks as one mono line, oldest → newest (WP9 deal_price_checks).
 *  `gone` is the copy-pass value for an unavailable check (S.checkGone); the
 *  caller hides the whole line when that key is empty and any row is gone. */
export function toCheckItems(rows: CheckRow[], gone: string): CheckItem[] {
  const asc = [...rows].sort((a, b) => a.checkedAt.localeCompare(b.checkedAt));
  let prev: number | null = null;
  return asc.map((r) => {
    const ok = r.available && r.price != null;
    const up = ok && prev != null && (r.price as number) > prev;
    if (ok) prev = r.price as number;
    return { date: formatDates(r.checkedAt.slice(0, 10), null), value: ok ? eur(r.price as number) : gone, up };
  });
}
```

`queries.ts` — import `dealPriceChecks` from the schema and add:

```ts
/** Newest N verification checks for one deal (WP9). */
export async function getPriceChecks(dealId: number, limit = 3) {
  return db
    .select({ checkedAt: dealPriceChecks.checkedAt, price: dealPriceChecks.price, available: dealPriceChecks.available })
    .from(dealPriceChecks)
    .where(eq(dealPriceChecks.dealId, dealId))
    .orderBy(desc(dealPriceChecks.checkedAt))
    .limit(limit);
}
```

- [ ] **Step 4: Run** — `npx vitest run` PASS; `npx tsc --noEmit` clean.

- [ ] **Step 5: Commit** — `git commit -am "feat(site): price-check query and check-line mapper"`.

---

### Task 4: Deal page — check line, gated slots, expired variant (desktop)

**Files:**
- Create: `site/src/components/v2/CheckLine.tsx`
- Modify: `site/src/components/PriceSparkline.tsx`
- Modify: `site/src/app/deal/[id]/page.tsx`
- Modify: `site/src/styles/v2.css`

**Interfaces:**
- Consumes: `getPriceChecks`, `toCheckItems`, `S.checkGone`, `S.priceRoseFlag`, `S.windowMinLabel`, `S.lastedLabel`, `deal.lasted`.
- Produces: `<CheckLine items={CheckItem[]} />`; `<PriceSparkline stats todayPrice dead? />`.

- [ ] **Step 1: CheckLine component** — `site/src/components/v2/CheckLine.tsx`:

```tsx
import type { CheckItem } from '@/lib/priceChecks';
import { S } from '@/lib/lt';

/** One baseline mono line of the last checks: „rugs. 10 · 47 € | rugs. 11 · 47 € | rugs. 12 · 64 € ↑".
 *  A rise is coral; the value is data, the heading reuses the existing method line. */
export function CheckLine({ items }: { items: CheckItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="v2-checkline" aria-label={S.priceContextMethod}>
      {items.map((c) => (
        <span key={c.date} className={c.up ? 'up' : undefined}>
          {c.date} · <b>{c.value}{c.up ? ' ↑' : ''}</b>
        </span>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Sparkline dead bar** — in `PriceSparkline.tsx` add prop `dead?: boolean` and render the today bar as `<i className={`today${dead ? ' dead' : ''}`} …/>`.

- [ ] **Step 3: CSS** — append to `v2.css` inside the inner-pages section:

```css
/* slice 2: the last checks as one mono line (no chips — paper-first) */
.v2-checkline { display: flex; flex-wrap: wrap; margin-top: 14px; font-family: var(--font-mono);
  font-size: 12px; text-transform: uppercase; letter-spacing: .08em; color: var(--sand-500); }
.v2-checkline span { padding-right: 18px; margin-right: 18px; border-right: 1px solid var(--line); }
.v2-checkline span:last-child { border: 0; }
.v2-checkline b { color: var(--v2-ink); font-weight: 700; }
.v2-checkline .up b { color: #B53017; }
/* an expired deal's chart bar wears the strike coral, never live amber */
.v2-spark .bars i.today.dead { background: #B53017; }
```

- [ ] **Step 4: Deal page wiring** — in `site/src/app/deal/[id]/page.tsx`:

  1. Imports: `getPriceChecks` from `@/lib/queries`, `toCheckItems` from `@/lib/priceChecks`, `CheckLine` from `@/components/v2/CheckLine`.
  2. After `const stats = await priceContext(...)`:
     ```tsx
     const expired = !isLive(pd.status);
     const checkRows = await getPriceChecks(pd.id);
     // With no copy for a gone check yet, a line containing one would show a bare
     // dash — hide the line until the key is filled (Global Constraints).
     const checkItems = toCheckItems(checkRows, S.checkGone);
     const showChecks = checkItems.length > 0 && (S.checkGone !== '' || checkRows.every((r) => r.available && r.price != null));
     ```
  3. Kicker (poster `.top .v2-kicker`): replace the ternary with
     ```tsx
     {rank > 0
       ? `${S.dealNoWord} Nr. ${String(rank).padStart(2, '0')} · ${S.thisWeekOf}${deal.state === 'changed' && S.priceRoseFlag ? ` · ${S.priceRoseFlag}` : ''}`
       : expired
         ? `${S.pastEyebrow}${S.lastedLabel && deal.lasted ? ` · ${S.lastedLabel} ${deal.lasted}` : ''}`
         : pd.publicLabel ?? S.foundByHand}
     ```
  4. Catch column: after the `whyAndCatch.catch.map(...)` block add
     ```tsx
     {S.windowMinLabel && pd.windowMinPrice != null && pd.windowMinDate && (
       <div className="v2-li cav"><span className="bead" aria-hidden="true" />
         <span>{S.windowMinLabel}: {formatDates(String(pd.windowMinDate), null)} · {eur(Number(pd.windowMinPrice))}</span></div>
     )}
     ```
     (import `formatDates` from `@/lib/format`).
  5. Price context block: pass `dead={expired}` to `<PriceSparkline …/>`; directly after it, before the method line, add `{showChecks && <CheckLine items={checkItems} />}`.
  6. Replace `<CaptureRow source="deal" />` with `{!expired && <CaptureRow source="deal" />}` (reviewer finding 7).

- [ ] **Step 5: Verify** — `npx tsc --noEmit`, `npx vitest run`, `npx next build` (needs `site/.env.local`; copy it from the main checkout). Start `npx next start -p 3103`, open `/deal/3` (expired Larnaka) and `/deal/17` (live Milanas): the expired page must show no mid-page capture and a coral last bar if the chart renders; live page unchanged except the check line appears once `deal_price_checks` has rows (it is empty today — that is expected).

- [ ] **Step 6: Commit** — `git commit -am "feat(site): deal page — check line, expired variant, gated slice-2 slots"`.

---

### Task 5: Home + archive — hero stamp time, trophy duration, collapsed locked list

**Files:**
- Modify: `site/src/lib/scarcity.ts`
- Modify: `site/src/components/v2/Rows.tsx`
- Modify: `site/src/app/page.tsx`
- Modify: `site/src/app/buvo/page.tsx`
- Modify: `site/src/styles/v2.css`
- Test: `site/src/lib/scarcity.test.ts`

**Interfaces:**
- Produces: `splitLockedRows<T>(locked: T[], shown = 4): { shown: T[]; collapsed: T[] }`.
- Produces: `LiveIndex` renders `shown` locked rows + one collapsed row when `collapsed.length > 0`.

- [ ] **Step 1: Failing test** — append to `scarcity.test.ts`:

```ts
test('splitLockedRows: first 4 shown, the rest collapsed into one row', () => {
  const ids = [4, 5, 6, 7, 8, 9, 10, 11, 12];
  expect(splitLockedRows(ids)).toEqual({ shown: [4, 5, 6, 7], collapsed: [8, 9, 10, 11, 12] });
  expect(splitLockedRows([4, 5])).toEqual({ shown: [4, 5], collapsed: [] });
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement** — `scarcity.ts`:

```ts
/** Desktop shows four locked rows, then one „+ dar N" row (founder 2026-09-12:
 *  "seven of them is just too much"). Mobile shows none and the same row. */
export const LOCKED_SHOWN = 4;
export function splitLockedRows<T>(locked: T[], shown = LOCKED_SHOWN): { shown: T[]; collapsed: T[] } {
  return { shown: locked.slice(0, shown), collapsed: locked.slice(shown) };
}
```

`Rows.tsx` — in `LiveIndex`, replace the `locked.map(...)` block with:

```tsx
        {lockedShown.map((t, i) => ( /* the existing locked <a> row, unchanged */ ))}
        {lockedCollapsed.length > 0 && (
          <a href="#kapote" className="v2-row v2-row--locked v2-row--more">
            <span className="no">Nr. {String(startAt + deals.length + lockedShown.length).padStart(2, '0')}–{String(total).padStart(2, '0')}</span>
            <span className="v2-row-name">
              <span className="d-only">{S.moreLocked} {lockedCollapsed.length} {ltPlural(lockedCollapsed.length, 'radinys', 'radiniai', 'radinių')}</span>
              <span className="m-only">{S.moreLocked} {locked.length} {ltPlural(locked.length, 'radinys', 'radiniai', 'radinių')}</span>
            </span>
            <span className="v2-row-meta">{lockedCollapsed.map((t) => t.destination).join(' · ')}</span>
            <span className="v2-row-price"><span className="bead" aria-hidden="true" />{S.lockedChip}</span>
            <span className="go" aria-hidden="true" />
          </a>
        )}
```

with `const { shown: lockedShown, collapsed: lockedCollapsed } = splitLockedRows(locked);` at the top of `LiveIndex` (import from `@/lib/scarcity`). Locked rows get an extra class `v2-row--locked-n` (hidden on mobile in PR B).

`TrophyCase` (same file) and `buvo/page.tsx` — in the meta span, after the dates, append:

```tsx
{S.lastedLabel && t.lasted ? ` · ${S.lastedLabel} ${t.lasted}` : ''}
```

`page.tsx` (home) — the hero stamp: replace `{S.humanStamp}{stampFresh}` with

```tsx
{S.humanStamp}{featured?.verifiedTime ? ` · ${featured.verifiedTime}` : stampFresh}
```

(the time replaces the relative freshness once WP9 has verified the deal; before that the existing fallback stays).

CSS (`v2.css`):

```css
.v2-row--more .v2-row-name { color: var(--sand-600); }
.d-only { display: inline; } .m-only { display: none; }
```

- [ ] **Step 4: Verify** — vitest, tsc, build; `next start` and check `/` shows rows Nr. 02–07 then „Nr. 08–12 + dar 5 radiniai". Screenshot at 1440 and compare with the Main board.

- [ ] **Step 5: Commit, push, PR A** — title `feat(site): slice 2 — deal surfaces (desktop)`, body lists Tasks 1–5, `gh run watch --exit-status`, then hand back for the founder's merge.

---

### Task 6: Poster facts + trust lines (mobile-only markup) — PR B

**Files:**
- Modify: `site/src/components/v2/Poster.tsx`
- Modify: `site/src/app/deal/[id]/page.tsx` (the poster hero copy of the same markup)
- Modify: `site/src/styles/v2.css` (mobile block)

**Interfaces:** none new; markup only.

- [ ] **Step 1: Markup** — inside `.routebox`, after the `.bead-route` div, add in both places:

```tsx
<div className="facts m-only">{t.dates} · {t.airline} · {S.humanStamp}</div>
```

and inside `.pricecell`, after the CTA:

```tsx
<div className="trust m-only">{S.trustDirect}</div>
```

- [ ] **Step 2: CSS** — inside `@media (max-width: 720px)` in `v2.css`:

```css
  .m-only { display: block; } .d-only { display: none; }
  .v2-poster { min-height: 0; gap: 18px; }
  .v2-poster .v2-stamp, .v2-poster .top .v2-kicker { white-space: nowrap; }
  .v2-poster .facts { font-family: var(--font-mono); font-size: 11px; letter-spacing: .08em;
    text-transform: uppercase; color: rgba(255,255,255,.92); margin-top: 10px; }
  .v2-poster .pricecell { flex-direction: column; align-items: stretch; gap: 14px; width: 100%; }
  .v2-poster .cta { width: 100%; justify-content: center; min-height: 48px; }
  .v2-poster .trust { font-family: var(--font-mono); font-size: 10px; letter-spacing: .08em;
    text-transform: uppercase; color: rgba(255,255,255,.8); text-align: center; }
  .v2-catchline { display: none; }
```

- [ ] **Step 3: Verify** at 390 (`next start`, Playwright or Chrome device mode): poster shows dates·airline·stamp under the route, full-width button, trust line under it; catch line gone.
- [ ] **Step 4: Commit** — `git commit -am "feat(site): mobile poster carries dates, airline, stamp and the buy-direct line"`.

---

### Task 7: Mobile home — poster first, rows as taps, collapsed locked list, empty-state proof

**Files:**
- Modify: `site/src/app/page.tsx`
- Modify: `site/src/components/v2/Rows.tsx`
- Modify: `site/src/components/v2/Masthead.tsx`
- Modify: `site/src/styles/v2.css`

- [ ] **Step 1: Home markup** — in `page.tsx`: give the hero section `className={`wrap v2-hero${featured ? ' v2-hero--has-poster' : ''}`}`; wrap `<CaptureRow />` and `<TrophyCase …/>` each in a `<div className="d-only">`; in the `!featured` branch add after the empty footnote:

```tsx
<section className="wrap v2-sec m-only m-rows">
  <div className="v2-rows">
    {past[0] && (
      <Link href={`/deal/${past[0].id}`} className="v2-row v2-row--dead">
        <span className="no" /><span className="v2-row-name">{past[0].destination}</span>
        <span className="v2-row-meta">{rowMeta(past[0])}</span>
        <span className="v2-row-price">{eur(past[0].price)}{past[0].baseline != null && <s>{eur(past[0].baseline)}</s>}</span>
      </Link>
    )}
    <Link href="/buvo" className="v2-row v2-row--more"><span className="no" /><span className="v2-row-name">{S.navPast}</span><span className="v2-row-meta">{S.pastEyebrow}</span><span className="v2-row-price">→</span></Link>
  </div>
</section>
```

- [ ] **Step 2: Masthead** — the `navlinks` nav gets class `navlinks d-only`.

- [ ] **Step 3: CSS** (mobile block):

```css
  .v2-hero--has-poster { display: none; }
  .v2-masthead .bar { justify-content: space-between; } .v2-masthead .pill { min-height: 44px; }
  .v2-row--locked-n { display: none; }
  .v2-rows .v2-row { grid-template-columns: 1fr auto; grid-template-areas: "name price" "meta meta";
    gap: 6px 14px; padding: 16px 4px; min-height: 44px; }
  .v2-rows .v2-row .no { display: none; }
  .v2-rows .v2-row-name { grid-area: name; } .v2-rows .v2-row-price { grid-area: price; justify-self: end; white-space: nowrap; }
  .v2-rows .v2-row-meta { grid-area: meta; font-size: 11px; }
  .v2-sec .head .v2-kicker { display: none; }
  .v2-ink-band { margin-top: 28px; padding: 44px 0; }
```

(and delete the older mobile `.v2 .v2-row { grid-template-columns: auto 1fr auto … }` rules that these replace).

- [ ] **Step 4: Verify** at 390: `/` = masthead → poster → 2 open rows → „+ dar 9 radiniai" → ink band → footer; primary button bottom ≈ 485 px; no horizontal scroll. Compare with the MainMobile board.
- [ ] **Step 5: Commit** — `git commit -am "feat(site): mobile home is poster-first"`.

---

### Task 8: Mobile deal page — reduced page, expired tail

**Files:**
- Modify: `site/src/app/deal/[id]/page.tsx`
- Create: `site/src/components/v2/MobileCapture.tsx`
- Modify: `site/src/styles/v2.css`

- [ ] **Step 1: MobileCapture** — a client component identical in behaviour to `CaptureRow` (same `subscribeAction`, `TrackingFields`, `source="deal-mobile"`) rendering:

```tsx
<section className="wrap m-capture m-only">
  <form onSubmit={onSubmit}>
    <input type="hidden" name="source" value={source} /><input type="hidden" name="mode" value="inline" /><TrackingFields />
    <input type="email" name="email" placeholder={S.emailPlaceholder} aria-label={S.emailAria} required />
    <button type="submit" className="btn" disabled={pending}>{pending ? S.submitting : S.ctaSubmit}</button>
  </form>
  <div className="fine">{S.finePrint}</div>
</section>
```

with the same `done`/`error` states as `CaptureRow`.

- [ ] **Step 2: Deal page** — add `d-only` to: the `Crumb`, the `v2-cols` section, the curator section, the `v2-context` section, `<CaptureRow>`, the similar-deals section, the `LinkBand`. When `expired`, render after the poster section:

```tsx
<section className="wrap v2-sec m-only m-rows"><div className="v2-rows">
  <Link href="/" className="v2-row v2-row--more"><span className="no" /><span className="v2-row-name">{S.liveHeader}</span><span className="v2-row-meta">{S.navAllDeals}</span><span className="v2-row-price">→</span></Link>
</div></section>
<MobileCapture source="deal-expired-mobile" />
```

and give the `InkBand` on expired pages the class wrapper `<div className={expired ? 'd-only' : undefined}><InkBand /></div>`. For the expired poster on mobile, the CTA is already the signup anchor (`#kapote`) — point it at the MobileCapture form by giving that section `id="kapote-m"` and using `href="#kapote-m"` inside an `m-only` duplicate of the CTA (desktop CTA stays `#kapote`).

- [ ] **Step 3: CSS** (mobile block):

```css
  .m-capture { padding-block: 20px 0; }
  .m-capture form { display: flex; flex-direction: column; gap: 10px; }
  .m-capture input[type="email"] { font-size: 16px; padding: 14px 16px; border-radius: 12px; border: 1.5px solid var(--sand-300); background: #fff; color: var(--v2-ink); font-family: inherit; min-height: 48px; }
  .m-capture .btn { font-weight: 700; font-size: 16px; padding: 14px 22px; border-radius: 12px; background: var(--v2-amber); color: var(--v2-ink); border: 0; font-family: inherit; min-height: 48px; }
  .m-capture .fine { font-family: var(--font-mono); font-size: 10px; letter-spacing: .08em; text-transform: uppercase; color: var(--sand-500); margin-top: 10px; }
```

- [ ] **Step 4: Verify** at 390: `/deal/17` = masthead → poster → curator quote? **No** — the curator quote is hidden on mobile (approved board); → ink band → footer. `/deal/3` (expired) = poster → „Dar spėji" row → form → footer. Compare with DealLiveMobile / DealExpiredMobile boards.
- [ ] **Step 5: Commit** — `git commit -am "feat(site): mobile deal page — poster, one ask, expired tail"`.

---

### Task 9: Mobile footer + masthead compaction, PR B

**Files:**
- Modify: `site/src/components/v2/V2Footer.tsx`
- Modify: `site/src/styles/v2.css`

- [ ] **Step 1: Footer** — give the `links` nav class `links d-only`; add after it `<Link href="/privatumas" className="legal m-only">{S.footerPrivacy}</Link>`.
- [ ] **Step 2: CSS** (mobile block): replace the existing `.v2-footer .bar`/`.links` mobile rules with

```css
  .v2-footer { padding: 0; }
  .v2-footer .bar { min-height: 52px; flex-direction: row; align-items: center; justify-content: space-between; flex-wrap: nowrap; gap: 12px; }
  .v2-footer .legal { font-size: 12px; text-transform: none; letter-spacing: 0; color: var(--sand-600); }
  .v2-footer span.legal { display: none; }
```

- [ ] **Step 3: Verify** at 390 on `/`, `/deal/17`, `/deal/3`, `/buvo`, `/rinkiniai`: footer is one 52 px row (wordmark + Privatumas); every tap target ≥ 44 px; no horizontal scroll at 390; desktop at 1440 unchanged from PR A.
- [ ] **Step 4: Commit, push, PR B** — title `feat(site): slice 2 — mobile layout`, `gh run watch --exit-status`, hand back for merge.

---

## Self-review notes

- Spec coverage: verification time ✔ (T1/T2/T5), lasted ✔ (T1/T2/T5, gated), check line ✔ (T3/T4), window-min ✔ (T4, gated), changed state ✔ (existing lines + T4 flag gated + coral in T3/T4), expired page ✔ (T4 + T8), locked list ✔ (T5 + T7), mobile reduced layout ✔ (T6–T9), empty-state proof ✔ (T7). Not built on purpose: archetype-aware verdict wording (copy), sticky mobile CTA (rejected), price-changed eyebrow wording (gated).
- Names used consistently: `verifiedTime`, `lasted`, `toCheckItems`, `getPriceChecks`, `splitLockedRows`, `CheckLine`, `MobileCapture`, classes `m-only`/`d-only`/`v2-row--more`/`v2-row--locked-n`/`v2-checkline`/`m-capture`.

---

### Task 10: Expired poster variant on the deal page (desktop) — belongs to PR A

Added 2026-09-12 after the controller's visual check: Task 4 covered the kicker, the mid-page capture and the chart bar, but the approved DealExpired board also changes the poster itself. Reference: `docs/plans/2026-09-12-slice2-mockups-generator.py`, `deal_expired = deal_page(... poster_cls="v2-poster--dead" ...)` and `.v2-poster--dead` in its CSS.

**Files:**
- Modify: `site/src/app/deal/[id]/page.tsx` (poster hero + catch line + `dealWhyAndCatch` call)
- Modify: `site/src/styles/v2.css`

**Interfaces:**
- Consumes: `expired` (already computed in the page from `isLive(pd.status)`), `S.trophyHeader` („Buvo. Nebėra."), `S.trophyCaption` („Kas gavo laišką — spėjo."), `S.savedWord` („sutaupė"), `S.ctaSubmit` („Noriu radinių") — all existing keys; `t.baseline`, `t.price`, `save`, `booking`, `POSTER`, `sceneClass`.

- [ ] **Step 1: Poster field + stamp + blurb** — in the poster hero of `page.tsx`:
  - `const posterField = expired ? 'v2-poster--dead' : (POSTER[sceneClass(pd.destination)] ?? 'v2-poster--sun');`
  - stamp: `{expired ? S.trophyHeader : qualityLabel}`
  - blurb: `{expired ? S.trophyCaption : headline}`

- [ ] **Step 2: Price cell** — replace the price/save/CTA block with:

```tsx
<div className="pricecell">
  <div>
    <div className="v2-price price">
      {expired ? <s className="price-dead">{eur(t.price)}</s> : <>{eur(t.price)}{showWas && <s>{eur(t.baseline!)}</s>}</>}
    </div>
    {expired
      ? (save != null && <div className="mono save">{S.savedWord} {eur(save)}</div>)
      : (showWas && save != null && <div className="mono save">{S.saveWord} {eur(save)} {S.youSaveVs}</div>)}
    {!expired && t.priceLines.map((line) => <div key={line} className="mono save">{line}</div>)}
  </div>
  {expired
    ? <a className="cta" href="#kapote">{S.ctaSubmit} <span className="bead" aria-hidden="true" /></a>
    : <a className="cta" href={booking.url} target="_blank" rel="noopener noreferrer">{booking.button} <span className="bead" aria-hidden="true" /></a>}
</div>
```

- [ ] **Step 3: Catch line + catch column** — third catch-line span: `{expired ? t.airline : `${t.airline} · ${freshLabel.toLowerCase()}`}`; in the `dealWhyAndCatch({...})` call pass `goingFast: pd.goingFast && !expired` so „Tirpsta" never appears on an expired deal.

- [ ] **Step 4: CSS** — append next to the other `.v2-poster--*` field modifiers in `v2.css`:

```css
/* expired deal: sand duotone, never the live sun/dusk/sea fields */
.v2-poster--dead { background: linear-gradient(160deg, var(--sand-300) 0%, var(--sand-500) 55%, var(--sand-700) 100%); }
.v2-poster .price-dead { margin-left: 0; font: inherit; opacity: .75; letter-spacing: inherit; }
```

- [ ] **Step 5: Verify** — `npx tsc --noEmit`, `npx vitest run`, `npx next build`; `npx next start -p 3103`; `curl -s http://localhost:3103/deal/3` must contain `v2-poster--dead`, `price-dead`, `Buvo. Nebėra.`, `href="#kapote"` inside the poster, and must NOT contain `Google Flights` or `Tirpsta`; `curl -s http://localhost:3103/deal/17` must be unchanged (sun/stone field, booking CTA present, no `price-dead`). `pkill -f 'next start -p 3103'`.

- [ ] **Step 6: Commit** — `git commit -m "feat(site): expired deal page — sand poster, struck price, signup CTA"`.

## Post-review fixes (PR #56 high-effort review, 2026-09-12)

1. `getPriceChecks` reads exact-itinerary rows only (`source IN ('flights','manual')`, `calendar` excluded — it carries the window minimum), ordered by `checked_at, id` desc.
2. Three check states in `priceChecks.ts` — `priced` / `gone` / `unpriced` (`available=true, price=null` is a real engine state, never rendered as gone); `up` compares to the previous *priced* check; `canShowCheckLine` gates the line (no bare dash, no empty value).
3. `InkBand` takes a `source` prop (default `home`); the deal page passes `deal` so signups attribute correctly.
4. Hero clock hidden again — `verified_at` carries the run start time, not the check time; `verifiedTime` stays in the mappers/types for later.
5. Expired `generateMetadata`: title `«Destination» — Buvo. Nebėra. · Yip`, description = trophy caption + footnote; no dead price in the `<title>`.
6. Expired poster save line uses the same depth gate as live and `/buvo` (`showWas && save > 0`).
7. `vilniusDay(iso)` in `format.ts`; `sameVilniusDay` refactored onto it; check dates are Vilnius calendar days, not UTC.
8. The price-context section is hidden on expired pages — the page speaks in the past tense only in the poster (controller ruling; deviates from the approved board deliberately). `|| showChecks` lets a fresh route with checks but no history show its line.
9. `getPriceChecks` is skipped on expired pages.
10. `going_fast` is a live-only signal in `toTicket` / `toPublicDeal` (a dead row never says „Tirpsta").

Follow-up — engine: stamp `verified_at`/`checked_at` per check, not with the run start `now` (skrendam/verification.py:225) — separate PR; re-enable the hero clock after.

## PR B post-review fixes (2026-09-12)

1. `LiveIndex` renders the collapsed „+ dar N" row for any locked count ≥ 1 — `v2-row--more-m` (mobile-only) when nothing is collapsed, with an empty № instead of a nonsense range; phones no longer lose every locked destination when 1–4 deals are locked.
2. `Masthead` takes `mobileCtaHref`; the expired deal page passes `#kapote-m` so the pill has a visible target on phones (a `pill d-only` / `pill m-only` pair, one pill everywhere else).
3. `.d-only` / `.m-only`: the hide direction is `!important` (`.m-only` hidden in the exact complement of the mobile media query, `.d-only` hidden inside it); the five hide-only component overrides (poster CTA ×2, masthead nav, footer links, footer `a.legal`) are gone; the base `.d-only { display: inline }` is gone; the locked-row hide is `.v2-rows .v2-row--locked-n` (0,2,0), independent of import order.
4. The mobile empty-home section renders only when `past.length > 0` — no link to an empty archive.
5. `TrophyRow({ t, href })` extracted from `TrophyCase`; the mobile empty home uses it (as a Link) instead of `rowMeta` on a dead row.
6. `MobileCapture`'s `source` is required; the unused `deal-mobile` source is out of `SUBSCRIBE_SOURCES`.
7. `.v2-hero--has-poster` is visually hidden on mobile (sr-only pattern), keeping the home's h1 in the accessibility tree and for search engines.

Plan defects recorded: Task 7 never stated the `locked ≤ 4` mobile case; Task 8 left the masthead pill pointing at a hidden anchor on expired mobile; Task 7 used `rowMeta` on a dead row; Task 6 placed the facts line inside an `aria-hidden` box (repaired in its fix round).
