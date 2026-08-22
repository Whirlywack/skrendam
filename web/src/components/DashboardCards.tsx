import type { ScanView } from '@/lib/types';
import { GREAT_THRESHOLD } from '@/lib/tiers';

interface DashboardCardsProps {
  toReview: number;
  highScore: number;
  stalePrice: number;
  liveCount: number;
  expiringSoon: number;
  scan: ScanView;
}

const EYEBROW: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  letterSpacing: '0.1em',
  textTransform: 'uppercase' as const,
  color: 'var(--fg-3)',
  marginBottom: 6,
};

const NUM: React.CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontWeight: 800,
  fontSize: 48,
  lineHeight: 1,
  letterSpacing: '-0.03em',
};

const CAPTION: React.CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontSize: 13,
  color: 'var(--fg-2)',
  marginTop: 6,
};

const CARD: React.CSSProperties = {
  background: 'var(--bg-surface)',
  border: '1px solid var(--line)',
  borderRadius: 'var(--radius-lg)',
  padding: '20px 22px 18px',
  boxShadow: 'var(--shadow-md)',
  display: 'flex',
  flexDirection: 'column',
};

export function DashboardCards({
  toReview,
  highScore,
  stalePrice,
  liveCount,
  expiringSoon,
  scan,
}: DashboardCardsProps) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(188px, 1fr))',
        gap: 14,
      }}
    >
      {/* Card 1 — deals waiting for review (distinct candidates, current scan data) */}
      <div style={CARD}>
        <p style={EYEBROW}>To review</p>
        <p
          style={{
            ...NUM,
            color: toReview > 0 ? 'var(--sea-600)' : 'var(--fg-2)',
          }}
        >
          {toReview}
        </p>
        <p style={CAPTION}>
          {toReview === 0
            ? 'queue is clear'
            : `fresh deals · ${highScore} high-score (≥ ${GREAT_THRESHOLD})`}
        </p>
      </div>

      {/* Card 2 — live deals whose price nobody has re-checked lately */}
      <div style={CARD}>
        <p style={EYEBROW}>Needs a price check</p>
        <p
          style={{
            ...NUM,
            color: stalePrice > 0 ? 'var(--coral-600)' : 'var(--fg-2)',
          }}
        >
          {stalePrice}
        </p>
        <p style={CAPTION}>
          {stalePrice === 0
            ? 'all live prices fresh'
            : stalePrice === 1
              ? 'live deal not verified in over a week'
              : 'live deals not verified in over a week'}
        </p>
      </div>

      {/* Card 3 — Live deals */}
      <div style={CARD}>
        <p style={EYEBROW}>Live deals</p>
        <p
          style={{
            ...NUM,
            color: liveCount > 0 ? 'var(--sea-500)' : 'var(--fg-2)',
          }}
        >
          {liveCount}
        </p>
        <p style={CAPTION}>
          {expiringSoon > 0 ? (
            <span style={{ color: 'var(--amber-700)' }}>
              {expiringSoon} expiring within 7 days
            </span>
          ) : (
            'published and live'
          )}
        </p>
      </div>

      {/* Card 4 — Last scan */}
      <div style={CARD}>
        <p style={EYEBROW}>Last scan</p>
        <p
          style={{
            ...NUM,
            fontSize: 36,
            color:
              scan.status === 'completed'
                ? 'var(--sea-600)'
                : scan.status === 'never run'
                  ? 'var(--fg-3)'
                  : 'var(--amber-600)',
          }}
        >
          {scan.ago}
        </p>
        <p style={CAPTION}>
          {scan.newToday > 0 ? (
            <>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700,
                  color: 'var(--fg-1)',
                  marginRight: 3,
                }}
              >
                +{scan.newToday}
              </span>
              candidates ·{' '}
            </>
          ) : null}
          <span
            style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}
          >
            {scan.fares} API calls
          </span>
        </p>
      </div>
    </div>
  );
}
