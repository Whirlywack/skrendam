'use client';

import { useState } from 'react';
import type { CandidateView, ScanView, TemplateGroup } from '@/lib/types';
import { Topbar } from './Topbar';
import { Queue } from './Queue';
import { Composer } from './Composer';

const TAB_TO_STATUS: Record<string, string | null> = {
  All: null,
  Suggested: 'suggested',
  'In review': 'review',
  Published: 'published',
  Rejected: 'rejected',
};

function TemplateSection({
  g,
  items,
  onOpen,
}: {
  g: TemplateGroup;
  items: CandidateView[];
  onOpen: (id: number) => void;
}) {
  const [maybeOpen, setMaybeOpen] = useState(false);

  const great = items.filter((c) => c.tier === 'great');
  const maybe = items.filter((c) => c.tier === 'maybe');

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
        }}
      >
        {g.templateLabel} <span style={{ fontWeight: 400 }}>({items.length})</span>
      </h3>

      {great.length > 0 && <Queue candidates={great} onOpen={onOpen} />}

      {maybe.length > 0 && (
        <>
          <button
            className="maybe-toggle"
            onClick={() => setMaybeOpen((o) => !o)}
            aria-expanded={maybeOpen}
          >
            <span
              className={`chevron${maybeOpen ? ' open' : ''}`}
              aria-hidden="true"
            >
              ▾
            </span>
            Maybe ({maybe.length})
          </button>
          {maybeOpen && <Queue candidates={maybe} onOpen={onOpen} />}
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
  const [tab, setTab] = useState('All');
  const [selected, setSelected] = useState<CandidateView | null>(null);

  const want = TAB_TO_STATUS[tab];
  const flat = groups.flatMap((g) => g.items);
  const byId = (id: number) => flat.find((c) => c.matchId === id) ?? null;

  return (
    <>
      <Topbar tab={tab} setTab={setTab} scan={scan} />

      {groups.map((g) => {
        const items = want ? g.items.filter((c) => c.status === want) : g.items;
        if (!items.length) return null;
        return (
          <TemplateSection
            key={g.templateId}
            g={g}
            items={items}
            onOpen={(id) => setSelected(byId(id))}
          />
        );
      })}

      {selected && <Composer c={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
