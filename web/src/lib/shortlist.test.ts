import { expect, test } from 'vitest';
import { shortlistIds } from './shortlist';
import type { CandidateView } from './types';

function cand(over: Partial<CandidateView>): CandidateView {
  return {
    id: 'm1', candidateId: 1, templateId: 1, matchId: 1, score: 90,
    tier: 'great', status: 'suggested', place: 'Larnaca', country: 'Cyprus',
    origin: 'VNO', from: 'VNO', to: 'LCA', price: 92, usual: 228, drop: 60,
    dates: '9–16 Jan', travelDate: '2027-01-09', legs: 'nonstop',
    airline: 'Wizz Air', template: 'Winter sun', signals: [], flags: [],
    grad: '', verifiedAt: null, copy: { headline: '', hook: '', news: '' },
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
