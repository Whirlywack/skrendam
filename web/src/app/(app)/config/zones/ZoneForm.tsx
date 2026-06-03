'use client';

import { useRef, useState, useTransition } from 'react';
import { CheckCircle, AlertTriangle } from 'lucide-react';
import { upsertZone } from '@/app/config-actions';

interface ZoneRow {
  zone: string;
  haulType: string;
  thresholdPriceEur: number | null;
  minAbsSavingsEur: number | null;
  minDiscountPct: number | null;
}

interface ZoneFormProps {
  /** Existing row to edit, or null to create a new zone. */
  zone: ZoneRow | null;
}

export function ZoneForm({ zone }: ZoneFormProps) {
  const isEdit = zone !== null;
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
        await upsertZone(data);
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
      {/* Zone PK */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label style={labelStyle}>
          <span style={labelTextStyle}>Zone</span>
          <input
            name="zone"
            type="text"
            defaultValue={zone?.zone ?? ''}
            required
            readOnly={isEdit}
            placeholder="e.g. europe-short"
            style={{
              ...inputStyle,
              ...(isEdit ? readonlyStyle : {}),
            }}
          />
        </label>

        <label style={labelStyle}>
          <span style={labelTextStyle}>Haul type</span>
          <select
            name="haul_type"
            defaultValue={zone?.haulType ?? 'short'}
            style={inputStyle}
          >
            <option value="short">Short</option>
            <option value="medium">Medium</option>
            <option value="long">Long</option>
          </select>
        </label>

        <label style={labelStyle}>
          <span style={labelTextStyle}>Threshold price (€)</span>
          <input
            name="threshold_price_eur"
            type="number"
            min={0}
            step={1}
            defaultValue={zone?.thresholdPriceEur ?? ''}
            placeholder="—"
            style={inputStyle}
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
            defaultValue={zone?.minDiscountPct ?? ''}
            placeholder="—"
            style={inputStyle}
          />
        </label>

        <label style={labelStyle}>
          <span style={labelTextStyle}>Min abs savings (€)</span>
          <input
            name="min_abs_savings_eur"
            type="number"
            min={0}
            step={1}
            defaultValue={zone?.minAbsSavingsEur ?? ''}
            placeholder="—"
            style={inputStyle}
          />
        </label>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={isPending}
          style={isPending ? { opacity: 0.6, cursor: 'not-allowed' } : undefined}
        >
          {isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Create zone'}
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
