const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function d(iso: string) { const [, m, day] = iso.split('-'); return { day: Number(day), mon: MONTHS[Number(m) - 1] }; }
export function formatDates(travel: string, ret: string | null): string {
  const a = d(travel);
  if (!ret) return `${a.day} ${a.mon}`;
  const b = d(ret);
  return a.mon === b.mon ? `${a.day}–${b.day} ${a.mon}` : `${a.day} ${a.mon}–${b.day} ${b.mon}`;
}
export function pct(v: number | null | undefined): number { return v == null ? 0 : Math.round(v * 100); }
export function timeAgo(iso: string | null): string {
  if (!iso) return '—';
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60); return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
}

// A freshness claim older than this stops being a trust signal and becomes an
// anti-ad ("Checked 86d ago") — past the cap we tell the truth differently.
const FRESHNESS_CAP_DAYS = 3;

export function freshnessLabel(iso: string | null): string {
  if (!iso) return 'Checked recently';
  const days = (Date.now() - new Date(iso).getTime()) / 86_400_000;
  return days <= FRESHNESS_CAP_DAYS
    ? `Checked ${timeAgo(iso)}`
    : 'Price may have moved — check live';
}
