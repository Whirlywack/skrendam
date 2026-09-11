// Pure helpers for the live-deal verification state (WP9, migration 0015).
// The scan writes `status` ('live' | 'changed' | 'expired'), `current_price*`,
// `window_min_*`, `verified_at` and `missed_checks`; the desk only reads them.
// Everything here is pure so Today, the Live board and the sidebar agree.

import { parseEngineTs } from './format';
import { LIVE_STATUSES } from './statuses';

/** `live` and `changed` are both on the site — the shared visible set. */
export function isLiveStatus(status: string): boolean {
  return (LIVE_STATUSES as readonly string[]).includes(status);
}

/** The three verification states the board names; anything else (a
 *  `draft`, an unknown value) is shown as-is under `other`. */
export type DealState = 'live' | 'changed' | 'expired' | 'other';

export function dealState(status: string): DealState {
  return status === 'live' || status === 'changed' || status === 'expired' ? status : 'other';
}

/** Curator-facing label per state. `changed` is the only one that needs a
 *  gloss: the fare is still there, above the published price. */
export const STATE_LABEL: Record<DealState, string> = {
  live: 'live',
  changed: 'changed',
  expired: 'expired',
  other: '',
};

/** Whole-percent drift of the current price against the published one:
 *  `+33` for 93 → 124, `-5` for a cheaper re-check, null without a current
 *  price or a zero published price. */
export function priceDriftPct(published: number, current: number | null): number | null {
  if (current == null || !(published > 0)) return null;
  return Math.round(((current - published) / published) * 100);
}

/** A deal whose last REAL answer (`verified_at`) is older than this many days
 *  gets the manual Recheck button on Today. Deals the scan has never verified
 *  fall back to `last_seen_at`, then `published_at` — a deal published an
 *  hour ago is not an emergency, one published a week ago and never checked is. */
export const RECHECK_AFTER_DAYS = 2;

/** The window Today's „since yesterday" summary looks back over. */
export const SUMMARY_WINDOW_HOURS = 24;

interface VerifiedSlice {
  status: string;
  verifiedAt: string | null;
  lastSeenAt: string | null;
  publishedAt: string;
}

export function needsRecheck(deal: VerifiedSlice, now: Date): boolean {
  if (!isLiveStatus(deal.status)) return false;
  const last = deal.verifiedAt ?? deal.lastSeenAt ?? deal.publishedAt;
  return now.getTime() - parseEngineTs(last).getTime() > RECHECK_AFTER_DAYS * 86_400_000;
}

export interface VerificationSummary {
  /** Deals currently in `changed` (still on the site, above published price). */
  changed: number;
  /** Deals whose `expired_at` falls inside the last `SUMMARY_WINDOW_HOURS`. */
  expired: number;
}

interface SummarySlice {
  status: string;
  expiredAt: string | null;
}

export function verificationSummary(deals: SummarySlice[], now: Date): VerificationSummary {
  const cutoff = now.getTime() - SUMMARY_WINDOW_HOURS * 3_600_000;
  let changed = 0;
  let expired = 0;
  for (const d of deals) {
    if (d.status === 'changed') changed += 1;
    if (d.status === 'expired' && d.expiredAt != null) {
      const at = parseEngineTs(d.expiredAt).getTime();
      if (at > cutoff && at <= now.getTime()) expired += 1;
    }
  }
  return { changed, expired };
}

/** „2 changed · 1 expired since yesterday" — one line, real counts only. */
export function verificationSummaryLine(s: VerificationSummary): string {
  return `${s.changed} changed · ${s.expired} expired since yesterday`;
}

/** Sidebar badge next to Live: deals the curator should look at — every
 *  `changed` deal plus every live one due a manual recheck (a deal counts
 *  once even when both apply). */
export function attentionCount(deals: (VerifiedSlice & SummarySlice)[], now: Date): number {
  return deals.filter((d) => d.status === 'changed' || needsRecheck(d, now)).length;
}
