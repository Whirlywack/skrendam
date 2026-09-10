# WP6 — Email: two streams — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publishing a deal emails every paid subscriber within a minute; the curator assembles and sends a Thursday paid digest and a 10-day free nurture letter from the desk; every deal link and „Užsisakiau" click lands as a `deal_events` row with its `issue_id`; a free subscriber never receives the instant stream.

**Architecture:** One additive migration (`0014_email_streams`). Sending lives in `web/` (the desk, laptop-hosted) behind an `emailEnabled()` gate: the instant stream fires inside `publishDeal`; digest and nurture are assembled on a new Letters page, saved as `issues` rows, and sent by a button (decision D1 — there is no always-on host). Tracking routes live in `site/` (Vercel) because links must resolve publicly. Recipients always come through one `activeSubscribers()` helper (confirmed, not unsubscribed, by plan).

**Tech Stack:** Python 3.13 + SQLAlchemy/Alembic (`skrendam/`), Next.js 16 + drizzle (`web/`, `site/`), Resend SDK (already in `site/`; added to `web/`), vitest, pytest, ruff.

**Spec:** `docs/plans/2026-09-10-demand-layer-launch-spec.md` §0.2, §2.3, §4 WP6 (+ WP3.4/3.5 moved here), §5, §6, §7, §8, §9. Parent plan `docs/plans/2026-09-10-demand-layer-implementation-plan.md` §C (D1, D2), §F WP6. Verified facts: `.superpowers/sdd/2026-09-10-demand-layer-implementation-plan/wp6-research.md` (file:line for every claim below).

## Global Constraints

- Branch `feat/wp6-email-streams` from `main` **after PR #37 (site follow-up, migration 0013) and PR #38 (WP3 desk) are merged**; worktree `.claude/worktrees/wp6-email` created from the main checkout with an absolute path.
- Alembic single head: `0014_email_streams`, `down_revision = "0013_unsubscribe"`. Model↔migration parity gate `tests/skrendam/test_migration.py` (SQLite `alembic check`): backfills in Python, `batch_alter_table` for column adds, `sa.JSON()` for json columns, indexes named `ix_<table>_<column>`.
- Generated drizzle schemas (`web/src/db/generated/*`, `site/src/db/generated/*`) are never hand-edited; the controller applies the migration to Neon dev and re-pulls both apps (`cd site && npm run db:pull`; `cd web && npx drizzle-kit pull`, exporting `DATABASE_URL_UNPOOLED` from each app's `.env.local`). Expect table reordering in the diff.
- Recipients only via `activeSubscribers(plan)` = `confirmed = true AND unsubscribed_at IS NULL AND plan = $plan`. **The instant stream and the digest go to `plan = 'paid'` only; the nurture to `plan = 'free'` only** (spec §9). A test proves a free subscriber is never in the instant recipient list.
- Every outgoing email (all three renderers) ends with the unsubscribe link `unsubscribeUrl(unsubscribe_token)` and sets the `List-Unsubscribe` header to that URL. No email is ever sent to a row with a NULL `unsubscribe_token` (skip + count in stats).
- `emailEnabled()` = `!!process.env.RESEND_API_KEY` in `web/` exactly as in `site/src/lib/email.ts:5-7`; every send path returns early (and still records the `issues` row with `stats.skipped_no_key = true`) when disabled. `web/e2e/journey.spec.ts` really publishes and must keep passing without a key.
- Copy: Lithuanian, `tu` voice, lowercase spoken verbs, „radinys"; spec §7 strings verbatim; banned: *akcija, superkaina, nepraleisk progos!*, „skenuoti"/"scan"; real counts only („{n} prenumeratorių užsisakė" only from `deal_events`, never estimated); was-price/„įprastai" only when `discount_pct ≥ 30` (`WAS_PRICE_MIN_DROP_PCT`).
- Constants (spec §6), module-level: `FREE_LETTER_CADENCE_DAYS = 10`, `FREE_LETTER_FRESH = 2`, `FREE_LETTER_MISSED = 3` in `web/src/lib/letters.ts`; `DIGEST_DAY = 'Thursday'`, `DIGEST_TIME = '07:00'` (informational labels on the Letters page — no scheduler).
- No LLM in the send path; rules and stored copy only. No affiliate links. Tier thresholds untouched.
- Desk pages follow existing conventions: `(app)/…/page.tsx` + `ConfigShell`, server actions in a `'use server'` file starting with `await requireAdmin()` and ending with `revalidatePath`, Sidebar entry added in `web/src/components/Sidebar.tsx`.
- Site tracking endpoints are public: rate-limit with the existing `FixedWindowLimiter` (`site/src/lib/rate-limit.ts`), never trust ids from the URL beyond existence checks, no state change on GET except the click insert (documented; prefetch noise accepted).
- Each commit ends with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_018PDTEbaxZkCdkN6PbHUSA9`.
- Gates: `uv run pytest tests/skrendam -q`; `uv run ruff check skrendam tests/skrendam alembic && uv run ruff format --check skrendam tests/skrendam alembic`; `cd web && npx tsc --noEmit && npx vitest run && npx eslint <touched>`; same in `site/`.

---

### Task 1: Migration `0014_email_streams` + models + `expired_at` writers

**Files:**
- Modify: `skrendam/db/models.py` (Subscriber, PublishedDeal; new `Issue`, `DealEvent`)
- Create: `alembic/versions/0014_email_streams.py`
- Modify: `skrendam/scanning/orchestrator.py::_expire_published_past_date` (~:467-483)
- Create: `scripts/2026-09-12_founding_interest_backfill.sql` (one-off, written not run)
- Test: `tests/skrendam/test_migration.py`, `tests/skrendam/test_orchestrator.py`

**Interfaces (produces):**
```python
class Subscriber:  # additions
    plan: Mapped[str] = mapped_column(String, nullable=False, server_default="free")   # 'free' | 'paid'
    paid_since: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    paid_source: Mapped[str | None] = mapped_column(String, nullable=True)             # 'manual' | 'stripe'
class PublishedDeal:  # addition
    expired_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
class Issue(Base):
    __tablename__ = "issues"
    id, kind: str  # 'paid_digest' | 'free_nurture' | 'instant'
    sent_at: DateTime | None; deal_ids: JSON (list[int]); expired_deal_ids: JSON (list[int]);
    stats: JSON | None; created_at: DateTime (default _now)
class DealEvent(Base):
    __tablename__ = "deal_events"
    id, deal_id: FK published_deals.id (index), issue_id: FK issues.id nullable (index),
    subscriber_id: FK subscribers.id nullable (index), kind: str  # 'click' | 'booked_claim'
    source: str | None; created_at: DateTime (default _now)
```
Indexes: `ix_deal_events_deal_id`, `ix_deal_events_issue_id`, `ix_deal_events_subscriber_id`, `ix_subscribers_plan`.

- [ ] **Step 1: Failing tests.** In `test_migration.py` add `test_0014_backfills_expired_at` pinned at `0013_unsubscribe`: insert two `published_deals` rows via raw SQL — one `status='expired'` with `valid_until='2026-08-01'` and `last_seen_at=NULL`, one `status='expired'` with `valid_until=NULL` and `last_seen_at='2026-08-05 10:00:00'`, one `status='live'` — upgrade to head — assert `expired_at` = `2026-08-01 00:00:00`, `2026-08-05 10:00:00`, `NULL` respectively; and `subscribers.plan` defaults to `'free'` for a pre-existing row. In `test_orchestrator.py` add `test_date_sweep_stamps_expired_at`: a live deal with `valid_until < today` → after `run_scan(...)` `status == "expired"` and `expired_at == now` (the injected `now`).
- [ ] **Step 2: Run** `uv run pytest tests/skrendam/test_migration.py tests/skrendam/test_orchestrator.py -q` → FAIL.
- [ ] **Step 3: Implement.** Migration in 0012/0013 style: `batch_alter_table("subscribers")` add `plan` (server_default `'free'`, nullable False), `paid_since`, `paid_source`; `batch_alter_table("published_deals")` add `expired_at`; `create_table("issues")`, `create_table("deal_events")`; indexes; **backfill in Python** (select id, valid_until, last_seen_at, published_at where status='expired'; set `expired_at = datetime.combine(valid_until, time.min) if valid_until else (last_seen_at or published_at)` per row — SQLite-safe, no SQL casts). Downgrade mirrors. `_expire_published_past_date(session, today, now)`: sets `status="expired"` and `expired_at=now` (thread `now` from `run_scan`, which already has it). Write the founding-interest SQL:
  ```sql
  -- one-off: pre-existing early opt-ins get the founding-interest flag (spec WP6.4)
  UPDATE subscribers SET prefs = (coalesce(prefs::jsonb,'{}'::jsonb) || '{"founding_interest": true}'::jsonb)::json
  WHERE early_alerts = true AND coalesce(prefs::jsonb->>'founding_interest','') <> 'true';
  ```
- [ ] **Step 4: Run** full pytest + ruff → PASS (`alembic check` clean on SQLite).
- [ ] **Step 5: Commit** `feat(db): 0014 email streams — subscribers.plan, issues, deal_events, published_deals.expired_at`.
- [ ] **Controller step (not the implementer):** apply to Neon dev (`uv run alembic upgrade head` with `SKRENDAM_DATABASE_URL` from `web/.env.local`), re-pull drizzle in both apps, commit `chore(db): regenerate drizzle schemas after 0014`.

---

### Task 2: `web/` email foundation — sender, recipients, links, formatting

**Files:**
- Modify: `web/package.json` (add `"resend": "^6.12.4"` — same major as site), `web/.env.example` (add `RESEND_API_KEY=`, `YIP_FROM_EMAIL=`, `NEXT_PUBLIC_SITE_URL=`, `PAYMENT_LINK_URL=`)
- Create: `web/src/lib/email/client.ts`, `web/src/lib/subscribers.ts`, `web/src/lib/links.ts`
- Modify: `web/src/lib/format.ts` (add `eur`)
- Test: `web/src/lib/links.test.ts`, `web/src/lib/subscribers.test.ts` (pure parts), `web/src/lib/format.test.ts`

**Interfaces (produces):**
```ts
// web/src/lib/email/client.ts
export function emailEnabled(): boolean;                       // !!process.env.RESEND_API_KEY
export const FROM: string;                                     // process.env.YIP_FROM_EMAIL ?? 'Yip <hello@yip.lt>'
export interface OutgoingMail { to: string; subject: string; html: string; text: string; unsubscribeUrl: string }
export async function sendMail(m: OutgoingMail): Promise<{ ok: true } | { ok: false; error: string }>;
// sets headers: { 'List-Unsubscribe': `<${m.unsubscribeUrl}>` }; never throws — returns ok:false
// web/src/lib/links.ts
export function siteUrl(): string;                              // NEXT_PUBLIC_SITE_URL ?? 'https://yip.lt' (live fallback, like site's unsubscribe.ts)
export function unsubscribeUrl(token: string): string;          // `${siteUrl()}/atsisakyti?token=${token}` — byte-identical logic to site/src/lib/unsubscribe.ts
export function trackedDealUrl(dealId: number, issueId: number | null, subscriberId: number): string;
//   `${siteUrl()}/go/${dealId}?i=${issueId ?? ''}&s=${refCode(subscriberId)}`  (refCode from ./refcode)
export function claimUrl(dealId: number, issueId: number | null, subscriberId: number): string;   // `/uzsisakiau/${dealId}?i=…&s=…`
export function upgradeUrl(subscriberId: number): string;       // `${process.env.PAYMENT_LINK_URL ?? ''}?client_reference_id=${refCode(subscriberId)}`; '' when env unset
// web/src/lib/subscribers.ts
export type Plan = 'free' | 'paid';
export interface Recipient { id: number; email: string; plan: Plan; prefs: Record<string, unknown> | null; unsubscribeToken: string | null }
export async function activeSubscribers(plan: Plan): Promise<Recipient[]>;   // confirmed AND unsubscribedAt IS NULL AND plan = $plan
export function wantsOrigin(r: Recipient, origin: string): boolean;         // prefs.origins empty/absent → true, else includes(origin)
export function momentCodes(r: Recipient): string[];                        // prefs.moments ?? []
export function sendable(r: Recipient): boolean;                            // unsubscribeToken != null && email present
// web/src/lib/format.ts
export function eur(v: number): string;                                     // '123 €' — same output as site/src/lib/format.ts:20
```

- [ ] **Step 1: Failing tests** — `links.test.ts`: `trackedDealUrl(42, 7, 5)` ends with `/go/42?i=7&s=` + `refCode(5)`; `issueId null` → `i=`; `upgradeUrl` returns `''` when `PAYMENT_LINK_URL` unset and appends `?client_reference_id=<refCode>` when set (use `vi.stubEnv`); `unsubscribeUrl('abc')` equals `https://yip.lt/atsisakyti?token=abc` with env unset. `subscribers.test.ts`: `wantsOrigin` with `prefs null`, `origins []`, `origins ['VNO']` vs `'KUN'`; `sendable` false for null token. `format.test.ts`: `eur(93)` → `'93 €'`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** (client wraps `new Resend(key).emails.send({ from, to, subject, html, text, headers })` in try/catch). `npm install resend@^6.12.4` in `web/`.
- [ ] **Step 4: Run** `npx tsc --noEmit && npx vitest run && npx eslint src/lib` → PASS.
- [ ] **Step 5: Commit** `feat(desk): email foundation — resend client, recipients, tracked links, eur()`.

---

### Task 3: Renderers — instant, digest, nurture (LT, HTML + text)

**Files:**
- Create: `web/src/lib/email/render.ts`, `web/src/lib/email/copy.ts`, `web/src/lib/letters.ts` (constants)
- Test: `web/src/lib/email/render.test.ts`

**Interfaces:**
- Consumes: `typeof publishedDeals.$inferSelect` rows (`headline, body, origin, destination, price, baselinePrice, discountPct, travelDate, returnDate, tripType, id, newsletterTag, expiredAt, publishedAt`), `Recipient`, links from Task 2, `personas.json` (`web/src/lib/personas.json`), `city()` from `web/src/lib/airports.ts`, `formatDates` from `format.ts`, `WAS_PRICE_MIN_DROP_PCT`.
- Produces:
  ```ts
  // copy.ts (spec §7 verbatim)
  export const L = {
    headline: 'Savaitės radinys', family: 'Atostogų radaras', missed: 'Ką praleidai',
    upgrade: 'Gauk kiekvieną radinį tą pačią minutę', booked: 'Užsisakiau',
    bookedN: (n: number) => `${n} prenumeratorių užsisakė`,
    instantSubject: (deal) => `${eur(deal.price)} — ${city(deal.destination)}`,   // numbers are the hero
    digestSubject: (n) => `Savaitės radiniai: ${n}`, nurtureSubject: 'Ką praleidai — ir du nauji radiniai',
    lasted: (h: number) => h < 48 ? `išbuvo ${h} val.` : `išbuvo ${Math.round(h/24)} d.`,
    usually: (b) => `įprastai ${eur(b)}`, unsub: 'Atsisakyti laiškų', bookDirect: 'Į bilietus →',
  } as const;
  // letters.ts
  export const FREE_LETTER_CADENCE_DAYS = 10, FREE_LETTER_FRESH = 2, FREE_LETTER_MISSED = 3;
  export const DIGEST_DAY = 'Thursday', DIGEST_TIME = '07:00';
  // render.ts
  export interface Rendered { subject: string; html: string; text: string }
  export function renderInstant(deal, r: Recipient, issueId: number): Rendered;
  export function renderDigest(deals: Deal[], r: Recipient, issueId: number): Rendered;   // blocks ordered: deals whose personas (personas.json[newsletterTag]) intersect momentCodes(r) first ('family'/'home' blocks under L.family), then the rest under L.headline
  export function renderNurture(fresh: Deal[], missed: (Deal & { lastedHours: number; bookedCount: number })[], r: Recipient, issueId: number): Rendered;
  //   fresh under L.headline, missed under L.missed with real price + L.lasted + (bookedCount > 0 ? L.bookedN : nothing), one upgrade link (upgradeUrl) under L.upgrade — omitted entirely when upgradeUrl() === ''
  export function dealCard(deal, r, issueId): { html: string; text: string }   // headline, dates, price, „įprastai" only if discountPct ≥ WAS_PRICE_MIN_DROP_PCT, body (as-is, newline → <br>), CTA trackedDealUrl, claim link claimUrl
  ```
  HTML follows `site/src/lib/email.ts` style (inline styles, `max-width:520px`, bg `#FFFDF7`, text `#1C1813`, CTA `#E2820E`/`#FFFDF7`, muted `#6B6560`, wordmark `yıp`), footer with `unsubscribeUrl` text link. All user-derived strings HTML-escaped (`escapeHtml` helper — headline/body are curator text but escape anyway).

- [ ] **Step 1: Failing tests** with a deal fixture (`price 93, baselinePrice 275, discountPct 66, body 'Kalėdų atostogos — €93, įprastai apie €275\n1 persėdimas'`): instant subject `'93 € — Londonas'`… (use whatever `city('LON'|'STN')` returns in `airports.json` — assert via `city()`), html contains `/go/<id>?i=<issue>&s=`, contains `atsisakyti?token=`, contains `įprastai 275 €`; with `discountPct 20` no `įprastai`; digest orders a `family_sun` deal before a `winter_sun` deal for a recipient with `moments ['family']` and the reverse ordering for `moments ['sun']`; nurture with `upgradeUrl() === ''` has no `L.upgrade` heading, with env set has exactly one upgrade link carrying `client_reference_id`; missed card shows `išbuvo 36 val.` for 36 h and `išbuvo 3 d.` for 72 h, `bookedN` only when count > 0; `text` twin non-empty and contains the same URLs; no banned words in any output (assert regex `/akcija|superkaina|nepraleisk|skenuo/i` absent); headline `<b>` escaped.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS. **Step 5: Commit** `feat(desk): LT email renderers — instant, digest, nurture`.

---

### Task 4: Instant paid stream inside `publishDeal`

**Files:**
- Modify: `web/src/app/actions.ts::publishDeal` (~:106-159), `web/src/app/actions.ts::expireDeal` (+`expiredAt`), `republishDeal` (clear `expiredAt`)
- Create: `web/src/lib/email/streams.ts`
- Test: `web/src/lib/email/streams.test.ts`

**Interfaces:**
```ts
// streams.ts
export interface SendDeps { recipients: (plan: Plan) => Promise<Recipient[]>; send: (m: OutgoingMail) => Promise<{ok:boolean; error?: string}>; insertIssue: (kind, dealIds, expiredIds) => Promise<number>; finishIssue: (id, stats) => Promise<void>; now: () => Date }
export interface SendStats { attempted: number; sent: number; failed: number; skipped_no_token: number; skipped_origin: number; skipped_no_key?: boolean }
export async function sendInstant(deal, deps: SendDeps): Promise<{ issueId: number; stats: SendStats }>;
//   recipients('paid') → filter sendable && wantsOrigin(r, deal.origin) → renderInstant → send; rare archetype changes nothing here (a single deal is always immediate)
export const defaultDeps: SendDeps;   // real db + sendMail
```
`publishDeal`: `.returning({ id })` on the insert; after the candidate update, `if (emailEnabled()) await sendInstant(row, defaultDeps)` else `await insertIssue('instant', [id], [])` with `stats.skipped_no_key = true`; errors from the send are caught and logged, **never** fail the publish (the deal is live regardless; the Letters page shows the failed issue). `expireDeal`: `status:'expired', expiredAt: now`. `republishDeal`: `expiredAt: null`.

- [ ] **Step 1: Failing tests** with fake deps: paid recipients only (`recipients` called with `'paid'` exactly once, never `'free'`); a recipient with `origins ['KUN']` skipped for a VNO deal (`skipped_origin 1`); null token skipped; `send` failure counted not thrown; `insertIssue` called with kind `'instant'` and `[deal.id]`; `finishIssue` receives the stats.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** tsc/vitest/eslint → PASS; run `npx playwright test e2e/journey.spec.ts` if a dev DB is reachable (no key → publish still succeeds). **Step 5: Commit** `feat(desk): instant paid stream on publish; expired_at on expire/republish`.

---

### Task 5: Letters page — assemble, save, send (paid digest + free nurture)

**Files:**
- Create: `web/src/app/(app)/letters/page.tsx` (list of issues + two "Assemble" buttons), `web/src/app/(app)/letters/[id]/page.tsx` (preview + Send), `web/src/app/letters-actions.ts` (`'use server'`), `web/src/lib/letters-queries.ts`, `web/src/lib/letters.ts` (+assembly pure functions)
- Modify: `web/src/components/Sidebar.tsx` (entry `Letters` → `/letters`, icon `Mail`)
- Test: `web/src/lib/letters.test.ts`

**Interfaces:**
```ts
// letters.ts (pure)
export function pickDigest(deals: Deal[], lastDigestAt: string | null): Deal[];   // live deals published after lastDigestAt (all, if null), newest first
export function pickNurture(deals: Deal[], events: DealEvent[], now: Date): { fresh: Deal[]; missed: (Deal & {lastedHours; bookedCount})[] }
//   fresh = FREE_LETTER_FRESH newest live; missed = FREE_LETTER_MISSED most recent status='expired' with expiredAt != null, lastedHours = round((expiredAt − publishedAt)/3600000), bookedCount = events(kind='booked_claim', deal_id).length
// letters-queries.ts
export async function listIssues(): Promise<Issue[]>; getIssue(id); lastIssueOf(kind): Promise<Issue | null>; liveDeals(); expiredDeals(limit); bookedCounts(dealIds)
// letters-actions.ts
export async function assembleIssue(kind: 'paid_digest' | 'free_nurture'): Promise<void>;   // requireAdmin; picks; inserts issues row (sent_at null); redirect(`/letters/${id}`)
export async function sendIssue(id: number): Promise<void>;   // requireAdmin; refuses if sent_at != null; plan = kind === 'paid_digest' ? 'paid' : 'free'; per recipient render (digest: renderDigest; nurture: renderNurture) + sendMail; writes sent_at + stats; revalidatePath('/letters')
```
Preview page renders the HTML for a sample recipient (`{ id: 0, prefs: null, unsubscribeToken: 'preview' }`) inside an `<iframe srcDoc>`, lists included deals with headlines, shows `DIGEST_DAY DIGEST_TIME` / `FREE_LETTER_CADENCE_DAYS` as a hint line („send by hand — no scheduler"), and a Send button (`useTransition`, confirm on second click like `Dismiss group…` in QueueBoard). Sent issues show stats.

- [ ] **Step 1: Failing tests** for `pickDigest` (cutoff respected, null → all) and `pickNurture` (counts, lastedHours 36 for 1.5 days, bookedCount from events, deals without `expiredAt` excluded).
- [ ] **Step 2–4:** red → implement → tsc/vitest/eslint green. Manual: `npm run dev` (port 3000), assemble both kinds against dev DB, preview renders, Send with no key records `skipped_no_key`.
- [ ] **Step 5: Commit** `feat(desk): Letters page — assemble, preview, send paid digest and free nurture`.

---

### Task 6: Subscribers page + manual plan flip

**Files:**
- Create: `web/src/app/(app)/subscribers/page.tsx`, `web/src/app/subscribers-actions.ts`, `web/src/lib/subscribers-queries.ts`
- Modify: `web/src/components/Sidebar.tsx` (entry `Subscribers` → `/subscribers`, icon `Users`)
- Test: `web/src/lib/subscribers.test.ts` (extend: `referralCounts`)

**Interfaces:**
```ts
export async function listSubscribers(): Promise<Array<{ id, email, plan, confirmed, earlyAlerts, createdAt, paidSince, unsubscribedAt, prefs }>>;
export function referralCounts(rows: { prefs }[]): Map<string, number>;   // prefs.referred_by refcode → count
export async function setPlan(id: number, plan: Plan): Promise<void>;     // requireAdmin; paid → { plan:'paid', paidSince: now, paidSource:'manual', earlyAlerts: true }; free → { plan:'free', paidSince: null, paidSource: null }; revalidatePath('/subscribers')
```
Table columns: email, plan (button toggles), confirmed, moments, origins, utm.source, founding_interest, referrals (count of rows whose `referred_by === refCode(id)`), created, unsubscribed. Sorted newest first. Counts line at top: total / confirmed / paid / unsubscribed.

- [ ] Tests for `referralCounts`; page + action; commit `feat(desk): Subscribers page with manual plan flip`.

---

### Task 7: Site tracking — `/go/[dealId]` and `/uzsisakiau/[dealId]`

**Files:**
- Create: `site/src/app/go/[dealId]/route.ts`, `site/src/app/uzsisakiau/[dealId]/page.tsx`, `site/src/app/uzsisakiau/[dealId]/claim-action.ts`, `site/src/lib/events.ts`
- Modify: `site/src/lib/lt.ts` (`S.claimTitle = 'Užsisakei?'`, `S.claimBody = 'Paspausk — suskaičiuosim, kiek žmonių pasinaudojo radiniu.'`, `S.claimCta = 'Užsisakiau'`, `S.claimDone = 'Ačiū! Užrašėm.'`, `S.claimInvalid = 'Šio radinio neberodome.'`), `site/src/lib/rate-limit.ts` (`clickLimiter` 60/min/IP)
- Test: `site/src/lib/events.test.ts`

**Interfaces:**
```ts
// events.ts
export function parseTracking(sp: URLSearchParams): { issueId: number | null; subscriberId: number | null }   // i → int or null; s → parseRefCode (site/src/lib/refcode.ts) or null
export async function recordEvent(e: { dealId: number; issueId: number | null; subscriberId: number | null; kind: 'click' | 'booked_claim'; source: string | null }): Promise<void>
//   booked_claim: skip insert when one already exists for (dealId, subscriberId) with subscriberId != null
```
`/go/[dealId]` GET: load `published_deals` by id (any status); missing → 404; `recordEvent(click)` (fire-and-forget with catch, `source = req.headers.get('referer') ? 'email' : null` → keep it simply `'email'` when `i` present else `null`); 302 to `bookingUrl` (or to `/deal/[id]` when `bookingUrl` null). `force-dynamic`. `/uzsisakiau/[dealId]`: GET page (same shell as `/atsisakyti`) with a POST button → `claimAction` records `booked_claim` → redirect `?done=1` state; unknown deal → `S.claimInvalid`.

- [ ] Tests for `parseTracking` (bad `s`, bad `i`, both missing) and the claim dedupe (pure decision helper). Commit `feat(site): tracked deal redirects and booked-claim page`.

---

### Task 8: Docs and env

**Files:** `docs/PROJECT.md` (§pipeline: newsletter now live from the desk; the two streams; Letters/Subscribers pages; env keys; "no scheduler — Thursday is a calendar habit"), `web/.env.example`, `docs/handoffs/2026-09-1X-wp6-email-streams.md` (what to do on first send: Resend domain DNS records, test send to Gmail/Apple/Outlook, Payment Link creation, one-off founding-interest SQL).

- [ ] Commit `docs: WP6 email streams — pipeline, env, first-send checklist`.

---

## Acceptance (spec §4 WP6 / §8)

- Publish → paid subscribers receive the instant email within a minute (with key); free never (test + `activeSubscribers('paid')` only).
- Letters page assembles both kinds; preview renders; Send writes `sent_at` + stats.
- Events land with `issue_id` via `/go` and `/uzsisakiau`.
- Founder: SPF/DKIM/DMARC in Resend for `yip.lt`, test sends in three clients, Stripe Payment Link URL into `web/.env.local` as `PAYMENT_LINK_URL`, manual `plan` flips on the Subscribers page.
