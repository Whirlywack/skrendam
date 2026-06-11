import type { CandidateView } from '@/lib/types';
import { GREAT_THRESHOLD } from '@/lib/tiers';

export function ScoreBadge({ score }: { score: CandidateView['score'] }) {
  // 'hi' aligns with the GREAT tier; 'mid' is the band below it — no more 80-vs-88 drift.
  const cls = score >= GREAT_THRESHOLD ? 'hi' : score >= GREAT_THRESHOLD - 28 ? 'mid' : 'lo';
  return (
    <div className={`score ${cls}`}>
      {score}<small>SCORE</small>
    </div>
  );
}
