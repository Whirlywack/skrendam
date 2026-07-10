'use client';

import { useEffect, useTransition, useState } from 'react';
import type { CandidateView } from '@/lib/types';
import { Icon } from '@/components/Icon';
import { ScoreBadge } from '@/components/ScoreBadge';
import { StatusPill } from '@/components/StatusPill';
import { CopyDrafter } from '@/components/CopyDrafter';
import { timeAgo } from '@/lib/format';
import {
  setCandidateStatus,
  publishDeal,
  enqueueRecheck,
} from '@/app/actions';

interface ComposerProps {
  c: CandidateView;
  /** Omit in inline mode — the detail page is a Server Component and functions
   *  don't cross the RSC boundary; there's no drawer to dismiss anyway. */
  onClose?: () => void;
  /** When true: render in-flow (no scrim, no close button) for the detail page. */
  inline?: boolean;
}

export function Composer({ c, onClose: onCloseProp, inline = false }: ComposerProps) {
  const onClose = onCloseProp ?? (() => {});
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<string | null>(null);
  const [recheckQueued, setRecheckQueued] = useState(false);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2800);
  }

  function handleReject() {
    startTransition(async () => {
      try {
        await setCandidateStatus(c.candidateId, 'rejected');
        onClose();
      } catch {
        showToast('Reject failed — try again');
      }
    });
  }

  function handleSchedule() {
    startTransition(async () => {
      try {
        await setCandidateStatus(c.candidateId, 'maybe');
        onClose();
      } catch {
        showToast('Schedule failed — try again');
      }
    });
  }

  function handlePublish() {
    startTransition(async () => {
      try {
        await publishDeal({
          candidateId: c.candidateId,
          templateId: c.templateId,
          headline: c.copy.headline,
          tiktokHook: c.copy.hook,
        });
        showToast(`${c.place}, ${c.country} is live`);
        setTimeout(() => onClose(), 1200);
      } catch {
        showToast('Publish failed — try again');
      }
    });
  }

  function handleRecheck() {
    startTransition(async () => {
      try {
        await enqueueRecheck(c.candidateId);
        setRecheckQueued(true);
        showToast('Recheck queued');
      } catch {
        showToast("Couldn't queue recheck — try again");
      }
    });
  }

  useEffect(() => {
    if (inline) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, inline]);

  const drawer = (
    <div className={inline ? undefined : 'drawer'} style={inline ? { display: 'flex', flexDirection: 'column', height: '100%' } : undefined}>
      {/* Hero */}
      <div className="dh" style={{ background: c.grad }}>
        <div className="ov" />
        <ScoreBadge score={c.score} />
        {!inline && (
          <button className="x" onClick={onClose} aria-label="Close">
            <Icon name="X" size={18} />
          </button>
        )}
        <div className="cap">
          <div className="e">{c.template}</div>
          <div className="nm">{c.place}, {c.country}</div>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="dscroll">
        {/* Trip fact pills */}
        <div className="drow">
          <span className="pp" style={{ fontFamily: 'var(--font-mono)' }}>
            {c.from} → {c.to}
          </span>
          <span className="pp">{c.dates}</span>
          <span className="pp">{c.legs}</span>
          {c.airline && c.airline !== '—' && (
            <span className="pp">{c.airline}</span>
          )}
          {c.usual != null ? (
            <span className="pp" style={{ color: 'var(--sea-700)' }}>
              €{c.price} · −{c.drop}%
            </span>
          ) : (
            <span className="pp" style={{ color: 'var(--sea-700)' }}>
              €{c.price}
            </span>
          )}
        </div>

        {/* Status + verified */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <StatusPill status={c.status} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-3)' }}>
            {c.verifiedAt ? `Verified ${timeAgo(c.verifiedAt)}` : 'Not yet rechecked'}
          </span>
        </div>

        {/* Price vs baseline */}
        {c.usual != null && (
          <div className="sec">
            <h4>Price vs baseline</h4>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 28, color: 'var(--sea-600)' }}>
                €{c.price}
              </span>
              <span style={{ color: 'var(--fg-3)', fontSize: 14 }}>
                vs usual €{c.usual} · −{c.drop}% saving
              </span>
            </div>
          </div>
        )}

        {/* Signals */}
        {c.signals.length > 0 && (
          <div className="sec">
            <h4>Why the scanner flagged it</h4>
            {c.signals.map((s, i) => (
              <div className="sig" key={i}>
                <span className="ic"><Icon name="Check" size={16} /></span>
                {s}
              </div>
            ))}
          </div>
        )}

        {/* Flags / warnings */}
        {c.flags.length > 0 && (
          <div className="sec">
            <h4>Caveats to disclose</h4>
            {c.flags.map((f, i) => (
              <div className="flag" key={i}>
                <span className="ic"><Icon name="AlertTriangle" size={15} /></span>
                {f}
              </div>
            ))}
          </div>
        )}

        {/* Copy drafter */}
        <CopyDrafter c={c} />
      </div>

      {/* Publish bar */}
      <div className="pubbar" style={{ position: 'relative' }}>
        <button
          className="btn btn-ghost"
          onClick={handleReject}
          disabled={isPending}
          style={isPending ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
        >
          <Icon name="X" size={16} /> Reject
        </button>
        <span className="flex1" />
        <button
          className="btn btn-outline"
          onClick={handleSchedule}
          disabled={isPending}
          style={isPending ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
        >
          <Icon name="Clock" size={16} /> Schedule
        </button>
        <button
          className="btn btn-primary"
          onClick={handlePublish}
          disabled={isPending}
          style={isPending ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
        >
          <Icon name="Check" size={16} /> Approve &amp; publish
        </button>
        <button
          className="btn btn-outline"
          onClick={handleRecheck}
          disabled={isPending || recheckQueued}
          style={(isPending || recheckQueued) ? { opacity: 0.5, cursor: 'not-allowed', marginLeft: 4 } : { marginLeft: 4 }}
        >
          {recheckQueued ? 'Recheck queued' : 'Recheck'}
        </button>
        {toast && (
          <div className="toast">
            <span className="ic"><Icon name="CheckCircle" size={18} /></span>
            {toast}
          </div>
        )}
      </div>
    </div>
  );

  if (inline) {
    return drawer;
  }

  return (
    <>
      <div className="scrim" onClick={onClose} />
      {drawer}
    </>
  );
}
