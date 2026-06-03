'use client';

import { useTransition, useState } from 'react';
import { enqueueScan, enqueueRecheckLive } from '@/app/actions';
import { Icon } from '@/components/Icon';

export function ScanButtons() {
  const [isScanPending, startScanTransition] = useTransition();
  const [scanQueued, setScanQueued] = useState(false);
  const [scanError, setScanError] = useState(false);

  const [isRecheckPending, startRecheckTransition] = useTransition();
  const [recheckQueued, setRecheckQueued] = useState(false);
  const [recheckError, setRecheckError] = useState(false);

  function handleRunScan() {
    startScanTransition(async () => {
      try {
        await enqueueScan();
        setScanQueued(true);
        setTimeout(() => setScanQueued(false), 4000);
      } catch {
        setScanError(true);
        setTimeout(() => setScanError(false), 4000);
      }
    });
  }

  function handleRecheckLive() {
    startRecheckTransition(async () => {
      try {
        await enqueueRecheckLive();
        setRecheckQueued(true);
        setTimeout(() => setRecheckQueued(false), 4000);
      } catch {
        setRecheckError(true);
        setTimeout(() => setRecheckError(false), 4000);
      }
    });
  }

  return (
    <>
      <button
        className="btn btn-outline"
        onClick={handleRunScan}
        disabled={isScanPending}
        style={isScanPending ? { opacity: 0.6, cursor: 'not-allowed' } : undefined}
      >
        {isScanPending ? (
          <>
            <Icon name="Loader" size={16} /> Queuing…
          </>
        ) : scanError ? (
          <>
            <Icon name="AlertTriangle" size={16} /> Couldn&apos;t queue — try again
          </>
        ) : scanQueued ? (
          <>
            <Icon name="CheckCircle" size={16} /> Scan queued
          </>
        ) : (
          'Run scan'
        )}
      </button>

      <button
        className="btn btn-outline"
        onClick={handleRecheckLive}
        disabled={isRecheckPending}
        style={isRecheckPending ? { opacity: 0.6, cursor: 'not-allowed' } : undefined}
      >
        {isRecheckPending ? (
          <>
            <Icon name="Loader" size={16} /> Queuing…
          </>
        ) : recheckError ? (
          <>
            <Icon name="AlertTriangle" size={16} /> Couldn&apos;t queue — try again
          </>
        ) : recheckQueued ? (
          <>
            <Icon name="CheckCircle" size={16} /> Recheck queued
          </>
        ) : (
          'Recheck live deals'
        )}
      </button>
    </>
  );
}
