# Yip — Demand layer & launch spec (v3, reconciled + founder decisions 2026-09-10)

> **For the coding agent.** Read `docs/PROJECT.md` first. This is the approved direction from the
> Launch Review (2026-09-03) and the Deal Thesis (2026-09-04), rewritten after a read-only pass
> over the repo (v2) and the founder's three decisions the same day (v3). Every name below is a
> real table, field, file or constant that already exists, or is marked *new*. Date every change;
> update `PROJECT.md` §7 and write a `docs/handoffs/` note per work package.

Founder constraints: launch = TikTok + email within ~2–4 weeks; founder capacity after launch
**under 1 h/day**; revenue: paid subscription (primary), sponsored slots, B2B/leads — **not**
affiliate links.

---

## 0. Founder decisions (2026-09-10) — these override anything earlier

1. **Backend first; the public site will be redone.** Current `site/` copy and layout are
   provisional. Do not invest in site pages or design now. Site work in this spec is limited to
   (a) capturing what the backend needs (signup fields, source/UTM), (b) exposing new data through
   the query/mapper layer so the redo can use it, (c) trivial config fixes. No mockups, no new pages.
2. **Two email streams, not one.**
   - **Free list = leads.** People who signed up but don't pay. They get an occasional *nurture*
     letter: a couple of fresh finds + „ką praleidai" (the good deals they missed, with real
     prices) + an upgrade ask. Purpose: convert to paid.
   - **Paid subscription = the product.** Every published find, sent when it's published
     (instant), plus the weekly digest, plus personal windows (school breaks, flights home).
   - Consequence: the existing free `early_alerts` opt-in is folded into the paid stream (§3 WP6).
3. **Add a family Christmas template.** There was none by design; the founder wants it. It goes in
   with WP2, because the date archetype (window-typical from history) is what lets Christmas-peak
   fares surface as deals.

---

## 1. Reconciliation notes — what the repo already has, and what v1 got wrong

| v1 proposed | Reality in the repo | Decision |
|---|---|---|
| New `personas[]` on subscribers and candidates | `subscribers.prefs` JSON already holds `origins[]` + `moments[]` with codes `sun, city, family, weekend, last_minute` (`site/src/lib/subscribe-prefs.ts`); templates carry `newsletter_tag` (`family_sun, plan_summer, sept_sun, last_warm, xmas, last_minute, vfr, long_haul, winter_sun, ski`) | **No persona schema.** Persona = existing pref moment code. One shared mapping `skrendam/personas.json` (`newsletter_tag → pref codes`), loaded like `airports.json` in Python, web and site. Add code `home` (WP7). |
| Replace the hero H1 / new site copy | Site is being redone (decision 1) | No copy or page work now. The date-deal line and persona lines live in `docs/plans/2026-09-04-deal-thesis.md` for the redo. |
| Verify a Kalėdų template = Dec 21 | No Christmas family template existed (seeds comment: Xmas-peak fares never cleared the gate) | Add `family-xmas-sun` (decision 3, WP2.12) with the date archetype that makes it work. |
| New `route_floor_stats` table | `scanning/history.py` prefetches a 180-day `PriceHistorySeries` per route/trip/duration with `scanned_at` per point; `RarityScorer` already has `percentile()`; site shows "Pigiausi X % per 90 dienų" via `priceContext.ts` | **No new table.** Compute `commodity_share` in memory from the same series. |
| New `typical_price`, `MIN_DATE_PAIRS`, "departure ≥ 07:00" | `candidates.baseline_price`/`discount_pct` exist; `deal_templates.min_departure_dates` + `candidates.departure_date_count` are the marketability gate; `family_friendly_times_only`, `earliest_departure_hour`, `latest_arrival_hour` exist on templates **but are consumed nowhere** | Reuse. **Bug to close in WP2:** enforce the time-of-day gates. |
| `is_launch` flag on templates | `deal_templates.priority` (int, default 0) exists, unused | Use `priority` (one-off SQL). |
| Typical price + sparkline on the card | Deal page already has `priceContext` + `PriceSparkline` + was-price gated by `WAS_PRICE_MIN_DROP_PCT = 30` (synced in `content.py`, `web/format.ts`, `site/format-rules.ts`) | Done; the redo inherits it. |
| Machine-drafted why/catch | `scanning/content.py` seeds `content_drafts` (headline, tiktok_hook, newsletter_snippet); `body` always `None`; desk `CopyDrafter` tabs headline/hook/news | Extend `build_content_draft` to fill `body`; add a body tab. |
| Instant alerts as the paid hook vs free `early_alerts` | `subscribers.early_alerts` is a free opt-in today | Decision 2: instant alerts are paid. `early_alerts` becomes a *paid-feature flag* (default on for paid); the free form stops offering it. Existing opt-ins (few) are treated as founding paid-interest leads. |
| Newsletter + tracked clicks | Nothing beyond confirmation emails (`site/src/lib/email.ts`, Resend SDK) | New (WP6), two streams. |
| Reverse diaspora routes | `routes(origin, destination)` generic; `deal_templates.included_origins` exists; `due_routes()` honours `core` | Feasible without schema change (WP7). |

Also noted: scorers are a registry (`weighted, drop, error_fare, rarity, outlier`) with
`pick_headline()` by `template.primary_scorer`; `tiering.py` (GREAT 88 / RARE 94) is the single
source of truth downstream must not re-encode; `published_deals.tier` is reserved for a per-deal
„Viešas / Tik laiške" toggle; edition scarcity `FREE_WINDOW = 3`; `S.emptyLive` and the `foundToday`
kicker exist; `PREF_ORIGINS` already lists PLQ and WAW with no routes seeded for them.

---

## 2. The decision

### 2.1 What counts as a deal (three archetypes, one exclusion)

| Archetype | Definition | Gate (constants in §6) |
|---|---|---|
| **date** | A normally expensive window at an off-peak price: school breaks, Christmas, Easter, LT long weekends — only a history-holding service can find it. | both legs inside a `peak_windows` row whose `pref_codes` intersect the template's persona codes · `fare ≤ DATE_DEAL_MAX_RATIO × window_typical` (WP2.5) · existing itinerary + time-of-day gates pass |
| **destination** | A destination Lithuanians actually search for, at a price that beats the mental anchor, not just the month. | `saving_pp ≥ ABS_SAVING_FLOOR_EUR` (direct) / `ABS_SAVING_FLOOR_CONNECTING_EUR` (stops) **and** `discount ≥ MIN_DISCOUNT_PCT` · `demand_tier ∈ {A,B}` · `departure_date_count ≥ template.min_departure_dates` |
| **rare** | Error fares, launch pricing, long-haul at short-haul money. | `outlier.signals.possible_error_fare` **or** an `error_fare` score **or** `discount ≥ RARE_DISCOUNT_PCT` · sent to paid within the hour · badge `S.badgeRare` |
| **commodity** (excluded) | A fare at or near a price the route hits on most scan days — its floor. | `commodity_share ≥ COMMODITY_FLOOR_SHARE` → `score_v2 = min(score, COMMODITY_CAP)` |

Primary archetype precedence `date > rare > destination`; all matched archetypes kept in `demand_signals`.

### 2.2 Who — personas are the existing pref moment codes

| Pref code | Who | Their deal | Templates (`newsletter_tag`) |
|---|---|---|---|
| `family` | Parents 35–44; book early; compare against a ~€950/person package | Family of 4 flights ≤ €400–500 total, direct, departure ≥ 07:00, inside an official break (incl. Christmas), bags priced | `family_sun`, `plan_summer` |
| `weekend` | Couples/friends 25–44, Vilnius/Kaunas, TikTok-native | City break ≤ €70 rt hand-luggage, Fri/Sat out, Sun/Mon back; long weekends around LT public holidays | `last_minute`, `xmas`, `sept_sun` |
| `home` (**new**) | VFR both ways: LT residents visiting family abroad and the ~460k diaspora flying home | London/Dublin/Oslo/Bergen/Copenhagen/Manchester on Christmas/Easter/summer dates, 2–6 months out — a **date** deal | `vfr` + new `home` templates (WP7) |
| `sun` | Couples/families 35–54, Nov–Mar | 7–10 nights ≤ €150 rt, direct where it exists | `winter_sun`, `last_warm` |
| `city`, `last_minute` | existing codes, keep | — | `xmas`, `last_minute`, `long_haul`, `ski` |

Mapping in **`skrendam/personas.json`** (new, shared). Launch personas: `family`, `weekend`;
`home` with WP7; `sun` from November.

### 2.3 The two email streams

| | Free list (leads) | Paid subscription (product) |
|---|---|---|
| Who | anyone who signed up | `subscribers.plan = 'paid'` |
| Gets | a nurture letter every `FREE_LETTER_CADENCE_DAYS`: `FREE_LETTER_FRESH` fresh finds + „Ką praleidai" (`FREE_LETTER_MISSED` expired finds with real prices and how long they lasted) + upgrade ask | every published find on publish (instant email), the weekly digest (Thursday 07:00), personal windows (`family`, `home`) first, `rare` within the hour |
| Purpose | convert to paid | retain |
| Payment at launch | — | Stripe Payment Link (no integration code): webhook or manual flip of `plan` in the desk; full billing later |

The site's locked rows („kaina — laiške") sell the paid stream; the redo will reword them.

---

## 3. Non-negotiables (PROJECT.md + founder rules + what the code enforces)

- Worktrees off `main`; merges gated by `gh run watch --exit-status`. Alembic migrations for schema
  (`alembic/versions/`); drizzle schemas in `web/src/db/generated` and `site/src/db/generated` are
  regenerated, not hand-edited.
- No site layout or page work now (decision 1). Desk UI changes are fine without mockups (internal).
- Public copy rules still apply to the letter and any provisional site string: show the catch; no
  invented social proof; no "scan"/„skenuoti" (use *peržiūrim*); any „usually/įprastai/was" price
  obeys `WAS_PRICE_MIN_DROP_PCT` wherever it is defined.
- **Google load:** nothing here adds searches except the WP7 cohort. Never probe interactively;
  never rescan a healthy run.
- **Seeds are insert-only** (`_get_or_create`): new rows via `seeds.py`, value changes via
  `scripts/YYYY-MM-DD_*.sql` on the live DB (Neon `yip`, **`dev` branch**).
- `trip_len_max_days` is decorative; a fare attaches to every matching template.

---

## 4. Work packages, in order

Order: **WP2 → WP3 → WP6 → WP0 → WP7 → WP8**. Site-side items are minimal and can ride along.

### WP2 — Demand layer in the scorer (`skrendam/`) — start here

Hook point: `orchestrator._persist_fare()` after `pick_headline()` — the headline `Score` and
`hist_series` (`PriceHistorySeries`) are in scope. Implement pure functions in
**`skrendam/scanning/scoring/demand.py`** (new) — not a registered `Scorer` (scorers only add
matches; this layer also demotes).

1. **Time-of-day gates (bug, do first):** enforce `family_friendly_times_only`,
   `earliest_departure_hour`, `latest_arrival_hour` in `eligibility.itinerary_ok` from `fare.legs`
   (first departure, last arrival). Seeded since June, never read.
2. **`commodity_share(series, price)`**: group `series.points` by `scanned_at.date()`, take each
   day's minimum price, return the fraction of scan days with `daily_min ≤ price × FLOOR_TOLERANCE`
   over the last `FLOOR_LOOKBACK_DAYS`; `None` below `FLOOR_MIN_DAYS` (unknown ≠ commodity).
3. **`peak_windows`** (new table + alembic + insert-only seed): `id, slug, name, kind ∈
   {school_break, public_holiday, long_weekend, custom}, start_date, end_date, pref_codes JSON,
   source_url, notes`. Seed from §10. `date_fit(travel_date, return_date, template_pref_codes)` =
   `DATE_FIT_PEAK` when both legs sit inside a window sharing a pref code; `DATE_FIT_WEEKEND` for
   FRI/SAT-out & SUN/MON-back; else `1.0`.
4. **`demand_tier(destination)`** from **`skrendam/demand_tiers.json`** (new static resource, §10,
   shared like `airports.json`): `{A: 1.00, B: 0.85, C: 0.70}`; airports flagged `vfr: true`
   get `1.00` when the template's persona includes `home`.
5. **`window_typical`** for the date archetype: median of `series.points` whose `travel_date` falls
   inside the matched `peak_windows` row (≥ `WINDOW_TYPICAL_MIN_POINTS`; else
   `baseline.local_median(travel_date)`). First use of *history for a fixed calendar window* rather
   than the current calendar — say so in the docstring. This is what makes Christmas fares
   findable: a Christmas-week fare compared with Christmas-week fares from earlier scans, not with
   December's median.
6. **Absolute saving** per person: `saving_pp = max(0, baseline.local_median − price)` (same
   quantity `WeightedScorer` computes as `abs_savings`); family templates (`audience == families`)
   also report `saving_family = 4 × saving_pp`.
7. **Archetypes** per §2.1 from existing signals (`outlier.signals.possible_error_fare`, presence
   of an `error_fare` score, `candidate.discount_pct`, `departure_date_count` vs `min_departure_dates`).
8. **`score_v2`** = `clamp(round(headline.score_0_100 × date_fit × demand_weight), 0, 100)`; if
   commodity, `min(score_v2, COMMODITY_CAP)`. Rare skips `demand_weight`. `quality_tier` recomputed
   as `tiering.quality_tier(score_v2)` — thresholds stay only in `tiering.py`.
9. **Persist** on `candidate_template_matches` (alembic): `score_v2 int`, `archetype str`,
   `demand_signals json` (`commodity_share, is_commodity, date_fit, demand_weight, window_slug,
   window_typical, saving_pp, saving_family, archetypes[]`). `score_0_100` untouched.
10. **Launch priority:** one-off SQL sets `deal_templates.priority = 100` on `family-autumn-sun,
    family-feb-sun, family-easter-sun, family-xmas-sun, plan-ahead-summer, last-minute-weekends,
    christmas-markets, last-warm-days-november, winter-sun-escape`. Coverage tab shows priority.
11. **Curator-label proxy:** extend `skrendam/analyze.py` with approval rate of labeled candidates
    by zone × template × price band × `commodity_share` bucket → markdown to `docs/research/`.
12. **`family-xmas-sun` template** (decision 3), in `seeds.py` next to the other fixed-window
    family templates:
    ```
    slug="family-xmas-sun", audience="families", moment="school_holidays",
    trip_type="roundtrip", date_window_type="fixed",
    fixed_start_date=date(2026,12,18), fixed_end_date=date(2026,12,28),   # departures; break Dec 21 – Jan 3
    included_destinations=WINTER_WARM, trip_len_min_days=5, trip_len_max_days=10,
    max_stops=1, allow_overnight_layover=False, allow_airport_change=False,
    family_friendly_times_only=True,
    max_price_eur=450,            # Christmas peak; the date archetype, not this cap, is the real gate
    min_discount_pct=20, min_departure_dates=3,
    public_label="Family sun", newsletter_tag="family_sun",
    content_angle="Christmas-break warmth (Dec 21 - Jan 3) - real sun only",
    ```
    Add `LT_XMAS_BREAK = (date(2026,12,18), date(2026,12,28))` beside the other break constants
    with the ministry note (start moved Dec 23 → Dec 21 on 2026-07-30). Founder may add a
    `family-xmas-ski` twin over the ski destinations later.

**Acceptance:** after one healthy scan, Review sorted by `score_v2` shows no commodity fares in the
top 20; every new match carries `score_v2`, `archetype`, `demand_signals`; a fare inside
`rudens-2026` outranks an equal-z random-Tuesday fare on the same route; a 05:50 departure no longer
matches a `family_friendly_times_only` template; `family-xmas-sun` resolves specs on the next run;
`scan_runs.api_calls` unchanged vs the previous day; tests cover commodity, date_fit, window_typical,
time gates.

### WP3 — Deal Desk (`web/`): today's ten, half-written

1. **Today** (`shortlist.ts`): rank by `score_v2` (fallback `score`), default filter
   `template.priority ≥ 100` with a toggle; archetype chip, persona chips (`personas.json`),
   `commodity_share`, `saving_family` on family rows, plus existing supersede/route-context chips.
   `SHORTLIST` 20 → `TODAY_N` 10.
2. **Drafts**: `content.py: build_content_draft` fills `body` = *kodėl verta* (local median vs
   fare, or window name for date deals — only above `WAS_PRICE_MIN_DISCOUNT`) + *kabliukas* (stops,
   departure < 07:00, hand-luggage-only when known, ground link for KUN/RIX, weather line for `sun`
   templates). Rules-based LT strings. `CopyDrafter` gets a `body` tab; `Composer` shows it.
3. **Publish** from Today with the draft prefilled (existing Composer path). Publishing a deal
   enqueues the paid instant send (WP6).
4. **Issue assembly** (new page `(app)/issue`): two modes — *paid digest* (all finds since the last
   digest, personal blocks first) and *free nurture* (`FREE_LETTER_FRESH` fresh + `FREE_LETTER_MISSED`
   missed + upgrade ask). Preview → save an `issues` row → send (WP6). Expired list from
   `published_deals` with `lasted_hours = expired_at − published_at`.
5. **Subscribers view**: `plan`, `prefs.moments/origins`, `prefs.utm.source`, referral count, a
   manual `plan` flip (paid ↔ free) for the Payment Link phase.

**Acceptance:** desk → 1–3 published deals in ≤ 10 min using drafts; either issue mode assembled in
≤ 15 min; expired list needs no manual input.

### WP6 — Email: two streams (new; Resend from `web/`)

1. **Schema (alembic):** `subscribers.plan text default 'free'`, `paid_since`, `paid_source`;
   `issues(id, kind ∈ {paid_digest, free_nurture, instant}, sent_at, deal_ids json,
   expired_deal_ids json, stats json)`; `deal_events(id, deal_id, issue_id, subscriber_id,
   kind ∈ {click, booked_claim}, source, created_at)`.
2. **Paid stream:** on publish → one email per find to `plan='paid'` subscribers whose
   `prefs.origins` match (empty = all); `rare` goes out within the hour; Thursday 07:00 digest
   with `family`/`home` blocks first for subscribers with those codes.
3. **Free stream:** nurture letter every `FREE_LETTER_CADENCE_DAYS` (assembled in WP3.4): fresh
   finds, „Ką praleidai" with real prices and `lasted_hours`, one upgrade link (Payment Link +
   `ref`). Real numbers only („{n} prenumeratorių užsisakė") — never estimates.
4. **`early_alerts`:** stop offering it on the free form; treat it as a paid-feature flag (default
   true for paid). Existing opt-ins: keep the flag, mark `prefs.founding_interest = true`, include
   in the first upgrade ask.
5. **Tracking:** every deal link is a tracked redirect (`click`); one „Užsisakiau" per deal
   (`booked_claim`); `issue_id` on every event.
6. **Deliverability (founder applies DNS):** SPF/DKIM/DMARC on the sending domain; unsubscribe link
   on both streams; test send to Gmail/Apple Mail/Outlook.

**Acceptance:** publishing a deal sends the paid email within a minute; a nurture issue renders in
the three clients; events land with `issue_id`; DMARC passes; a free subscriber never receives the
instant stream.

### WP0 — Launch hygiene (small; alongside WP6)

| # | Task | Owner | Where |
|---|---|---|---|
| 0.1 | **Signup capture only:** add `'tiktok'` to `SUBSCRIBE_SOURCES`; store `utm_*` from the query string into `prefs.utm`; accept `?ref=` → `prefs.referred_by`; drop the `early_alerts` checkbox from the free form (WP6.4). No layout work. | agent | `site/src/lib/subscribe-prefs.ts`, `subscribe-action.ts`, `subscribe/page.tsx` |
| 0.2 | **Referral code without a migration:** `ref_code = base36(subscriber.id) + 1-char checksum`; shown in letter footers. | agent | `web/` + `site/` shared helper |
| 0.3 | **Kipras collection:** add filter kind `{ kind: 'destinations'; iatas: ['LCA','PFO'] }` and its query branch (config-level fix; the redo keeps the kind). | agent | `site/src/lib/collections.ts`, `queries.ts` |
| 0.4 | **Expose, don't design:** `site/src/lib/mappers.ts` / `queries.ts` surface `verified_at`, `saving_family`, `archetype`, `demand_signals.window_slug`, and a ground-link hint for KUN/RIX so the redo can render them. | agent | site lib only |
| 0.5 | **Privacy page** — plain text, legal minimum, no design. | agent | `site/src/app/privatumas/page.tsx` (new) |
| 0.6 | Publish ≥ 12 live deals across ≥ 3 moments; expire dead ones. | **founder** | Deal Desk |

### WP7 — `home` persona: reverse diaspora cohort

1. Add `home` to `PREF_MOMENTS` (label „Grįžtu namo iš užsienio") and to `personas.json`.
2. Seed ~10 **reverse routes** in `ROUTES` (origin abroad → KUN/VNO), verified against the current
   schedule before seeding — candidates `STN/LTN→KUN`, `STN/LTN→VNO`, `DUB→KUN`, `DUB→VNO`,
   `OSL→VNO`, `OSL→KUN`, `BGO→KUN`, `CPH→VNO`, `MAN→KUN`; zone `WESTERN_EUROPE`; `core=True`
   October → mid-December, tail otherwise. `scan_runs.api_calls` must stay inside the healthy
   envelope (~900, 0×429) — shrink the list rather than add passes.
3. Templates `home-xmas`, `home-easter`, `home-summer` (fixed windows §10, `included_origins` = the
   abroad airports, `included_destinations = ['VNO','KUN']`, `newsletter_tag='home'`,
   `audience='vfr'`, `moment='vfr_visit'`, `trip_type='roundtrip'`, `min_departure_dates` unset).
4. **Check assumptions** that origin ∈ {VNO,KUN,RIX}: desk queue filters, `routeContext.ts`,
   `cities-lt.ts`, origin collections. Fix only what breaks the desk; the site redo handles display.

### WP8 — Instrumentation (alongside WP6)

- Desk aggregation of `deal_events` per issue: clicks and booked-claims by archetype × pref code ×
  origin × plan. Replaces §6 constants after ~8 issues. Free→paid conversion per nurture issue.
- TikTok attribution: signups by `prefs.utm.content` (video id).

### Deferred to the site redo (do not build now)

Hero/date-deal copy; Savaitgaliai and „Namo" collections as pages; the „Mokinių atostogos
2026–2027" page + .ics; „Kaip mes dirbam"; „Pavyzdinis laiškas"; deal-card lines (bag, ground link,
„tikrinta", family total) — the data for all of these is exposed by WP0.4 and WP2. Also later: route
price-history pages, quarterly „kainų indeksas", Telegram, full billing, Latvian layer, scanning
off the laptop, fli replacement.

---

## 5. Schema and resource changes (all additive)

```
NEW  peak_windows                                    (alembic + insert-only seed)     WP2
NEW  candidate_template_matches.score_v2, .archetype, .demand_signals (alembic)   WP2
NEW  deal_templates row family-xmas-sun              (seeds.py, insert-only)         WP2
NEW  subscribers.plan, .paid_since, .paid_source     (alembic)                       WP6
NEW  issues, deal_events                             (alembic)                       WP6
NEW  skrendam/personas.json, skrendam/demand_tiers.json (shared static resources)   WP2
SQL  deal_templates.priority = 100 on launch templates (scripts/2026-09-XX_launch_priority.sql)  WP2
SQL  seeds: reverse routes + home_* templates        (insert-only via seeds.py)      WP7
—    subscribers.prefs gains keys utm, referred_by, founding_interest (JSON)         WP0/WP6
```

Regenerate `web/src/db/generated/*` and `site/src/db/generated/*` after each migration.

---

## 6. Constants (module-level in `scoring/demand.py` and the desk, matching existing style)

```
COMMODITY_FLOOR_SHARE            = 0.20
FLOOR_TOLERANCE                  = 1.05
FLOOR_LOOKBACK_DAYS              = 90      # within the 180-day prefetched series
FLOOR_MIN_DAYS                   = 14      # fewer scan days -> commodity_share None
COMMODITY_CAP                    = 40
DATE_FIT_PEAK                    = 1.25
DATE_FIT_WEEKEND                 = 1.10
DEMAND_W                         = {"A": 1.00, "B": 0.85, "C": 0.70}
ABS_SAVING_FLOOR_EUR             = 60      # per person, direct
ABS_SAVING_FLOOR_CONNECTING_EUR  = 150
MIN_DISCOUNT_PCT                 = 40      # destination archetype
DATE_DEAL_MAX_RATIO              = 0.60    # fare <= 60% of window_typical
WINDOW_TYPICAL_MIN_POINTS        = 10
RARE_DISCOUNT_PCT                = 60      # aligns with outlier.DISC_ERROR
TODAY_N                          = 10      # web/src/lib/shortlist.ts
DIGEST_DAY / DIGEST_TIME         = Thursday / 07:00 Europe/Vilnius   (paid)
FREE_LETTER_CADENCE_DAYS         = 10
FREE_LETTER_FRESH                = 2
FREE_LETTER_MISSED               = 3
```

Existing constants that stay authoritative: `WAS_PRICE_MIN_DROP_PCT = 30` (three places),
`tiering.GREAT = 88`, `tiering.RARE = 94`, `outlier.Z_ERROR = -5`, `outlier.DISC_ERROR = 0.60`,
`rarity.RARE_PCTILE = 0.10`, `template.min_departure_dates`, `scarcity.FREE_WINDOW = 3`.

---

## 7. Copy (LT; provisional — the site redo owns final copy; letters follow the `lt.ts` voice: tu, lowercase spoken verbs, „radinys"; banned: *akcija, superkaina, nepraleisk progos!*, "scan")

```
prefHome          „Grįžtu namo iš užsienio"                     (PREF_MOMENTS, WP7)
letter.headline   „Savaitės radinys"
letter.family     „Atostogų radaras"
letter.missed     „Ką praleidai"                                 (free nurture)
letter.upgrade    „Gauk kiekvieną radinį tą pačią minutę"        (free nurture, upgrade ask)
letter.booked     „Užsisakiau"
letter.bookedN    „{n} prenumeratorių užsisakė"                  (real counts only)
card.bagOnlyHand  „Tik rankinis bagažas — registruotas pagal tarifą"   (draft body)
card.fromVilnius  „Iš Vilniaus: 59 min traukiniu"                (KUN, draft body)
card.fromRiga     „Iš Vilniaus: traukinys nuo €9.60, ~4 val."    (RIX, draft body)
card.familyTotal  „Šeimai iš keturių: {price}"                   (draft body)
```

---

## 8. Definition of done for the launch

- WP2 live: `score_v2`/archetypes on every new match, time gates enforced, `family-xmas-sun`
  seeded, launch priorities set, `api_calls` unchanged.
- WP3: Today view with body drafts; both issue modes assemble.
- WP6: publishing sends the paid instant email; one free nurture issue and one paid digest sent to
  a seed list with tracked clicks; free form no longer offers early alerts; Payment Link + manual
  `plan` flip working.
- WP0: signup captures source/utm/ref; Kipras fix; privacy page; ≥ 12 live deals across ≥ 3 moments.
- WP7 in before mid-October; WP8 alongside WP6.

---

## 9. Do not

- Build site pages, hero copy, card design, or mockups now (decision 1).
- Add Google searches for follows/watches/alerts — only the WP7 cohort.
- Add a `personas` column anywhere; a search box; an app; templates beyond `family-xmas-sun` and
  `home_*`; Latvian; full billing integration; affiliate links.
- Generate why/catch with an LLM in the publish path; extend `content.py` rules only.
- Show „usually/was" below `WAS_PRICE_MIN_DROP_PCT`; show estimated social proof.
- Send the instant stream to `plan='free'`; re-encode tier thresholds outside `tiering.py`;
  hand-edit generated drizzle schemas; change zones or scan cadence.

---

## 10. Reference data

**`peak_windows` seed (2026–27).** School dates: smsm.lrv.lt (Christmas start moved Dec 23 → Dec 21
on 2026-07-30). Existing template departure windows already align: `LT_AUTUMN_BREAK` Oct 30–Nov 4,
`LT_FEB_BREAK` Feb 12–17, `LT_EASTER_BREAK` Mar 19–31; new `LT_XMAS_BREAK` Dec 18–28.

| slug | kind | start → end (travel dates) | pref_codes |
|---|---|---|---|
| rudens-2026 (+Nov 1–2) | school_break | 2026-10-31 → 2026-11-08 | family, weekend |
| kaledos-2026 | school_break | 2026-12-21 → 2027-01-03 | family, home |
| ziemos-2027 (Feb 16 inside) | school_break | 2027-02-15 → 2027-02-21 | family, weekend |
| pavasario-2027 (1–10 kl.; Easter Mar 28) | school_break | 2027-03-22 → 2027-03-29 | family, home |
| pavasario-gimn-2027 | school_break | 2027-03-29 → 2027-04-04 | family |
| vasara-2027 | school_break | 2027-06-05 → 2027-08-31 (school-specific start) | family |
| kovo-11-2027 | long_weekend | 2027-03-11 → 2027-03-14 | weekend |
| jonines-2027 | long_weekend | 2027-06-24 → 2027-06-27 | weekend |
| liepos-6-2027 | long_weekend | 2027-07-03 → 2027-07-06 | weekend |
| geguzes-1-2027 | public_holiday | 2027-05-01 → 2027-05-02 | weekend |
| home-xmas-2026 | custom | out 2026-12-18 → 12-23 · back 2027-01-02 → 01-06 | home |
| home-easter-2027 | custom | 2027-03-25 → 2027-04-05 | home |
| home-summer-2027 | custom | 2027-06-20 → 2027-07-05 | home |

**`demand_tiers.json` (initial, from LT search volumes Sep 2026):**
- **A:** CDG/BVA, FCO/CIA, BGY/MXP, BUD, AMS, IST, STN/LTN/LGW, PRG, TFS/LPA, ALC, HER/CHQ, FNC,
  LCA/PFO, AGP, PMI, BCN.
- **B:** BER, VIE, LIS, DUB, NCE, OSL, TIA, HRG/SSH, DXB, BKK, TGD, BRI, NAP, ATH, OPO, VLC, KRK,
  WAW, CPH, MLA, AYT.
- **C:** everything else.
- **`vfr: true`:** STN, LTN, LGW, DUB, OSL, BGO, CPH, MAN, EDI, BRS, LPL, ARN, HHN, EIN, SNN.

**Ground links (constants for draft bodies):** Vilnius–Kaunas LTG Link express 59 min (since
2026-03-29, dynamic pricing); Vilnius–Riga direct train ~4 h from €9.60; bus 4–4.5 h.

---

## 11. Handoff

When a WP lands: update `docs/PROJECT.md` §7, add a dated `docs/handoffs/` note (what changed,
constants set, next scan's `api_calls` and 429s). The Launch Review and Deal Thesis this spec
implements sit next to it in `docs/plans/`; the site redo should start from the Deal Thesis
(personas, message, card standard).
