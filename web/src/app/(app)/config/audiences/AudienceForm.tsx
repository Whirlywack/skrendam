'use client';

import { useRef, useState, useTransition } from 'react';
import { CheckCircle, AlertTriangle } from 'lucide-react';
import { upsertAudience } from '@/app/config-actions';

interface AudienceRow {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  defaultItineraryTolerance: string;
}

interface AudienceFormProps {
  /** Existing row to edit, or null to create a new audience. */
  audience: AudienceRow | null;
}

export function AudienceForm({ audience }: AudienceFormProps) {
  const isEdit = audience !== null;
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
        await upsertAudience(data);
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
        padding: '18px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        position: 'relative',
      }}
    >
      {/* Hidden id for edits */}
      {isEdit && <input type="hidden" name="id" value={audience.id} />}

      {/* Row 1: slug + name + tolerance */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label style={labelStyle}>
          <span style={labelTextStyle}>Slug</span>
          <input
            name="slug"
            type="text"
            defaultValue={audience?.slug ?? ''}
            required
            readOnly={isEdit}
            placeholder="e.g. budget-hunters"
            style={{
              ...inputStyle,
              width: 200,
              ...(isEdit ? readonlyStyle : {}),
            }}
          />
        </label>

        <label style={labelStyle}>
          <span style={labelTextStyle}>Name</span>
          <input
            name="name"
            type="text"
            defaultValue={audience?.name ?? ''}
            required
            placeholder="e.g. Budget hunters"
            style={{ ...inputStyle, width: 220 }}
          />
        </label>

        <label style={labelStyle}>
          <span style={labelTextStyle}>Default itinerary tolerance</span>
          <select
            name="default_itinerary_tolerance"
            defaultValue={audience?.defaultItineraryTolerance ?? 'normal'}
            style={{ ...inputStyle, width: 160 }}
          >
            <option value="strict">Strict</option>
            <option value="normal">Normal</option>
            <option value="relaxed">Relaxed</option>
          </select>
        </label>
      </div>

      {/* Row 2: description */}
      <label style={{ ...labelStyle, width: '100%' }}>
        <span style={labelTextStyle}>Description</span>
        <textarea
          name="description"
          defaultValue={audience?.description ?? ''}
          placeholder="Audience description (optional)"
          rows={2}
          style={{
            ...inputStyle,
            width: '100%',
            resize: 'vertical',
            fontFamily: 'var(--font-body)',
            lineHeight: 1.5,
          }}
        />
      </label>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={isPending}
          style={isPending ? { opacity: 0.6, cursor: 'not-allowed' } : undefined}
        >
          {isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Create audience'}
        </button>

        {saved && (
          <div
            className="toast"
            style={{ position: 'static', transform: 'none', boxShadow: 'none', padding: '8px 14px', fontSize: 13 }}
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
            style={{ position: 'static', transform: 'none', boxShadow: 'none', padding: '8px 14px', fontSize: 13, background: 'var(--coral-600)' }}
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
  width: 160,
};

const readonlyStyle: React.CSSProperties = {
  background: 'var(--bg-sunken)',
  color: 'var(--fg-2)',
  cursor: 'default',
  border: '1.5px solid var(--line-soft)',
};
