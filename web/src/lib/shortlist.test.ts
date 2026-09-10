import { expect, test } from 'vitest';
import { LAUNCH_PRIORITY, TODAY_N, rankScore, shortlistIds } from './shortlist';
import type { CandidateView } from './types';

function cand(over: Partial<CandidateView>): CandidateView {
  return {
    id: 'm1', candidateId: 1, templateId: 1, matchId: 1, score: 90,
    tier: 'great', status: 'suggested', place: 'Larnaca', country: 'Cyprus',
    origin: 'VNO', from: 'VNO', to: 'LCA', price: 92, usual: 228, drop: 60,
    dates: '9–16 Jan', travelDate: '2027-01-09', legs: 'nonstop',
    airline: 'Wizz Air', template: 'Winter sun', signals: [], flags: [],
    grad: '', verifiedAt: null, copy: { headline: '', hook: '', news: '' },
    scoreV2: null, archetype: null, commodityShare: null, savingFamily: null,
    windowSlug: null, personas: [], priority: LAUNCH_PRIORITY,
    ...over,
  } as CandidateView;
}

test('keeps the top N distinct candidates by score', () => {
  const rows = [1, 2, 3, 4].map((n) => cand({ candidateId: n, score: 100 - n }));
  expect(shortlistIds(rows, 2)).toEqual(new Set([1, 2]));
});

test('one candidate on several templates takes one slot, ranked by its best row', () => {
  const ids = shortlistIds(
    [
      cand({ candidateId: 1, templateId: 1, score: 70 }),
      cand({ candidateId: 1, templateId: 2, score: 95 }),
      cand({ candidateId: 2, score: 90 }),
      cand({ candidateId: 3, score: 80 }),
    ],
    2,
  );
  expect(ids).toEqual(new Set([1, 2]));
});

test('only fresh (suggested) candidates compete', () => {
  const ids = shortlistIds(
    [
      cand({ candidateId: 1, score: 99, status: 'review' }),
      cand({ candidateId: 2, score: 50 }),
    ],
    1,
  );
  expect(ids).toEqual(new Set([2]));
});

test('rankScore prefers scoreV2 over the legacy score', () => {
  const legacyHigh = cand({ candidateId: 1, score: 95, scoreV2: 40 });
  const v2High = cand({ candidateId: 2, score: 70, scoreV2: 80 });
  expect(rankScore(v2High)).toBeGreaterThan(rankScore(legacyHigh));
  expect(rankScore(cand({ score: 55, scoreV2: null }))).toBe(55);
  expect(shortlistIds([legacyHigh, v2High], 1)).toEqual(new Set([2]));
});

test('default limit is ten', () => {
  expect(TODAY_N).toBe(10);
  const rows = Array.from({ length: 11 }, (_, i) => cand({ candidateId: i + 1, score: 100 - i }));
  expect(shortlistIds(rows).size).toBe(10);
});

test('priority floor drops low-priority templates unless disabled', () => {
  const rows = [
    cand({ candidateId: 1, score: 99, priority: 50 }),
    cand({ candidateId: 2, score: 60, priority: 100 }),
  ];
  expect(shortlistIds(rows, 1, 100)).toEqual(new Set([2]));
  expect(shortlistIds(rows, 1, null)).toEqual(new Set([1]));
});

test('a candidate on two templates competes only with its launch-priority row', () => {
  const ids = shortlistIds(
    [
      cand({ candidateId: 1, templateId: 1, score: 95, priority: 50 }),
      cand({ candidateId: 1, templateId: 2, score: 60, priority: 100 }),
      cand({ candidateId: 2, score: 70, priority: 100 }),
    ],
    1,
    100,
  );
  expect(ids).toEqual(new Set([2]));
});
