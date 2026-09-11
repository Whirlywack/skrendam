import type { CandidateView, ScanView, TemplateGroup } from './types';
import { city, country } from './airports';
import { airlineName } from './airlines';
import { formatClock, formatDates, parseEngineTs, timeAgo } from './format';
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
    copy: { headline: r.headline ?? '', hook: r.hook ?? '', news: r.news ?? '', body: r.body ?? '' },
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

// A run still "running" this long after it started never finished (laptop
// slept, process died). Mirrors ORPHAN_RUN_AFTER in skrendam/scanning/
// orchestrator.py, which reconciles such rows to "failed" on the next run; until
// then the desk must not report them as in progress.
export const SCAN_ORPHAN_AFTER_MS = 6 * 60 * 60 * 1000;

/** Local HH:MM a scan has been running since — only for a run that started
 *  after the latest finished one and within the orphan cutoff. */
export function runningSince(
  finished: ScanRunish | null,
  running: ScanRunish | null,
  now: Date = new Date(),
): string | null {
  if (!running?.startedAt) return null;
  const started = parseEngineTs(String(running.startedAt));
  if (finished?.startedAt && started.getTime() <= parseEngineTs(String(finished.startedAt)).getTime()) return null;
  if (now.getTime() - started.getTime() > SCAN_ORPHAN_AFTER_MS) return null;
  return formatClock(started);
}

/** Counts, age and health come from the latest FINISHED run; `running` only
 *  adds the "running since" clause. Reading the newest row regardless of
 *  status made every orphaned run a phantom "running.. checked 0 fares"
 *  scan (desk journey review 2026-09-11, blocker 1). */
export function toScanView(
  finished: ScanRunish | null,
  running: ScanRunish | null = null,
  now: Date = new Date(),
): ScanView {
  const since = runningSince(finished, running, now);
  if (!finished) {
    return { fares: '0', airports: 0, ago: '—', newToday: 0, status: 'never run', healthReasons: [], runningSince: since };
  }
  const reasons = (finished.health as { reasons?: unknown } | null | undefined)?.reasons;
  return {
    fares: String(finished.apiCalls ?? 0), airports: finished.routesScanned ?? 0,
    ago: timeAgo(finished.startedAt ? String(finished.startedAt) : null),
    newToday: finished.candidatesFound ?? 0, status: finished.status ?? 'unknown',
    healthReasons: Array.isArray(reasons) ? reasons.map(String) : [],
    runningSince: since,
  };
}
