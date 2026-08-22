'use client';

import { useState, useTransition } from 'react';
import { enqueueRecheck } from '@/app/actions';

export function RecheckButton({ candidateId }: { candidateId: number }) {
  const [pending, startTransition] = useTransition();
  const [queued, setQueued] = useState(false);

  return (
    <button
      className="btn btn-outline"
      disabled={pending || queued}
      style={{
        borderColor: 'var(--coral-100)',
        color: 'var(--coral-600)',
        ...(pending || queued ? { opacity: 0.6, cursor: 'default' } : {}),
      }}
      onClick={() =>
        startTransition(async () => {
          await enqueueRecheck(candidateId);
          setQueued(true);
        })
      }
    >
      {queued ? 'Recheck queued ✓' : pending ? 'Queuing…' : 'Recheck price'}
    </button>
  );
}
