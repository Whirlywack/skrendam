'use client';

import { useState, useTransition } from 'react';
import type { CandidateView } from '@/lib/types';
import { Icon } from '@/components/Icon';
import { saveContentDraft } from '@/app/actions';

type Tab = 'headline' | 'hook' | 'news' | 'body';
type Copy = CandidateView['copy'];

const TABS: { key: Tab; icon: string; label: string; rows?: number; tall?: boolean }[] = [
  { key: 'headline', icon: 'Type', label: 'Headline', rows: 3 },
  { key: 'hook', icon: 'Music', label: 'TikTok hook', rows: 4 },
  { key: 'news', icon: 'Mail', label: 'Newsletter', tall: true },
  { key: 'body', icon: 'AlignLeft', label: 'Body', tall: true },
];

/**
 * Copy state is owned by the parent (Composer) so "Approve & publish" sends
 * exactly what the curator sees in the textareas — not the server-loaded
 * values. The drafter only edits and saves.
 */
export function CopyDrafter({
  c,
  copy,
  onChange,
}: {
  c: CandidateView;
  copy: Copy;
  onChange: (copy: Copy) => void;
}) {
  const [tab, setTab] = useState<Tab>('headline');
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      try {
        await saveContentDraft({
          candidateId: c.candidateId,
          templateId: c.templateId,
          headline: copy.headline,
          hook: copy.hook,
          news: copy.news,
          body: copy.body,
        });
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      } catch {
        setSaveError(true);
        setTimeout(() => setSaveError(false), 2500);
      }
    });
  }

  const active = TABS.find((t) => t.key === tab) ?? TABS[0];
  const value = copy[active.key];

  return (
    <div className="sec">
      <h4>Draft copy · AI-assisted, you approve</h4>
      <div className="drafter">
        <div className="dtabs">
          {TABS.map((t) => (
            <button
              key={t.key}
              className={'dtab' + (tab === t.key ? ' on' : '')}
              onClick={() => setTab(t.key)}
            >
              <Icon name={t.icon} size={15} /> {t.label}
            </button>
          ))}
        </div>

        <div className="dcontent">
          <div>
            <textarea
              key={active.key}
              className="draftbox"
              style={active.tall ? { minHeight: 132 } : undefined}
              rows={active.rows}
              value={value}
              onChange={(e) => onChange({ ...copy, [active.key]: e.target.value })}
            />
            <span className="charcount">{value.length} chars</span>
          </div>
        </div>

        <div style={{ padding: '0 16px 14px', display: 'flex', alignItems: 'center', gap: 10, position: 'relative' }}>
          <button
            className="btn btn-outline"
            onClick={handleSave}
            disabled={isPending}
            style={isPending ? { opacity: 0.6, cursor: 'not-allowed' } : undefined}
          >
            {isPending ? 'Saving…' : 'Save copy'}
          </button>
          {saved && (
            <div className="toast" style={{ bottom: 56 }}>
              <span className="ic"><Icon name="CheckCircle" size={18} /></span>
              Copy draft saved
            </div>
          )}
          {saveError && (
            <div className="toast" style={{ bottom: 56, background: 'var(--coral-600)' }}>
              <span className="ic"><Icon name="AlertTriangle" size={18} /></span>
              Save failed — try again
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
