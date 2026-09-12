'use client';
import { useState, useTransition } from 'react';
import type { FormEvent } from 'react';
import { subscribeAction } from '@/app/subscribe-action';
import { S } from '@/lib/lt';

/**
 * The one subscribe-form state machine shared by every inline signup form
 * (InkBand, CaptureRow, MobileCapture): submit the form's FormData to
 * `subscribeAction`, flip `done` on success, surface the server's error
 * (or the generic one) otherwise. The form markup stays in each component.
 */
export function useSubscribeForm() {
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    start(async () => {
      const res = await subscribeAction(data);
      if (res && res.ok) { setDone(true); setError(null); }
      else if (res && !res.ok) setError(res.error ?? S.genericError);
    });
  }

  return { done, error, pending, onSubmit };
}
