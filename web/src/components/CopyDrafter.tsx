'use client';

import { useState, useTransition } from 'react';
import type { CandidateView } from '@/lib/types';
import { Icon } from '@/components/Icon';
import { saveContentDraft } from '@/app/actions';

type Tab = 'headline' | 'hook' | 'news';

export function CopyDrafter({ c }: { c: CandidateView }) {
  const [tab, setTab] = useState<Tab>('headline');
  const [headline, setHeadline] = useState(c.copy.headline);
  const [hook, setHook] = useState(c.copy.hook);
  const [news, setNews] = useState(c.copy.news);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      try {
        await saveContentDraft({
          candidateId: c.candidateId,
          templateId: c.templateId,
          headline,
          hook,
          news,
        });
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      } catch {
        setSaveError(true);
        setTimeout(() => setSaveError(false), 2500);
      }
    });
  }

  return (
    <div className="sec">
      <h4>Draft copy · AI-assisted, you approve</h4>
      <div className="drafter">
        <div className="dtabs">
          <button
            className={'dtab' + (tab === 'headline' ? ' on' : '')}
            onClick={() => setTab('headline')}
          >
            <Icon name="Type" size={15} /> Headline
          </button>
          <button
            className={'dtab' + (tab === 'hook' ? ' on' : '')}
            onClick={() => setTab('hook')}
          >
            <Icon name="Music" size={15} /> TikTok hook
          </button>
          <button
            className={'dtab' + (tab === 'news' ? ' on' : '')}
            onClick={() => setTab('news')}
          >
            <Icon name="Mail" size={15} /> Newsletter
          </button>
        </div>

        <div className="dcontent">
          {tab === 'headline' && (
            <div>
              <textarea
                className="draftbox"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                rows={3}
              />
              <span className="charcount">{headline.length} chars</span>
            </div>
          )}

          {tab === 'hook' && (
            <div>
              <textarea
                className="draftbox"
                value={hook}
                onChange={(e) => setHook(e.target.value)}
                rows={4}
              />
              <span className="charcount">{hook.length} chars</span>
            </div>
          )}

          {tab === 'news' && (
            <div>
              <textarea
                className="draftbox"
                style={{ minHeight: 132 }}
                value={news}
                onChange={(e) => setNews(e.target.value)}
              />
              <span className="charcount">{news.length} chars</span>
            </div>
          )}
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
