'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        gap: 20,
        background: 'var(--bg-surface)',
        padding: '40px 24px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 800,
          fontSize: 22,
          color: 'var(--coral-600)',
        }}
      >
        Something went wrong
      </div>
      <p style={{ color: 'var(--fg-2)', fontSize: 14, maxWidth: 360, margin: 0 }}>
        {error.digest
          ? `There was a problem loading this page (ref: ${error.digest}). Please try again.`
          : 'There was a problem loading this page. Please try again.'}
      </p>
      <button className="btn btn-primary" onClick={reset}>
        Reload
      </button>
    </div>
  );
}
