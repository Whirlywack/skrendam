'use client';

// TODO Task 12: full review room — this is a minimal drawer stub so QueueBoard compiles
// and the queue is clickable. Replace with the full Composer.jsx port in Task 12.

import { useEffect } from 'react';
import type { CandidateView } from '@/lib/types';
import { ScoreBadge } from './ScoreBadge';
import { StatusPill } from './StatusPill';

export function Composer({ c, onClose }: { c: CandidateView; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="drawer">
        <div className="dh" style={{ background: c.grad }}>
          <div className="ov" />
          <ScoreBadge score={c.score} />
          <button className="x" onClick={onClose} aria-label="Close">
            ×
          </button>
          <div className="cap">
            <div className="e">{c.template}</div>
            <div className="nm">{c.place}, {c.country}</div>
          </div>
        </div>

        <div className="dscroll">
          {/* Route + trip facts */}
          <div className="drow">
            <span className="pp" style={{ fontFamily: 'var(--font-mono)' }}>
              {c.from} → {c.to}
            </span>
            <span className="pp">{c.place}, {c.country}</span>
            <span className="pp">{c.dates}</span>
            <span className="pp">{c.legs}</span>
            {c.usual != null && (
              <span className="pp" style={{ color: 'var(--sea-700)' }}>
                €{c.price} · −{c.drop}%
              </span>
            )}
            {c.usual == null && (
              <span className="pp" style={{ color: 'var(--sea-700)' }}>€{c.price}</span>
            )}
          </div>

          {/* Status */}
          <div style={{ marginBottom: 18 }}>
            <StatusPill status={c.status} />
          </div>

          {/* Placeholder — Task 12 will add signals, flags, copy drafter */}
          <div className="sec">
            <h4>Signals</h4>
            {c.signals.map((s, i) => (
              <div className="sig" key={i}>
                <span className="ic">✓</span> {s}
              </div>
            ))}
          </div>

          {c.flags.length > 0 && (
            <div className="sec">
              <h4>Caveats</h4>
              {c.flags.map((f, i) => (
                <div className="flag" key={i}>
                  <span className="ic">⚠</span> {f}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="pubbar">
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </>
  );
}
