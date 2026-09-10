import type { CandidateView, ScanView, TemplateGroup } from './types';
import { city, country } from './airports';
import { airlineName } from './airlines';
import { formatDates, timeAgo } from './format';
import { gradientForZone } from './gradients';
import { toDisplayStatus } from './status';
import { tierForScore } from './tiers';
import personas from './personas.json';

type QueueRow = Awaited<ReturnType<typeof import('./queries').getQueueRows>>[number];

const ARCHETYPES = new Set(['date', 'rare', 'destination']);

function num(v: unknown): number | null {
  const n = Number(v);
  return v == null || Number.isNaN(n) ? null : n;
}

function legsFrom(snapshot: unknown): { legs: string; airline: string; stops: number } {
  const s = (snapshot ?? {}) as Record<string, unknown>;
  const stops = Number(s.stops ?? 0);
  const dur = s.duration_minutes ? `${Math.round(Number(s.duration_minutes) / 60)}h` : '';
  const legs = `${stops === 0 ? 'Direct' : `${stops} stop${stops > 1 ? 's' : ''}`}${dur ? ` · ${dur}` : ''}`;
  return { legs, airline: airlineName(String(s.airline ?? '—')), stops };
}

export function toCandidateView(r: QueueRow): CandidateView {
  const c = r.c;
  const { legs, airline, stops } = legsFrom(c.itinerarySnapshot);
  const drop = Math.round(Number(c.discountPct ?? 0));
  const signals = [
    ...(r.reason ? [r.reason] : []),
    ...(drop ? [`${drop}% below baseline`] : []),
    ...(stops === 0 ? ['Direct route'] : []),
  ];
  const flags: string[] = [];
  if (stops >= 2) flags.push('2+ stops');
  if ((c.itinerarySnapshot as { self_transfer?: boolean } | null)?.self_transfer) {
    flags.push('Self-transfer');
  }
  // Prefer the engine-written normalized score + tier; fall back for un-backfilled rows.
  const score = r.score100 != null ? Number(r.score100) : Math.round(Number(r.score) * 100);
  // web's Tier is binary (great|maybe): both engine tiers map to 'great'. Use an
  // explicit allowlist (mirrors site/quality.ts) so an unexpected stored string
  // can't force 'great' and bypass the score-derived path.
  // D6: quality_tier follows score_v2, so a NULL tier on a row that HAS a
  // score_v2 means "the demand layer scored it below great" — deriving from the
  // headline score would overrule the engine. Only legacy rows (score_v2 null)
  // fall back to the displayed score.
  const tierScore = r.scoreV2 != null ? Number(r.scoreV2) : score;
  const tier = r.qualityTier === 'rare' || r.qualityTier === 'great'
    ? ('great' as const)
    : tierForScore(tierScore);
  const sig = (r.demandSignals ?? {}) as Record<string, unknown>;
  const archetype = ARCHETYPES.has(String(r.archetype))
    ? (r.archetype as CandidateView['archetype'])
    : null;
  return {
    id: `m${r.matchId}`, candidateId: c.id, templateId: r.templateId, matchId: r.matchId,
    score,
    tier,
    status: toDisplayStatus(c.status, r.publishedId != null),
    place: city(c.destination), country: country(c.destination), origin: city(c.origin),
    from: c.origin, to: c.destination, tripType: c.tripType,
    price: Number(c.price), usual: c.baselinePrice == null ? null : Number(c.baselinePrice), drop,
    dates: formatDates(String(c.travelDate), c.returnDate ? String(c.returnDate) : null),
    travelDate: String(c.travelDate),
    legs, airline,
    template: r.templateLabel ?? r.templateName,
    signals, flags,
    grad: gradientForZone(c.zone),
    verifiedAt: c.verifiedAt ? String(c.verifiedAt) : null,
    copy: { headline: r.headline ?? '', hook: r.hook ?? '', news: r.news ?? '' },
    scoreV2: r.scoreV2 == null ? null : Number(r.scoreV2),
    archetype,
    commodityShare: num(sig.commodity_share),
    savingFamily: num(sig.saving_family),
    windowSlug: typeof sig.window_slug === 'string' ? sig.window_slug : null,
    personas: (personas as Record<string, string[]>)[r.newsletterTag ?? ''] ?? [],
    priority: r.templatePriority ?? 0,
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

type ScanRunish = {
  apiCalls?: number | null;
  routesScanned?: number | null;
  startedAt?: string | Date | null;
  candidatesFound?: number | null;
  status?: string | null;
  health?: unknown;
};

export function toScanView(run: ScanRunish | null): ScanView {
  if (!run) return { fares: '0', airports: 0, ago: '—', newToday: 0, status: 'never run', healthReasons: [] };
  const reasons = (run.health as { reasons?: unknown } | null | undefined)?.reasons;
  return {
    fares: String(run.apiCalls ?? 0), airports: run.routesScanned ?? 0,
    ago: timeAgo(run.startedAt ? String(run.startedAt) : null),
    newToday: run.candidatesFound ?? 0, status: run.status ?? 'unknown',
    healthReasons: Array.isArray(reasons) ? reasons.map(String) : [],
  };
}
