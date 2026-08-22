'use client';

import { useState } from 'react';
import { clusterDateSpan, type Cluster } from '@/lib/cluster';
import { QueueRow } from './QueueRow';

export function Queue({
  clusters,
  alsoMatches,
  onOpen,
}: {
  clusters: Cluster[];
  alsoMatches: Map<number, string[]>;
  onOpen: (id: number) => void;
}) {
  const [open, setOpen] = useState<Set<string>>(new Set());

  return (
    <div className="queue">
      {clusters.map((cl) => {
        const key = cl.rep.id;
        const expanded = open.has(key);
        const prices = [cl.rep, ...cl.rest].map((c) => c.price);
        return (
          <div key={key}>
            <QueueRow
              c={cl.rep}
              also={(alsoMatches.get(cl.rep.candidateId) ?? []).filter((t) => t !== cl.rep.template)}
              onOpen={onOpen}
            />
            {cl.rest.length > 0 && (
              <button
                className="maybe-toggle"
                onClick={() =>
                  setOpen((s) => {
                    const n = new Set(s);
                    if (expanded) n.delete(key);
                    else n.add(key);
                    return n;
                  })
                }
                aria-expanded={expanded}
                style={{ marginTop: -4 }}
              >
                <span className={`chevron${expanded ? ' open' : ''}`} aria-hidden="true">▾</span>
                {cl.rest.length} more {cl.rest.length === 1 ? 'date' : 'dates'} on {cl.rep.from} →{' '}
                {cl.rep.to} · {clusterDateSpan(cl)} · €{Math.min(...prices)}–{Math.max(...prices)}
              </button>
            )}
            {expanded &&
              cl.rest.map((c) => (
                <QueueRow
                  key={c.id}
                  c={c}
                  also={(alsoMatches.get(c.candidateId) ?? []).filter((t) => t !== c.template)}
                  onOpen={onOpen}
                />
              ))}
          </div>
        );
      })}
    </div>
  );
}
