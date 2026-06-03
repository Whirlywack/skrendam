import type { CandidateView, ScanView, TemplateGroup } from './types';
import { city, country } from './airports';
import { formatDates, pct, timeAgo } from './format';
import { gradientForZone } from './gradients';
import { toDisplayStatus } from './status';

type QueueRow = Awaited<ReturnType<typeof import('./queries').getQueueRows>>[number];

function legsFrom(snapshot: unknown): { legs: string; airline: string; stops: number } {
  const s = (snapshot ?? {}) as Record<string, unknown>;
  const stops = Number(s.stops ?? 0);
  const dur = s.duration_minutes ? `${Math.round(Number(s.duration_minutes) / 60)}h` : '';
  const legs = `${stops === 0 ? 'Direct' : `${stops} stop${stops > 1 ? 's' : ''}`}${dur ? ` · ${dur}` : ''}`;
  return { legs, airline: String(s.airline ?? '—'), stops };
}

export function toCandidateView(r: QueueRow): CandidateView {
  const c = r.c;
  const { legs, airline, stops } = legsFrom(c.itinerarySnapshot);
  const drop = pct(c.discountPct);
  const signals = [
    ...(r.reason ? [r.reason] : []),
    ...(drop ? [`${drop}% below baseline`] : []),
    ...(stops === 0 ? ['Direct route'] : []),
  ];
  const flags: string[] = [];
  if (stops >= 2) flags.push('2+ stops');
  if ((c.itinerarySnapshot as any)?.self_transfer) flags.push('Self-transfer');
  return {
    id: `m${r.matchId}`, candidateId: c.id, templateId: r.templateId, matchId: r.matchId,
    score: Math.round(Number(r.score) * 100),
    status: toDisplayStatus(c.status, r.publishedId != null),
    place: city(c.destination), country: country(c.destination), origin: city(c.origin),
    from: c.origin, to: c.destination,
    price: Number(c.price), usual: c.baselinePrice == null ? null : Number(c.baselinePrice), drop,
    dates: formatDates(String(c.travelDate), c.returnDate ? String(c.returnDate) : null),
    legs, airline,
    template: r.templateLabel ?? r.templateName,
    signals, flags,
    grad: gradientForZone(c.zone),
    verifiedAt: c.verifiedAt ? String(c.verifiedAt) : null,
    copy: { headline: r.headline ?? '', hook: r.hook ?? '', news: r.news ?? '' },
  };
}

export function groupByTemplate(rows: QueueRow[]): TemplateGroup[] {
  const map = new Map<number, TemplateGroup>();
  for (const r of rows) {
    const v = toCandidateView(r);
    const g = map.get(r.templateId) ?? { templateId: r.templateId, templateLabel: v.template, items: [] };
    g.items.push(v); map.set(r.templateId, g);
  }
  return [...map.values()];
}

export function toScanView(run: any | null): ScanView {
  if (!run) return { fares: '0', airports: 0, ago: '—', newToday: 0, status: 'never run' };
  return {
    fares: String(run.apiCalls ?? 0), airports: run.routesScanned ?? 0,
    ago: timeAgo(run.startedAt ? String(run.startedAt) : null),
    newToday: run.candidatesFound ?? 0, status: run.status ?? 'unknown',
  };
}
