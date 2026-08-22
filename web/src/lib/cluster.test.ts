import { expect, test } from 'vitest';
import { clusterByRoute } from './cluster';
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

test('adjacent-date clones collapse into one cluster', () => {
  const clusters = clusterByRoute([
    cand({ id: 'a', price: 92, travelDate: '2027-01-09' }),
    cand({ id: 'b', price: 95, travelDate: '2027-01-16' }),
    cand({ id: 'c', price: 98, travelDate: '2027-01-23' }),
  ]);
  expect(clusters).toHaveLength(1);
  expect(clusters[0].rest).toHaveLength(2);
});

test('different routes never merge', () => {
  const clusters = clusterByRoute([cand({ id: 'a', to: 'LCA' }), cand({ id: 'b', to: 'AGP' })]);
  expect(clusters).toHaveLength(2);
});

test('price bands beyond 15 percent split into separate clusters', () => {
  const clusters = clusterByRoute([cand({ id: 'a', price: 92 }), cand({ id: 'b', price: 150 })]);
  expect(clusters).toHaveLength(2);
});
