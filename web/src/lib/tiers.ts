export const GREAT_THRESHOLD = 80; // match_score on the 0–100 scale; tuned later via `skrendam analyze`
export type Tier = 'great' | 'maybe';
export function tierForScore(score: number): Tier {
  return score >= GREAT_THRESHOLD ? 'great' : 'maybe';
}
