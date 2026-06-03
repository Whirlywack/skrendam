import type { CandidateView } from '@/lib/types';
import { ScoreBadge } from './ScoreBadge';
import { StatusPill } from './StatusPill';

export function QueueRow({ c, onOpen }: { c: CandidateView; onOpen: (id: number) => void }) {
  return (
    <div className="qrow" onClick={() => onOpen(c.matchId)}>
      <ScoreBadge score={c.score} />
      <div className="qdeal">
        <span className="qthumb" style={{ background: c.grad }} />
        <div style={{ minWidth: 0 }}>
          <div className="nm">{c.place}, {c.country}</div>
          <div className="mt">{c.from} → {c.to} · {c.dates} · {c.legs}</div>
        </div>
      </div>
      <div className="qtmpl"><span className="chip">{c.template}</span></div>
      <div className="qdrop">−{c.drop}%</div>
      <div className="qprice">
        €{c.price}
        {c.usual != null && <s>was €{c.usual}</s>}
      </div>
      <StatusPill status={c.status} />
    </div>
  );
}
