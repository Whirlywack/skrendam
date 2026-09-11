'use client';

import { useFormStatus } from 'react-dom';
import { Icon } from '@/components/Icon';

/**
 * Submit button of the two Assemble forms on the Letters page. The form's
 * action is a server action (`assembleIssue`) that queries the dev DB and
 * then redirects — a second or more with nothing on screen, which is how the
 * 2026-09-11 journey review read a click as a silent no-op. `useFormStatus`
 * reads the enclosing form's pending state, so the button says "Assembling…"
 * and refuses a second click until the redirect lands (on the new draft, or
 * back here with the empty banner).
 */
export function AssembleButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className="btn btn-outline"
      disabled={pending}
      aria-busy={pending}
      style={pending ? { opacity: 0.6, cursor: 'not-allowed' } : { cursor: 'pointer' }}
    >
      {pending ? (
        <>
          <Icon name="Loader" size={16} /> Assembling…
        </>
      ) : (
        label
      )}
    </button>
  );
}
