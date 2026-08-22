# Deal-detection research synthesis — what we adopt, test, and discard

_Date: 2026-08-22. Synthesis of the two research runs:
[aifare deal detection.md](aifare%20deal%20detection.md) (web/incumbents, engineering-grade) and
[deal-detection-lit-brief.md](deal-detection-lit-brief.md) (Consensus academic, 49 refs).
Read both before changing scorers._

## Where the two reports independently converge (highest confidence)

1. **Forward-curve neighborhood scoring is the backbone.** Score each travel date against the
   median/MAD of its *local neighborhood* (same month, like day-of-week, like trip length) within
   the same daily snapshot — not against the whole window. Zero history needed; works day 1 on new
   routes; directly separates "cheap month" from "cheap for its month." Etzioni's structural finding
   backs it: 63% of price moves are route-wide ("dependent"); the *independent* single-date move is
   the true deal signal. **This upgrades our existing `compute_baseline` (which uses the whole-window
   median — the source of the January bug), it does not replace the architecture.**
2. **Robust statistics beat models at our data depth.** No STL (needs ≥7 seasonal periods = years),
   no year-over-year (needs 13 months), no Hopper-style ML (needs corpora + infra we don't want).
   Median/MAD + quantile rules, fully interpretable to the curator.
3. **Three-tier output instead of a binary flag**: Certainty / Probable / Uncertainty →
   auto-publishable / curator-review / suppress. Maps onto our rare/great tiers but re-grounded in
   *signal agreement* (forward-curve AND time-series AND cross-route) rather than one weighted score.
4. **Date-clone collapse is a queue requirement.** "Same route cheap across 30 adjacent dates" must
   become ONE candidate with a date-range ("cheap Jan 8–24"), plus per-route caps in the top-k.
   (Winter sun's 180 candidates are largely this.) Bonus: the date-range summary IS Going's
   "≥N departure dates" marketability gate — same computation, two uses (PR #8's
   `min_departure_dates` field already anticipates it).
5. **Lifetime claims are radioactive until proven.** Daily snapshots time-average a continuously
   moving fare (Cavallo); any "live N days" claim must survive re-derivation under ≥2 imputation
   rules before we ship it. Segmented Kaplan-Meier later; "book within X hours" never (cadence
   forbids it).

## Genuinely new, high-value (single-source but strong)

- **Liquidity-conditioned thresholds** (Kim et al. 2019): the anomaly cutoff should be a function of
  route liquidity / scan density / carrier count, not one global z. The academic brief calls this the
  single highest-value change to the current scorers. Cheap to add once the z-scorer exists.
- **Route curve-shape classes before thresholds**: competitive trunk routes are non-decreasing in
  days-to-departure; thin routes have a bottoming-out window. One global days-out prior is wrong;
  classify routes (liquidity is probably the classifier), then threshold.
- **Cross-route zone priors for cold start** (price-per-km bucketed by zone/competition, NOT raw
  distance): matters exactly when PR #8 adds ~130 blind routes. Our zones table's
  `threshold_price_eur` is already a crude version — formalize it.
- **"Days since this route's last drop"** as a hazard feature (positive duration dependence in retail;
  legacy vs LCC likely need separate models). One SQL view over price_log.
- **Reference-price psychology → product rules** (the most product-shaping thread):
  - Suppress the was-price on shallow deals (meta-analysis: it only helps large plausible deals).
  - Baseline must be conservative (robust central tendency, never a flattering max) — the measurable
    harm of a generous was-price is *suppressed comparison search*, the opposite of our reason to exist.
  - **Publish the method**: "€180 below this route's typical August fare, across 46 scans" — the
    attribution is load-bearing; transparency is a conversion feature, not just ethics.
  - Badge calibration split: "cheap month" is a tensile claim → governed by the month's price
    *dispersion* ("up to" framing only when dispersion is wide); "true outlier" is a point claim →
    governed by *depth*.
  - Badge rate-limiting per route: flagging a route constantly trains readers it's always cheap and
    destroys perceived value.
- **Error fares get their own aggressive path**: magnitude rule (z beyond ~−5 / ≥60% below
  neighborhood) → Tier 0 "verify fast"; cross-route price-per-km corroboration; next-scan death as
  post-hoc label. Curator workflow: verify on a second source, "book direct," honor-rate context
  (~70–90% honored per the services that track it).

## Test BEFORE building — against the 218-candidate batch (dev DB, analysis scripts only)

1. **Quantization check**: do candidate discounts cluster at discrete deltas? If yes we're detecting
   fare-bucket transitions (Belobaba/EMSR) — stronger, explainable story, and a free feature.
2. **Threshold re-scoring**: re-score the batch with a liquidity-conditioned threshold vs the global
   one; measure how the great/maybe split moves.
3. **Neighborhood vs whole-window baseline**: re-score with month-local median; count how many
   current "great" candidates (esp. January winter-sun) demote to "cheap month." This quantifies the
   January bug before we fix it.
4. **Depth distribution**: what share of the 218 are shallow (<~25–30%)? Per the was-price rule,
   those should suppress the strikethrough on the site/newsletter.
5. **Days-since-last-drop**: compute per route from price_log; check whether drops follow droughts.

## Discard pile (deliberate, with reasons)

- Hopper-style ML forecasting (infra + corpora we don't have; wrong archetype — we're deal-alert,
  not buy-or-wait).
- STL/RobustSTL now (needs years; revisit at multi-year history if thin-route seasonality provably
  costs precision).
- Year-over-year now (needs 13 months; lands automatically via price_log next summer).
- Precise book-by-hours promises (cadence-impossible; "typically lasts N days" segmented KM only,
  after the imputation test).
- Per-carrier continuous-pricing watch (NDC risk) — log as a monitor idea, don't build.

## Sequencing (proposal, pending founder go)

- **Wave 0 — diagnostics (½ day):** the five batch tests above. Evidence before code.
- **Wave 1 — engine (~1 week):** neighborhood z-scorer (upgrade `compute_baseline`) →
  liquidity-conditioned thresholds → error-fare magnitude tier → date-clone collapse + per-route
  caps in the queue. A/B against current scorers on the batch; curator accept/reject log becomes the
  tuning signal.
- **Wave 2 — product rules (2–3 days):** was-price suppression rule, method-transparency line,
  badge framing split, badge rate limits. Touches templates/site copy, no engine risk.
- **Wave 3 — as data accrues:** days-since-drop feature, zone priors (before the PR #8 route
  expansion), KM lifetimes under two imputation rules, curve-shape classes at ~150 routes.

---

## Wave 0 results (2026-08-22, run against the 227-candidate batch + 2,410-price scan)

_Script: session scratchpad `wave0.py`; read-only against dev Neon._

**T1 — Quantization: CONFIRMED.** Only 41% of today's 2,410 prices are distinct values;
VNO-AGP shows €112 twenty-six times across a 360-point calendar. Fares sit at discrete bucket
levels — "a drop is a bucket reopening" is visible in our own data. (Bucket-gap deltas usable
as a feature later.)

**T2 — Dispersion: one global threshold is provably unfair.** MAD/median per series spans
**3.1% (RIX-PRG) to 43.8% (VNO-STN)** — a 14× spread. A fare 25% below median is **0.6 MADs on
VNO-STN (ordinary noise, floods the queue) but 8.1 MADs on RIX-PRG (a screaming anomaly the
current rule barely notices)**. Volatility-aware thresholds (modified z on per-series MAD) are
mandatory, not optional. Loudest finding of the five.

**T3 — January bug quantified: 24% of the batch.** Month-local scoring (≥25% below the travel
month's own median) demotes **53/225 candidates** from "deal" to "cheap month". Sample: KUN-AGP
Nov 28 claimed −47% vs window but is only 22% below its month median. Notably **winter sun
survives well (145/180 = 81% genuine)** — the January catch is mostly real; the was-prices are
what's inflated. Plan-ahead summer is the worst offender (42 demotions — consistent with its
missing months constraint).

**T4 — Depth: was-price suppression would apply to 24%** (55/227 below 30% discount;
17 below 20%). Distribution: 7% / 17% / 19% / 34% / 22% across <20/20-30/30-40/40-50/50+.

**T5 — Days-since-last-drop: not computable yet.** Longest consecutive daily-scan streak is 3
(June 12–13 gap, Aug 21–22). Needs ~14+ consecutive daily scans; accrues automatically.

**Consequence for Wave 1 order:** (1) per-series modified-z with month-local neighborhood —
T2+T3 are one combined change to `compute_baseline`/matching; (2) date-clone collapse (the 227
still contain many adjacent-date twins); (3) error-fare magnitude tier; (4) was-price
suppression rule at publish time (T4). Quantization feature and drought hazard wait for data.
