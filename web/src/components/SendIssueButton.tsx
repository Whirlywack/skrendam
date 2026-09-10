'use client';

import { useState, useTransition } from 'react';
import { sendIssue } from '@/app/letters-actions';

/**
 * The Send button of a letter preview. Sending is irreversible and reaches
 * every active subscriber on the plan, so it asks once — first click arms,
 * second click commits, blur disarms — the same shape as `Dismiss group…` in
 * QueueBoard and the plan flip in PlanToggle.
 */
export function SendIssueButton({ id, audience }: { id: number; audience: string }) {
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  function send() {
    setConfirming(false);
    startTransition(() => sendIssue(id));
  }

  return (
    <button
      type="button"
      className="btn btn-primary"
      onClick={() => (confirming ? send() : setConfirming(true))}
      onBlur={() => setConfirming(false)}
      disabled={isPending}
      style={{
        cursor: isPending ? 'default' : 'pointer',
        background: confirming ? 'var(--coral-600)' : undefined,
      }}
    >
      {isPending ? 'Sending…' : confirming ? `Send to ${audience} now?` : 'Send…'}
    </button>
  );
}
