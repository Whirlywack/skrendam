'use client';

import type { ScanView } from '@/lib/types';

const TABS = ['All', 'Suggested', 'In review', 'Published', 'Rejected'];

export function Topbar({
  tab,
  setTab,
  scan,
}: {
  tab: string;
  setTab: (t: string) => void;
  scan: ScanView;
}) {
  return (
    <div className="topbar">
      <div className="scan">
        <span className="dot" />
        <span>
          Scanner ran <b>{scan.ago}</b> · checked <b>{scan.fares}</b> fares across{' '}
          <b>{scan.airports}</b> airports · <b>{scan.newToday}</b> new candidates today
        </span>
      </div>
      <div className="pagehead">
        <div>
          <h1>Deal queue</h1>
          <div className="sub">
            Candidates the scanner surfaced — review, draft, and approve before they go public.
          </div>
        </div>
        <div className="tabs">
          {TABS.map((t) => (
            <button
              key={t}
              className={`tab${tab === t ? ' on' : ''}`}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
