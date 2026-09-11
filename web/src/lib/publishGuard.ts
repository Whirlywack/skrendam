// Publish guard — one rule for the Composer, the Live board and the server
// actions: a dead fare must never go live. /candidates/1 was `Expired` with
// "Approve & publish" enabled, and /published offered Republish on a deal whose
// departure had passed (desk journey review 2026-09-11, blocker 3). The client
// checks are UX; `publishDeal` / `republishDeal` apply the same rule as the guard.

export type PublishBlock = 'expired' | 'travel_past';

export const PUBLISH_BLOCK_TEXT: Record<PublishBlock, string> = {
  expired: 'Expired — cannot publish',
  travel_past: 'Travel date has passed — cannot publish',
};

export const REPUBLISH_BLOCK_TEXT: Record<PublishBlock, string> = {
  expired: 'Expired — cannot republish',
  travel_past: 'Travel date has passed — cannot republish',
};

/** The local calendar date as `YYYY-MM-DD` — travel dates are calendar dates
 *  and the desk (and its server actions) run on the founder's laptop. */
export function localToday(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Why a candidate cannot be published today, or null. `status` accepts the
 *  engine status ('expired') and the display status (also 'expired'). A
 *  missing travel date never blocks: dateless deals stay curator-managed. */
export function publishBlock(
  c: { status: string | null | undefined; travelDate: string | null | undefined },
  today: string,
): PublishBlock | null {
  if (c.status === 'expired') return 'expired';
  if (c.travelDate && c.travelDate < today) return 'travel_past';
  return null;
}

export function canPublish(
  c: { status: string | null | undefined; travelDate: string | null | undefined },
  today: string,
): boolean {
  return publishBlock(c, today) === null;
}

/** Republish is offered on non-live deals, so `expired` is the normal state
 *  here — only a departure date already behind us blocks. */
export function republishBlock(
  d: { travelDate: string | null | undefined },
  today: string,
): PublishBlock | null {
  return publishBlock({ status: null, travelDate: d.travelDate }, today);
}
