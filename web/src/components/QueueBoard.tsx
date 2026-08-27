'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import type { CandidateView, ScanView, TemplateGroup } from '@/lib/types';
import { rejectCandidates } from '@/app/actions';
import { clusterByRoute } from '@/lib/cluster';
import { SHORTLIST, shortlistIds } from '@/lib/shortlist';
import { Queue } from './Queue';
import { Composer } from './Composer';

export interface OriginTab {
  code: string;
  label: string;
  count: number;
}

// Scopes mirror the curator's day, not the DB: "New today" = untouched fresh
// candidates, "Saved" = ones parked with Hold, "History" = everything ever.
const SCOPES = ['New today', 'Saved', 'History'] as const;
type Scope = (typeof SCOPES)[number];

const SCOPE_FILTER: Record<Scope, (c: CandidateView) => boolean> = {
  'New today': (c) => c.status === 'suggested',
  Saved: (c) => c.status === 'review',
  History: () => true,
};

// "Best first" is the engine's own score — it already blends drop, rarity and
// price; the other sorts are simple human questions.
const SORTS = {
  'Best first': (a: CandidateView, b: CandidateView) => b.score - a.score,
  Cheapest: (a: CandidateView, b: CandidateView) => a.price - b.price,
  'Biggest drop': (a: CandidateView, b: CandidateView) => b.drop - a.drop,
  'Soonest travel': (a: CandidateView, b: CandidateView) =>
    a.travelDate.localeCompare(b.travelDate),
} as const;
type SortKey = keyof typeof SORTS;

// Show the top few per group so one big template can't drown the page; the
// rest is one click away.
const GROUP_PREVIEW = 3;

function TemplateSection({
  g,
  items,
  alsoMatches,
  preview,
  onOpen,
}: {
  g: TemplateGroup;
  items: CandidateView[];
  alsoMatches: Map<number, string[]>;
  /** Cap rows at GROUP_PREVIEW (overview mode); focused mode shows all. */
  preview: boolean;
  onOpen: (id: number) => void;
}) {
  const [maybeOpen, setMaybeOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  const great = items.filter((c) => c.tier === 'great');
  const maybe = items.filter((c) => c.tier === 'maybe');
  const dismissable = items.filter((c) => c.status === 'suggested' || c.status === 'review');
  // Cluster BEFORE the preview cap: the top-3 slots must be three different
  // routes, not three dates of the same route (they sort adjacent by score).
  const greatClusters = clusterByRoute(great);
  const shown = showAll || !preview ? greatClusters : greatClusters.slice(0, GROUP_PREVIEW);
  const hidden = greatClusters.length - shown.length;

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

      {shown.length > 0 && <Queue clusters={shown} alsoMatches={alsoMatches} onOpen={onOpen} />}

      {hidden > 0 && (
        <button
          className="maybe-toggle"
          onClick={() => setShowAll(true)}
          style={{ fontWeight: 600 }}
        >
          Show {hidden} more {hidden === 1 ? 'route' : 'routes'} ({great.length} dates total) ↓
        </button>
      )}
      {preview && showAll && greatClusters.length > GROUP_PREVIEW && (
        <button className="maybe-toggle" onClick={() => setShowAll(false)}>
          Show fewer ↑
        </button>
      )}

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
          {maybeOpen && (
            <Queue clusters={clusterByRoute(maybe)} alsoMatches={alsoMatches} onOpen={onOpen} />
          )}
        </>
      )}
    </section>
  );
}

export function QueueBoard({
  groups,
  scan,
  origins,
  activeOrigin,
}: {
  groups: TemplateGroup[];
  scan: ScanView;
  origins: OriginTab[];
  activeOrigin: string | null;
}) {
  const [scope, setScope] = useState<Scope>('New today');
  const [sortKey, setSortKey] = useState<SortKey>('Best first');
  const [typeFilter, setTypeFilter] = useState<number | null>(null);
  const [selected, setSelected] = useState<CandidateView | null>(null);
  const [showAllToday, setShowAllToday] = useState(false);

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

  // Membership is by best score per candidate; the sort dropdown only reorders
  // the 20, it never changes who made the cut.
  const shortlist = useMemo(() => shortlistIds(flat), [flat]);
  // Only the default view is capped — focusing a type chip or another scope is
  // already an explicit "show me everything of this" gesture.
  const shortlisting =
    scope === 'New today' && typeFilter === null && !showAllToday &&
    counts['New today'] > SHORTLIST;

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
            <h1>Review{activeOrigin ? ` · from ${origins.find((o) => o.code === activeOrigin)?.label}` : ''}</h1>
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

      {/* Departure-city sub-pages — each origin has its own URL */}
      <div style={{ display: 'flex', gap: 8, padding: '12px 28px 4px', flexWrap: 'wrap' }}>
        <Link
          href="/queue"
          style={{
            textDecoration: 'none',
            fontFamily: 'var(--font-body)',
            fontWeight: 600,
            fontSize: 13,
            padding: '6px 14px',
            borderRadius: 99,
            border: '1px solid var(--sand-200)',
            background: activeOrigin === null ? 'var(--sand-900)' : 'transparent',
            color: activeOrigin === null ? 'var(--sand-50)' : 'var(--fg-2)',
          }}
        >
          All cities
        </Link>
        {origins.map((o) => (
          <Link
            key={o.code}
            href={`/queue?origin=${o.code}`}
            style={{
              textDecoration: 'none',
              fontFamily: 'var(--font-body)',
              fontWeight: 600,
              fontSize: 13,
              padding: '6px 14px',
              borderRadius: 99,
              border: '1px solid var(--sand-200)',
              background: activeOrigin === o.code ? 'var(--sand-900)' : 'transparent',
              color: activeOrigin === o.code ? 'var(--sand-50)' : 'var(--fg-2)',
            }}
          >
            {o.label}
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, marginLeft: 6, opacity: 0.7 }}>
              {o.count}
            </span>
          </Link>
        ))}
      </div>

      {/* Deal-type overview: today's whole catch in one line, click to focus */}
      <div
        style={{
          display: 'flex', gap: 8, padding: '8px 28px 4px', flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        {orderedGroups.map((g) => {
          const n = new Set(
            g.items.filter(SCOPE_FILTER[scope]).map((c) => c.candidateId),
          ).size;
          if (n === 0) return null;
          const on = typeFilter === g.templateId;
          return (
            <button
              key={g.templateId}
              onClick={() => setTypeFilter(on ? null : g.templateId)}
              style={{
                cursor: 'pointer',
                fontFamily: 'var(--font-mono)', fontSize: 11,
                padding: '5px 12px', borderRadius: 99,
                border: on ? '1px solid var(--amber-500)' : '1px solid var(--line)',
                background: on ? 'var(--amber-100)' : 'var(--bg-surface)',
                color: on ? 'var(--amber-700)' : 'var(--fg-2)',
              }}
            >
              {g.templateLabel} {n}
            </button>
          );
        })}
        <label
          style={{
            marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 11,
            color: 'var(--fg-3)', display: 'flex', gap: 6, alignItems: 'center',
          }}
        >
          sort
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            style={{
              fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600,
              border: '1px solid var(--sand-200)', borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-surface)', color: 'var(--fg-1)', padding: '4px 8px',
            }}
          >
            {Object.keys(SORTS).map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </label>
      </div>

      {orderedGroups.map((g) => {
        if (typeFilter !== null && g.templateId !== typeFilter) return null;
        const items = g.items
          .filter(SCOPE_FILTER[scope])
          .filter((c) => !shortlisting || shortlist.has(c.candidateId))
          .sort(SORTS[sortKey]);
        if (!items.length) return null;
        return (
          <TemplateSection
            key={g.templateId}
            g={g}
            items={items}
            alsoMatches={templatesByCandidate}
            // The shortlist IS the cap — don't hide any of the 20 behind
            // per-group previews on top of it.
            preview={typeFilter === null && !shortlisting}
            onOpen={(id) => setSelected(byId(id))}
          />
        );
      })}

      {shortlisting && (
        <button
          className="maybe-toggle"
          onClick={() => setShowAllToday(true)}
          style={{ fontWeight: 600 }}
        >
          Top {SHORTLIST} shown — show all {counts['New today']} deals ↓
        </button>
      )}
      {scope === 'New today' && typeFilter === null && showAllToday &&
        counts['New today'] > SHORTLIST && (
          <button className="maybe-toggle" onClick={() => setShowAllToday(false)}>
            Back to top {SHORTLIST} ↑
          </button>
        )}

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
