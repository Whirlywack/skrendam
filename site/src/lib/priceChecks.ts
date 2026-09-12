import { eur, formatDates } from './format';

export interface CheckRow { checkedAt: string; price: number | null; available: boolean }
export interface CheckItem { date: string; value: string; up: boolean }

/** The last N daily checks as one mono line, oldest → newest (WP9 deal_price_checks).
 *  `gone` is the copy-pass value for an unavailable check (S.checkGone); the
 *  caller hides the whole line when that key is empty and any row is gone. */
export function toCheckItems(rows: CheckRow[], gone: string): CheckItem[] {
  const asc = [...rows].sort((a, b) => a.checkedAt.localeCompare(b.checkedAt));
  let prev: number | null = null;
  return asc.map((r) => {
    const ok = r.available && r.price != null;
    const up = ok && prev != null && (r.price as number) > prev;
    if (ok) prev = r.price as number;
    return { date: formatDates(r.checkedAt.slice(0, 10), null), value: ok ? eur(r.price as number) : gone, up };
  });
}
