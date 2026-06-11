import { describe, it, expect } from 'vitest';
import { toCandidateView, groupByTemplate, toScanView } from './mappers';

// Minimal mock for the QueueRow shape returned by getQueueRows().
// Cast via `as unknown as QueueRow` so we don't need a full Drizzle schema import.
type QueueRow = Awaited<ReturnType<typeof import('./queries').getQueueRows>>[number];

function makeRow(overrides: Partial<{
  matchId: number;
  score: string | number;
  reason: string | null;
  templateId: number;
  templateLabel: string | null;
  templateName: string;
  headline: string | null;
  hook: string | null;
  news: string | null;
  publishedId: number | null;
  score100: number | null;
  qualityTier: string | null;
  cOverrides: Record<string, unknown>;
}>): QueueRow {
  const {
    matchId = 1,
    score = '0.92',
    reason = null,
    templateId = 10,
    templateLabel = 'Beach Deals',
    templateName = 'beach_deals',
    headline = null,
    hook = null,
    news = null,
    publishedId = null,
    score100 = null,
    qualityTier = null,
    cOverrides = {},
  } = overrides ?? {};

  const c = {
    id: 42,
    status: 'new',
    discountPct: '42',
    baselinePrice: '200',
    price: '116',
    origin: 'VNO',
    destination: 'AGP',
    travelDate: '2026-07-01',
    returnDate: '2026-07-08',
    zone: 'MEDITERRANEAN',
    verifiedAt: null,
    itinerarySnapshot: { stops: 0, duration_minutes: 120, airline: 'FR' },
    ...cOverrides,
  };

  return { matchId, score, score100, qualityTier, reason, templateId, templateLabel, templateName, headline, hook, news, publishedId, c } as unknown as QueueRow;
}

describe('toCandidateView', () => {
  it('normal row — scale, score, status, and signals are correct', () => {
    const row = makeRow({ score: '0.92' });
    const v = toCandidateView(row);

    // Guards the scale-bug regression: drop must be 42, NOT 4200
    expect(v.drop).toBe(42);

    // Score should be 92 (0-100 range)
    expect(v.score).toBe(92);

    // status 'new' with no publishedId → 'suggested'
    expect(v.status).toBe('suggested');

    // signals should include the "% below baseline" entry
    expect(v.signals.some((s) => s.includes('% below baseline'))).toBe(true);
    expect(v.signals.some((s) => s.includes('42%'))).toBe(true);
  });

  it('null itinerarySnapshot — no crash; airline is "—"; no Self-transfer flag', () => {
    const row = makeRow({ cOverrides: { itinerarySnapshot: null } });
    expect(() => toCandidateView(row)).not.toThrow();

    const v = toCandidateView(row);
    expect(v.airline).toBe('—');
    expect(v.flags).not.toContain('Self-transfer');
  });

  it('stops >= 2 — flags includes "2+ stops"; signals does NOT include "Direct route"', () => {
    const row = makeRow({
      cOverrides: { itinerarySnapshot: { stops: 2, duration_minutes: 300, airline: 'W6' } },
    });
    const v = toCandidateView(row);

    expect(v.flags).toContain('2+ stops');
    expect(v.signals).not.toContain('Direct route');
  });

  it('published row (publishedId set) — status is "published"', () => {
    const row = makeRow({ publishedId: 99, cOverrides: { status: 'approved' } });
    const v = toCandidateView(row);
    expect(v.status).toBe('published');
  });

  it('publishedId set overrides status regardless of engineStatus', () => {
    const row = makeRow({ publishedId: 7, cOverrides: { status: 'new' } });
    expect(toCandidateView(row).status).toBe('published');
  });

  it('score 0.92 → tier "great"', () => {
    const row = makeRow({ score: '0.92' });
    expect(toCandidateView(row).tier).toBe('great');
  });

  it('score 0.60 → tier "maybe"', () => {
    const row = makeRow({ score: '0.60' });
    expect(toCandidateView(row).tier).toBe('maybe');
  });

  it('prefers engine score_0_100 over round(score*100)', () => {
    // raw score 0.50 would map to 50, but the engine wrote 91 → use 91.
    const row = makeRow({ score: '0.50', score100: 91 });
    expect(toCandidateView(row).score).toBe(91);
  });

  it('engine quality_tier "rare" maps to web tier "great"', () => {
    const row = makeRow({ score: '0.50', score100: 95, qualityTier: 'rare' });
    expect(toCandidateView(row).tier).toBe('great');
  });

  it('null quality_tier with a stored score derives "maybe"', () => {
    const row = makeRow({ score: '0.50', score100: 70, qualityTier: null });
    expect(toCandidateView(row).tier).toBe('maybe');
  });
});

describe('toScanView health', () => {
  it('exposes degraded status and reasons', () => {
    const v = toScanView({
      status: 'degraded',
      health: { reasons: ['6/6 calendar searches returned no data'] },
    });
    expect(v.status).toBe('degraded');
    expect(v.healthReasons).toEqual(['6/6 calendar searches returned no data']);
  });

  it('defaults healthReasons to empty', () => {
    expect(toScanView(null).healthReasons).toEqual([]);
    expect(toScanView({ status: 'completed' }).healthReasons).toEqual([]);
  });

  it('ignores malformed health payloads', () => {
    expect(toScanView({ status: 'degraded', health: { reasons: 'nope' } }).healthReasons).toEqual([]);
    expect(toScanView({ status: 'degraded', health: 42 }).healthReasons).toEqual([]);
  });
});

describe('groupByTemplate', () => {
  it('two rows with the same templateId produce one group with 2 items', () => {
    const rows = [
      makeRow({ matchId: 1, templateId: 10 }),
      makeRow({ matchId: 2, templateId: 10, cOverrides: { id: 43 } }),
    ];
    const groups = groupByTemplate(rows);
    expect(groups).toHaveLength(1);
    expect(groups[0].templateId).toBe(10);
    expect(groups[0].items).toHaveLength(2);
  });

  it('rows with different templateIds produce separate groups', () => {
    const rows = [
      makeRow({ matchId: 1, templateId: 10 }),
      makeRow({ matchId: 2, templateId: 20, cOverrides: { id: 43 } }),
    ];
    const groups = groupByTemplate(rows);
    expect(groups).toHaveLength(2);
    const ids = groups.map((g) => g.templateId).sort();
    expect(ids).toEqual([10, 20]);
  });
});
