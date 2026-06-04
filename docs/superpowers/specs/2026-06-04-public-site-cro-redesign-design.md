# Spec — Yip public site v2: CRO / SEO / GEO redesign (Spec 2.1)

_Date: 2026-06-04. Extends the shipped public site (`site/`, Spec 2 / PR #4). Approved via brainstorming on 2026-06-04 (visual companion). Grounded in the `yip-design-system` kit (`ui_kits/website`, `assets/imagery.css`)._

## 1. Summary

Turn the public homepage from a clean-but-flat "product spec" into a **conversion-focused, travel-desire-led** experience, and add the supporting surfaces (collections, a past-deals archive, an enriched deal-detail page, email capture). Designed through three lenses:

- **CRO** — make email signup the obvious next step; two CTAs with distinct jobs.
- **SEO** — useful, compact, high-intent pages; **do not make SEO pages that feel like SEO pages**.
- **GEO/AEO** — server-rendered, factual, structured so answer engines can understand + cite Yip.

The page's job is not only to show deals — it must create the thought *"I don't want to miss the next one,"* then make subscribing effortless. Desire first (imagery), then trust, then subscribe.

## 2. Scope (locked)

- **Design the full vision; build no-account first.** Everything here ships on the current read-only `site/` app **without accounts**.
- **Premium stays soft as "early alerts" → a waitlist** in v1 (collect interest). Real accounts / paid tiers / tiered-release / payments are **Spec 3**.
- **Booking v1 = the Google-Flights handoff** (the stored `tfs` link); the provider-named **"Book with <airline>" (vendor-direct) is the flagged fast-follow** (needs the engine to resolve + persist `get_booking_options`). `booking.ts` already supports all variants.
- **Imagery in mockups = warm gradient stand-ins; the build uses real warm photos** via the `.yip-photo` treatments.

## 3. CTA strategy (locked copy)

| Slot | Copy |
|---|---|
| **Primary (everywhere)** | **Get free weekly deals** · support: *Best rare fares in one calm weekly email.* |
| **Secondary** | **Get early alerts** · support: *The best fares as soon as Yip finds them — before the weekly email.* |
| Hero capture-card headline | **Get the next rare fare by email** (+ a **FREE** badge) |
| Deal-detail email nudge | **Want deals like this? Get them by email** |
| Past-deals nudge | **Get the next one before it disappears** |
| Trust micro-line | *No spam · Unsubscribe anytime · Hand-checked fares* + *From VNO, KUN and RIX. No search engine, just the good ones.* |

Premium is never loud. "Early alerts" explains the value better than "premium member."

## 4. Homepage structure

Ten sections, with **section contrast** (alternating cream / dark / sunken / teal / amber) so the page never reads flat:

1. **Header** — sticky translucent; wordmark, nav (Deals · Collections · Past fares · How it works), `From VNO · KUN · RIX` pill.
2. **Hero** — **asymmetric two-column grid**: *left column* = eyebrow → H1 → lead → signup card (the card is the conversion, so the left leads); *right column* = a **full-height visual deal panel** (top rises beside the headline, bottom aligns with the card); **trust micro-line spans full-width below both columns**. H1: **"Hand-checked cheap flights from Vilnius, Kaunas and Riga."** (amber on "cheap flights"). The signup card carries the FREE badge + primary CTA + trust row + the soft early-alerts secondary.
3. **Live deals** — a **featured rare fare** (large boarding-pass ticket) + a grid of ticket cards.
4. **Email capture band** — the canonical ink band (amber bead), primary CTA.
5. **Past rare fares** — *"Expired, but useful proof"* / *"These are gone now. Get the next one before it disappears."* A few strong expired examples (*was €X · lasted ~N days*) → one indexable **`/past-deals`** archive.
6. **Collections** — **amber-duotone visual tiles** with **human labels** (slugs only in URLs). The SEO/LLM growth layer.
7. **How Yip works** — a **process band** (contrast bg) with Lucide icons: **Find → Check → Explain the catch → Send.**
8. **Early-alerts teaser** — an **amber feature band**: *"Some fares are gone by the weekly email. Early alerts get the rare ones first."* → waitlist.
9. **FAQ** — a compact **accordion** (is it free? how do you find these? do I book with you?). Doubles as GEO content + JSON-LD.
10. **Footer** — canonical ink footer (Deals / Yip / **Follow** [TikTok·IG·Telegram] columns + legal "Made in Vilnius").

**Responsive:**
- **Desktop:** the asymmetric hero grid above.
- **Mobile order:** eyebrow → headline → lead → **signup card** → visual deal panel → trust line. The visual panel stays ~card height, never a huge hero.
- A **sticky / repeated primary CTA** appears after the first deal group on scroll.

## 5. Deal card — the boarding-pass ticket (signature component)

Use the kit's canonical `.deal` ticket, not a plain card:
- **Photo top** (`.yip-photo--protect`) with a **mono eyebrow** (top-left) + **place name** overlaid (bottom-left, with `country · from <origin>`); optional coral **"Going fast"** hot-tag (observed-only).
- **Body:** mono **route meta** (`VNO → LCA · dates · stops`), an **editorial hook headline** (e.g. *"€140 return to Cyprus — sea's still 27°C and the crowds have gone home"*), **why/caveat chips** (sea-teal "X% under" + sand caveat).
- **Perforated ticket-foot** (dashed divider + the two **notch cut-outs**): **price** `€X` ~~`€usual`~~ · `return · <airline>` + **"See deal →"**.
The **featured** deal is a large horizontal ticket. The browse grid is 3-up (2-up / 1-up responsive).

## 6. Deal-detail page

Kit pattern + our data layer + the additions:
- **Hero image** (place + `eyebrow`) → **mono meta** + Rare-deal / freshness chips → **editorial headline**.
- **Book row** — `€140` ~~`€301`~~ + the booking CTA (v1: "Open in Google Flights · live price"; fast-follow: "Book with <airline> · airline-direct").
- **Why it's good | The catch** — two columns, Lucide icons, sea-teal vs sand (the kit pattern).
- **"Why it's a good price"** — our 90-day **price-history sparkline** ("Cheapest X% we've seen in 90 days", best/typical/highest), gated on `sample_size`.
- **Curator's note** — a short, **signed, human** note (amber box). _Decision to confirm: attribute to a named curator ("— Jonas, your Yip curator") — sourced from the published deal's curator note (`published_deals.body`) + a curator name._
- **Email nudge** — "Want deals like this? Get them by email."
- **Similar deals** — a row of related ticket cards ("More September sun" / "More from Vilnius").

## 7. Collections (the SEO/LLM growth layer)

Compact, high-intent landing pages that are **filtered views of `published_deals`** — collections map onto existing engine config:
- **Airport** collections → filter by `origin` (e.g. *Cheap flights from Vilnius* = VNO).
- **Theme/seasonal** collections → filter by `travel_moment` (e.g. *September sun*, *Christmas markets*) or `zone` (e.g. *Cyprus from Lithuania*).

**Human labels in the UI; slugs only in the URL** (`/cheap-flights-from-vilnius`, `/september-sun-deals`, `/cyprus-flight-deals-from-lithuania`, …).
**Page structure:** H1 (exact intent) → one-sentence promise → email CTA → current/recent deal examples (ticket cards) → "how Yip checks deals" → early-alerts CTA → FAQ → related collections.

**v1 initial set (start small, expand later):** the 3 airport pages (Vilnius / Kaunas / Riga) + 3 theme pages (*September sun*, *Christmas markets*, *Cyprus from Lithuania*), driven by existing `routes`/`zones`/`travel_moments`. The full keyword set (school-holiday, last-minute, Spain, early-alerts, etc.) is a content-expansion follow-up. **Log which collections are live** (no silent truncation).

## 8. Past deals

- One indexable **`/past-deals`** archive page (an `ItemList` of expired finds; strong examples only).
- Individual expired-deal pages are **`noindex`** (avoid thousands of thin pages); the live `/deal/[id]` pages remain indexable while live.
- Copy: *"Expired, but useful proof"* · *"was €X · lasted ~N days."*

## 9. Email signup flow + early-alerts waitlist

### 9.1 Signup flow — design the states, not just a form
- **Entry A — inline on homepage:** the capture card; on submit it flips to a **success state** ("You're in. First deals land this week — check your email to confirm.") with a **soft early-alerts upsell** beneath.
- **Entry B — standalone `/subscribe` page:** wordmark + the promise + the capture + trust row + the soft early-alerts line. For links, the footer, and the TikTok bio.
- **Double opt-in — "Check your email":** a confirmation link is sent (keeps the list clean + GDPR-friendly) with a **resend** affordance.
- **Optional preferences (after confirm, skippable):** departure airports (VNO/KUN/RIX/PLQ/WAW) + trip types (sun / city breaks / family / last-minute / weekends) as multi-select chips → segmentation. **Always skippable** ("Skip — I'll take everything"). v1 may ship preferences-lite; the **early-alerts interest flag** is captured regardless.
- **Soft upsell:** the early-alerts ask is **soft + recurring** (inline success, `/subscribe`, post-signup) and **never blocks the free path**.
- **Data:** `subscribers` (email, source, `early_alerts_interest` flag). Preferences = the segmentation extension (preference columns or a `subscriber_preferences` table) — design at plan time; v1 capture stays simple.

### 9.2 Early-alerts waitlist page (`/early-alerts`)
The secondary CTA's destination. Explains the value with an **honest free-vs-early comparison**, premium kept soft:
- **Free weekly** (left, "You're on this", *always free*): one calm email a week · the best of what we found · *slower — some rare fares may be gone*.
- **Early alerts** (right, amber, "Waitlist", *paid · coming soon*): the rarest fares **the moment we find them** · before the weekly email, before they sell out · your airports + trip types prioritised.
- A dark **waitlist band**: *"Early alerts isn't open yet — join the waitlist. We'll let you in first. Free weekly subscribers get priority."* + email → **Join the waitlist** (records the interest flag). No accounts/payments in v1 (that's Spec 3).

## 10. SEO / GEO / AEO

People-first content (Google helpful-content); never pages made only for ranking.
- **Server-render** all deal + collection pages; clean **per-page metadata** + OpenGraph; **sitemap + robots**; **breadcrumbs**.
- **Visible facts** on every deal: origin, destination, price, dates, checked-time, the caveat, status.
- **JSON-LD where honest:** `Organization`, `WebSite`, `BreadcrumbList`, `ItemList` (deal grids / collections / past-deals), `WebPage`. **No `Offer`** — Yip doesn't sell the fare.
- Allow useful answer-engine crawlers (e.g. `OAI-SearchBot`) in `robots`.
- Indexing: `/past-deals` indexable; individual expired pages `noindex`; collections indexable.
- Refs: Google helpful-content + structured-data docs; Next.js robots/sitemap; OpenAI crawler FAQ (captured in `docs/research/2026-06-03-jfc-competitive-notes.md` lineage).

## 11. Imagery

Per `assets/imagery.css`: **select warm** (golden hour, sun, sea), then **one treatment** — `.yip-photo--protect` for any photo carrying text (hero, deal cards, detail hero), `.yip-photo--duotone` for collection tiles / editorial. Text/CTA always on a protection gradient. Not every card is image-heavy — hero, featured deal, and collection tiles carry imagery; standard browse cards may use lighter treatment.

## 12. Voice

Sentence case; numbers are the hero; always *why* it's good **and** the catch; concrete-over-generic; the **curator's-note** human voice ("a clued-in local friend who just texted you a deal"). Emoji only in newsletter/TikTok, never in product UI.

## 13. Architecture & data flow

- **Extends the existing `site/` app** (no new app). New / enhanced routes: `/` (redesigned homepage), `/deal/[id]` (enriched), **top-level collection slugs** for SEO (e.g. `/cheap-flights-from-vilnius`, `/september-sun-deals`) + a `/collections` index, `/past-deals`, **`/subscribe`** (standalone capture + confirm/preferences states), **`/early-alerts`** (the waitlist page). (Collection slugs are top-level, not `/collections/<slug>`, since the keyword *is* the URL.)
- **Reads** (read-only): `published_deals`, `price_log`, `routes`, `candidate_template_matches`, `travel_moments`, `zones` (for collection filters). Collections = parameterized queries over `published_deals` joined to `routes`/`zones`/`travel_moments`.
- **Writes:** only `subscribers` (+ the early-alerts flag; preferences later) — the app's sole write surface.
- **Engine:** vendor-direct booking persistence is a fast-follow (out of scope v1); no engine change is required for the no-account redesign except (optionally) the curator-note attribution field if not already on `published_deals` (`body` exists).
- **Mockups** (`.superpowers/brainstorm/.../homepage-v3-brand.html`, `deal-detail-brand.html`) are the visual source of truth → copy into `site/design-reference/` at build time.

## 14. Out of scope / deferred

- Real **premium / accounts / paid tiers / tiered-release / payments** — Spec 3.
- **Vendor-direct booking** ("Book with airBaltic") — fast-follow (engine `get_booking_options` persistence).
- **Push notifications**, personalized ranking, Watch tab — Spec 3.
- The **rich preference flow** (airports/types) — v1.1 fast-follow (v1 captures email + early-alerts interest).
- The full **collection keyword set** beyond the initial 6 — content-expansion follow-up.

## 15. Build sequence (the plan will detail)

1. Copy the approved mockups into `site/design-reference/`; lift the new component CSS (ticket card, hero grid, sections) into `site.css`.
2. The **boarding-pass ticket card** component (+ featured variant) + the `.yip-photo` treatment components.
3. **Homepage redesign** — the asymmetric hero, live deals (featured + grid), capture band, past-fares strip, collections tiles, how-it-works band, early-alerts band, FAQ accordion, footer; responsive + sticky CTA.
4. **Deal-detail** enrichment — Why-good/catch, curator's note, similar deals, the email nudge (keep the sparkline/freshness).
5. **Collections** — the route/data layer for filtered views + the collection page template + the initial 6 + `/collections` index.
6. **Past-deals** `/past-deals` archive + expired `noindex`.
7. **Signup flow + early-alerts** — the flow states (inline success, `/subscribe` page, double opt-in "check your email", optional skippable preferences, soft upsell) + the **`/early-alerts`** waitlist page (free-vs-early comparison + join-the-waitlist band) + the `early_alerts_interest` flag on `subscribers`.
8. **SEO/GEO** — per-page metadata/OG, breadcrumbs, JSON-LD (Organization/WebSite/BreadcrumbList/ItemList/WebPage), robots (allow answer crawlers), sitemap incl. collections.
9. QA gauntlet (Playwright journeys for the new surfaces + `/code-review high` + `security-review`).
