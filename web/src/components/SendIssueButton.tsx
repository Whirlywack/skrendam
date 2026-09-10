'use client';

import { useState, useTransition } from 'react';
import { sendIssue } from '@/app/letters-actions';
import { SEND_REFUSAL_TEXT, type SendRefusal } from '@/lib/letters';

/**
 * The Send button of a letter preview. Sending is irreversible and reaches
 * every active subscriber on the plan, so it asks once — first click arms,
 * second click commits, blur disarms — the same shape as `Dismiss group…` in
 * QueueBoard and the plan flip in PlanToggle. A refusal (already sent from
 * another tab, no live deals left, no Resend key) is shown next to the
 * button, not thrown to the error boundary.
 */
export function SendIssueButton({ id, audience }: { id: number; audience: string }) {
  const [confirming, setConfirming] = useState(false);
  const [refusal, setRefusal] = useState<SendRefusal | null>(null);
  const [isPending, startTransition] = useTransition();

  function send() {
    setConfirming(false);
    setRefusal(null);
    startTransition(async () => {
      const out = await sendIssue(id);
      if (!out.ok) setRefusal(out.reason);
    });
  }

  return (
    <>
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
      {refusal && (
        <span role="status" style={{ fontSize: 13, color: 'var(--coral-600)' }}>
          {SEND_REFUSAL_TEXT[refusal]}
        </span>
      )}
    </>
  );
}
