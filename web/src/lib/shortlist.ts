import type { CandidateView } from './types';

// "New today" opens as the day's shortlist — the top N candidates by score —
// so a 700-deep queue reads as a morning's work, not a wall (handoff 08-27).
export const SHORTLIST = 20;

/**
 * Candidate ids of the top `limit` fresh candidates by score.
 *
 * A candidate matching several templates appears as several rows; membership
 * is decided by its best score, and one slot is one candidate, not one row.
 */
export function shortlistIds(rows: CandidateView[], limit = SHORTLIST): Set<number> {
  const best = new Map<number, number>();
  for (const c of rows) {
    if (c.status !== 'suggested') continue;
    best.set(c.candidateId, Math.max(best.get(c.candidateId) ?? -Infinity, c.score));
  }
  return new Set(
    [...best.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([id]) => id),
  );
}
