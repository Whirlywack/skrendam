const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function d(iso: string) { const [, m, day] = iso.split('-'); return { day: Number(day), mon: MONTHS[Number(m) - 1] }; }
export function formatDates(travel: string, ret: string | null): string {
  const a = d(travel);
  if (!ret) return `${a.day} ${a.mon}`;
  const b = d(ret);
  return a.mon === b.mon ? `${a.day}–${b.day} ${a.mon}` : `${a.day} ${a.mon}–${b.day} ${b.mon}`;
}
export function pct(v: number | null | undefined): number { return v == null ? 0 : Math.round(v * 100); }
// Engine timestamps are naive UTC ("2026-08-22 05:42:11.910007"); new Date() would
// read them as local time and shift every display by the TZ offset (B2 in the
// 2026-08-22 redesign plan). Normalize to ISO-8601 UTC, trimming sub-ms digits.
export function parseEngineTs(ts: string): Date {
  const trimmed = ts.trim();
  const hasTz = /(?:[zZ]|[+-]\d{2}:?\d{2})$/.test(trimmed);
  const iso = trimmed.replace(' ', 'T').replace(/(\.\d{3})\d+/, '$1');
  return new Date(hasTz ? iso : iso + 'Z');
}
export function timeAgo(iso: string | null): string {
  if (!iso) return '—';
  const mins = Math.max(0, Math.round((Date.now() - parseEngineTs(iso).getTime()) / 60000));
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60); return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
}
