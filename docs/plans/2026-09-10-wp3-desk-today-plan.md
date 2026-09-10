# WP3 — Deal Desk: today's ten, half-written — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The curator opens the desk and sees the ten best fresh finds ranked by `score_v2`, each with an archetype/persona/commodity chip and a rules-written LT body (why it's worth it + the catches) prefilled into Publish.

**Architecture:** Read side in `web/` (queries → `CandidateView` → chips, shortlist by `scoreV2`, priority floor). Write side in `skrendam/scanning/content.py` (pure LT string rules from the demand signals the scanner already persists) wired at the existing `build_content_draft` call in the orchestrator. No new tables; no LLM in the publish path (spec §9).

**Tech Stack:** Next.js 16 + drizzle (`web/`, vitest, tsc, eslint), Python 3.13 (`skrendam/`, pytest, ruff).

**Spec:** `docs/plans/2026-09-10-demand-layer-launch-spec.md` §4 WP3, §6 (`TODAY_N = 10`), §7 copy, §9 do-nots. Parent plan: `docs/plans/2026-09-10-demand-layer-implementation-plan.md` §F WP3.

## Global Constraints

- Branch `feat/wp3-desk-today` from `main` (≥ `d36ed75`), worktree `.claude/worktrees/wp3-desk` created from the main checkout with an absolute path.
- Never hand-edit `web/src/db/generated/*` or `site/src/db/generated/*`; the columns WP3 needs (`candidate_template_matches.score_v2/archetype/demand_signals`, `content_drafts.body`, `deal_templates.priority/newsletter_tag`) already exist in the generated schema.
- Tier thresholds only in `skrendam/scanning/scoring/tiering.py` / `web/src/lib/tiers.ts` (D6: desk tier already follows `scoreV2` — do not re-derive).
- `WAS_PRICE_MIN_DROP_PCT = 30` gate (`content.WAS_PRICE_MIN_DISCOUNT = 0.30`) for any „įprastai/vietoj" was-price clause.
- Copy: Lithuanian, `tu` voice, lowercase spoken verbs, „radinys"; banned: *akcija, superkaina, nepraleisk progos!*, „skenuoti"/"scan". **No invented facts:** a body line appears only when the data proves it (a bag line only when the snapshot says so; a weather line only from the verified climate table).
- Draft body carries **no label words** (no „Kodėl verta:"/„Kabliukas:" prefixes) — the founder will rename the concept later; labels stay in the desk UI (English), never in stored copy.
- Rules only in `content.py` (spec §9: no LLM generation in the publish path).
- Scanner behaviour unchanged except the draft body: `api_calls`, scoring, tiers untouched.
- WP3.4 (issue assembly) and WP3.5 (subscribers view) are **moved to WP6** (they need `issues` and `subscribers.plan` from the WP6 migration).
- Each commit ends with the trailers `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_018PDTEbaxZkCdkN6PbHUSA9`.
- Gates: `cd web && npx tsc --noEmit && npx vitest run && npx eslint <touched>`; `uv run pytest tests/skrendam -q`; `uv run ruff check skrendam tests/skrendam && uv run ruff format --check skrendam tests/skrendam`.

---

### Task 1: Data plumbing — demand fields on `CandidateView`

**Files:**
- Modify: `web/src/lib/queries.ts:12-40` (`queueBase` select)
- Modify: `web/src/lib/types.ts` (`CandidateView`)
- Modify: `web/src/lib/mappers.ts` (`toCandidateView`)
- Test: `web/src/lib/mappers.test.ts` (extend)

**Interfaces:**
- Consumes: generated columns `candidateTemplateMatches.archetype`, `.demandSignals` (json: `commodity_share`, `saving_family`, `window_slug`, `is_commodity`, `demand_tier`), `dealTemplates.priority`, `dealTemplates.newsletterTag`; `web/src/lib/personas.json` (`{ newsletter_tag: string[] }`).
- Produces (later tasks rely on these exact names):
  ```ts
  scoreV2: number | null;            // engine demand score, null on legacy rows
  archetype: 'date' | 'rare' | 'destination' | null;
  commodityShare: number | null;     // 0..1
  savingFamily: number | null;       // € for 4 seats, families templates only
  windowSlug: string | null;
  personas: string[];                // pref codes from personas.json[newsletterTag]
  priority: number;                  // dealTemplates.priority
  ```

- [ ] **Step 1: Failing test** — in `mappers.test.ts` add a row fixture with `scoreV2: 91`, `archetype: 'date'`, `demandSignals: { commodity_share: 0.35, saving_family: 240, window_slug: 'kaledos-2026' }`, `newsletterTag: 'family_sun'`, `priority: 100` and assert `toCandidateView(row)` yields `scoreV2 91`, `archetype 'date'`, `commodityShare 0.35`, `savingFamily 240`, `windowSlug 'kaledos-2026'`, `personas ['family']`, `priority 100`. Second case: all null/absent → `scoreV2 null, archetype null, commodityShare null, savingFamily null, windowSlug null, personas [], priority 0`. Third case: unknown `newsletterTag` → `personas []`; an `archetype` string outside the union → `null`.
- [ ] **Step 2: Run** `npx vitest run src/lib/mappers.test.ts` → FAIL (fields undefined).
- [ ] **Step 3: Implement** — `queueBase` adds `archetype: candidateTemplateMatches.archetype, demandSignals: candidateTemplateMatches.demandSignals, templatePriority: dealTemplates.priority, newsletterTag: dealTemplates.newsletterTag`. In `mappers.ts`:
  ```ts
  import personas from './personas.json';
  const ARCHETYPES = new Set(['date', 'rare', 'destination']);
  function num(v: unknown): number | null { const n = Number(v); return v == null || Number.isNaN(n) ? null : n; }
  // inside toCandidateView:
  const sig = (r.demandSignals ?? {}) as Record<string, unknown>;
  const archetype = ARCHETYPES.has(String(r.archetype)) ? (r.archetype as CandidateView['archetype']) : null;
  ...
  scoreV2: r.scoreV2 == null ? null : Number(r.scoreV2),
  archetype,
  commodityShare: num(sig.commodity_share),
  savingFamily: num(sig.saving_family),
  windowSlug: typeof sig.window_slug === 'string' ? sig.window_slug : null,
  personas: (personas as Record<string, string[]>)[r.newsletterTag ?? ''] ?? [],
  priority: r.templatePriority ?? 0,
  ```
  Update the `cand()` fixture helpers in `shortlist.test.ts`, `cluster.test.ts`, `routeContext.test.ts` if tsc complains about the widened type (add the seven fields with null/[]/0 defaults).
- [ ] **Step 4: Run** `npx tsc --noEmit && npx vitest run` → PASS.
- [ ] **Step 5: Commit** `feat(desk): surface score_v2, archetype, demand signals and template priority on CandidateView`.

---

### Task 2: Today's ten — `TODAY_N`, `scoreV2` ranking, priority floor, chips, Coverage priority column

**Files:**
- Modify: `web/src/lib/shortlist.ts`, `web/src/lib/shortlist.test.ts`
- Modify: `web/src/components/QueueBoard.tsx` (toggle + floor), `web/src/components/QueueRow.tsx` (chips)
- Modify: `web/src/app/(app)/machine/coverage/page.tsx` (priority column)

**Interfaces:**
- Consumes Task 1 fields.
- Produces:
  ```ts
  export const TODAY_N = 10;                 // spec §6
  export const LAUNCH_PRIORITY = 100;        // template.priority floor for the default view
  export function rankScore(c: CandidateView): number  // scoreV2 ?? score
  export function shortlistIds(rows: CandidateView[], limit = TODAY_N, priorityFloor: number | null = LAUNCH_PRIORITY): Set<number>
  ```

- [ ] **Step 1: Failing tests** in `shortlist.test.ts`: (a) `rankScore` prefers `scoreV2` (row with `score 95, scoreV2 40` ranks below `score 70, scoreV2 80`); (b) default limit is 10 (11 suggested rows → 10 ids); (c) `priorityFloor = 100` excludes rows with `priority 50` even when their score is highest; `priorityFloor = null` includes them; (d) a candidate on two templates where only one has `priority ≥ 100` competes with that row's score only.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** `shortlist.ts` (replace `SHORTLIST` with `TODAY_N`; keep an `export const SHORTLIST = TODAY_N` alias only if another importer exists — grep, otherwise delete). `rankScore = (c) => c.scoreV2 ?? c.score`. In `shortlistIds`, skip rows with `priorityFloor != null && c.priority < priorityFloor` before the `best` map.
- [ ] **Step 4: QueueBoard** — state `const [allTemplates, setAllTemplates] = useState(false)`; `shortlist = shortlistIds(flat, TODAY_N, allTemplates ? null : LAUNCH_PRIORITY)`; `SORTS['Best first']` uses `rankScore`; a small checkbox next to the sort select: `<label>… <input type="checkbox" checked={allTemplates} onChange…/> all templates</label>`; the "Top N shown" button text uses `TODAY_N`. Keep every other behaviour.
- [ ] **Step 5: QueueRow chips** — under the route stub, a mono 10px chip row (reuse the `also matches` styling): archetype (`date` → "date deal", `rare` → "rare fare", `destination` → "destination deal"), each persona code as-is, `commodity ${Math.round(commodityShare*100)}%` only when `commodityShare != null && commodityShare >= 0.2`, `family saves €${savingFamily}` when `savingFamily != null && savingFamily > 0`. No chip row when all are empty.
- [ ] **Step 6: Coverage** — add `<th>Priority</th>` after Template and `<td>{t.priority}</td>` in the rows; rows with `priority >= 100` get `fontWeight: 700`.
- [ ] **Step 7: Run** `npx tsc --noEmit && npx vitest run && npx eslint src/lib/shortlist.ts src/components/QueueBoard.tsx src/components/QueueRow.tsx 'src/app/(app)/machine/coverage/page.tsx'` → PASS.
- [ ] **Step 8: Commit** `feat(desk): today's ten by score_v2 with launch-priority floor, demand chips, coverage priority`.

---

### Task 3: Draft body rules in `content.py` (+ verified climate table)

**Files:**
- Modify: `skrendam/scanning/content.py` (`build_content_draft` gains `signals`, `fare`, `window_name`)
- Modify: `skrendam/scanning/scoring/demand.py` (`Window.name`; `windows_from_rows` fills it)
- Modify: `skrendam/scanning/orchestrator.py:448-450` (pass the new args)
- Create: `skrendam/climate.json` (verified monthly mean daily highs, °C, for sun destinations only)
- Test: `tests/skrendam/test_content.py`, `tests/skrendam/test_demand.py` (Window name), `tests/skrendam/test_orchestrator.py` (body persisted)

**Interfaces:**
- Consumes: `demand.assess(...).signals` dict (`window_slug`, `window_typical`, `saving_family`, `is_commodity`), `FareItinerary` (`stops`, `legs[*]["departure_time"]` ISO strings, `raw`), `eligibility.leg_hour_bounds(fare) -> (earliest_dep_hour | None, latest_arr_hour | None)`, template `newsletter_tag`, `personas.json` (`sun` persona = weather line).
- Produces:
  ```python
  def build_content_draft(origin, destination, price, baseline, travel_date, template,
                          *, signals: dict | None = None, fare: FareItinerary | None = None,
                          window_name: str | None = None) -> dict   # draft["body"] now a str
  def body_lines(...) -> tuple[str, list[str]]   # (why, catches) — pure, tested directly
  ```
  Body format: `why + ("\n" + " · ".join(catches) if catches else "")`. Never empty.

- [ ] **Step 1: Failing tests** (`test_content.py`), each a call to `body_lines`/`build_content_draft`:
  - date deal: `signals={"window_slug":"kaledos-2026","window_typical":420.0,"archetype":"date"}`, `window_name="Kalėdų atostogos"`, price 190 → why == `"Kalėdų atostogos — €190, įprastai apie €420"` (typical known and ≥30% below).
  - date deal, typical only 20% above → why falls back to the baseline rule; baseline 20% above too → why == `"€190 į Larnaką iš Vilniaus"` (LT accusative from `airports.json` if a `city_acc` key exists; else nominative `"€190 — Larnaca, iš Vilniaus"` — implementer checks the JSON and picks the honest one; test asserts whichever form the data supports, documented in the test).
  - destination deal: baseline 300, price 120 → why == `"€120 vietoj įprastų €300"`.
  - family: `signals={"saving_family": 240}` price 95 → catches/why includes `"Šeimai iš keturių: €380"` (price × 4, appended to why as second sentence).
  - catches: `fare.stops == 1` → `"1 persėdimas"`; `stops == 2` → `"2 persėdimai"`; leg departure `"2026-12-18T05:40:00"` → `"Išvyksta prieš 07:00"`; origin `KUN` → `"Iš Vilniaus: 59 min traukiniu"`; origin `RIX` → `"Iš Vilniaus: traukinys nuo €9.60, ~4 val."`; template `newsletter_tag="winter_sun"`, destination `LCA`, travel month January with `climate.json["LCA"][0] == 16` → `"Larnaca sausį: ~16 °C dieną"` (LT month locative from a 12-entry list in `content.py`); destination not in `climate.json` → no weather line; `fare.raw` without any bag info → **no** bag line (test asserts absence); `fare=None` → no fare-derived catches.
  - `draft["body"]` for the family/date case equals `why + "\n" + " · ".join(catches)`; for a case with no catches equals `why`.
- [ ] **Step 2: Run** `uv run pytest tests/skrendam/test_content.py -q` → FAIL.
- [ ] **Step 3: Implement** in `content.py`:
  ```python
  LT_MONTHS_LOC = ["sausį", "vasarį", "kovą", "balandį", "gegužę", "birželį", "liepą", "rugpjūtį", "rugsėjį", "spalį", "lapkritį", "gruodį"]
  CARD_FROM_VILNIUS = "Iš Vilniaus: 59 min traukiniu"          # KUN
  CARD_FROM_RIGA = "Iš Vilniaus: traukinys nuo €9.60, ~4 val."  # RIX
  CARD_BAG_ONLY_HAND = "Tik rankinis bagažas — registruotas pagal tarifą"
  CARD_FAMILY_TOTAL = "Šeimai iš keturių: €{total:.0f}"
  EARLY_DEP_HOUR = 7
  _CLIMATE = json.loads(resources.files("skrendam").joinpath("climate.json").read_text("utf-8"))
  ```
  `body_lines(origin, destination, price, baseline, travel_date, template, signals, fare, window_name)`; `_stops_lt(n)`: 1 → "1 persėdimas", 2–9 → f"{n} persėdimai", ≥10 → f"{n} persėdimų". Bag line only when `fare.raw.get("bags") == "hand_only"` or an equivalent key the implementer finds in `fli` `FlightResult` — if `fli` carries no bag info, leave the constant defined, the check present, and note it in the report. Weather line when `"sun" in persona_codes(template.newsletter_tag, load_personas())` and destination in `_CLIMATE`.
  `climate.json`: `{ "LCA": [16,17,19,23,27,30,33,33,31,27,22,18], ... }` for exactly the destinations that appear in `sun` templates' `included_destinations` (read `skrendam/seeds.py`); **every number sourced from a climate table (Wikipedia "Climate data" mean daily maximum) and cited in the report** — no estimates; a destination you cannot source is omitted.
  `Window` gains `name: str = ""`; `windows_from_rows` sets `name=r.name`; orchestrator builds `window_names = {w.slug: w.name for w in demand_ctx.windows}` once (or a helper on `DemandContext`) and passes `signals=dm.signals, fare=fare, window_name=window_names.get(dm.signals.get("window_slug"))`.
- [ ] **Step 4: Orchestrator test** — extend `test_orchestrator.py` (existing e2e/persist test) to assert the persisted `ContentDraft.body` for one family match is a non-empty string starting with the why line; `E2E_*` constants must not move.
- [ ] **Step 5: Run** `uv run pytest tests/skrendam -q && uv run ruff check skrendam tests/skrendam && uv run ruff format skrendam tests/skrendam` → PASS.
- [ ] **Step 6: Commit** `feat(drafts): rules-written LT body — why it's worth it + the catches, from demand signals`.

---

### Task 4: Desk body tab and publish prefill

**Files:**
- Modify: `web/src/lib/queries.ts` (`body: contentDrafts.body` in `queueBase`), `web/src/lib/types.ts` (`copy.body: string`), `web/src/lib/mappers.ts`
- Modify: `web/src/components/CopyDrafter.tsx` (`Tab` + 'body'), `web/src/components/Composer.tsx` (pass `body` to `publishDeal`, lift body state), `web/src/app/actions.ts` (`saveContentDraft` accepts `body`)
- Test: `web/src/lib/mappers.test.ts` (body mapped, `''` when null)

**Interfaces:**
- Consumes Task 3's `content_drafts.body`.
- Produces: `CandidateView.copy.body: string`; `saveContentDraft({ …, body: string })`; `publishDeal({ …, body })` already accepts `body?: string` (actions.ts:107) — no change to publish.

- [ ] **Step 1: Failing test** — mapper: row `body: 'Kalėdų atostogos — €190…'` → `copy.body` equals it; null → `''`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** — `queueBase` selects `body: contentDrafts.body`; mapper `copy.body: r.body ?? ''`; `CopyDrafter`: `type Tab = 'headline' | 'hook' | 'news' | 'body'`, a fourth tab "Body" (icon `AlignLeft` if `Icon` has it, else `Type`), textarea `minHeight 132`, included in `saveContentDraft`; `saveContentDraft` sets/inserts `body`. `Composer.handlePublish` passes `body: c.copy.body` — but the drafter holds edited state locally: lift `body` into `Composer` via a `CopyDrafter` prop `onBodyChange` (simplest: `CopyDrafter` accepts `onChange?: (copy: CandidateView['copy']) => void` and Composer keeps `const [copy, setCopy] = useState(c.copy)`; publish uses `copy.headline/hook/body`). Update all `cand()` test fixtures for the new `copy.body`.
- [ ] **Step 4: Run** `npx tsc --noEmit && npx vitest run && npx eslint <touched>` → PASS. Manual check on the local desk (`cd web && npm run dev`, port 3000): open a candidate → Body tab shows the text → Save copy → publish sends it (`published_deals.body` filled).
- [ ] **Step 5: Commit** `feat(desk): body tab in the drafter, prefilled into publish`.

---

## Acceptance (spec WP3, adjusted)

- Desk "New today" shows ≤ 10 candidates ranked by `score_v2`, only launch-priority templates unless "all templates" is ticked; chips show archetype/personas/commodity/family saving.
- New matches from the next scan carry a draft body; the curator publishes 1–3 deals in ≤ 10 min from the drafts.
- Coverage tab shows template priority.
- Moved to WP6: issue assembly page, subscribers view.
