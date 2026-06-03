'use client';

import { useRef, useState, useTransition } from 'react';
import { CheckCircle, AlertTriangle } from 'lucide-react';
import { upsertDealTemplate } from '@/app/config-actions';

// ---------- Row types (camelCase from Drizzle) ----------
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

interface TemplateRow {
  id: number;
  slug: string;
  name: string;
  enabled: boolean;
  audienceSegmentId: number;
  travelMomentId: number;
  priority: number;
  tripType: string;
  publicLabel: string | null;
  newsletterTag: string | null;
  maxPriceEur: number | null;
  minDiscountPct: number | null;
  psychologicalPriceThresholdEur: number | null;
  minAbsSavingsEur: number | null;
  maxStops: number | null;
  maxTotalDurationMinutes: number | null;
  contentAngle: string | null;
  suggestedHeadlineTemplate: string | null;
  tiktokHookTemplate: string | null;
}

interface TemplateFormProps {
  template: TemplateRow | null;
  audiences: AudienceRow[];
  moments: MomentRow[];
}

export function TemplateForm({ template, audiences, moments }: TemplateFormProps) {
  const isEdit = template !== null;
  const formRef = useRef<HTMLFormElement>(null);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);

    startTransition(async () => {
      try {
        await upsertDealTemplate(data);
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
        if (!isEdit) {
          formRef.current?.reset();
        }
      } catch {
        setSaveError(true);
        setTimeout(() => setSaveError(false), 2500);
      }
    });
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius-md)',
        padding: '20px 22px',
        display: 'flex',
        flexDirection: 'column',
        gap: 22,
        position: 'relative',
      }}
    >
      {/* Hidden id for edit mode */}
      {isEdit && (
        <input type="hidden" name="id" value={template.id} />
      )}

      {/* ── IDENTITY ───────────────────────────────────────────── */}
      <div className="sec" style={{ margin: 0 }}>
        <h4 style={eyebrowStyle}>Identity</h4>
        <div style={rowStyle}>
          <label style={labelStyle}>
            <span style={labelTextStyle}>Slug</span>
            <input
              name="slug"
              type="text"
              required
              defaultValue={template?.slug ?? ''}
              placeholder="e.g. vilnius-canary-winter"
              style={{ ...inputStyle, width: 220 }}
            />
          </label>

          <label style={labelStyle}>
            <span style={labelTextStyle}>Name</span>
            <input
              name="name"
              type="text"
              required
              defaultValue={template?.name ?? ''}
              placeholder="Canary Islands — Winter Escape"
              style={{ ...inputStyle, width: 260 }}
            />
          </label>

          <label style={labelStyle}>
            <span style={labelTextStyle}>Priority</span>
            <input
              name="priority"
              type="number"
              min={0}
              step={1}
              defaultValue={template?.priority ?? ''}
              placeholder="0"
              style={{ ...inputStyle, width: 88 }}
            />
          </label>

          <label style={labelStyle}>
            <span style={labelTextStyle}>Trip type</span>
            <select
              name="trip_type"
              defaultValue={template?.tripType ?? 'roundtrip'}
              style={{ ...inputStyle, width: 140 }}
            >
              <option value="roundtrip">Round trip</option>
              <option value="oneway">One way</option>
            </select>
          </label>

          <label style={labelStyle}>
            <span style={labelTextStyle}>Public label</span>
            <input
              name="public_label"
              type="text"
              defaultValue={template?.publicLabel ?? ''}
              placeholder="optional display name"
              style={{ ...inputStyle, width: 200 }}
            />
          </label>

          <label style={labelStyle}>
            <span style={labelTextStyle}>Newsletter tag</span>
            <input
              name="newsletter_tag"
              type="text"
              defaultValue={template?.newsletterTag ?? ''}
              placeholder="e.g. sun-escape"
              style={{ ...inputStyle, width: 160 }}
            />
          </label>
        </div>
      </div>

      {/* ── WHO ────────────────────────────────────────────────── */}
      <div className="sec" style={{ margin: 0 }}>
        <h4 style={eyebrowStyle}>Who</h4>
        <div style={rowStyle}>
          <label style={labelStyle}>
            <span style={labelTextStyle}>Audience segment</span>
            <select
              name="audience_segment_id"
              required
              defaultValue={template?.audienceSegmentId ?? ''}
              style={{ ...inputStyle, width: 220 }}
            >
              <option value="" disabled>Select audience…</option>
              {audiences.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* ── WHEN ───────────────────────────────────────────────── */}
      <div className="sec" style={{ margin: 0 }}>
        <h4 style={eyebrowStyle}>When</h4>
        <div style={rowStyle}>
          <label style={labelStyle}>
            <span style={labelTextStyle}>Travel moment</span>
            <select
              name="travel_moment_id"
              required
              defaultValue={template?.travelMomentId ?? ''}
              style={{ ...inputStyle, width: 220 }}
            >
              <option value="" disabled>Select moment…</option>
              {moments.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* ── WHAT'S CHEAP (TUNING KNOBS) ────────────────────────── */}
      <div className="sec" style={{ margin: 0 }}>
        <h4 style={eyebrowStyle}>What&rsquo;s cheap — tuning knobs</h4>
        <div style={rowStyle}>
          <label style={labelStyle}>
            <span style={labelTextStyle}>Max price (€)</span>
            <input
              name="max_price_eur"
              type="number"
              min={0}
              step={1}
              defaultValue={template?.maxPriceEur ?? ''}
              placeholder="—"
              style={{ ...inputStyle, width: 120 }}
            />
          </label>

          <label style={labelStyle}>
            <span style={labelTextStyle}>Min discount (%)</span>
            <input
              name="min_discount_pct"
              type="number"
              min={0}
              max={100}
              step={1}
              defaultValue={template?.minDiscountPct ?? ''}
              placeholder="—"
              style={{ ...inputStyle, width: 120 }}
            />
          </label>

          <label style={labelStyle}>
            <span style={labelTextStyle}>Psych. price threshold (€)</span>
            <input
              name="psychological_price_threshold_eur"
              type="number"
              min={0}
              step={1}
              defaultValue={template?.psychologicalPriceThresholdEur ?? ''}
              placeholder="—"
              style={{ ...inputStyle, width: 160 }}
            />
          </label>

          <label style={labelStyle}>
            <span style={labelTextStyle}>Min abs savings (€)</span>
            <input
              name="min_abs_savings_eur"
              type="number"
              min={0}
              step={1}
              defaultValue={template?.minAbsSavingsEur ?? ''}
              placeholder="—"
              style={{ ...inputStyle, width: 140 }}
            />
          </label>
        </div>
      </div>

      {/* ── ITINERARY PAIN ─────────────────────────────────────── */}
      <div className="sec" style={{ margin: 0 }}>
        <h4 style={eyebrowStyle}>Itinerary pain</h4>
        <div style={rowStyle}>
          <label style={labelStyle}>
            <span style={labelTextStyle}>Max stops</span>
            <input
              name="max_stops"
              type="number"
              min={0}
              max={5}
              step={1}
              defaultValue={template?.maxStops ?? ''}
              placeholder="—"
              style={{ ...inputStyle, width: 100 }}
            />
          </label>

          <label style={labelStyle}>
            <span style={labelTextStyle}>Max total duration (min)</span>
            <input
              name="max_total_duration_minutes"
              type="number"
              min={0}
              step={15}
              defaultValue={template?.maxTotalDurationMinutes ?? ''}
              placeholder="—"
              style={{ ...inputStyle, width: 160 }}
            />
          </label>
        </div>
      </div>

      {/* ── CONTENT ANGLE ──────────────────────────────────────── */}
      <div className="sec" style={{ margin: 0 }}>
        <h4 style={eyebrowStyle}>Content angle</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={labelStyle}>
            <span style={labelTextStyle}>Content angle</span>
            <textarea
              name="content_angle"
              className="draftbox"
              defaultValue={template?.contentAngle ?? ''}
              placeholder="What feeling/angle should copy lead with? E.g. 'Winter sun escape — lead with warmth and affordability'"
              style={{ minHeight: 72, resize: 'vertical' }}
            />
          </label>

          <label style={labelStyle}>
            <span style={labelTextStyle}>Suggested headline template</span>
            <textarea
              name="suggested_headline_template"
              className="draftbox"
              defaultValue={template?.suggestedHeadlineTemplate ?? ''}
              placeholder="E.g. '{{destination}} from €{{price}} return — {{month}}'"
              style={{ minHeight: 56, resize: 'vertical' }}
            />
          </label>

          <label style={labelStyle}>
            <span style={labelTextStyle}>TikTok hook template</span>
            <textarea
              name="tiktok_hook_template"
              className="draftbox"
              defaultValue={template?.tiktokHookTemplate ?? ''}
              placeholder="E.g. 'POV: you found €{{price}} flights to {{destination}} and it&apos;s actually real'"
              style={{ minHeight: 56, resize: 'vertical' }}
            />
          </label>
        </div>
      </div>

      {/* ── SUBMIT / FEEDBACK ──────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={isPending}
          style={isPending ? { opacity: 0.6, cursor: 'not-allowed' } : undefined}
        >
          {isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Create template'}
        </button>

        {saved && (
          <div
            className="toast"
            style={{
              position: 'static',
              transform: 'none',
              boxShadow: 'none',
              padding: '8px 14px',
              fontSize: 13,
            }}
          >
            <span style={{ color: 'var(--sea-300)', display: 'inline-flex' }}>
              <CheckCircle size={15} />
            </span>
            Saved
          </div>
        )}
        {saveError && (
          <div
            className="toast"
            style={{
              position: 'static',
              transform: 'none',
              boxShadow: 'none',
              padding: '8px 14px',
              fontSize: 13,
              background: 'var(--coral-600)',
            }}
          >
            <span style={{ color: '#fff', display: 'inline-flex' }}>
              <AlertTriangle size={15} />
            </span>
            Save failed — try again
          </div>
        )}
      </div>
    </form>
  );
}

// ---------- micro styles ----------
const eyebrowStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  letterSpacing: '.08em',
  textTransform: 'uppercase',
  color: 'var(--fg-3)',
  margin: '0 0 11px',
  fontWeight: 400,
};

const rowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 12,
  flexWrap: 'wrap',
  alignItems: 'flex-end',
};

const labelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 5,
};

const labelTextStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  letterSpacing: '.08em',
  textTransform: 'uppercase',
  color: 'var(--fg-3)',
};

const inputStyle: React.CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontSize: 14,
  padding: '9px 12px',
  border: '1.5px solid var(--line)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--bg-page)',
  color: 'var(--fg-1)',
  outline: 'none',
};
