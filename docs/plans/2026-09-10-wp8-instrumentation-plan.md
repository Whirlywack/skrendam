# WP8 — Instrumentation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After each letter the curator sees what worked: clicks and „Užsisakiau" claims per issue broken down by archetype × pref code × origin × plan, free→paid conversion per nurture issue, and TikTok signups by video (`prefs.utm.content`). Read-only pages over `deal_events`, `issues`, `subscribers`, `published_deals`; no new tables.

**Architecture:** Two desk pages under Letters: `/letters/[id]/stats` (per-issue) and `/letters/stats` (overview: conversion per nurture issue, TikTok attribution). Aggregation is done in TypeScript over small result sets (hundreds of rows at launch) with pure, tested functions; SQL only fetches. Spec §4 WP8 says the §6 constants get re-tuned "after ~8 issues" — that is a founder review, not code.

**Tech Stack:** Next.js 16 desk (`web/`), drizzle, vitest.

**Spec:** `docs/plans/2026-09-10-demand-layer-launch-spec.md` §4 WP8, §9. Parent plan §F WP8. Facts: `deal_events(deal_id, issue_id, subscriber_id, kind ∈ click|booked_claim, source, created_at)`, `issues(kind, sent_at, deal_ids, expired_deal_ids, stats)`, `subscribers(plan, paid_since, prefs.moments/origins/utm)`, `published_deals(origin, newsletter_tag, candidate_id)`; archetype lives on `candidate_template_matches.archetype` joined via `published_deals.candidate_id` + `deal_template_id`; personas via `web/src/lib/personas.json[newsletter_tag]`.

## Global Constraints
- Branch `feat/wp8-instrumentation` from `main` after PR #41 merges; worktree `.claude/worktrees/wp8-instr`.
- Read-only feature: no writes, no migrations, no generated-schema edits, no new deps.
- Real numbers only; when a denominator is 0 show „—", never a fake 0%.
- Desk conventions (`ConfigShell`, `force-dynamic`, `(app)` auth), pure aggregation functions with vitest, Fable subagents, trailers on every commit.
- Gates: `cd web && npx tsc --noEmit && npx vitest run && npx eslint <touched>`.

---

### Task 1: Aggregation library
**Files:** Create `web/src/lib/stats.ts`, `web/src/lib/stats.test.ts`; Create `web/src/lib/stats-queries.ts`.
**Produces:**
```ts
export interface EventRow { dealId: number; issueId: number | null; subscriberId: number | null; kind: 'click'|'booked_claim'; createdAt: string }
export interface DealFacts { id: number; origin: string; newsletterTag: string | null; archetype: 'date'|'rare'|'destination'|null }
export interface SubFacts { id: number; plan: 'free'|'paid'; moments: string[]; origins: string[]; utmContent: string | null; paidSince: string | null; createdAt: string }
export type Dim = 'archetype' | 'pref' | 'origin' | 'plan';
export function breakdown(events: EventRow[], deals: Map<number, DealFacts>, subs: Map<number, SubFacts>, dim: Dim): Array<{ key: string; clicks: number; claims: number }>;
//  archetype → deal.archetype ?? 'none'; pref → every persona code of deal.newsletterTag (personas.json) — an event counts once per code; origin → deal.origin; plan → subs.get(subscriberId)?.plan ?? 'anon'
export function conversionAfter(issue: { id: number; sentAt: string | null }, nextSentAt: string | null, subs: SubFacts[]): { paidBetween: number; freeAtSend: number }
//  paidBetween = subs with paidSince in [sentAt, nextSentAt ?? now); freeAtSend = subs created before sentAt with plan free OR paidSince ≥ sentAt
export function tiktokSignups(subs: SubFacts[]): Array<{ content: string; signups: number; paid: number }>  // grouped by utmContent, sorted desc, null content → 'unknown'
```
`stats-queries.ts`: `eventsForIssue(id)`, `dealFacts(ids)` (join `candidateTemplateMatches` for archetype by `candidateId` + `dealTemplateId`), `subFacts()`, `nurtureIssuesOrdered()`.
- [x] Tests: fixtures with 3 deals (date/rare/null archetype, tags family_sun/winter_sun/null), 4 subs (paid/free/anon, moments), 6 events → exact breakdown rows per dim; conversion with one paid_since inside and one outside the window; tiktok grouping with null.
- [x] Commit `feat(desk): stats aggregation — breakdowns, conversion, tiktok attribution`.

### Task 2: Pages
**Files:** Create `web/src/app/(app)/letters/[id]/stats/page.tsx`, `web/src/app/(app)/letters/stats/page.tsx`; Modify `web/src/app/(app)/letters/page.tsx` (link „Stats" per sent issue + top link „Overview") and `letters/[id]/page.tsx` (link to stats when sent).
- Per-issue page: header (kind, sent_at, stats json), four tables (one per `Dim`) with clicks/claims columns, totals row, „—" for empty.
- Overview: table of nurture issues (sent_at, recipients from `stats.sent`, `paidBetween`, `freeAtSend`, rate = paidBetween/freeAtSend or „—"); TikTok table (content, signups, paid).
- [ ] Manual check on the dev DB (`npm run dev`): both pages render with the existing draft/sent issues; empty states sane.
- [ ] Commit `feat(desk): per-issue and overview stats pages`.

### Task 3: Docs
- PROJECT.md: WP8 pages + the founder review rule (re-tune §6 constants after ~8 issues, by hand). Commit `docs: WP8 instrumentation`.

## Acceptance (spec §4 WP8)
Per-issue breakdown by archetype × pref × origin × plan; free→paid per nurture issue; TikTok signups by video id; no writes.
