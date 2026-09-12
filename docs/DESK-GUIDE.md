# Deal Desk — operating guide

> The founder's guide to running Yip day to day. Everything here is taken from the
> code and docs as of main `a552209` (2026-09-11); when the two disagree, the code
> wins and this file needs an update. Product copy is quoted in Lithuanian as the
> site and letters show it. Canonical project context lives in `docs/PROJECT.md`.
>
> **Editing this file:** the desk renders it at `/guide` with a deliberately small
> Markdown subset (`web/src/lib/markdown.ts`) — headings `#`–`###`, paragraphs,
> `>` quotes, bullet and numbered lists **one level only**, `**bold**`,
> `*italic*`, `` `code` ``, fenced blocks, links and simple pipe tables. A nested
> bullet does not nest: it degrades silently into a paragraph showing its literal
> `- text`. Anything outside the subset renders as its own source.

## 1. What this is

Yip is a curated cheap-flight-deals service (yip.lt) for Lithuania and the near
Baltics. A **scan** on the founder's MacBook queries Google Flights every morning
through the vendored `fli` library and writes fares, candidates and drafts to
**Neon Postgres** (project `yip`, the **`dev` branch** is the live one — the
`production` branch is idle). The **Deal Desk** (`web/`, Next.js, port 3000 on the
laptop) is where the curator reviews candidates and publishes deals; publishing
writes `published_deals`, which the public **site** (`site/`, Next.js on
**Vercel**, auto-deployed from `main`) renders, and — once a Resend key is set —
fires the instant paid email. The Thursday digest and the free nurture letter are
also assembled and sent from the desk. Nothing runs on an always-on host: the scan,
the desk and every email send happen on the laptop.

## 2. A normal morning

### The 06:00 scan

- **What fires:** launchd job `com.skrendam.daily-scan` at 06:00 runs
  `scripts/daily-scan.sh`, which runs `uv run skrendam run-scan` (never `--seed`).
  It waits up to ~2 h for the network, holds the Mac awake with `caffeinate`, and
  retries up to 4× (5-minute settle) on connection-shaped failures. A daily
  checkpoint (`~/Library/Logs/skrendam/scan-checkpoint.json`) lets a retry resume
  instead of re-spending Google calls.
- **What it does:** first, before it opens its own `scan_runs` row, marks any
  `running` run older than 6 h as failed. Then it scans today's cohort — the ~39
  core routes every day plus the tail slice where
  `route.id % 10 == day-ordinal % 10` (`tail_rotation_days = 10`)
  — across every enabled template (18 in the catalogue; `home-easter` and
  `home-summer` ship disabled until their dated chores); writes `price_log`, `candidates`,
  `candidate_template_matches` (with `score_v2`, `archetype`, `demand_signals`) and
  `content_drafts`. Then it sweeps: expires candidates whose `expires_at` (last
  seen + 14 days) has passed; expires live deals whose `travel_date` or
  `valid_until` is behind today; purges subscribers unsubscribed more than 30
  days ago; and finally, **only on a healthy run**, re-checks
  every live/changed deal (§4). Counters and status land on the `scan_runs` row
  when the run finishes.
- **How long:** the longest healthy full-network run observed is ~80 min; a run
  still `running` 6 h after it started is treated as orphaned.
- **Healthy vs degraded:** the verdict (`skrendam/fli_adapter/health.py`) is
  `degraded` when any of these hit — ≥ 50 % of calendar searches empty (≥ 5 made),
  ≥ 50 % of flights searches empty (≥ 5 made), ≥ 30 % of all calls errored (≥ 5
  made), ≥ 10 calls but zero price rows, or price rows under 10 % of the previous
  run's (previous ≥ 100). Data is kept either way; `degraded` only says "don't
  trust today's picture". A run the circuit breaker stopped (5 consecutive
  failures) is stamped `failed` in the database — but it still exits 2, so the
  notification says DEGRADED. `daily-scan.sh` exits 0 healthy / 2 degraded or
  aborted / 1 setup failure and posts a macOS notification titled "Skrendam scan
  OK", "Skrendam scan DEGRADED" or "Skrendam scan FAILED" with the summary line.
  "Skrendam scan FAILED" therefore means exit 1 (a crash or a setup problem such
  as a missing database URL); the watchdog is what reports an aborted run, as
  "last scan failed".
- **The rules that keep it healthy:** the Mac must be on AC for the scheduled wake
  (clamshell needs AC + external display); ProtonVPN auto-connect must stay off —
  a VPN exit IP produces ~100 % empty calendar answers and breaks Neon DNS, which
  looks exactly like Google gating; never run `tests/search` or whole-repo
  `pytest` from this laptop; never rescan after a completed healthy run.
- **The watchdog:** `com.skrendam.watchdog` runs `scripts/status.sh --alert` at
  09:00 and at every login. It notifies "Skrendam needs attention" when no scan
  finished in 26 h, when today's 06:00 scan has not finished by 08:30, when a
  launchd job is not loaded, or when the last scan was degraded/failed. Healthy
  mornings write one `OK` line to `watchdog.log`.

### Then, in the desk

1. **Today** (`/`). Read the verdict card: "Scan ran N ago — healthy", how many
   searches Google answered, prices logged, "N fresh deals · M of them high-score".
   A red banner appears only for a degraded/failed run, with the reasons. The line
   "N changed · M expired since yesterday · K on the site" is what verification did
   overnight. Any coral card underneath is a live deal with no real price answer in
   3+ days (a "Recheck price" button each).
2. **Review** (`/queue`). "New today" opens on the day's top ten by demand score,
   launch templates only. Open a row → the Composer → **Approve & publish**, Hold,
   or Dismiss. Work city by city with the chips if the list is long.
3. **Live** (`/published`). Glance at `changed` rows and anything with "missed N
   checks"; expire what is dead.
4. **Letters** (`/letters`) on a Thursday: Assemble paid digest → read the preview →
   Send. Free nurture on the ~10-day rhythm, same page.

### What each click costs in Google calls

| Action | Where | Google calls |
|---|---|---|
| Publish, Hold, Dismiss, Schedule, Reject, Save copy, Expire, Republish, Update live deal, plan flip, Assemble, Send | everywhere | none — database only |
| **Recheck** (Composer) / **Recheck price** (Today card) | Composer, Today | 1 flights search per candidate, via the worker |
| **Recheck live deals** | Today | 1 flights search per live/changed deal, via the worker |
| **Scan today's cohort** | Today | a full cohort pass (hundreds of calls — the same load as the 06:00 scan; never press it after a healthy morning run, **and never while the pulse bar says a scan is running**: nothing stops you — the button only greys out while it is queuing — and the worker's pass carries no checkpoint, so it shares the session and spends every call again) |

The three Google-calling buttons only **queue** a `scan_requests` row (the pulse bar
shows "N queued"). Nothing happens until `uv run skrendam worker` is running on the
laptop — it polls every 15 s, executes requests oldest first, and records the
outcome on the row. It takes **at most 5 requests per poll**, so "Recheck live
deals" across a dozen deals needs several polls: a queue count that drains a few
at a time is normal, not a stuck worker. `scripts/status.sh` shows whether the
worker is up ("only needed for admin buttons").

## 3. Pages

The pulse bar at the top of every page reads: last scan age with ✓/⚠, "scan
running since HH:MM" when one is in progress, "next today/tomorrow 06:00", and the
queued-request count. The sidebar badges are: **Review** = distinct fresh
candidates, **Live** (coral, "!") = `changed` deals + live deals due a recheck.

### Today (`/`)

- Verdict card: scan line, fresh/high-score counts, **Start reviewing →**, and the
  two Google-calling buttons **Scan today's cohort** and **Recheck live deals**.
- Verification summary: "N changed · M expired since yesterday" (`changed` = current
  state; `expired` = `expired_at` within the last 24 h) linking to Live.
- Stale cards: every live/changed deal whose last real answer (`verified_at`,
  falling back to `last_seen_at`, then `published_at`) is older than
  `RECHECK_AFTER_DAYS = 3`, with "N empty answers in a row" when the scan got
  nothing, and a **Recheck price** button.
- Footer: next scan time, live count, link to scan history.

### Review (`/queue`)

- **Scopes:** *New today* (status `new`), *Saved* (Hold/Schedule parked it),
  *History* (everything, including expired). Counts are distinct candidates, not
  candidate×template rows.
- **City tabs:** *All cities* plus one chip per enabled route origin (Vilnius,
  Kaunas, Riga, and the abroad origins such as "London STN"); each is its own URL
  (`/queue?origin=VNO`) so cities never mix.
- **Template chips:** one per template with fresh finds, most fresh high-score
  first; click to focus one template (which lifts the top-ten cap).
- **Sort:** Best first (`score_v2`, legacy score on old rows) · Cheapest ·
  Biggest drop · Soonest travel. Sorting reorders; it never changes who made the
  cut.
- **"all templates":** off by default — *New today* shows only templates with
  `priority ≥ 100` (launch templates). Tick it to let reserve inventory in.
- **Top-10 rule:** with more than `TODAY_N = 10` fresh candidates, *New today* shows
  the ten with the best `score_v2` (one slot per candidate, judged by its best
  row); "Top 10 shown — show all N deals ↓" lifts it. Inside a group the first three
  routes are shown (dates of one route cluster under "N more dates"), then "Show N
  more routes"; `maybe`-tier rows sit collapsed under "Maybe (n)". "Dismiss group…"
  rejects every fresh/saved row of a template after a confirming second click.
- **Row chips** (from the engine's `demand_signals`): **date deal / rare fare /
  destination deal** (the archetype), the **persona codes** the template's
  `newsletter_tag` maps to (`family`, `weekend`, `home`, `sun`, `city`,
  `last_minute` via `personas.json`), **commodity N%** when the fare sits on its own
  90-day floor on ≥ 20 % of scan days, and **family saves €N** on family templates
  (4 × per-person saving). The "why" line is the first signal (the template's
  reason, "N% below baseline", "Direct route"); "The catch:" lists the flags
  (`2+ stops`, `Self-transfer`) or says "No catches spotted — verify in review".
  "also matches: …" names the other templates the same fare hit. The usual price is
  struck through only when the drop is ≥ 30 % (`WAS_PRICE_MIN_DROP_PCT`).
- **Route context:** "↓ live deal is €X — this fare is €Y cheaper" with **Update
  live deal →** (supersedes the live deal in place, ≥ €5 cheaper, same route and
  trip type); "live on this route at €X"; "you dismissed a similar fare at €X".
- **Row buttons:** Open, Hold (→ `seen`, appears under *Saved*), Dismiss (→
  `rejected`).

### The Composer (drawer from Review, or full page at `/candidates/<matchId>`)

- **Fact pills:** route, dates, legs, airline, "€price · −drop%". Status pill and
  "Verified N ago" / "Not yet rechecked" (the candidate's `verified_at`).
- **Price vs baseline**, **Why the scanner flagged it** (signals), **Caveats to
  disclose** (flags).
- **Draft copy** tabs: Headline · TikTok hook · Newsletter · **Body** (the
  „kodėl verta / kabliukas" text). Edits go out exactly as shown; **Save copy**
  stores them as a `content_drafts` row (`status = 'edited'`).
- **Approve & publish** — creates the `published_deals` row (`status = 'live'`,
  `tier = 'free'`, price/baseline/dates/booking URL frozen from the candidate),
  sets the candidate `approved`, and fires the instant paid email (or records the
  skip when there is no key). Disabled with the reason "Expired — cannot publish"
  or "Travel date has passed — cannot publish"; the server refuses the same cases.
- **Reject** → `rejected`. **Schedule** → `maybe` (shows under *Saved*).
  **Recheck** → queues a `recheck` request (one Google call when the worker runs).

### Live (`/published`)

- Tabs **live** (= `LIVE_STATUSES`: `live` + `changed`), **draft**, **expired**,
  with counts. Each row: route, headline, published €price, −N%, travel date,
  "valid until", "published N ago", "unverified since <date>" when set, the public
  label, and — on live rows — the manual **TikTok +/✓** and **IG +/✓** posted chips.
- **Verification facts** per row: "now €X (+N%) · N ago" (current vs published
  price, hover = when) or "no current price"; "window min €X on <date>" (the day's
  cheapest fare at the last check); "missed N checks" in coral when > 0; "last
  check N ago" or "never checked"; "N checks" (`deal_price_checks` rows).
- State pill: `live` (sea), `changed` (amber), `expired` (coral).
- **Hook** copies the TikTok hook. **Expire** (live rows) stamps `expired_at`.
  **Republish** (non-live rows) sets `live`, clears `expired_at` and
  `unverified_since`, resets `missed_checks` — blocked once the travel date has
  passed. **Update live deal** lives on the Review row (route-context chip): it
  rewrites price, dates, booking URL and the €-figures in the headline, restarts
  the state at `live` with the candidate's fare as `current_price`.

### Subscribers (`/subscribers`)

Everyone newest first: email, **plan** with the flip ("→ paid…", then "Make
paid?"), confirmed, moments, origins, `utm.source`, founding (`prefs.founding_interest`),
referrals (rows whose `referred_by` is this subscriber's ref code), created,
unsubscribed. Going paid sets `paid_since = now`, `paid_source = 'manual'`,
`early_alerts = true`; going free clears `paid_since`/`paid_source` and leaves
`early_alerts` as the subscriber set it. Header counts: total · confirmed · paid ·
unsubscribed.

### Letters (`/letters`)

- **Assemble paid digest** picks every live/changed deal published since the last
  *sent* digest, newest first. **Assemble free nurture** picks the 2 newest
  live/changed deals plus the 3 most recently expired ones that have an `expired_at`
  and lasted ≥ 1 h. An empty pick saves nothing and shows a banner. Each assemble
  saves an unsent `issues` row and opens its preview.
- **Preview** (`/letters/<id>`): deal list (marked "(changed)" / "(expired)"),
  missed list with "N h · M booked", the subject, and the rendered HTML in a
  sandboxed iframe. **Send…** asks "Send to every paid|free subscriber now?" on a
  second click; refusals are shown inline (already sent, none live any more, no
  Resend key). Deals that expired between assemble and send are dropped and
  counted.
- The table lists every non-instant issue: deals, missed, assembled, sent, result
  ("N sent · N failed · N no token · N dropped (expired)" or "not sent —
  RESEND_API_KEY missing") and a **stats →** link. Instant sends are counted in one
  line and have their own summary page (`/letters/<id>` for an `instant` issue).
- **Stats:** per issue (`/letters/<id>/stats`) — clicks and „Užsisakiau" claims by
  archetype × pref code × origin × plan (anonymous ones under `anon`); overview
  (`/letters/stats`) — one row per sent nurture with recipients, free-at-send,
  paid-between and the free→paid rate, plus TikTok signups by `utm.content`. Both
  are read-only over `deal_events`, `issues`, `subscribers`.

### Machine (`/machine`)

- **Scan health** — the last 20 runs: status pill, start, duration, scanner
  version, Templates / Routes / API calls / 429s / Candidates / Matches / Errors;
  queued and running requests above.
- **Coverage** — the whole map: moment → template, **priority** (≥ 100 bold =
  launch), when it scans (seasonal / relative / fixed dates — stale fixed windows
  show "dates passed"), where, trip, price gates, audience, status (live / off /
  dates passed).
- **Templates, Routes, Zones, Audiences, Moments** — the config editors (the same
  pages as `/config/*`). Edits here change what the next scan looks for.

## 4. How a deal lives

### Candidates (`candidates.status`)

| Status | Desk shows | How it gets there |
|---|---|---|
| `new` | Review → *New today* | the scan created it |
| `seen` | *Saved* | Hold on a row |
| `maybe` | *Saved* | Schedule in the Composer |
| `rejected` | *History* | Dismiss / Reject / Dismiss group |
| `approved` | pill "published" | Approve & publish, or Update live deal |
| `expired` | *History* only | the scan's sweep: `expires_at` (last seen + 14 days) has passed |

A candidate matching several templates is several rows in Review but one deal;
counts and the top ten are per candidate. Publishing is refused when the candidate
is `expired` or its travel date is before today.

### Scoring and tiers

- The headline score is 0–100; **great ≥ 88**, **rare ≥ 94** (`tiering.py`, the
  single source; the site says „Geras radinys" / „Retas radinys").
- `score_v2` = headline score × date-fit (peak window 1.25, Fri/Sat-out
  Sun/Mon-back 1.10) × demand weight by destination tier (A 1.00 / B 0.85 /
  C 0.70; rare fares skip the weight), capped at 40 when the fare is a commodity
  (on its own floor ≥ 20 % of scan days over 90 days, needs ≥ 14 days of history).
  **A match's tier follows `score_v2`**, so a headline-great fare to a low-demand
  destination is not tiered great.
- Archetype precedence **date > rare > destination**: date = both legs inside a
  `peak_windows` row sharing a persona code and fare ≤ 60 % of that window's
  typical price (of the route's usual price when the window holds under 10 price
  points — `WINDOW_TYPICAL_MIN_POINTS`); rare = possible error fare / error-fare
  score / discount ≥ 60 %; destination = saving ≥ €60 direct (€150 with stops)
  and discount ≥ 40 % and demand tier A/B, and the template's
  `min_departure_dates` met (or unset). A commodity fare gets none.
- Launch templates carry `priority = 100`; Review's default view and the top ten
  are limited to them. `TODAY_N = 10`.

### Published deals (`published_deals.status`)

| State | Site | Meaning |
|---|---|---|
| `live` | published price; „Geras/Retas radinys"; „Tikrinta prieš …" from `verified_at`; top 3 newest shown in full, the rest locked „kaina — laiške" | last real answer within tolerance of the published price |
| `changed` | current price with „Dabar nuo 124 €" / „radome už 93 €"; discount recomputed against the shown price; still counts toward the free window | still available and still a deal, but > 10 % above the published price |
| `expired` | gone from the live list; shown in `/past-deals` | date passed, gate failed, two missing days, or Expire |

Verification rules (`skrendam/verification.py`, run by the 06:00 scan after the
route pass, **healthy runs only** — a degraded or aborted run makes zero
verification calls and zero writes):

- Free **calendar check** first: if today's `price_log` already holds the deal's
  exact route/dates pair, that price is recorded at zero cost (economy only).
- Then an **exact-itinerary flights check** (matched by flight numbers) for deals
  that are public (top `FREE_WINDOW = 3`), had no calendar hit today, whose
  calendar price moved beyond tolerance, or whose last real answer is older than
  3 days — priority public → mailed in the last 48 h → newest — until
  **20 network calls** (`VERIFY_CALLS_PER_DAY`) are spent. The loop stops on the
  first 429 or when the breaker opens; skipped deals keep their state.
- `PRICE_DRIFT_TOLERANCE_PCT = 10`: price ≤ published × 1.10 → `live`
  (`missed_checks` reset). Above that but still clearing **the same price-anomaly
  gate discovery uses** (discount vs the frozen `baseline_price` ≥ the template's
  minimum, or under the ceiling, or under the psychological price) → `changed`.
  Failing the gate → `expired`. Exact itinerary gone but the day's minimum still
  within tolerance → `live`; above tolerance but clearing the gate → `changed`
  with the window minimum as the sample.
- **An empty answer never changes status.** In the 06:00 step it stamps
  `unverified_since` and, on a healthy run, `missed_checks += 1`; **two
  consecutive missing days** (`MISSED_CHECKS_TO_EXPIRE = 2`) expire the deal.
  An empty **manual** Recheck stamps `unverified_since` only — no check row, no
  transition, no counter bump — so **pressing Recheck can never expire a deal**;
  expire a dead one by hand on Live. Republish, Update live deal and any real
  price reset the counter.
- Every check writes a `deal_price_checks` row (`source` = `calendar` /
  `flights` / `manual`). The desk's **Recheck** goes through the same
  `record_check` and `transition`, so a hand recheck can move a deal to `changed`
  or `expired` exactly as the morning step would; it is also the **only** thing
  that sets the „Tirpsta" (going fast) chip, when the price is ≥ 5 % above the
  published one. Neither path rewrites `candidates.price`.
- The calendar sweep (travel date or `valid_until` behind today) still expires
  `live` deals regardless of Google.

## 5. Letters & subscribers

- **Two streams**, split by `subscribers.plan`. **Free** (`'free'`, the default)
  gets the nurture letter: „Savaitės radinys" (2 fresh), „Ką praleidai" (3 expired
  with the real price, „išbuvo … val./d." and „{n} prenumeratorių užsisakė" — real
  `booked_claim` counts only) and one upgrade link when `PAYMENT_LINK_URL` is set.
  **Paid** (`'paid'`) gets every published deal the minute it is published
  („{price} € — {Miestas}", only if `prefs.origins` includes the deal's origin or is
  empty) and the Thursday digest.
- **Instant is on publish, paid only.** A send failure never fails the publish;
  the issue row is still written. A `changed` deal is never re-sent as instant.
- **Digest and nurture are a Send button.** There is no scheduler anywhere;
  `DIGEST_DAY = 'Thursday'`, `DIGEST_TIME = '07:00'` and
  `FREE_LETTER_CADENCE_DAYS = 10` are labels. Thursday is a calendar habit.
- **What needs the Resend key:** every send. Without `RESEND_API_KEY` in
  `web/.env.local` each send returns early and records `stats.skipped_no_key`; the
  draft stays sendable later. `YIP_FROM_EMAIL` defaults to `Yip <hello@yip.lt>`,
  `NEXT_PUBLIC_SITE_URL` to `https://yip.lt`. Restart `npm run dev` after editing.
- **Plan flip is manual** (no payment webhook): when a payment lands, find the row
  on Subscribers and flip it. Founding interest (pre-existing early-alerts opt-ins)
  is flagged by the one-off `scripts/2026-09-12_founding_interest_backfill.sql`;
  the nurture does not read it — it is for the first manual upgrade ask.
- **Unsubscribe / purge:** every mail carries the `/atsisakyti` link and a
  `List-Unsubscribe` header; the daily scan hard-deletes subscribers unsubscribed
  more than 30 days ago (the `/privatumas` promise). Their `deal_events` survive
  anonymised.
- **Tracked links:** every deal link in a letter is
  `yip.lt/go/<deal>?i=<issue>&s=<refCode>` (records a `click`, redirects to the
  booking page); every card has „Užsisakiau" → `/uzsisakiau/<deal>` (one
  `booked_claim` per subscriber per deal). That page also offers „Kaina pasikeitė",
  which records `price_changed` — a burst of those on a `live` deal means the fare
  moved between checks: hit Recheck.

## 6. Numbers to watch

| Number | Healthy looks like | Where |
|---|---|---|
| `api_calls` | ~900 for a full day (2026-09-03: 912; verification adds ≤ 20) | Scan health card "API calls"; `scan_runs.api_calls` |
| `http_429s` | 0 — any 429 means the session is being punished | Scan health "429s"; run summary |
| Google answered | ~96–100 % of searches on a cold single pass from a residential IP | Today verdict line; `health.metrics` |
| candidates / matches per run | 2026-09-03: 152 candidates on the new template set | Today ("N fresh deals"), Scan health, `scripts/status.sh` "found" |
| `deals_verified / deals_changed / deals_expired / verify_calls / deals_verify_aborted` | verified = number of live deals (calendar hits are free), `verify_calls ≤ 20`, aborted 0 | the `scan complete:` line in `daily-scan.log` carries verified/changed/expired only; `verify_calls` and `deals_verify_aborted` live in `scan_runs.health.metrics`; Today's "N changed · M expired" |
| live deals on the site | more than 0, ideally ≥ 12 across ≥ 3 moments | Live tab count; `status.sh` "published" |
| queue depth | a morning's work, not a wall | Review counts; `status.sh` "to review" |
| worker | running when you plan to press Recheck | `status.sh` "worker" |

`scripts/status.sh` prints all of this in one screen: last scan verdict and age,
found counts, why it degraded, whether the two launchd jobs are armed, worker,
queue, published (with unverified count) and subscribers.

## 7. Chores & calendar

- **Every June:** refresh BOTH the four family templates' fixed windows (Coverage
  flags "dates passed") AND the `peak_windows` rows from smsm.lrv.lt — they are
  seeded from the same `LT_*_BREAK` constants and must move together (a peak
  window opens on the Friday before its break).
- **2027-01-07:** run `scripts/2027-01-07_enable_home_easter.sql` to switch on
  `home-easter`; check the next run's `api_calls` stays under ~950.
- **2027-03-01:** run `scripts/2027-03-01_enable_home_summer.sql` to switch on
  `home-summer`. Then roll the three `home-*` fixed windows and their
  `peak_windows` rows forward a year, as in June. Only `home-xmas` scans now.
- **Seeding is manual:** `uv run skrendam seed` from the main checkout after a
  merge that adds zones, routes, templates or windows — the daily scan never seeds.
  Seeds are insert-only; value changes to existing rows are one-off SQL in
  `scripts/YYYY-MM-DD_*.sql` against Neon dev.
- **After ~8 sent letters:** re-tune the demand constants by hand from the Letter
  stats pages (commodity cap, date-fit multipliers, tier weights, cadence — spec
  `docs/plans/2026-09-10-demand-layer-launch-spec.md` §6). Nothing auto-adjusts.
- **Open, waiting on a word:** the founder wants „kabliukas" renamed (2026-09-11)
  but has not picked the replacement, so nothing has changed — the Composer's
  Body tab and the site still say it. The decision, and the four site files to
  sweep once the word is chosen, are recorded under "Open decisions" in
  `docs/PROJECT.md` §7.
- **Email go-live:** work through the first-send checklist in
  `docs/handoffs/2026-09-11-wp6-email-streams.md` (Resend domain + SPF/DKIM/DMARC,
  keys, Stripe Payment Link, test sends to Gmail/Apple Mail/Outlook, the
  founding-interest SQL) before the first Thursday.

## 8. When something looks wrong

- **Degraded scan.** Before blaming Google: `scutil --nc list` and
  `curl api.ipify.org` — a VPN exit IP explains 100 % empties and Neon DNS
  failures. Was the lid closed without AC + display? Did anything run
  `tests/search` or whole-repo `pytest` on this laptop? A VPN-gated run poisons the
  day's checkpoint — move `~/Library/Logs/skrendam/scan-checkpoint.json` aside
  before a clean retry, and never rescan after a run that completed healthy. Today
  shows the reasons in the red banner; the verification step made no writes.
- **A run stuck on `running`.** The desk stops treating it as in progress after
  6 h and the next scan marks it `failed` with "orphaned: never finished". The
  watchdog complains after 08:30 if today's scan never finished; check
  `daily-scan.log` for where it died (sleep, DB connection).
- **Recheck buttons do nothing.** Requests stay `queued` (pulse bar "N queued",
  Scan health "Queued / Running") until `uv run skrendam worker` is running. A
  request that errors keeps its message on the row; a worker crash mid-request
  leaves it `running` with no auto-recovery.
- **Desk says "Module not found" after a merge:** `cd web && npm ci`, restart
  `npm run dev`.
- **Zero live deals on the site.** Nothing is published, or verification expired
  them (two missing healthy days, or a real price that failed the gate) — check
  Live → expired and Today's "N expired since yesterday". Publish from Review; the
  site shows the 3 newest in full.
- **Letters say "not sent — RESEND_API_KEY missing".** The key is not in
  `web/.env.local` or the dev server was not restarted after adding it.
- **Logs:** `~/Library/Logs/skrendam/` — `daily-scan.log` (every run and retry,
  ends with the `scan complete:` line), `launchd.out.log` / `launchd.err.log`,
  `watchdog.log`, `scan-checkpoint.json`. `scripts/status.sh` first, always.
- **Trigger the scan by hand** only when the morning run never happened:
  `launchctl kickstart gui/$(id -u)/com.skrendam.daily-scan`.

## 9. Where things live

| Path | What |
|---|---|
| `skrendam/` | scan engine — `cli.py` (`run-scan`, `seed`, `worker`, `analyze`, `calibrate`), `scanning/orchestrator.py`, scorers under `scanning/scoring/` (`demand.py`, `tiering.py`, `eligibility.py`), `verification.py`, `seeds.py`, `worker.py` |
| `web/` | Deal Desk (Next.js + drizzle): pages in `src/app/(app)/`, actions in `src/app/*-actions.ts` and `actions.ts`, pure rules in `src/lib/` (`shortlist.ts`, `verification.ts`, `letters.ts`, `publishGuard.ts`, `statuses.ts`), email in `src/lib/email/` |
| `site/` | public yip.lt — copy deck `src/lib/lt.ts`, `scarcity.ts` (`FREE_WINDOW = 3`), `/go`, `/uzsisakiau`, `/atsisakyti`, `/past-deals`, `/privatumas` |
| `fli/` | vendored Google Flights client (private fork, no releases) |
| `docs/` | `PROJECT.md` (canonical context), `handoffs/` (session-by-session truth), `plans/` (specs), `research/` |
| `scripts/` | `daily-scan.sh`, `status.sh`, `install-daily-scan.sh`, `launchd/` plists, dated one-off SQL |
| `alembic/` | schema migrations (latest `0015_deal_verification`) |

**Env files (names only, all gitignored):**

- `web/.env.local` — `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `AUTH_SECRET`,
  `AUTH_TRUST_HOST`, `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`, `E2E_ADMIN_PASSWORD`,
  `RESEND_API_KEY`, `YIP_FROM_EMAIL`, `NEXT_PUBLIC_SITE_URL`, `PAYMENT_LINK_URL`.
  Rebuild this file from `web/.env.example`, not from this list — without
  `AUTH_SECRET` the desk cannot log in at all, and `drizzle-kit pull` needs the
  unpooled URL.
- `site/.env.local` — `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `RESEND_API_KEY`,
  `YIP_FROM_EMAIL`, `NEXT_PUBLIC_SITE_URL`, `CURATOR_NAME` (template:
  `site/.env.example`, which does not list `CURATOR_NAME` — only `src/lib/lt.ts`
  reads it; the same values live on Vercel).
- The scanner reads `SKRENDAM_*` variables (`SKRENDAM_DATABASE_URL`,
  `SKRENDAM_TAIL_ROTATION_DAYS`, …); when `SKRENDAM_DATABASE_URL` is unset,
  `daily-scan.sh` and `status.sh` reuse `DATABASE_URL` from `web/.env.local`.

**Database:** Neon project `yip` (`still-mode-83548775`), active branch **`dev`**
(`br-cool-hill-agqjm1kk`); `production` is idle. Desk, site and scan all point at
dev.

**Read next:** `docs/PROJECT.md` §6 (operational truths) and §7 (the queue), then
the latest files in `docs/handoffs/`.
