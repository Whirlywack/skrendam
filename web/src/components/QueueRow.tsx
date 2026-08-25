'use client';

import { useState, useTransition } from 'react';
import type { CandidateView } from '@/lib/types';
import { setCandidateStatus, updateLiveDealFromCandidate } from '@/app/actions';
import { WAS_PRICE_MIN_DROP_PCT } from '@/lib/format';
import { StatusPill } from './StatusPill';

const MONO: React.CSSProperties = { fontFamily: 'var(--font-mono)' };

/**
 * Boarding-pass row: route always readable (mono, never truncated), price as
 * the hero, one "why it's good" line and one "the catch" line — the brand's
 * trust formula applied to our own tool. Quick Hold/Dismiss without opening.
 */
export function QueueRow({
  c,
  also,
  onOpen,
}: {
  c: CandidateView;
  also: string[];
  onOpen: (id: number) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [gone, setGone] = useState<null | 'held' | 'dismissed'>(null);
  const [updated, setUpdated] = useState(false);

  function updateLive(e: React.MouseEvent, liveId: number) {
    e.stopPropagation();
    startTransition(async () => {
      await updateLiveDealFromCandidate({ publishedId: liveId, candidateId: c.candidateId });
      setUpdated(true);
    });
  }

  function act(e: React.MouseEvent, status: 'seen' | 'rejected') {
    e.stopPropagation();
    startTransition(async () => {
      await setCandidateStatus(c.candidateId, status);
      setGone(status === 'seen' ? 'held' : 'dismissed');
    });
  }

  if (gone) {
    return (
      <div className="qrow" style={{ opacity: 0.55, gridTemplateColumns: '1fr' }}>
        <span style={{ ...MONO, fontSize: 12, color: 'var(--fg-2)' }}>
          {c.from} → {c.to} {gone === 'held' ? 'saved for later' : 'dismissed'}
        </span>
      </div>
    );
  }

  const why = c.signals[0] ?? `${c.drop}% below this route's usual price`;
  const catches = c.flags;

  return (
    <div
      className="qrow"
      onClick={() => onOpen(c.matchId)}
      style={{ gridTemplateColumns: 'minmax(148px, 1fr) 2.2fr 104px auto', opacity: isPending ? 0.6 : 1 }}
    >
      {/* stub — route + dates, mono, never truncated */}
      <div style={{ minWidth: 0 }}>
        <div style={{ ...MONO, fontWeight: 700, fontSize: 15, whiteSpace: 'nowrap' }}>
          {c.from} → {c.to}
        </div>
        <div style={{ ...MONO, fontSize: 11, color: 'var(--fg-2)', marginTop: 3 }}>{c.dates}</div>
        <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 2 }}>
          {c.place}
          {c.airline && c.airline !== '—' ? ` · ${c.airline}` : c.legs ? ` · ${c.legs}` : ''}
        </div>
      </div>

      {/* why it's good + the catch */}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, color: 'var(--sea-700)' }}>{why}</div>
        <div style={{ fontSize: 12, color: 'var(--fg-2)', marginTop: 3 }}>
          {catches.length > 0 ? (
            <>
              <b style={{ color: 'var(--amber-700)', fontWeight: 600 }}>The catch:</b>{' '}
              {catches.join(' · ')}
            </>
          ) : (
            <span style={{ color: 'var(--fg-3)' }}>No catches spotted — verify in review</span>
          )}
        </div>
        {also.length > 0 && (
          <div style={{ ...MONO, fontSize: 10, color: 'var(--fg-3)', marginTop: 3 }}>
            also matches: {also.join(', ')}
          </div>
        )}
        {/* Route context: what the desk already knows about this route (routeContext.ts) */}
        {c.context?.kind === 'cheaper_than_live' && (
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5 }}
            onClick={(e) => e.stopPropagation()}
          >
            <span style={{ ...MONO, fontSize: 11, color: 'var(--amber-700)', fontWeight: 700 }}>
              ↓ live deal is €{c.context.livePrice} — this fare is €{c.context.saving} cheaper
            </span>
            {updated ? (
              <span style={{ ...MONO, fontSize: 11, color: 'var(--sea-600)', fontWeight: 700 }}>
                live deal updated ✓
              </span>
            ) : (
              <button
                className="btn btn-outline"
                style={{ padding: '2px 8px', fontSize: 11 }}
                disabled={isPending}
                onClick={(e) => updateLive(e, (c.context as { liveId: number }).liveId)}
              >
                Update live deal →
              </button>
            )}
          </div>
        )}
        {c.context?.kind === 'live_on_route' && (
          <div style={{ ...MONO, fontSize: 10, color: 'var(--fg-3)', marginTop: 4 }}>
            live on this route at €{c.context.livePrice}
          </div>
        )}
        {c.context?.kind === 'rejected_similar' && (
          <div style={{ ...MONO, fontSize: 10, color: 'var(--fg-3)', marginTop: 4 }}>
            you dismissed a similar fare at €{c.context.rejectedPrice}
            {c.context.when ? ` · ${new Date(c.context.when).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : ''}
          </div>
        )}
      </div>

      {/* fare */}
      <div style={{ textAlign: 'right' }}>
        <div
          style={{
            fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22,
            letterSpacing: '-0.02em',
          }}
        >
          €{c.price}
        </div>
        {c.usual != null && (
          <div style={{ ...MONO, fontSize: 11, color: 'var(--fg-3)' }}>
            {/* strikethrough only on deep deals (reference-price rule) */}
            {c.drop >= WAS_PRICE_MIN_DROP_PCT && <><s>€{c.usual}</s>{' '}</>}
            <span style={{ color: 'var(--sea-600)', fontWeight: 700 }}>−{c.drop}%</span>
          </div>
        )}
      </div>

      {/* actions */}
      <div
        style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'stretch' }}
        onClick={(e) => e.stopPropagation()}
      >
        {c.status === 'suggested' || c.status === 'review' ? (
          <>
            <button className="btn btn-primary" style={{ padding: '5px 14px', fontSize: 12 }} onClick={() => onOpen(c.matchId)}>
              Open
            </button>
            <div style={{ display: 'flex', gap: 5 }}>
              {c.status === 'suggested' && (
                <button
                  className="btn btn-outline"
                  style={{ padding: '4px 10px', fontSize: 11, flex: 1 }}
                  disabled={isPending}
                  onClick={(e) => act(e, 'seen')}
                >
                  Hold
                </button>
              )}
              <button
                className="btn btn-outline"
                style={{ padding: '4px 10px', fontSize: 11, flex: 1, color: 'var(--fg-3)' }}
                disabled={isPending}
                onClick={(e) => act(e, 'rejected')}
              >
                Dismiss
              </button>
            </div>
          </>
        ) : (
          <StatusPill status={c.status} />
        )}
      </div>
    </div>
  );
}
