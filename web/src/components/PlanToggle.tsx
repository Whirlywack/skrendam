'use client';

import { useState, useTransition } from 'react';
import { setPlan } from '@/app/subscribers-actions';
import type { Plan } from '@/lib/subscribers';

/**
 * Plan cell of the Subscribers table: the current plan plus a flip button.
 * The flip is a manual, unaudited write (no payment webhook in this phase),
 * so it asks once — first click arms, second click commits, blur disarms —
 * the same shape as `Dismiss group…` in QueueBoard.
 */
export function PlanToggle({ id, plan }: { id: number; plan: string }) {
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();
  const next: Plan = plan === 'paid' ? 'free' : 'paid';

  function flip() {
    setConfirming(false);
    startTransition(() => setPlan(id, next));
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 8, whiteSpace: 'nowrap' }}>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          fontWeight: plan === 'paid' ? 700 : 400,
          color: plan === 'paid' ? 'var(--ok, #2e7d32)' : 'var(--fg-2)',
        }}
      >
        {plan}
      </span>
      <button
        type="button"
        onClick={() => (confirming ? flip() : setConfirming(true))}
        onBlur={() => setConfirming(false)}
        disabled={isPending}
        style={{
          border: 'none',
          background: 'none',
          cursor: isPending ? 'default' : 'pointer',
          padding: 0,
          fontFamily: 'var(--font-body)',
          fontSize: 12,
          fontWeight: 600,
          color: confirming ? 'var(--coral-600)' : 'var(--fg-3)',
        }}
      >
        {isPending ? 'Saving…' : confirming ? `Make ${next}?` : `→ ${next}…`}
      </button>
    </span>
  );
}
