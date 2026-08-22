import type { CandidateView } from '@/lib/types';
import { QueueRow } from './QueueRow';

export function Queue({
  candidates,
  alsoMatches,
  onOpen,
}: {
  candidates: CandidateView[];
  alsoMatches: Map<number, string[]>;
  onOpen: (id: number) => void;
}) {
  return (
    <div className="queue">
      {candidates.map((c) => (
        <QueueRow
          key={c.id}
          c={c}
          also={(alsoMatches.get(c.candidateId) ?? []).filter((t) => t !== c.template)}
          onOpen={onOpen}
        />
      ))}
    </div>
  );
}
