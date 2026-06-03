import type { CandidateView } from '@/lib/types';

export function ScoreBadge({ score }: { score: CandidateView['score'] }) {
  const cls = score >= 80 ? 'hi' : score >= 60 ? 'mid' : 'lo';
  return (
    <div className={`score ${cls}`}>
      {score}<small>SCORE</small>
    </div>
  );
}
