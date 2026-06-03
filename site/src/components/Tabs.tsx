'use client';

import { useState } from 'react';
import type { PublicDeal } from '@/lib/types';
import { BrowseCard } from './BrowseCard';

interface TabsProps {
  bookNow: PublicDeal[];
  inspiration: PublicDeal[];
}

export function Tabs({ bookNow, inspiration }: TabsProps) {
  const [active, setActive] = useState<'book' | 'inspiration'>('book');
  const deals = active === 'book' ? bookNow : inspiration;

  return (
    <>
      <div className="tabs">
        <button
          type="button"
          className={`tab${active === 'book' ? ' on' : ''}`}
          onClick={() => setActive('book')}
        >
          Book now <span className="ct">{bookNow.length}</span>
        </button>
        <button
          type="button"
          className={`tab${active === 'inspiration' ? ' on' : ''}`}
          onClick={() => setActive('inspiration')}
        >
          Inspiration
        </button>
      </div>

      {deals.length === 0 ? (
        <div className="grid">
          <p className="subtitle" style={{ gridColumn: '1 / -1' }}>
            {active === 'book'
              ? 'No live deals right now — check back soon.'
              : 'No inspiration deals right now — check back soon.'}
          </p>
        </div>
      ) : (
        <div className="grid">
          {deals.map((deal) => (
            <BrowseCard key={deal.id} deal={deal} />
          ))}
        </div>
      )}
    </>
  );
}
