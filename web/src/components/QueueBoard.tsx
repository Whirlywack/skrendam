'use client';

import { useMemo, useState, useTransition } from 'react';
import type { CandidateView, ScanView, TemplateGroup } from '@/lib/types';
import { rejectCandidates } from '@/app/actions';
import { Queue } from './Queue';
import { Composer } from './Composer';

// Scopes mirror the curator's day, not the DB: "New today" = untouched fresh
// candidates, "Saved" = ones parked with Hold, "History" = everything ever.
const SCOPES = ['New today', 'Saved', 'History'] as const;
type Scope = (typeof SCOPES)[number];

const SCOPE_FILTER: Record<Scope, (c: CandidateView) => boolean> = {
  'New today': (c) => c.status === 'suggested',
  Saved: (c) => c.status === 'review',
  History: () => true,
};

function TemplateSection({
  g,
  items,
  alsoMatches,
  onOpen,
}: {
  g: TemplateGroup;
  items: CandidateView[];
  alsoMatches: Map<number, string[]>;
  onOpen: (id: number) => void;
}) {
  const [maybeOpen, setMaybeOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  const great = items.filter((c) => c.tier === 'great');
  const maybe = items.filter((c) => c.tier === 'maybe');
  const dismissable = items.filter((c) => c.status === 'suggested' || c.status === 'review');

  function bulkDismiss() {
    const ids = [...new Set(dismissable.map((c) => c.candidateId))];
    startTransition(async () => {
      await rejectCandidates(ids);
      setConfirming(false);
    });
  }

  return (
    <section style={{ marginBottom: 32 }}>
      <h3
        style={{
          fontFamily: 'var(--font-mono)',
          textTransform: 'uppercase',
          letterSpacing: '.04em',
          color: 'var(--fg-3)',
          fontSize: 11,
          fontWeight: 700,
          margin: '0 28px 8px',
          paddingTop: 8,
          display: 'flex',
          alignItems: 'baseline',
          gap: 10,
        }}
      >
        {g.templateLabel}
        <span style={{ fontWeight: 400 }}>
          {new Set(items.map((c) => c.candidateId)).size} deals · {great.length} high-score
        </span>
        {dismissable.length > 0 && (
          <button
            onClick={() => (confirming ? bulkDismiss() : setConfirming(true))}
            onBlur={() => setConfirming(false)}
            disabled={isPending}
            style={{
              marginLeft: 'auto',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontFamily: 'var(--font-body)',
              fontSize: 12,
              fontWeight: 600,
              textTransform: 'none',
              letterSpacing: 0,
              color: confirming ? 'var(--coral-600)' : 'var(--fg-3)',
            }}
          >
            {isPending
              ? 'Dismissing…'
              : confirming
                ? `Dismiss all ${dismissable.length}?`
                : 'Dismiss group…'}
          </button>
        )}
      </h3>

      {great.length > 0 && <Queue candidates={great} alsoMatches={alsoMatches} onOpen={onOpen} />}

      {maybe.length > 0 && (
        <>
          <button
            className="maybe-toggle"
            onClick={() => setMaybeOpen((o) => !o)}
            aria-expanded={maybeOpen}
          >
            <span className={`chevron${maybeOpen ? ' open' : ''}`} aria-hidden="true">
              ▾
            </span>
            Maybe ({maybe.length})
          </button>
          {maybeOpen && <Queue candidates={maybe} alsoMatches={alsoMatches} onOpen={onOpen} />}
        </>
      )}
    </section>
  );
}

export function QueueBoard({
  groups,
  scan,
}: {
  groups: TemplateGroup[];
  scan: ScanView;
}) {
  const [scope, setScope] = useState<Scope>('New today');
  const [selected, setSelected] = useState<CandidateView | null>(null);

  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const byId = (id: number) => flat.find((c) => c.matchId === id) ?? null;

  // candidateId -> template labels it appears under (for "also matches" on rows).
  const templatesByCandidate = useMemo(() => {
    const m = new Map<number, string[]>();
    for (const g of groups) {
      for (const c of g.items) {
        const list = m.get(c.candidateId) ?? [];
        if (!list.includes(g.templateLabel)) list.push(g.templateLabel);
        m.set(c.candidateId, list);
      }
    }
    return m;
  }, [groups]);

  const counts: Record<Scope, number> = useMemo(
    () => ({
      'New today': new Set(flat.filter(SCOPE_FILTER['New today']).map((c) => c.candidateId)).size,
      Saved: new Set(flat.filter(SCOPE_FILTER.Saved).map((c) => c.candidateId)).size,
      History: new Set(flat.map((c) => c.candidateId)).size,
    }),
    [flat],
  );

  // Groups with the most fresh high-score deals first — June ghosts can't lead.
  const orderedGroups = useMemo(() => {
    const freshGreat = (g: TemplateGroup) =>
      new Set(
        g.items
          .filter((c) => c.status === 'suggested' && c.tier === 'great')
          .map((c) => c.candidateId),
      ).size;
    return [...groups].sort((a, b) => freshGreat(b) - freshGreat(a));
  }, [groups]);

  return (
    <>
      <div className="topbar">
        <div className="scan">
          <span className="dot" />
          <span>
            Scanner ran <b>{scan.ago}</b> · checked <b>{scan.fares}</b> fares across{' '}
            <b>{scan.airports}</b> routes · <b>{scan.newToday}</b> new candidates
          </span>
        </div>
        <div className="pagehead">
          <div>
            <h1>Review</h1>
            <div className="sub">
              Fresh finds from the scanner — publish, save for later, or dismiss.
            </div>
          </div>
          <div className="tabs">
            {SCOPES.map((s) => (
              <button
                key={s}
                className={`tab${scope === s ? ' on' : ''}`}
                onClick={() => setScope(s)}
              >
                {s}
                {s !== 'History' && (
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, marginLeft: 6, opacity: 0.7 }}>
                    {counts[s]}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {orderedGroups.map((g) => {
        const items = g.items.filter(SCOPE_FILTER[scope]);
        if (!items.length) return null;
        return (
          <TemplateSection
            key={g.templateId}
            g={g}
            items={items}
            alsoMatches={templatesByCandidate}
            onOpen={(id) => setSelected(byId(id))}
          />
        );
      })}

      {flat.filter(SCOPE_FILTER[scope]).length === 0 && (
        <p style={{ padding: '32px 28px', color: 'var(--fg-2)', fontSize: 14 }}>
          {scope === 'New today'
            ? 'Queue is clear — nothing new to review. Next scan runs at 06:00.'
            : scope === 'Saved'
              ? 'Nothing saved. Press "Hold" on a deal to park it here.'
              : 'No history yet.'}
        </p>
      )}

      {selected && <Composer c={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
