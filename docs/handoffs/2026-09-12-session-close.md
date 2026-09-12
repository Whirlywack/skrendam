# Handoff — 2026-09-12 session close (for a fresh context window)

You are picking up Yip/Skrendam with no memory of the last three days. Read §0 and §1, then act.

## 0. PRIORITY (founder, 2026-09-12): the funnel order — TikTok → site → free list → paid
The backend is done (every work package of the launch spec is merged). There are **0 subscribers** today, so
nothing about email streams is urgent; what is urgent is the top of the funnel and the page it lands on.

1. **TikTok channel (founder, now).** Open it and post deals; the desk drafts a TikTok hook per deal
   (Composer → TikTok hook tab). Traffic comes from here first.
2. **The site — engineering priority #1, starting now.** It is where TikTok traffic lands and where the
   free list is captured. Two phases: (a) immediately, polish so the site *shows* what the backend produces
   and converts (found vs current price, verified-ago, the catch line, the edition, the signup) — with real-data
   mockups and founder sign-off; (b) the SEO page architecture (§0.1) once the deep-research results are in,
   built in slices, route pages first. Chores only if they block the site.
3. **Confirmation mail before the first post (founder, ~30 min).** Put `RESEND_API_KEY` (+ `YIP_FROM_EMAIL`,
   `NEXT_PUBLIC_SITE_URL`) into `site/` on Vercel and `web/.env.local` so signups get a real double-opt-in
   email; without the key the site silently falls back to single opt-in. That is the only email piece
   needed before subscribers exist.
4. **When the free list has people:** nurture letters from the Letters page; Payment Link + paid tier; the
   Thursday digest for paid subscribers. Not before.
- **In parallel:** the founder runs the deep-research prompt; a Lithuanian copywriter is briefed (item 3
  below); iv.lt adds the Cloudflare DS (ticket sent).

Concretely for the site:

1. **Make yip.lt reflect the backend.** Deals carry `score_v2`, archetype (date / rare / destination), the peak
   window, family saving, verified-at, `current_price` and the `live / changed / expired` states, price-check
   history, "lasted N hours" on expired deals. The site already reads most of these fields (mappers/queries);
   the redesign should *show* them honestly (found price vs current price, verified-ago stamp, the catch line).
2. **Build the new pages + interlinking** per the SEO architecture (§0.1 below, full text in
   `docs/research/2026-09-11-site-sitemap-seo-architecture.md`).
3. **Copy:** Lithuanian, honest, the `lt.ts` voice (tu, lowercase spoken verbs, „radinys"; banned: akcija,
   superkaina, nepraleisk progos!, „skenuoti"). AI drafts first; if the Lithuanian does not read natively, the
   founder hires a human copywriter — plan the copy as a separable deliverable (strings in `lt.ts`, one deck).
   The word „kabliukas" is to be replaced during the copy pass (open decision in PROJECT.md).
4. **Process for design work (hard rule):** mockups with REAL data states (1 deal, changed deal, empty edition)
   → founder sign-off → build. Use the `yip-design-system` skill for all UI/brand work. No design build
   without the mockup sign-off (`skrendam-mockup-signoff-rule`).
5. **Research input first:** the founder runs `docs/research/2026-09-11-deep-research-prompt.md` in a
   deep-research tool; its results (keyword universe with seasonality, competitor/SERP audit for Lithuania,
   programmatic-page practice after Google's 2025 updates, AI-answer citation behaviour, newsletter-business
   funnel/pricing benchmarks, small-list conversion evidence, LT/EU legal + VAT for a paid subscription,
   the diaspora audience, a content calendar) decide the exact pages, slugs and titles. The August keyword
   sample in `docs/research/2026-08-29-lt-keyword-volumes.md` is NOT a rule — treat it as a first survey.

### 0.1 The SEO / site architecture, in brief (do not lose this)
- **Concept:** Yip's unfair asset is its own price history + a human verdict per Baltic route. Every page shows
  that asset (live find, „įprastai €X", how long deals last, human-checked stamp) and funnels to one action:
  the free letter. Programmatic pages carry the SEO weight; the letter carries the money.
- **Page layers:** (A) core — home edition (1 open + 2 teasers + locked rest), `/deal/[id]`, past-deals archive,
  three origin hubs (own the head terms), funnel/legal pages; (B) **programmatic** — a route page per scanned
  route (`/skrydziai/vilnius-londonas`: live finds, 180-day price chart, „įprastai €X, žemiausia per 90 d.",
  cheapest months, airlines, direct vs stops, ground hint, last expired finds with „išbuvo N val.", FAQ), a
  destination page per city (`/kryptys/londonas`), flights-home pages (`/namo/is-londono`), three airport
  pages; rule: a programmatic page exists only with ≥ 14 scan-days of history (thin pages are a liability),
  regenerated daily; (C) **moment collections as real pages** — weekend trips, „kur keliauti lapkritį",
  Christmas markets, ski, family, a school-holidays page with a `.ics` download as the lead magnet, seasonal
  sun/Easter/summer, last-minute (framed as flights, not packages); (D) trust/content — about (the curator is
  the brand), how we work, **newsletter archive** (every sent letter becomes a page), quarterly price index
  from `price_log`, paid-plan page, FAQ with schema; (E) later — Latvian layer, English diaspora landing.
- **Interlinking:** three hubs (origin, destination, moment); deal pages are leaves linking UP to all three
  plus sideways to 3 more finds; breadcrumbs with schema; split sitemaps (core/routes/destinations/deals/
  letters); expired deals stay 200 + noindex + link to their route page so old TikTok links still convert;
  footer rotates top routes by season; schema: Organization, BreadcrumbList, ItemList, Offer (validThrough),
  FAQPage, Article.
- **Conversion:** one primary action site-wide (the free letter); paid offered after confirm and in letters,
  never cold; route/destination pages capture a route-interest pref („gauk, kai nukris žemiau €X") without
  new scanning; proof blocks use real data only (price chart, „išbuvo 36 val.", booked counts from
  `deal_events`, „Patikrino žmogus"); edition scarcity stays; TikTok landing `/is-tiktok` with the video id in
  `utm_content`; the school-holiday `.ics` as lead magnet delivered after double opt-in.
- **Angles not to forget:** GEO/AI answers (FAQ phrasing, entity consistency, `llms.txt`, one-sentence
  answers on route pages); Google Discover via the letter archive as `Article`; seasonal pages must exist
  6–8 weeks before the query peaks (Sep: „kur keliauti lapkritį"; Oct: Christmas markets; Nov: ski; Jan:
  žiemos atostogos); diaspora searches in LT and EN; own the brand SERP („yip skrydžiai"); legal/VAT before
  paid goes live.

## 1. Read first (10 minutes)
1. `docs/PROJECT.md` — canonical context: what the product is, the pipeline, ops truths, process rules, queue.
2. `docs/DESK-GUIDE.md` — the founder's operating manual for the Deal Desk (also rendered at `/guide` in the desk). Every page, button, state and constant, and what each click costs in Google calls.
3. This file, then the two handoffs it supersedes for detail: `docs/handoffs/2026-09-11-wp6-email-streams.md` (first-send checklist), `docs/handoffs/2026-09-11-wp9-live-deal-verification.md`.
4. `docs/runbooks/2026-09-12-dns-move-off-ivlt.md` — DNS is at Cloudflare now; why, and the one open item.
5. Memory files (loaded automatically): `skrendam-scan-laptop-ops`, `skrendam-funnel-hosting`, `skrendam-demand-layer-progress`, and the model rule `feedback-subagent-model-floor-opus`.

## 2. Where things stand (all merged to `main`, PRs #35–#49)
- **Spec delivered:** `docs/plans/2026-09-10-demand-layer-launch-spec.md` — every work package built and merged:
  WP2 demand layer (score_v2, archetypes, time gates, peak windows), WP0 hygiene, site follow-up (unsubscribe,
  founding interest), WP3 desk (today's ten, LT draft bodies), WP6 email streams (instant paid mail on publish,
  Letters page for digest/nurture, Subscribers page, tracked links), WP7 home persona (10 reverse routes, HOME_VFR
  zone, home-xmas live), WP8 letter stats, WP9 live-deal verification (daily exact-itinerary checks, states
  live/changed/expired, price-check history). Plans for each are in `docs/plans/`.
- **Databases:** Neon project `yip`, dev branch; alembic head `0015_deal_verification`; WP7 rows seeded by hand.
  Seeds are insert-only; value changes go in `scripts/YYYY-MM-DD_*.sql`. The daily scan never seeds.
- **Live state:** 12 published deals (founder published 2026-09-12); site at https://yip.lt on Vercel; DNS hosting
  at Cloudflare (`greg`/`sarah.ns.cloudflare.com`), domain still registered at iv.lt. Email sending is built but
  OFF until `RESEND_API_KEY` exists in `web/.env.local`.
- **Scans:** launchd 06:00 on the founder's laptop (`scripts/daily-scan.sh`); healthy envelope ≈ 850–900 Google
  calls/day, 0×429. Last two mornings were hurt by outages: ProtonVPN auto-connect (100 % empty answers) and a
  flaky connection tripping the circuit breaker. Check `bash scripts/status.sh` and `scutil --nc list` first.

## 3. Open items — founder (remind, don't do)
- Run the deep-research prompt `docs/research/2026-09-11-deep-research-prompt.md`; its results feed the site redo.
- First-send checklist (Resend key + `YIP_FROM_EMAIL`, `NEXT_PUBLIC_SITE_URL`, `PAYMENT_LINK_URL` into
  `web/.env.local`; Stripe Payment Link; test sends; `scripts/2026-09-12_founding_interest_backfill.sql`).
- iv.lt support ticket (sent 2026-09-12 14:10) to add Cloudflare's DS (tag 2371, alg 13) at the .lt registry —
  verify with `dig DS yip.lt @a.tld.lt` and `dig +dnssec A yip.lt @1.1.1.1` (`ad` flag). Until then the zone is
  unsigned but resolves everywhere. Never re-enable DNSSEC at iv.lt; never host the zone there again.
- Decisions: the replacement word for „kabliukas" (recorded as open in PROJECT.md; copy-only change); whether
  `home` subscribers with a Lithuanian origin pref should still get flights-home deals.
- Routine: publish from Review; Thursday digest and 10-day nurture are a Send button on Letters; keep the VPN
  auto-connect OFF and the laptop on AC with the lid open overnight.

## 4. Open items — engineering (after the frontend, unless blocking it)
1. **Site redo — see §0.** Everything else below waits for it unless it blocks the site.
2. **Desk round two** from the browser journey review (`.superpowers/sdd/2026-09-11-desk-journey-review.md` if
   present; else PROJECT.md queue): draft-headline baseline mismatch, empty TikTok/Body placeholders, duplicate
   chip labels for shared moment names, three disagreeing "today" counts, engine stats leaking into prose,
   Routes page always-open forms, filters not in the URL.
3. **Verification extras (WP9 parked):** evening check for public deals; re-fetch a sample itinerary when the
   found one is gone; `going_fast` from the daily step; surface `price_changed` reader reports on the desk.
4. **Email extras (WP6 parked):** `List-Unsubscribe-Post` (RFC 8058) before the first real send; purge of
   never-confirmed rows; the desk worker as a permanent launchd service + self-healing for stuck `scan_requests`.
5. **Hygiene:** `pyproject.toml` ruff include globs skip `skrendam/` and `alembic/` (scanner not linted in CI);
   `web/package-lock.json` esbuild pin is dishonest; Docker files unused.

## 5. Dated chores (also in PROJECT.md)
2027-01-07 `scripts/2027-01-07_enable_home_easter.sql`; 2027-03-01 `scripts/2027-03-01_enable_home_summer.sql`;
June: refresh Lithuanian school-holiday dates; after ~8 letters: re-tune the demand constants from `/letters/stats`.

## 6. How we work (non-negotiable process)
- Subagent-driven development from a written plan (`docs/plans/`), worktrees off `main` created from the main
  checkout with absolute paths, one PR per package, `gh run watch --exit-status` before merge, ledgers under
  `.superpowers/sdd/<plan>/progress.md` (git-ignored). Every implementer/reviewer on **Fable**, Opus when Fable is
  capped; never Sonnet/Haiku. Commit trailers as configured.
- Never call Google Flights outside the daily scan; never run `tests/search` (gated behind `--live`); never rescan
  after a healthy completed run; manual scans via `launchctl start com.skrendam.daily-scan`, not from a
  harness background command (10-minute ceiling kills it).
- Neon writes and destructive git only with founder approval; migrations applied by the controller, then
  `drizzle-kit pull` in both apps, never hand-edit `src/db/generated/*`.
- The desk runs locally: `cd web && npm run dev` (port 3000; login in `web/.env.local`); the site is Vercel-deployed
  on merge to `main`.

## 7. First 15 minutes of the next session
1. `bash scripts/status.sh`; if the scan is degraded, check the VPN and the wake log before anything else.
2. `dig DS yip.lt @a.tld.lt` — has iv.lt added the DS? If yes, confirm the `ad` flag and close the runbook item.
3. Ask whether the deep-research results are in. Then start the **site redo (§0)**: page inventory from §0.1 +
   research → mockups with real data → founder sign-off → build; copy as a separable deliverable.
