// Lithuanian formatting (V2 spec §4): VLKK month abbreviations, month-first
// genitive date order („rugs. 12–19"), „prieš X" relative time, „102 €" prices.
const MONTHS_NOM = [
  'sausis', 'vasaris', 'kovas', 'balandis', 'gegužė', 'birželis',
  'liepa', 'rugpjūtis', 'rugsėjis', 'spalis', 'lapkritis', 'gruodis',
];

/** Full nominative LT month from an ISO date — locked rows show the month, not the dates. */
export function ltMonthNom(iso: string): string {
  const m = Number(iso.split('-')[1]);
  return MONTHS_NOM[m - 1] ?? '';
}

const MONTHS = [
  'saus.', 'vas.', 'kov.', 'bal.', 'geg.', 'birž.',
  'liep.', 'rugpj.', 'rugs.', 'spal.', 'lapkr.', 'gruod.',
];
function d(iso: string) { const [, m, day] = iso.split('-'); return { day: Number(day), mon: MONTHS[Number(m) - 1] }; }

export function formatDates(travel: string, ret: string | null): string {
  const a = d(travel);
  if (!ret) return `${a.mon} ${a.day}`;
  const b = d(ret);
  // Same month: „rugs. 12–19"; cross-month: „rugs. 29 – spal. 2" (spaced en dash).
  return a.mon === b.mon ? `${a.mon} ${a.day}–${b.day}` : `${a.mon} ${a.day} – ${b.mon} ${b.day}`;
}

export function pct(v: number | null | undefined): number { return v == null ? 0 : Math.round(v * 100); }

/** Lithuanian three-form plural: 1 radinys / 2–9 radiniai / 0,10–20 radinių. */
export function ltPlural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 9 && (mod100 < 11 || mod100 > 19)) return few;
  return many;
}

/** „102 €" — symbol after, non-breaking space (LT convention). */
export function eur(v: number): string { return `${Math.round(v)} €`; }

export function timeAgo(iso: string | null): string {
  if (!iso) return '—';
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'ką tik';
  if (mins < 60) return `prieš ${mins} min.`;
  const h = Math.round(mins / 60);
  return h < 24 ? `prieš ${h} val.` : `prieš ${Math.round(h / 24)} d.`;
}

// A freshness claim older than this stops being a trust signal and becomes an
// anti-ad ("tikrinta prieš 86 d.") — past the cap we tell the truth differently.
const FRESHNESS_CAP_DAYS = 3;

/** Structured freshness — `withinCap` tells callers whether the label is a
 *  positive claim or the stale-price caveat, without string-sniffing. */
export function freshInfo(iso: string | null): { withinCap: boolean; label: string } {
  if (!iso) return { withinCap: false, label: 'Patikrinta neseniai' };
  const days = (Date.now() - new Date(iso).getTime()) / 86_400_000;
  return days <= FRESHNESS_CAP_DAYS
    ? { withinCap: true, label: `Tikrinta ${timeAgo(iso)}` }
    : { withinCap: false, label: 'Kaina galėjo pasikeisti — patikrink' };
}

export function freshnessLabel(iso: string | null): string {
  return freshInfo(iso).label;
}
