import type { CandidateView } from './types';

// "New today" opens as the day's ten — the top N candidates by demand score —
// so a 700-deep queue reads as a morning's work, not a wall (spec §6).
export const TODAY_N = 10;

// Templates below this priority are reserve inventory: they stay out of the
// default view until the curator asks for "all templates".
export const LAUNCH_PRIORITY = 100;

/** Ranking score: the engine's demand score, falling back to the legacy score on old rows. */
export function rankScore(c: CandidateView): number {
  return c.scoreV2 ?? c.score;
}

/**
 * Candidate ids of the top `limit` fresh candidates by `rankScore`.
 *
 * A candidate matching several templates appears as several rows; membership
 * is decided by its best row, and one slot is one candidate, not one row.
 * Rows on templates below `priorityFloor` don't compete at all (pass `null`
 * to let every template in).
 */
export function shortlistIds(
  rows: CandidateView[],
  limit = TODAY_N,
  priorityFloor: number | null = LAUNCH_PRIORITY,
): Set<number> {
  const best = new Map<number, number>();
  for (const c of rows) {
    if (c.status !== 'suggested') continue;
    if (priorityFloor != null && c.priority < priorityFloor) continue;
    best.set(c.candidateId, Math.max(best.get(c.candidateId) ?? -Infinity, rankScore(c)));
  }
  return new Set(
    [...best.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([id]) => id),
  );
}
