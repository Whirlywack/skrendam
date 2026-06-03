'use client';

import { useState } from 'react';
import type { CandidateView } from '@/lib/types';
import { Icon } from '@/components/Icon';

type Tab = 'headline' | 'hook' | 'news';

export function CopyDrafter({ c }: { c: CandidateView }) {
  const [tab, setTab] = useState<Tab>('headline');
  const [headline, setHeadline] = useState(c.copy.headline);
  const [hook, setHook] = useState(c.copy.hook);
  const [news, setNews] = useState(c.copy.news);

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

        <div style={{ padding: '0 16px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* TODO Task 14: saveContentDraft */}
          <button
            className="btn btn-outline"
            disabled
            title="Saving copy drafts lands in Task 14"
            style={{ opacity: 0.45, cursor: 'not-allowed' }}
          >
            Save copy
          </button>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-3)' }}>
            (persistence coming soon)
          </span>
        </div>
      </div>
    </div>
  );
}
