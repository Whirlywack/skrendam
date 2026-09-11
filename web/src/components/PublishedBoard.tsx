'use client';

import { useState, useTransition } from 'react';
import type { publishedDeals } from '@/db/generated/schema';
import { expireDeal, republishDeal, markPosted } from '@/app/actions';
import { formatLocalTs, timeAgo } from '@/lib/format';
import { localToday, republishBlock, REPUBLISH_BLOCK_TEXT } from '@/lib/publishGuard';
import { dealState, isLiveStatus, priceDriftPct, STATE_LABEL } from '@/lib/verification';
import { Icon } from '@/components/Icon';

// Manual "I posted this" toggle — one tap after posting the deal by hand.
// Automatic detection would need TikTok/IG API integrations for zero benefit
// at one post per deal (founder decision 2026-08-22).
function PostedChip({
  dealId,
  platform,
  postedAt,
}: {
  dealId: number;
  platform: 'tiktok' | 'instagram';
  postedAt: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const label = platform === 'tiktok' ? 'TikTok' : 'IG';
  const posted = postedAt != null;
  return (
    <button
      disabled={isPending}
      onClick={() => startTransition(() => markPosted(dealId, platform, !posted))}
      title={posted ? `Posted ${timeAgo(postedAt)} — tap to unmark` : `Mark as posted to ${label}`}
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        letterSpacing: '0.05em',
        padding: '3px 9px',
        borderRadius: 99,
        cursor: 'pointer',
        border: posted ? '1px solid var(--sea-200)' : '1px dashed var(--sand-300)',
        background: posted ? 'var(--sea-50)' : 'transparent',
        color: posted ? 'var(--sea-700)' : 'var(--fg-3)',
        opacity: isPending ? 0.6 : 1,
      }}
    >
      {label} {posted ? '✓' : '+'}
    </button>
  );
}

type Deal = typeof publishedDeals.$inferSelect;

// The Live tab is the site's visible set (`LIVE_STATUSES`: live + changed);
// each row carries its own state pill.
const TABS = ['live', 'draft', 'expired'] as const;
type TabVal = (typeof TABS)[number];

function inTab(deal: Deal, tab: TabVal): boolean {
  return tab === 'live' ? isLiveStatus(deal.status) : deal.status === tab;
}

interface Props {
  deals: Deal[];
  /** `deal_price_checks` rows per deal id (grouped query; absent = 0). */
  checkCounts: Record<number, number>;
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
  if (status === 'changed')
    return { ...PILL, background: 'var(--amber-100)', color: 'var(--amber-700)' };
  if (status === 'expired')
    return { ...PILL, background: 'var(--coral-50)', color: 'var(--coral-700)' };
  return { ...PILL, background: 'var(--sand-100)', color: 'var(--fg-3)' };
}

const FACT: React.CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-3)' };

/** The verification line under a deal (WP9): published vs current price,
 *  the window minimum, missed checks, the last real answer and how many
 *  checks the scan has recorded. Every fact is a real column or a count —
 *  nothing here is estimated. */
function VerificationFacts({ deal, checkCount }: { deal: Deal; checkCount: number }) {
  const drift = priceDriftPct(deal.price, deal.currentPrice);
  const driftTone =
    drift == null ? 'var(--fg-3)' : drift > 0 ? 'var(--amber-700)' : 'var(--sea-600)';
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
      {deal.currentPrice != null ? (
        <span
          style={{ ...FACT, color: driftTone, fontWeight: 700 }}
          title={deal.currentPriceAt ? `current price as of ${formatLocalTs(deal.currentPriceAt)}` : undefined}
        >
          now €{Math.round(deal.currentPrice)}
          {drift != null && drift !== 0 && ` (${drift > 0 ? '+' : ''}${drift}%)`}
          {deal.currentPriceAt && ` · ${timeAgo(deal.currentPriceAt)}`}
        </span>
      ) : (
        <span style={FACT}>no current price</span>
      )}
      {deal.windowMinPrice != null && (
        <span style={FACT}>
          window min €{Math.round(deal.windowMinPrice)}
          {deal.windowMinDate && ` on ${deal.windowMinDate}`}
        </span>
      )}
      {deal.missedChecks > 0 && (
        <span style={{ ...FACT, color: 'var(--coral-600)', fontWeight: 700 }}>
          missed {deal.missedChecks} {deal.missedChecks === 1 ? 'check' : 'checks'}
        </span>
      )}
      <span style={FACT} title={deal.verifiedAt ? formatLocalTs(deal.verifiedAt) : undefined}>
        {deal.verifiedAt ? `last check ${timeAgo(deal.verifiedAt)}` : 'never checked'}
      </span>
      <span style={FACT}>
        {checkCount} {checkCount === 1 ? 'check' : 'checks'}
      </span>
    </div>
  );
}

function DealRow({ deal, checkCount }: { deal: Deal; checkCount: number }) {
  const live = isLiveStatus(deal.status);
  const state = dealState(deal.status);
  const [isPending, startTransition] = useTransition();
  // UX half of the republish guard; `republishDeal` refuses the same case.
  const block = republishBlock(deal, localToday());
  const blockText = block ? REPUBLISH_BLOCK_TEXT[block] : null;

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
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-3)' }}>
            published {timeAgo(deal.publishedAt)}
          </span>
          {deal.unverifiedSince && (
            <span className="stat unverified">
              unverified since {String(deal.unverifiedSince).slice(0, 10)}
            </span>
          )}
          {deal.publicLabel && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-3)' }}>
              {deal.publicLabel}
            </span>
          )}
          {live && (
            <>
              <PostedChip dealId={deal.id} platform="tiktok" postedAt={deal.postedTiktokAt} />
              <PostedChip dealId={deal.id} platform="instagram" postedAt={deal.postedInstagramAt} />
            </>
          )}
        </div>
        <VerificationFacts deal={deal} checkCount={checkCount} />
      </div>

      {/* State pill: live / changed / expired (anything else as stored) */}
      <span style={statusStyle(deal.status)}>{state === 'other' ? deal.status : STATE_LABEL[state]}</span>

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
        {live && (
          <button
            className="btn btn-ghost"
            style={{ fontSize: 12, padding: '6px 10px' }}
            onClick={handleExpire}
            disabled={isPending}
          >
            <Icon name="Archive" size={14} /> Expire
          </button>
        )}
        {!live && (
          <span title={blockText ?? undefined} style={{ display: 'inline-flex' }}>
            <button
              className="btn btn-outline"
              style={{ fontSize: 12, padding: '6px 10px', ...(blockText ? { opacity: 0.5, cursor: 'not-allowed' } : {}) }}
              onClick={handleRepublish}
              disabled={isPending || blockText != null}
              aria-disabled={blockText != null || undefined}
              title={blockText ?? undefined}
            >
              <Icon name="RefreshCw" size={14} /> Republish
            </button>
          </span>
        )}
      </div>
    </div>
  );
}

export function PublishedBoard({ deals, checkCounts }: Props) {
  const [tab, setTab] = useState<TabVal>('live');

  const filtered = deals.filter((d) => inTab(d, tab));

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
        Live
      </h1>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 20 }}>
        {TABS.map((t) => {
          const count = deals.filter((d) => inTab(d, t)).length;
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
          filtered.map((d) => <DealRow key={d.id} deal={d} checkCount={checkCounts[d.id] ?? 0} />)
        )}
      </div>
    </div>
  );
}
