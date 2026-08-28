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
