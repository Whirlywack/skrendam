import type { CandidateView } from '@/lib/types';
import { QueueRow } from './QueueRow';

export function Queue({
  candidates,
  onOpen,
}: {
  candidates: CandidateView[];
  onOpen: (id: number) => void;
}) {
  return (
    <div className="queue">
      <div className="qhead">
        <span>Score</span>
        <span>Deal</span>
        <span>Template</span>
        <span>Drop</span>
        <span>Price</span>
        <span>Status</span>
      </div>
      {candidates.map((c) => (
        <QueueRow key={c.id} c={c} onOpen={onOpen} />
      ))}
    </div>
  );
}
