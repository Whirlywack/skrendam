// Strikethrough was-prices only help on deep deals (reference-price research,
// deal-detection synthesis 2026-08-22). Single source for the web app; the site
// (site/src/lib/format-rules.ts) and the engine (skrendam/scanning/content.py)
// carry the same value with cross-references.
export const WAS_PRICE_MIN_DROP_PCT = 30;

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function d(iso: string) { const [, m, day] = iso.split('-'); return { day: Number(day), mon: MONTHS[Number(m) - 1] }; }
export function formatDates(travel: string, ret: string | null): string {
  const a = d(travel);
  if (!ret) return `${a.day} ${a.mon}`;
  const b = d(ret);
  return a.mon === b.mon ? `${a.day}–${b.day} ${a.mon}` : `${a.day} ${a.mon}–${b.day} ${b.mon}`;
}
export function pct(v: number | null | undefined): number { return v == null ? 0 : Math.round(v * 100); }
/** „102 €“ — symbol after, non-breaking space (LT convention). Same bytes as
 *  site/src/lib/format.ts so desk-rendered mail and the site agree. */
export function eur(v: number): string { return `${Math.round(v)} €`; }
// Engine timestamps are naive UTC ("2026-08-22 05:42:11.910007"); new Date() would
// read them as local time and shift every display by the TZ offset (B2 in the
// 2026-08-22 redesign plan). Normalize to ISO-8601 UTC, trimming sub-ms digits.
// Zoned strings pass through: `Z`, `+03:00`, `+0300`, and the 2-digit offset
// Postgres prints for `timestamptz` text (`2026-09-10 20:15:00+00`), which
// Date.parse rejects bare — it is widened to `+00:00` first.
export function parseEngineTs(ts: string): Date {
  let iso = ts.trim().replace(' ', 'T').replace(/(\.\d{3})\d+/, '$1');
  // An offset only counts when it follows the time of day (`:SS`, `:SS.fff`
  // or `HH:MM`), so a date's own `-DD` is never read as one.
  const offset = /(?<=:\d{2}(?:\.\d+)?)([+-]\d{2})(:?\d{2})?$/.exec(iso);
  if (offset) {
    if (!offset[2]) iso += ':00';
  } else if (!/[zZ]$/.test(iso)) {
    iso += 'Z';
  }
  return new Date(iso);
}
export function timeAgo(iso: string | null): string {
  if (!iso) return '—';
  const mins = Math.max(0, Math.round((Date.now() - parseEngineTs(iso).getTime()) / 60000));
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60); return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
}
