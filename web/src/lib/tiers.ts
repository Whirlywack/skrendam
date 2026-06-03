// match_score on the 0–100 scale. Tuned 2026-06-03 from `skrendam analyze` (246 real
// matches): at 80, 76% of matches were "great"; 88 makes "great" the top ~36% (the
// median match scores 0.85, which correctly lands in "maybe"). Keep in sync with the
// engine's analyze default (skrendam/analyze.py). See docs/research/2026-06-03-tuning-analysis.md.
export const GREAT_THRESHOLD = 88;
export type Tier = 'great' | 'maybe';
export function tierForScore(score: number): Tier {
  return score >= GREAT_THRESHOLD ? 'great' : 'maybe';
}
