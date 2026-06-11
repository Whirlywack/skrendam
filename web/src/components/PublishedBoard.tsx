'use client';

import { useState, useTransition } from 'react';
import type { publishedDeals } from '@/db/generated/schema';
import { expireDeal, republishDeal } from '@/app/actions';
import { Icon } from '@/components/Icon';

type Deal = typeof publishedDeals.$inferSelect;

const TABS = ['live', 'draft', 'expired'] as const;
type TabVal = (typeof TABS)[number];

interface Props {
  deals: Deal[];
}

const PILL: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  letterSpacing: '0.08em',
  textTransform: 'uppercase' as const,
  padding: '3px 8px',
  borderRadius: 4,
  fontWeight: 600,
};

function statusStyle(status: string): React.CSSProperties {
  if (status === 'live')
    return { ...PILL, background: 'var(--sea-100)', color: 'var(--sea-700)' };
  if (status === 'expired')
    return { ...PILL, background: 'var(--coral-50)', color: 'var(--coral-700)' };
  return { ...PILL, background: 'var(--sand-100)', color: 'var(--fg-3)' };
}

function DealRow({ deal }: { deal: Deal }) {
  const [isPending, startTransition] = useTransition();

  function handleExpire() {
    startTransition(() => expireDeal(deal.id));
  }

  function handleRepublish() {
    startTransition(() => republishDeal(deal.id));
  }

  return (
    <div
      className="qrow"
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto auto',
        gap: 12,
        alignItems: 'center',
        padding: '12px 16px',
        borderBottom: '1px solid var(--line)',
      }}
    >
      {/* Left: route + meta */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 13 }}>
          {deal.origin} → {deal.destination}
        </span>
        <span style={{ fontSize: 12, color: 'var(--fg-2)' }}>
          {deal.headline}
        </span>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--sea-600)', fontWeight: 700 }}>
            €{deal.price}
          </span>
          {deal.discountPct != null && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-3)' }}>
              −{Math.round(Number(deal.discountPct ?? 0))}%
            </span>
          )}
          {deal.travelDate && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-3)' }}>
              {deal.travelDate}
            </span>
          )}
          {deal.validUntil && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--amber-700)' }}>
              valid until {deal.validUntil}
            </span>
          )}
          {deal.unverifiedSince && (
            <span className="stat rejected">
              unverified since {String(deal.unverifiedSince).slice(0, 10)}
            </span>
          )}
          {deal.publicLabel && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-3)' }}>
              {deal.publicLabel}
            </span>
          )}
        </div>
      </div>

      {/* Status pill */}
      <span style={statusStyle(deal.status)}>{deal.status}</span>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6 }}>
        {deal.tiktokHook && (
          <button
            className="btn btn-outline"
            style={{ fontSize: 12, padding: '6px 10px' }}
            onClick={() => navigator.clipboard.writeText(deal.tiktokHook ?? '')}
            title="Copy TikTok hook"
          >
            <Icon name="Copy" size={14} /> Hook
          </button>
        )}
        {deal.status === 'live' && (
          <button
            className="btn btn-ghost"
            style={{ fontSize: 12, padding: '6px 10px' }}
            onClick={handleExpire}
            disabled={isPending}
          >
            <Icon name="Archive" size={14} /> Expire
          </button>
        )}
        {deal.status !== 'live' && (
          <button
            className="btn btn-outline"
            style={{ fontSize: 12, padding: '6px 10px' }}
            onClick={handleRepublish}
            disabled={isPending}
          >
            <Icon name="RefreshCw" size={14} /> Republish
          </button>
        )}
      </div>
    </div>
  );
}

export function PublishedBoard({ deals }: Props) {
  const [tab, setTab] = useState<TabVal>('live');

  const filtered = deals.filter((d) => d.status === tab);

  return (
    <div className="topbar" style={{ flex: 1, overflowY: 'auto', paddingBottom: 40 }}>
      <h1
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 800,
          fontSize: 32,
          letterSpacing: '-0.02em',
          margin: '0 0 20px',
          color: 'var(--fg-1)',
        }}
      >
        Published deals
      </h1>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 20 }}>
        {TABS.map((t) => {
          const count = deals.filter((d) => d.status === t).length;
          return (
            <button
              key={t}
              className={'dtab' + (tab === t ? ' on' : '')}
              onClick={() => setTab(t)}
              style={{ textTransform: 'capitalize', gap: 6 }}
            >
              {t}
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  background: 'var(--sand-200)',
                  borderRadius: 8,
                  padding: '1px 6px',
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Deal rows */}
      <div
        className="card"
        style={{ padding: 0, overflow: 'hidden' }}
      >
        {filtered.length === 0 ? (
          <p
            style={{
              padding: 24,
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
              color: 'var(--fg-3)',
            }}
          >
            No {tab} deals.
          </p>
        ) : (
          filtered.map((d) => <DealRow key={d.id} deal={d} />)
        )}
      </div>
    </div>
  );
}
