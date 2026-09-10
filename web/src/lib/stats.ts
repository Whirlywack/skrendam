import personas from './personas.json';

/** WP8 aggregation — pure functions over the rows `stats-queries.ts` fetches.
 *  Everything here runs over small sets (hundreds of rows at launch), so the
 *  arithmetic stays in TypeScript where it can be unit-tested; SQL only
 *  fetches. No rounding, no rates: the page decides how to show a ratio and
 *  prints „—" when the denominator is 0. */

const PERSONAS = personas as Record<string, string[]>;

export interface EventRow {
  dealId: number;
  issueId: number | null;
  subscriberId: number | null;
  kind: 'click' | 'booked_claim';
  createdAt: string;
}

export interface DealFacts {
  id: number;
  origin: string;
  newsletterTag: string | null;
  archetype: 'date' | 'rare' | 'destination' | null;
}

export interface SubFacts {
  id: number;
  plan: 'free' | 'paid';
  moments: string[];
  origins: string[];
  /** `prefs.utm.content` — the TikTok video id the signup came from. */
  utmContent: string | null;
  paidSince: string | null;
  createdAt: string;
}

export type Dim = 'archetype' | 'pref' | 'origin' | 'plan';

export interface BreakdownRow {
  key: string;
  clicks: number;
  claims: number;
}

/** Bucket label for an event that cannot be attributed on a deal dimension:
 *  the deal's archetype / tag is NULL, the tag has no persona codes, or the
 *  deal id is not in `deals` at all (the FK makes the last one near
 *  impossible, but a stats page must never throw on it). One label, on
 *  purpose — the curator reads „none" as "no attributable value", and the
 *  events still land in the totals row. */
export const NONE = 'none';

/** Plan bucket for events without a subscriber: anonymous clicks (a forwarded
 *  mail, a link without `s=`) and rows whose subscriber was deleted
 *  (`ON DELETE SET NULL`) or is missing from `subs`. */
export const ANON = 'anon';

/** Per-issue table for one dimension. An event contributes 1 to `clicks` or
 *  `claims` under each key it maps to — one key per event for every dim
 *  except `pref`, where a deal tag with several persona codes counts once
 *  per code (so `pref` rows do not sum to the event count). Rows sorted by
 *  clicks desc, claims desc, key asc. */
export function breakdown(
  events: EventRow[],
  deals: Map<number, DealFacts>,
  subs: Map<number, SubFacts>,
  dim: Dim,
): BreakdownRow[] {
  const rows = new Map<string, BreakdownRow>();
  for (const e of events) {
    for (const key of keysOf(e, deals, subs, dim)) {
      const row = rows.get(key) ?? { key, clicks: 0, claims: 0 };
      if (e.kind === 'click') row.clicks += 1;
      else row.claims += 1;
      rows.set(key, row);
    }
  }
  return [...rows.values()].sort(
    (a, b) => b.clicks - a.clicks || b.claims - a.claims || a.key.localeCompare(b.key),
  );
}

function keysOf(
  e: EventRow,
  deals: Map<number, DealFacts>,
  subs: Map<number, SubFacts>,
  dim: Dim,
): string[] {
  if (dim === 'plan') {
    const sub = e.subscriberId == null ? undefined : subs.get(e.subscriberId);
    return [sub?.plan ?? ANON];
  }
  const deal = deals.get(e.dealId);
  if (!deal) return [NONE];
  switch (dim) {
    case 'archetype':
      return [deal.archetype ?? NONE];
    case 'origin':
      return [deal.origin];
    case 'pref': {
      const codes = deal.newsletterTag == null ? [] : (PERSONAS[deal.newsletterTag] ?? []);
      return codes.length === 0 ? [NONE] : [...new Set(codes)];
    }
  }
}

export interface Conversion {
  /** Subscribers whose `paid_since` falls in [sentAt, nextSentAt ?? now). */
  paidBetween: number;
  /** Subscribers who existed at send time and were on the free plan then:
   *  created before `sentAt` and either still free or paid at/after it. */
  freeAtSend: number;
}

/** Free→paid conversion attributed to one nurture issue: who was free when
 *  it went out, and how many of *all* subscribers paid before the next
 *  issue. An unsent issue has no window — both counts are 0 and the page
 *  prints „—". `now` is injectable for tests. */
export function conversionAfter(
  issue: { id: number; sentAt: string | null },
  nextSentAt: string | null,
  subs: SubFacts[],
  now: string = new Date().toISOString(),
): Conversion {
  if (issue.sentAt == null) return { paidBetween: 0, freeAtSend: 0 };
  const start = tsMs(issue.sentAt);
  const end = tsMs(nextSentAt ?? now);
  let paidBetween = 0;
  let freeAtSend = 0;
  for (const s of subs) {
    const paid = s.paidSince == null ? null : tsMs(s.paidSince);
    if (paid != null && paid >= start && paid < end) paidBetween += 1;
    const existed = tsMs(s.createdAt) < start;
    const wasFree = s.plan === 'free' || (paid != null && paid >= start);
    if (existed && wasFree) freeAtSend += 1;
  }
  return { paidBetween, freeAtSend };
}

export interface TiktokRow {
  content: string;
  signups: number;
  paid: number;
}

/** Signups per TikTok video (`prefs.utm.content`), every subscriber row
 *  counted (confirmed or not — the number is "who arrived from this video").
 *  Rows without a content id group under `unknown`. Sorted by signups desc,
 *  paid desc, content asc. */
export function tiktokSignups(subs: SubFacts[]): TiktokRow[] {
  const rows = new Map<string, TiktokRow>();
  for (const s of subs) {
    const content = s.utmContent ?? 'unknown';
    const row = rows.get(content) ?? { content, signups: 0, paid: 0 };
    row.signups += 1;
    if (s.plan === 'paid') row.paid += 1;
    rows.set(content, row);
  }
  return [...rows.values()].sort(
    (a, b) => b.signups - a.signups || b.paid - a.paid || a.content.localeCompare(b.content),
  );
}

/** Epoch ms of a Postgres text timestamp as drizzle's `mode: 'string'` hands
 *  it over. Two shapes reach us: naive UTC from `timestamp` columns
 *  (`"2026-09-10 12:00:00.123456"`) and `timestamptz` text with a 2-digit
 *  offset (`"2026-09-10 12:00:00+00"`). `format.ts#parseEngineTs` only
 *  recognises 4-digit offsets and turns the second shape into an Invalid
 *  Date, so this one normalises both to ISO-8601 first: space → `T`,
 *  fractional seconds trimmed to ms, `+HH` → `+HH:00`, no offset → `Z`. */
export function tsMs(ts: string): number {
  let iso = ts.trim().replace(' ', 'T').replace(/(\.\d{3})\d+/, '$1');
  const m = /([+-]\d{2})(:?\d{2})?$/.exec(iso);
  if (m) {
    if (!m[2]) iso += ':00';
  } else if (!/[zZ]$/.test(iso)) {
    iso += 'Z';
  }
  return new Date(iso).getTime();
}
