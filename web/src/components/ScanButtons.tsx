'use client';

import { useTransition, useState } from 'react';
import { enqueueScan } from '@/app/actions';
import { Icon } from '@/components/Icon';

export function ScanButtons() {
  const [isPending, startTransition] = useTransition();
  const [queued, setQueued] = useState(false);

  function handleRunScan() {
    startTransition(async () => {
      await enqueueScan();
      setQueued(true);
      setTimeout(() => setQueued(false), 4000);
    });
  }

  return (
    <>
      <button
        className="btn btn-outline"
        onClick={handleRunScan}
        disabled={isPending}
        style={isPending ? { opacity: 0.6, cursor: 'not-allowed' } : undefined}
      >
        {isPending ? (
          <>
            <Icon name="Loader" size={16} /> Queuing…
          </>
        ) : queued ? (
          <>
            <Icon name="CheckCircle" size={16} /> Scan queued
          </>
        ) : (
          'Run scan'
        )}
      </button>

      {/* "Recheck live deals" also enqueues a full scan — the Python worker
          re-evaluates all pending candidates in a single pass. */}
      <button
        className="btn btn-outline"
        onClick={handleRunScan}
        disabled={isPending}
        style={isPending ? { opacity: 0.6, cursor: 'not-allowed' } : undefined}
      >
        Recheck live deals
      </button>
    </>
  );
}
