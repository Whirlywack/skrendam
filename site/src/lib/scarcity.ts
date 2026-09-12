/**
 * Edition scarcity — the free window (spec: docs/plans/2026-08-28-edition-scarcity-model.md).
 *
 * The site shows the newest FREE_WINDOW live deals in full (poster + 2 rows);
 * every further live deal renders locked: destination + month visible, price and
 * exact dates held for the letter. Control is automatic by rank — no desk UI.
 */
export const FREE_WINDOW = 3; // poster + 2 full rows (founder decision 2026-08-28)

/** Split a newest-first live list into the free window and the locked tail. */
export function splitFreeLocked<T>(live: T[]): { free: T[]; locked: T[] } {
  return { free: live.slice(0, FREE_WINDOW), locked: live.slice(FREE_WINDOW) };
}

/** Desktop shows four locked rows, then one „+ dar N" row (founder 2026-09-12:
 *  "seven of them is just too much"). Mobile hides the four and shows only the
 *  „+ dar N" row, which there counts every locked deal — so LiveIndex renders it
 *  for any locked count ≥ 1, even when `collapsed` is empty. */
export const LOCKED_SHOWN = 4;
export function splitLockedRows<T>(locked: T[], shown = LOCKED_SHOWN): { shown: T[]; collapsed: T[] } {
  return { shown: locked.slice(0, shown), collapsed: locked.slice(shown) };
}

/** „Nr. 08–12" for a collapsed range, „Nr. 08" when one row is collapsed. */
export function lockedRangeLabel(from: number, to: number): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return from === to ? `Nr. ${p(from)}` : `Nr. ${p(from)}–${p(to)}`;
}
