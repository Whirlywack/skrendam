'use client';

import { toggleTemplateEnabled } from '@/app/config-actions';

interface AudienceRow {
  id: number;
  name: string;
  slug: string;
}

interface MomentRow {
  id: number;
  name: string;
  slug: string;
}

interface TemplateRowProps {
  id: number;
  name: string;
  slug: string;
  enabled: boolean;
  tripType: string;
  audienceSegmentId: number;
  travelMomentId: number;
  audiences: AudienceRow[];
  moments: MomentRow[];
  children: React.ReactNode;
}

export function TemplateRow({
  id,
  name,
  slug,
  enabled,
  tripType,
  audienceSegmentId,
  travelMomentId,
  audiences,
  moments,
  children,
}: TemplateRowProps) {
  const aud = audiences.find((a) => a.id === audienceSegmentId);
  const mom = moments.find((m) => m.id === travelMomentId);

  return (
    <details
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
      }}
    >
      {/* ── Row summary (collapsed state) ─────────────────── */}
      <summary
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '13px 18px',
          cursor: 'pointer',
          listStyle: 'none',
          userSelect: 'none',
        }}
      >
        {/* Enabled/disabled pill */}
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '.06em',
            textTransform: 'uppercase',
            padding: '3px 8px',
            borderRadius: 'var(--radius-pill)',
            background: enabled ? 'var(--sea-50)' : 'var(--sand-100)',
            color: enabled ? 'var(--sea-700)' : 'var(--sand-500)',
            border: enabled ? '1px solid var(--sea-200)' : '1px solid var(--sand-200)',
            flex: 'none',
          }}
        >
          {enabled ? 'on' : 'off'}
        </span>

        {/* Name + slug */}
        <span style={{ flex: 1, minWidth: 0 }}>
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: 15,
              color: 'var(--fg-1)',
            }}
          >
            {name}
          </span>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--fg-3)',
              marginLeft: 10,
            }}
          >
            {slug}
          </span>
        </span>

        {/* Audience badge */}
        {aud && (
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: 'var(--fg-3)',
              background: 'var(--sand-100)',
              padding: '3px 8px',
              borderRadius: 'var(--radius-pill)',
              whiteSpace: 'nowrap',
              flex: 'none',
            }}
          >
            {aud.name}
          </span>
        )}

        {/* Moment badge */}
        {mom && (
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: 'var(--fg-3)',
              background: 'var(--sand-100)',
              padding: '3px 8px',
              borderRadius: 'var(--radius-pill)',
              whiteSpace: 'nowrap',
              flex: 'none',
            }}
          >
            {mom.name}
          </span>
        )}

        {/* Trip type chip */}
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--amber-700)',
            background: 'var(--amber-50)',
            padding: '3px 8px',
            borderRadius: 'var(--radius-pill)',
            whiteSpace: 'nowrap',
            flex: 'none',
            border: '1px solid var(--amber-100)',
          }}
        >
          {tripType === 'oneway' ? 'one way' : 'round trip'}
        </span>

        {/* Enable/Disable mini-form — stopPropagation prevents details toggling on button click */}
        <form
          action={toggleTemplateEnabled}
          onClick={(e) => e.stopPropagation()}
          style={{ flex: 'none' }}
        >
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="enabled" value={String(enabled)} />
          <button
            type="submit"
            className="btn btn-outline"
            style={{ fontSize: 12, padding: '6px 12px' }}
          >
            {enabled ? 'Disable' : 'Enable'}
          </button>
        </form>

        {/* Expand chevron */}
        <span
          style={{
            color: 'var(--fg-3)',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            flex: 'none',
          }}
        >
          ▾
        </span>
      </summary>

      {/* ── Expanded edit form ─────────────────────────────── */}
      <div
        style={{
          borderTop: '1px solid var(--line-soft)',
          padding: '18px 18px 18px',
        }}
      >
        {children}
      </div>
    </details>
  );
}
