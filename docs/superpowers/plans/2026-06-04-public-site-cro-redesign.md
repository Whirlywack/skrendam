# Yip public site v2 — CRO/SEO/GEO redesign · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Redesign the public `site/` app into a travel-desire-led, conversion-focused "opportunity inbox" with boarding-pass ticket cards, an enriched deal-detail, collections, a past-deals archive, a full email signup flow, and an early-alerts waitlist — optimised for CRO + SEO + GEO.

**Architecture:** Extends the existing read-only Next.js 16 `site/` app (Spec 2). Reuses its data layer (`queries`/`mappers`/`quality`/`booking`/`priceContext`) and tokens (`colors_and_type.css`). New surfaces are added as focused components + routes; the homepage is restructured into 10 sections. One engine migration adds `subscribers` columns (confirm/token/early-alerts/prefs). Email sending (double opt-in) integrates Resend and **degrades gracefully to single opt-in until a key is configured**.

**Tech Stack:** Next 16.2.7 (App Router, SSR/ISR), React 19, Drizzle (neon-http, read-only + the `subscribers` write), Neon Postgres, Vitest, Playwright, Alembic (one migration), Resend (email, gated). Yip design-system kit.

**Spec:** `docs/superpowers/specs/2026-06-04-public-site-cro-redesign-design.md`. **Visual source of truth:** the approved mockups at `.superpowers/brainstorm/20278-1780577522/content/{homepage-v3-brand,deal-detail-brand,signup-flow,early-alerts-and-collection}.html` → copied into `site/design-reference/` in Task 1; build components to match their DOM/classes.

---

## File Structure

**New components** (`site/src/components/`): `DealTicket.tsx` (the boarding-pass card + featured variant), `Photo.tsx` (the `.yip-photo` treatment wrapper), `CollectionTile.tsx`, `ProcessBand.tsx`, `EarlyAlertsBand.tsx`, `Faq.tsx`, `Footer.tsx`, `CuratorNote.tsx`, `SimilarDeals.tsx`, `SignupCard.tsx` (the dual-CTA hero card), `PreferenceStep.tsx`. Reworked: `Header.tsx`, `Hero.tsx`, `DealDetail.tsx`, `CaptureBand.tsx`. Likely removed: `Tabs.tsx`, `BrowseCard.tsx` (replaced by sections + `DealTicket`).
**New libs** (`site/src/lib/`): `collections.ts` (config + filters), `email.ts` (Resend, gated), `jsonld.ts` (structured data), `photos.ts` (destination→image/treatment). Extended: `queries.ts` (collection + past queries), `mappers.ts` (`toTicket`), `types.ts`.
**New routes** (`site/src/app/`): `[collection]/page.tsx` (top-level slug), `collections/page.tsx` (index), `past-deals/page.tsx`, `subscribe/page.tsx`, `early-alerts/page.tsx`, `confirm/route.ts`. Reworked: `page.tsx`, `subscribe-action.ts`, `sitemap.ts`, `robots.ts`, `layout.tsx`.
**Engine:** `skrendam/db/models.py` (`Subscriber` cols) + `alembic/versions/0005_subscriber_prefs.py`.
**Styles:** add new component CSS to `site/src/styles/site.css`.

---

## Task 1: Foundations — design references + the new component CSS

**Files:** copy mockups → `site/design-reference/`; modify `site/src/styles/site.css`.

- [ ] **Step 1: copy the approved mockups** as the visual source of truth:
```bash
cd /Users/superoptimised/Documents/Skrendam
cp .superpowers/brainstorm/20278-1780577522/content/homepage-v3-brand.html site/design-reference/homepage-v2.html
cp .superpowers/brainstorm/20278-1780577522/content/deal-detail-brand.html site/design-reference/deal-detail-v2.html
cp .superpowers/brainstorm/20278-1780577522/content/signup-flow.html site/design-reference/signup-flow.html
cp .superpowers/brainstorm/20278-1780577522/content/early-alerts-and-collection.html site/design-reference/early-alerts-and-collection.html
```
- [ ] **Step 2: lift the new component CSS into `site/src/styles/site.css`.** READ the `<style>` blocks in the four mockups above. Append (scoped under `.yip-site`, aliasing local vars to the real tokens as the existing file already does) the rules NOT already present: the boarding-pass ticket (`.deal`, `.deal .ph`, `.eyebrow`/`.place` overlays, `.hot-tag`, `.meta`, `.chips`/`.chip-good`/`.chip-caveat`, `.ticket-foot` + the `::before`/`::after` notch cut-outs, `.price`/`s`/`.ret`, `.btn-see`); the **asymmetric hero** (`.hero-grid`, `.hero-left`, `.cap`/`.freebadge`/`.trust`/`.cap-early`, `.hero-photo`, `.microproof`); the featured ticket (`.feat`); the **section bands** (`.band`+`.bead`, `.coll`/`.ctile`, `.how`/`.proc`/`.pstep`, `.early`, the FAQ `details`/`summary` accordion, the canonical `.ftr`); the deal-detail additions (`.dcols`/`.dlist`, `.curator`, `.nudge`). De-dupe against existing classes; keep the `.yip-photo` treatments from `assets/imagery.css` (copy `--protect`/`--warm`/`--duotone` + `.ph-cap` into `site.css` if not present).
- [ ] **Step 3: verify + commit.** `cd site && npm run build` (succeeds — CSS only, no component refs yet). 
```bash
git add site/design-reference site/src/styles/site.css
git commit -m "feat(site): design references + new component CSS (ticket card, hero grid, sections)"
```

## Task 2: `Photo` + `DealTicket` components

**Files:** Create `site/src/lib/photos.ts`, `site/src/components/Photo.tsx`, `site/src/components/DealTicket.tsx` + `site/src/components/DealTicket.test.ts` (light render assertion is hard for RSC; instead unit-test the mapper in Task 5 — here, build-verify). Modify `site/src/lib/types.ts` (add a `TicketView`), `site/src/lib/mappers.ts` (add `toTicket`).

- [ ] **Step 1: `photos.ts`** — a destination→treatment helper (real photos drop in later; warm gradient/duotone fallback now, so nothing renders broken):
```typescript
// site/src/lib/photos.ts
// Maps an IATA destination to a warm "scene" class (real golden-hour photos replace these later
// via <Photo src=...>; the gradient is the graceful fallback — see assets/imagery.css).
const SCENE: Record<string, string> = {
  LCA: 'ph-coast', AGP: 'ph-coast', TFS: 'ph-coast', FAO: 'ph-coast', // sun/coast
  BCN: 'ph-city', BGY: 'ph-city', VIE: 'ph-city', PRG: 'ph-city', CIA: 'ph-city', STN: 'ph-city',
  CPH: 'ph-snow', AYT: 'ph-coast',
};
export function sceneClass(iata: string): string { return SCENE[iata] ?? 'ph-sun'; }
```
- [ ] **Step 2: `Photo.tsx`** — wraps the `.yip-photo` treatment (protect/duotone) + a warm scene fallback; accepts an optional real `src`:
```tsx
// site/src/components/Photo.tsx
export function Photo({ scene, src, treatment = 'protect', className = '', children }:
  { scene: string; src?: string; treatment?: 'protect' | 'duotone'; className?: string; children?: React.ReactNode }) {
  return (
    <div className={`yip-photo yip-photo--${treatment} ${scene} ${className}`}>
      {src && <img src={src} alt="" loading="lazy" />}
      {children}
    </div>
  );
}
```
- [ ] **Step 3: `DealTicket.tsx`** — the canonical boarding-pass card; match `deal-detail-v2.html`/`homepage-v2.html` `.deal` markup (eyebrow + place overlay, mono meta, hook headline, why/caveat chips, perforated ticket-foot with notch, price·~~usual~~·airline, See deal). Props from a `TicketView` (Task 5). `featured` variant = the horizontal layout. Links to `/deal/{id}`. Server component.
```tsx
// site/src/components/DealTicket.tsx (shape — match the mockup classes exactly)
import Link from 'next/link';
import type { TicketView } from '@/lib/types';
import { Photo } from './Photo';
export function DealTicket({ t, featured = false }: { t: TicketView; featured?: boolean }) {
  return (
    <Link href={`/deal/${t.id}`} className={featured ? 'feat' : 'deal'} aria-label={`${t.destination} from €${t.price}`}>
      <Photo scene={t.scene} className="ph">
        <div className="ov" /><span className="eyebrow">{t.eyebrow}</span>
        <div className="place">{t.destination}<small>{t.country} · from {t.origin}</small></div>
        {t.goingFast && <span className="hot-tag">▲ Going fast</span>}
      </Photo>
      <div className="body">
        <div className="meta">{t.route} · {t.dates} · {t.legs}</div>
        <h3>{t.headline}</h3>
        <div className="chips"><span className="chip chip-good">↓ {t.drop}% under</span>{t.catchChip && <span className="chip chip-caveat">{t.catchChip}</span>}</div>
        <div className="ticket-foot"><div className="price">€{t.price}{t.baseline && <s>€{t.baseline}</s>}<span className="ret">return · {t.airline}</span></div><span className="btn-see">See deal →</span></div>
      </div>
    </Link>
  );
}
```
- [ ] **Step 4:** build-verify `cd site && npx tsc --noEmit && npm run build`. Commit:
```bash
git add site/src/lib/photos.ts site/src/components/Photo.tsx site/src/components/DealTicket.tsx site/src/lib/types.ts
git commit -m "feat(site): Photo (.yip-photo) + boarding-pass DealTicket components"
```
(`TicketView` type + the `toTicket` mapper land in Task 5; this task may leave a temporary `TicketView` stub in `types.ts` that Task 5 completes — note it as DONE_WITH_CONCERNS if so.)

## Task 3: Homepage — Header + asymmetric hero + dual-CTA card

**Files:** rework `site/src/components/Header.tsx`, `Hero.tsx`; create `site/src/components/SignupCard.tsx`.

- [ ] **Step 1: `Header.tsx`** — nav `Deals · Collections · Past fares · How it works` + the `From VNO · KUN · RIX` pill (match `.hdr` in `homepage-v2.html`). The "Get deals by email" link → `href="#capture"`.
- [ ] **Step 2: `SignupCard.tsx`** (`'use client'`) — the hero capture card: FREE badge, headline "Get the next rare fare by email", email input + **Get free weekly deals** (calls `subscribe` from Task 11 via `useTransition`; success → inline "You're in" + soft upsell), `cap-sub` "Best rare fares in one calm weekly email.", trust row, divider, the early-alerts secondary (`Get early alerts →` → `/early-alerts`). Match `.cap` markup; reuse the success/error pattern from the existing `CaptureBand.tsx`.
- [ ] **Step 3: `Hero.tsx`** — the **asymmetric grid** (match `.hero-grid`/`.hero-left`/`.hero-photo` in `homepage-v2.html`): left = eyebrow + H1 "Hand-checked cheap flights from Vilnius, Kaunas and Riga." (amber span on "cheap flights") + lead + `<SignupCard/>`; right = `<Photo scene="ph-coast" className="hero-photo">` with the "This week · live now / Larnaca, from €140" caption (pass the top live deal in); trust micro-line spans full-width below. Props: `{ topDeal: TicketView | null }`.
- [ ] **Step 4:** build-verify (`npx tsc --noEmit`). Commit:
```bash
git add site/src/components/Header.tsx site/src/components/Hero.tsx site/src/components/SignupCard.tsx
git commit -m "feat(site): asymmetric hero + dual-CTA signup card + header nav"
```

## Task 4: Homepage — sections + page composition

**Files:** create `site/src/components/{CollectionTile,ProcessBand,EarlyAlertsBand,Faq,Footer,StickyCta}.tsx`; rework `site/src/app/page.tsx`; remove `Tabs.tsx`/`BrowseCard.tsx` if unused.

- [ ] **Step 1:** build the section components to match `homepage-v2.html`: **live deals** (a `<DealTicket featured>` + a grid of `<DealTicket>`), **past rare fares** strip (expired tickets, "Expired, but useful proof" + "Get the next one before it disappears" → `/past-deals`), `CollectionTile` (duotone `<Photo treatment="duotone">` + human label, links to the slug), `ProcessBand` (Find→Check→Explain→Send, Lucide SVGs, on the `.how` teal band), `EarlyAlertsBand` (the amber `.early` band → `/early-alerts`), `Faq` (the `<details>` accordion), `Footer` (canonical `.ftr` columns incl. Follow), `StickyCta` (`'use client'` — a slim primary CTA that appears on scroll after the first deal group).
- [ ] **Step 2: rework `page.tsx`** into the 10 sections, reusing `getLiveDeals`/`getInspirationDeals` + the new `toTicket` (Task 5):
```tsx
// site/src/app/page.tsx (composition)
export const revalidate = 300;
export default async function Home() {
  const now = new Date();
  const live = (await getLiveDeals()).map((r) => toTicket(r, now));
  const past = (await getInspirationDeals(3)).map((r) => toTicket(r, now));
  const [featured, ...rest] = live;
  return (<main className="yip-home">
    <Header />
    <Hero topDeal={featured ?? null} />
    <LiveDeals featured={featured} rest={rest.slice(0,2)} />
    <CaptureBand />
    <PastFares deals={past} />
    <Collections />
    <ProcessBand />
    <EarlyAlertsBand />
    <Faq items={HOME_FAQ} />
    <Footer />
    <StickyCta />
  </main>);
}
```
(Empty-state: if `live` is empty, LiveDeals shows the calm empty message.)
- [ ] **Step 3:** `npm run build` + `npx tsc --noEmit` clean. Commit:
```bash
git add site/src/components site/src/app/page.tsx && git rm -f site/src/components/Tabs.tsx site/src/components/BrowseCard.tsx 2>/dev/null; git commit -m "feat(site): homepage 10-section composition (live/past/collections/process/early-alerts/faq/footer + sticky CTA)"
```

## Task 5: Ticket mapper + `TicketView`

**Files:** modify `site/src/lib/types.ts`, `site/src/lib/mappers.ts`; create `site/src/lib/mappers.ticket.test.ts`.

- [ ] **Step 1: failing test** for `toTicket` (mock a `getLiveDeals` row; assert `id`, `destination` (city via `airports`), `route` "VNO → LCA", `drop`, `headline` (uses `pd.headline` when present else a generated hook), `scene`, `goingFast`, `airline` from `snapshot.legs[0].airline.code`, `eyebrow`, `catchChip`).
```typescript
// site/src/lib/mappers.ticket.test.ts
import { describe, it, expect } from 'vitest';
import { toTicket } from './mappers';
type Row = Awaited<ReturnType<typeof import('./queries').getLiveDeals>>[number];
const row = (o: Record<string, unknown> = {}): Row => ({
  pd: { id: 1, origin: 'VNO', destination: 'LCA', tripType: 'roundtrip', price: 140, baselinePrice: 301,
    discountPct: 53, travelDate: '2026-09-12', returnDate: '2026-09-19', headline: '€140 return to Cyprus — sea\'s still 27°C.',
    bookingUrl: 'https://www.google.com/travel/flights?tfs=X', lastSeenAt: '2026-06-04T10:00:00', goingFast: false,
    publicLabel: 'September sun', status: 'live', ...(o.pd as object ?? {}) },
  score: o.score ?? 0.96, snapshot: o.snapshot ?? { stops: 1, duration: 440, legs: [{ airline: { code: 'BT' } }] },
  candLastSeen: '2026-06-04T10:00:00',
} as unknown as Row);
describe('toTicket', () => {
  it('maps the ticket fields', () => {
    const t = toTicket(row(), new Date('2026-06-04T12:00:00Z'));
    expect(t.destination).toBe('Larnaca'); expect(t.country).toBe('Cyprus');
    expect(t.route).toBe('VNO → LCA'); expect(t.drop).toBe(53); expect(t.airline).toBe('BT');
    expect(t.headline).toContain('€140'); expect(t.scene).toBe('ph-coast'); expect(t.quality).toBe('rare');
  });
});
```
- [ ] **Step 2: run** `cd site && npx vitest run src/lib/mappers.ticket.test.ts` → fails (no `toTicket`).
- [ ] **Step 3: add `TicketView`** to `types.ts` + implement `toTicket` in `mappers.ts` (reuse `city`/`country`, `formatDates`, `qualityTag`, `sceneClass`, `legs()`; `eyebrow` = `pd.publicLabel ?? 'Found by hand'`; `headline` = `pd.headline` || a generated `€${price} return to ${city}`; `catchChip` = stops≥1 ? `${stops} stop${…}` : 'Direct'; `legs` = the summary string; `drop` = round(discountPct); `goingFast` = pd.goingFast). Keep `toPublicDeal` (used by detail) intact.
- [ ] **Step 4: run** vitest → pass; `npx tsc --noEmit` clean. Commit:
```bash
git add site/src/lib/types.ts site/src/lib/mappers.ts site/src/lib/mappers.ticket.test.ts
git commit -m "feat(site): TicketView + toTicket mapper (boarding-pass card data)"
```

## Task 6: Collections — config + queries

**Files:** create `site/src/lib/collections.ts` + `site/src/lib/collections.test.ts`; modify `site/src/lib/queries.ts`.

- [ ] **Step 1: read the real config values** — query the dev DB (or `skrendam` seed) for the actual `travel_moments.slug` + `zones.zone` values, so the collection filters match real data. Use the env extraction from `web/.env.local` (`DATABASE_URL_UNPOOLED`); `psql`/a quick script listing `select slug,name from travel_moments; select zone from zones;`.
- [ ] **Step 2: `collections.ts`** — the initial 6, filters mapped to real values found in Step 1:
```typescript
// site/src/lib/collections.ts
export type CollectionFilter =
  | { kind: 'origin'; iata: string } | { kind: 'zone'; zone: string } | { kind: 'moment'; slug: string };
export interface Collection { slug: string; label: string; h1: string; promise: string; filter: CollectionFilter; }
export const COLLECTIONS: Collection[] = [
  { slug: 'cheap-flights-from-vilnius', label: 'Cheap flights from Vilnius', h1: 'Cheap flights from Vilnius', promise: "The genuinely cheap fares we've hand-checked from Vilnius — why each is good, and the catch.", filter: { kind: 'origin', iata: 'VNO' } },
  { slug: 'cheap-flights-from-kaunas', label: 'Cheap flights from Kaunas', h1: 'Cheap flights from Kaunas', promise: "Hand-checked cheap fares from Kaunas.", filter: { kind: 'origin', iata: 'KUN' } },
  { slug: 'cheap-flights-from-riga', label: 'Cheap flights from Riga', h1: 'Cheap flights from Riga', promise: "Hand-checked cheap fares from Riga.", filter: { kind: 'origin', iata: 'RIX' } },
  { slug: 'september-sun-deals', label: 'September sun deals', h1: 'Cheap September sun flights from the Baltics', promise: "Late-summer warmth, fewer crowds, lower fares — hand-checked.", filter: { kind: 'moment', slug: '<september-moment-slug-from-step-1>' } },
  { slug: 'christmas-market-flights', label: 'Christmas market flights', h1: 'Cheap Christmas-market flights from the Baltics', promise: "Glühwein-weekend fares to Europe's best markets.", filter: { kind: 'moment', slug: '<christmas-moment-slug>' } },
  { slug: 'cyprus-flight-deals-from-lithuania', label: 'Cyprus from Lithuania', h1: 'Cheap flights to Cyprus from Lithuania', promise: "Warm-sea Cyprus fares from Vilnius & Kaunas.", filter: { kind: 'zone', zone: '<cyprus-zone-from-step-1>' } },
];
export const collectionBySlug = (slug: string) => COLLECTIONS.find((c) => c.slug === slug);
```
(Replace the `<...>` placeholders with the real slugs/zones from Step 1 — this is the one spot that must match DB values.)
- [ ] **Step 3: `collections.test.ts`** — assert `collectionBySlug('cheap-flights-from-vilnius')?.filter` is `{kind:'origin',iata:'VNO'}`, unknown slug → undefined, all slugs unique.
- [ ] **Step 4: `getCollectionDeals` in `queries.ts`** — reuse `dealBase()` + `dedupeById`; filter live deals per kind:
```typescript
export async function getCollectionDeals(filter: CollectionFilter) {
  const base = (cond) => dedupeById(await /* not valid inline; see note */);
}
```
Implement as: a `where` combining `eq(publishedDeals.status,'live')` with — `origin` → `eq(publishedDeals.origin, filter.iata)`; `zone` → `eq(publishedDeals.zone, filter.zone)`; `moment` → join `dealBase()` to `dealTemplates` (on `publishedDeals.dealTemplateId`) + filter `dealTemplates.travelMomentId in (select id from travelMoments where slug = filter.slug)` (use a subquery via `inArray` + a `travelMoments` lookup, or add the join to `dealBase`). Order by `publishedAt desc`; `dedupeById`. (Write the real Drizzle here — `dealBase` already imports the needed tables; add `dealTemplates`/`travelMoments` imports for the moment case.)
- [ ] **Step 5: run** vitest (collections.test) → pass; `npx tsc --noEmit` clean. Commit:
```bash
git add site/src/lib/collections.ts site/src/lib/collections.test.ts site/src/lib/queries.ts
git commit -m "feat(site): collections config + filtered queries (origin/zone/moment)"
```

## Task 7: Collection page + index

**Files:** create `site/src/app/[collection]/page.tsx`, `site/src/app/collections/page.tsx`.

- [ ] **Step 1: `[collection]/page.tsx`** — top-level slug route. `generateStaticParams` from `COLLECTIONS`; `collectionBySlug(slug)` → `notFound()` if unknown; fetch `getCollectionDeals(c.filter)` → `toTicket`. Render per `early-alerts-and-collection.html`'s collection mock: breadcrumb → H1 (`c.h1`) → promise → inline email CTA (`<SignupCard/>` or a compact capture) → live `<DealTicket>` grid (empty-state if none) → "how Yip checks these" trust band → `<EarlyAlertsBand/>` → collection `<Faq/>` → related collections + `<Footer/>`. `export const revalidate = 300`. `generateMetadata` per collection (title = `c.h1 — Yip`, description = `c.promise`).
- [ ] **Step 2: `collections/page.tsx`** — the index: a grid of `<CollectionTile>` for all `COLLECTIONS` + header/footer + metadata.
- [ ] **Step 3:** build-verify; manual check `/cheap-flights-from-vilnius`, `/september-sun-deals`, `/collections`. Commit:
```bash
git add site/src/app/[collection] site/src/app/collections
git commit -m "feat(site): collection pages (top-level SEO slugs) + /collections index"
```

## Task 8: Past-deals archive + expired noindex

**Files:** create `site/src/app/past-deals/page.tsx`; modify `site/src/app/deal/[id]/page.tsx`.

- [ ] **Step 1: `past-deals/page.tsx`** — `getInspirationDeals(24)` → `toTicket`; render "Past rare fares · Expired, but useful proof" + the strip ("These are gone now. Get the next one before it disappears.") + expired tickets (visually marked `Expired`, struck price) + a capture CTA + footer. Indexable. `revalidate = 3600`.
- [ ] **Step 2: expired deal pages `noindex`** — in `deal/[id]/page.tsx` `generateMetadata`, when `row.pd.status !== 'live'` add `robots: { index: false }`. (Live deals stay indexable.)
- [ ] **Step 3:** build-verify; commit:
```bash
git add site/src/app/past-deals site/src/app/deal/[id]/page.tsx
git commit -m "feat(site): /past-deals archive (indexable) + noindex on expired deal pages"
```

## Task 9: Subscriber schema — confirm/token/early-alerts/prefs

**Files:** modify `skrendam/db/models.py`; create `alembic/versions/0005_subscriber_prefs.py`; re-pull `site/src/db/generated/schema.ts`.

- [ ] **Step 1: model** — add to `Subscriber`: `confirmed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")`, `confirmation_token: Mapped[str | None] = mapped_column(String, nullable=True)`, `early_alerts_interest: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")`, `prefs: Mapped[dict | None] = mapped_column(JSON, nullable=True)` (airports + trip types). Ensure `Boolean`, `JSON` imported.
- [ ] **Step 2: migration `0005_subscriber_prefs.py`** — `down_revision='b7c41d9e2a02'`; `op.add_column` for `confirmed` (Boolean, server_default 'false', not null), `confirmation_token` (String, nullable), `early_alerts_interest` (Boolean, server_default 'false', not null), `prefs` (sa.JSON, nullable). `downgrade` drops them.
- [ ] **Step 3: apply to dev + re-pull** (dev branch only — host `ep-spring-rice-ag3lozh6`):
```bash
RAW=$(grep '^DATABASE_URL_UNPOOLED=' web/.env.local | head -1 | sed 's/^DATABASE_URL_UNPOOLED=//'); RAW="${RAW%\"}"; RAW="${RAW#\"}"; RAW="${RAW//\\$/$}"; case "$RAW" in postgres://*) RAW="postgresql://${RAW#postgres://}";; esac; export SKRENDAM_DATABASE_URL="$RAW"
echo "$SKRENDAM_DATABASE_URL" | grep -q 'ep-spring-rice-ag3lozh6' && uv run alembic upgrade head || echo "NOT dev — abort"
cd site && node --env-file=.env.local node_modules/.bin/drizzle-kit pull   # adds the new cols to schema.ts
```
Confirm `subscribers` now has `confirmed`, `confirmationToken`, `earlyAlertsInterest`, `prefs`.
- [ ] **Step 4: engine suite green + commit.** `uv run pytest tests/skrendam -q` (51 passed/2 skipped) + `uv run mypy skrendam`.
```bash
git add skrendam/db/models.py alembic/versions/0005_subscriber_prefs.py site/src/db
git commit -m "feat(skrendam,site): subscriber confirm/token/early-alerts/prefs columns"
```

## Task 10: Email provider (Resend) — gated + the confirm route

**Files:** create `site/src/lib/email.ts`, `site/src/app/confirm/route.ts`; modify `site/.env.example`.

- [ ] **Step 1: `email.ts`** — gated Resend send (no SDK; a fetch). Degrades gracefully when `RESEND_API_KEY` is unset:
```typescript
// site/src/lib/email.ts
export function emailEnabled(): boolean { return Boolean(process.env.RESEND_API_KEY); }
export async function sendConfirmEmail(to: string, token: string): Promise<boolean> {
  if (!emailEnabled()) return false;
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3001';
  const link = `${base}/confirm?token=${encodeURIComponent(token)}`;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.YIP_FROM_EMAIL ?? 'Yip <hello@yip.lt>',
      to, subject: 'Confirm your Yip deals',
      text: `Welcome to Yip — confirm your email to get hand-checked cheap flights:\n${link}\n\nNo spam, unsubscribe anytime.`,
    }),
  });
  return res.ok;
}
```
- [ ] **Step 2: `confirm/route.ts`** — GET handler: read `?token`, `update subscribers set confirmed=true where confirmation_token=token`, redirect to `/?confirmed=1`:
```typescript
// site/src/app/confirm/route.ts
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { subscribers } from '@/db/generated/schema';
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get('token') ?? '';
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3001';
  if (token) await db.update(subscribers).set({ confirmed: true, confirmationToken: null }).where(eq(subscribers.confirmationToken, token));
  return NextResponse.redirect(`${base}/?confirmed=1`);
}
```
- [ ] **Step 3: `.env.example`** — add `RESEND_API_KEY=` + `YIP_FROM_EMAIL=Yip <hello@yip.lt>` with a comment: *optional — when unset, signup is single-opt-in (no confirmation email sent).*
- [ ] **Step 4:** build-verify (`npx tsc --noEmit`). Commit:
```bash
git add site/src/lib/email.ts site/src/app/confirm/route.ts site/.env.example
git commit -m "feat(site): Resend email (gated) + double-opt-in confirm route"
```
> **Dependency flag:** double opt-in only *sends* when `RESEND_API_KEY` is set (a verified sending domain is needed for production). Until then, Task 11's action confirms immediately (single opt-in). This is the one external dependency.

## Task 11: Signup flow — action + UI states

**Files:** rework `site/src/app/subscribe-action.ts`; create `site/src/app/subscribe/page.tsx`, `site/src/components/PreferenceStep.tsx`; rework `site/src/components/CaptureBand.tsx`.

- [ ] **Step 1: rework `subscribe-action.ts`** — accept `email` + optional `earlyAlerts` + `prefs`; zod-validate; generate a token; insert `{email, source, confirmationToken: token, confirmed: !emailEnabled(), earlyAlertsInterest}`; if `emailEnabled()` → `sendConfirmEmail` + return `{ ok: true, doubleOptIn: true }`, else `{ ok: true, doubleOptIn: false }`. `onConflictDoNothing`. Wrap in try/catch (return `{ok:false,error}`). Add `savePreferences(email, prefs)` (update). Use `crypto.randomUUID()` for the token.
- [ ] **Step 2: `subscribe/page.tsx`** — the standalone capture page (match `signup-flow.html` Entry B): wordmark, promise, `<SignupCard/>`, trust, the early-alerts line. `generateMetadata`. Reads `?confirmed=1` → a "You're confirmed 🎉" banner.
- [ ] **Step 3: `CaptureBand.tsx` + `SignupCard.tsx`** — on success show `doubleOptIn ? "Check your inbox to confirm." : "You're in — first deals land this week."` + the soft early-alerts upsell (match `signup-flow.html`). `PreferenceStep.tsx` (`'use client'`) = the optional skippable chips (airports VNO/KUN/RIX/PLQ/WAW + trip types sun/city/family/last-minute/weekends) calling `savePreferences`; shown after success.
- [ ] **Step 4:** build-verify + manual (submit on homepage → success state; `/subscribe`). Commit:
```bash
git add site/src/app/subscribe-action.ts site/src/app/subscribe site/src/components/PreferenceStep.tsx site/src/components/CaptureBand.tsx site/src/components/SignupCard.tsx
git commit -m "feat(site): signup flow — action (token+early-alerts+prefs), /subscribe page, success+preferences states"
```

## Task 12: Early-alerts waitlist page

**Files:** create `site/src/app/early-alerts/page.tsx`.

- [ ] **Step 1:** build the page to match `early-alerts-and-collection.html` (the early-alerts half): eyebrow "Early alerts · coming soon" → H1 "Get the best fares first." → lead → the **free-vs-early comparison** (two `.cmpcard`s: free "You're on this / always free / slower"; early amber "Waitlist / paid · coming soon / the moment we find them") → the dark **waitlist band** with a join form that calls `subscribe` with `earlyAlerts: true` (records the interest flag) → footer. `generateMetadata`.
- [ ] **Step 2:** build-verify; commit:
```bash
git add site/src/app/early-alerts
git commit -m "feat(site): /early-alerts waitlist page (free-vs-early + join waitlist)"
```

## Task 13: Deal-detail enrichment

**Files:** rework `site/src/components/DealDetail.tsx`; create `site/src/components/{CuratorNote,SimilarDeals}.tsx`; modify `site/src/app/deal/[id]/page.tsx`; extend `queries.ts` (`getSimilarDeals`).

- [ ] **Step 1: `getSimilarDeals(deal, limit=3)` in `queries.ts`** — live deals sharing the deal's `zone` (or `travelMoment`), excluding the current `id`, limit 3; `dedupeById`.
- [ ] **Step 2: `CuratorNote.tsx`** — the amber signed note: body from `pd.body` (the curator's editorial note) with a static attribution ("— Jonas, your Yip curator"); render only when `pd.body` is present. `SimilarDeals.tsx` — a `<DealTicket>` row ("More like this").
- [ ] **Step 3: rework `DealDetail.tsx`** to match `deal-detail-v2.html`: hero image (`<Photo>` + place/eyebrow) → mono meta + Rare/freshness chips → headline → book row (`<BookingCta>`) → **Why-good | The-catch** two columns (from the snapshot flags + the why factors) → `<PriceSparkline>` (keep) → `<CuratorNote>` → the email nudge (`<CaptureBand variant="nudge">` "Want deals like this? Get them by email") → `<SimilarDeals>`. Keep the existing sparkline/freshness logic.
- [ ] **Step 4: `deal/[id]/page.tsx`** — fetch `getSimilarDeals`, pass to `DealDetail`. Build-verify; manual `/deal/1`. Commit:
```bash
git add site/src/components/DealDetail.tsx site/src/components/CuratorNote.tsx site/src/components/SimilarDeals.tsx site/src/app/deal/[id]/page.tsx site/src/lib/queries.ts
git commit -m "feat(site): deal-detail — Why-good|catch, curator note, similar deals, email nudge"
```

## Task 14: SEO / GEO + robots/sitemap

**Files:** create `site/src/lib/jsonld.ts`, `site/src/components/JsonLd.tsx`, `site/src/components/Breadcrumbs.tsx`; modify `site/src/app/{layout,sitemap,robots}.ts(x)` + the page routes.

- [ ] **Step 1: `jsonld.ts`** — pure builders returning plain objects: `organization()`, `website()`, `breadcrumbList(items)`, `itemList(deals)`, `webPage(...)`. **No `Offer`.** `jsonld.test.ts` asserts shapes (e.g. `itemList([...]).itemListElement.length`).
- [ ] **Step 2: `JsonLd.tsx`** — render structured data, escaping `<` so a curator-written headline containing `</script>` can't break out (the standard safe JSON-LD pattern):
```tsx
// site/src/components/JsonLd.tsx
export function JsonLd({ data }: { data: object }) {
  // data is engine/curator-controlled; escape "<" → < so it can't terminate the <script> (XSS-safe).
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
```
`Breadcrumbs.tsx` — a visible breadcrumb trail (pairs with the `BreadcrumbList` JSON-LD).
- [ ] **Step 3: wire** — `layout.tsx`: Organization + WebSite JSON-LD. Homepage + collections + past-deals: `ItemList` of the deals + Breadcrumbs. Deal page: `WebPage` + Breadcrumbs. 
- [ ] **Step 4: `robots.ts`** — keep allow-all + sitemap; add explicit allow for `OAI-SearchBot` + `GPTBot` user-agents (answer-engine visibility). `sitemap.ts` — add the collection slugs + `/collections` + `/past-deals` + `/subscribe` + `/early-alerts` alongside the live deal URLs.
- [ ] **Step 5:** `npx vitest run` (jsonld.test) + `npm run build` clean. Commit:
```bash
git add site/src/lib/jsonld.ts site/src/components/JsonLd.tsx site/src/components/Breadcrumbs.tsx site/src/app
git commit -m "feat(site): SEO/GEO — JSON-LD (Organization/WebSite/BreadcrumbList/ItemList/WebPage), breadcrumbs, robots, sitemap"
```

## Task 15: QA gauntlet

**Files:** `site/e2e/{homepage,deal-detail,collection,signup,early-alerts}.spec.ts`.

- [ ] **Step 1: seed** demo data if needed (`uv run python scripts/seed_demo_published_deals.py` against dev — idempotent).
- [ ] **Step 2: Playwright journeys** — homepage (hero + featured ticket + `See deal`); deal-detail (price, Why-good/catch, curator note, similar); collection (`/cheap-flights-from-vilnius` renders + tickets); signup (submit on homepage → success state; submit a pref); early-alerts (`/early-alerts` comparison + join waitlist). Tolerate thin data (assert ≥1 where seeded). Run `cd site && npx playwright test 2>&1 | tail -20` → all pass (paste output).
- [ ] **Step 3: full green-check** — `cd site && npx tsc --noEmit && npm run lint && npx vitest run`; `cd .. && uv run pytest tests/skrendam -q && uv run mypy skrendam`. All green.
- [ ] **Step 4: `/code-review high`** on `main...HEAD` — focus: the read-only invariant (only `subscribers` writes), the collection-filter correctness (esp. the `moment` join + the real slug/zone values), the gated-email graceful path, JSON-LD honesty (no `Offer`), `dangerouslySetInnerHTML` only on JSON.stringify'd structured data, ticket-card data wiring.
- [ ] **Step 5: `security-review`** on the branch — focus: the `subscribe`/`savePreferences` actions + `/confirm` route (token via `crypto.randomUUID`, parameterized, no enumeration), external link safety, the Resend key never client-exposed (server-only), no secrets committed.
- [ ] **Step 6:** fix real findings; then ready for `finishing-a-development-branch` (PR — user-approved).

---

## Self-Review (against the spec)

**Spec coverage:** §3 CTA → SignupCard/CaptureBand/EarlyAlertsBand (T3,T4,T12). §4 homepage 10 sections → T3,T4. §5 ticket card → T2,T5. §6 deal-detail → T13. §7 collections → T6,T7. §8 past-deals → T8. §9 signup flow + early-alerts → T9,T10,T11,T12. §10 SEO/GEO → T14. §11 imagery → T2 (Photo/.yip-photo). §12 voice → copy throughout. §13 architecture (routes, read-only + subscribers write) → all. §14 out-of-scope (vendor-direct booking, real premium) honored — booking stays google variant; early-alerts is waitlist-only. §15 build sequence → T1–T15 order.

**Gaps / flagged:** (a) **Email provider** — double-opt-in *send* needs `RESEND_API_KEY` + a verified domain; the build degrades to single opt-in until set (T10/T11). (b) **Real photos** — T2 ships warm gradient/duotone treatments as the graceful fallback; sourcing curated warm photos is a content follow-up (drop into `<Photo src>`). (c) **Collection real slug/zone values** — T6 Step 1 must read them from the dev DB (the one place values must match). (d) **Vendor-direct booking** — out of scope (booking stays the google variant), per spec.

**Placeholder scan:** the only intentional `<...>` is in `collections.ts` (T6) — explicitly a Step-1-resolved value, not a plan gap. `getCollectionDeals` (T6 Step 4) is described with the exact Drizzle approach (the implementer writes the final query against `dealBase`).

**Type consistency:** `TicketView`/`toTicket` (T2 stub → T5 complete) used by `DealTicket` (T2) + pages (T4,T7,T8,T13). `CollectionFilter`/`COLLECTIONS`/`collectionBySlug` (T6) used by T7. `getCollectionDeals`/`getSimilarDeals`/`getInspirationDeals`/`getLiveDeals` consistent. `emailEnabled`/`sendConfirmEmail` (T10) used by `subscribe-action` (T11). `subscribers` new cols (T9) used by T10/T11.
