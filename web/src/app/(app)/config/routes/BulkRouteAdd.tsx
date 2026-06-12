'use client';

import { useState, useTransition } from 'react';
import { parseBulkRoutes } from '@/lib/bulk-routes';
import { bulkAddRoutes, type BulkAddSummary } from '@/app/config-actions';

export function BulkRouteAdd({ zones }: { zones: { zone: string }[] }) {
  const [text, setText] = useState('');
  const [result, setResult] = useState<BulkAddSummary | null>(null);
  const [isPending, startTransition] = useTransition();

  const preview = text.trim() ? parseBulkRoutes(text, zones.map((z) => z.zone)) : null;

  function handleAdd() {
    const form = new FormData();
    form.set('routes_text', text);
    startTransition(async () => {
      setResult(await bulkAddRoutes(form));
      setText('');
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: '.08em',
          textTransform: 'uppercase',
          color: 'var(--fg-3)',
        }}
      >
        Bulk add — one per line: origin,destination,zone[,core]
      </div>
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setResult(null);
        }}
        rows={8}
        placeholder={'VNO,FAO,MEDITERRANEAN\nKUN,DUB,CITY_BREAKS,core'}
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 13,
          padding: '10px 12px',
          border: '1.5px solid var(--line)',
          borderRadius: 'var(--radius-sm)',
          background: 'var(--bg-page)',
          color: 'var(--fg-1)',
          outline: 'none',
          resize: 'vertical',
        }}
      />
      {preview && (
        <div style={{ fontSize: 13, color: 'var(--fg-2)' }}>
          {preview.routes.length} valid route{preview.routes.length === 1 ? '' : 's'} ready
          {preview.issues.length > 0 && (
            <ul style={{ margin: '6px 0 0', paddingLeft: 18, color: 'var(--coral-600)' }}>
              {preview.issues.map((i) => (
                <li key={i.line}>
                  line {i.line}: {i.problem}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          type="button"
          className="btn btn-primary"
          disabled={isPending || !preview || preview.routes.length === 0}
          onClick={handleAdd}
          style={isPending || !preview || preview.routes.length === 0 ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
        >
          {isPending ? 'Adding…' : `Add ${preview?.routes.length ?? 0} routes`}
        </button>
        {result && (
          <span style={{ fontSize: 13, color: 'var(--fg-2)' }}>
            Inserted {result.inserted}
            {result.skippedExisting.length > 0 &&
              ` — skipped ${result.skippedExisting.length} existing (untouched)`}
          </span>
        )}
      </div>
    </div>
  );
}
