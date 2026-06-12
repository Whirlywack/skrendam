'use client';

import { useRef, useState, useTransition } from 'react';
import { CheckCircle, AlertTriangle } from 'lucide-react';
import { upsertRoute, toggleRouteEnabled } from '@/app/config-actions';

interface ZoneOption {
  zone: string;
}

interface RouteRow {
  id: number;
  origin: string;
  destination: string;
  zone: string;
  enabled: boolean;
  cabin: string;
  core: boolean;
}

interface RouteFormProps {
  /** Existing row to edit, or null to create a new route. */
  route: RouteRow | null;
  zones: ZoneOption[];
}

export function RouteForm({ route, zones }: RouteFormProps) {
  const isEdit = route !== null;
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
        await upsertRoute(data);
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
    <div
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
      }}
    >
      {/* ── Row header (edit only): enabled pill + enable/disable toggle ── */}
      {isEdit && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '12px 18px',
            borderBottom: '1px solid var(--line-soft)',
            background: 'var(--bg-sunken)',
          }}
        >
          {/* Origin → Destination label */}
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
              fontWeight: 700,
              color: 'var(--fg-1)',
              letterSpacing: '.04em',
            }}
          >
            {route.origin} → {route.destination}
          </span>

          {/* Cabin chip */}
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: 'var(--amber-700)',
              background: 'var(--amber-50)',
              padding: '3px 8px',
              borderRadius: 'var(--radius-pill)',
              border: '1px solid var(--amber-100)',
              flex: 'none',
            }}
          >
            {route.cabin}
          </span>

          {/* Core pill — amber, only when route.core */}
          {route.core && (
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '.06em',
                textTransform: 'uppercase',
                padding: '3px 8px',
                borderRadius: 'var(--radius-pill)',
                background: 'var(--amber-50)',
                color: 'var(--amber-700)',
                border: '1px solid var(--amber-100)',
                flex: 'none',
              }}
            >
              core
            </span>
          )}

          {/* Enabled pill */}
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '.06em',
              textTransform: 'uppercase',
              padding: '3px 8px',
              borderRadius: 'var(--radius-pill)',
              background: route.enabled ? 'var(--sea-50)' : 'var(--sand-100)',
              color: route.enabled ? 'var(--sea-700)' : 'var(--sand-500)',
              border: route.enabled ? '1px solid var(--sea-200)' : '1px solid var(--sand-200)',
              flex: 'none',
            }}
          >
            {route.enabled ? 'on' : 'off'}
          </span>

          <div style={{ flex: 1 }} />

          {/* Enable/disable mini-form — matches toggleRouteEnabled's form.get('id') + form.get('enabled') */}
          <form action={toggleRouteEnabled}>
            <input type="hidden" name="id" value={route.id} />
            <input type="hidden" name="enabled" value={String(route.enabled)} />
            <button
              type="submit"
              className="btn btn-outline"
              style={{ fontSize: 12, padding: '6px 12px' }}
            >
              {route.enabled ? 'Disable' : 'Enable'}
            </button>
          </form>
        </div>
      )}

      {/* ── Edit / create form ── */}
      <form
        ref={formRef}
        onSubmit={handleSubmit}
        style={{
          padding: '18px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        {/* Hidden id for edits */}
        {isEdit && <input type="hidden" name="id" value={route.id} />}

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label style={labelStyle}>
            <span style={labelTextStyle}>Origin</span>
            <input
              name="origin"
              type="text"
              defaultValue={route?.origin ?? ''}
              required
              placeholder="VNO"
              maxLength={4}
              style={{
                ...inputStyle,
                width: 100,
                textTransform: 'uppercase',
              }}
            />
          </label>

          <label style={labelStyle}>
            <span style={labelTextStyle}>Destination</span>
            <input
              name="destination"
              type="text"
              defaultValue={route?.destination ?? ''}
              required
              placeholder="LHR"
              maxLength={4}
              style={{
                ...inputStyle,
                width: 100,
                textTransform: 'uppercase',
              }}
            />
          </label>

          <label style={labelStyle}>
            <span style={labelTextStyle}>Zone</span>
            <select
              name="zone"
              defaultValue={route?.zone ?? ''}
              required
              style={{ ...inputStyle, width: 180 }}
            >
              <option value="" disabled>
                — select zone —
              </option>
              {zones.map((z) => (
                <option key={z.zone} value={z.zone}>
                  {z.zone}
                </option>
              ))}
            </select>
          </label>

          <label style={labelStyle}>
            <span style={labelTextStyle}>Cabin</span>
            <select
              name="cabin"
              defaultValue={route?.cabin ?? 'ECONOMY'}
              style={{ ...inputStyle, width: 180 }}
            >
              <option value="ECONOMY">Economy</option>
              <option value="PREMIUM_ECONOMY">Premium economy</option>
              <option value="BUSINESS">Business</option>
              <option value="FIRST">First</option>
            </select>
          </label>

          <label
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 5,
              justifyContent: 'flex-end',
            }}
          >
            <span style={labelTextStyle}>Core</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, height: 38 }}>
              <input
                type="checkbox"
                name="core"
                defaultChecked={route?.core ?? false}
                style={{ width: 15, height: 15, accentColor: 'var(--brand)', cursor: 'pointer' }}
              />
              <span
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 12,
                  color: 'var(--fg-3)',
                }}
              >
                Core routes scan every day; others rotate.
              </span>
            </div>
          </label>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isPending}
            style={isPending ? { opacity: 0.6, cursor: 'not-allowed' } : undefined}
          >
            {isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Create route'}
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
    </div>
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
