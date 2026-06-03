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
          <section key={g.templateId} style={{ marginBottom: 32 }}>
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
            <Queue candidates={items} onOpen={(id) => setSelected(byId(id))} />
          </section>
        );
      })}

      {selected && <Composer c={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
