# Handoff — 2026-09-12 session close (for a fresh context window)

You are picking up Yip/Skrendam with no memory of the last three days. Read in this order, then act.

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

## 4. Open items — engineering (do when asked, in this order of value)
1. **Site redo** — the next big block, now unblocked (backend done). Inputs: the deep-research results +
   `docs/research/2026-09-11-site-sitemap-seo-architecture.md` (page inventory, interlinking model, conversion
   architecture, GEO angles). Hard rule: mockups with real data and founder sign-off before any design build
   (`skrendam-mockup-signoff-rule`). Copy is the founder's; the keyword sample is not a rule.
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
3. Ask the founder which of §4 to start, or whether the deep-research results are in for the site redo.
