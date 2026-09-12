import { eur, formatDates, vilniusDay } from './format';

export interface CheckRow { checkedAt: string; price: number | null; available: boolean }
/** Three engine states, never collapsed: `priced` (exact itinerary found),
 *  `gone` (nothing bookable), `unpriced` (fares exist, exact itinerary not
 *  matched — a real state that must never read as gone). */
export interface CheckItem { date: string; value: string; up: boolean; kind: 'priced' | 'gone' | 'unpriced' }

/** The last N daily checks as one mono line, oldest → newest (WP9 deal_price_checks).
 *  `gone` is the copy-pass value for an unavailable check (S.checkGone); the
 *  caller gates the whole line with canShowCheckLine. `up` compares against the
 *  previous PRICED check only. The date is the Vilnius calendar day. */
export function toCheckItems(rows: CheckRow[], gone: string): CheckItem[] {
  const asc = [...rows].sort((a, b) => a.checkedAt.localeCompare(b.checkedAt));
  let prev: number | null = null;
  return asc.map((r) => {
    const date = formatDates(vilniusDay(r.checkedAt), null);
    if (!r.available) return { date, value: gone, up: false, kind: 'gone' as const };
    if (r.price == null) return { date, value: '', up: false, kind: 'unpriced' as const };
    const up = prev != null && r.price > prev;
    prev = r.price;
    return { date, value: eur(r.price), up, kind: 'priced' as const };
  });
}

/** The line renders only when every check is priced, or every non-priced check is a
 *  gone one AND the copy pass has filled S.checkGone — never a bare dash or ''. */
export function canShowCheckLine(items: CheckItem[], gone: string): boolean {
  if (items.length === 0) return false;
  if (items.some((c) => c.kind === 'unpriced')) return false;
  if (items.some((c) => c.kind === 'gone') && gone === '') return false;
  return true;
}
