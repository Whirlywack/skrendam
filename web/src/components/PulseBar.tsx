const MONO: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
};

/**
 * One-line system pulse rendered at the top of every page: when the machine
 * last ran, when it runs next, and whether anything is queued. Answers
 * "is the robot OK?" without a page visit (X1 in the redesign plan).
 */
export function PulseBar({
  scanAgo,
  scanHealthy,
  runningSince,
  queued,
}: {
  scanAgo: string;
  scanHealthy: boolean;
  /** Local HH:MM a newer scan has been running since; null when idle. */
  runningSince: string | null;
  queued: number;
}) {
  // The daily scan fires at 06:00 local (launchd); "next" is informational.
  const nextScan = new Date().getHours() < 6 ? 'today 06:00' : 'tomorrow 06:00';
  return (
    <div
      style={{
        display: 'flex',
        gap: 16,
        alignItems: 'center',
        justifyContent: 'flex-end',
        padding: '8px 28px',
        borderBottom: '1px solid var(--line)',
        background: 'var(--bg-surface)',
      }}
    >
      <span
        style={{ ...MONO, color: scanHealthy ? 'var(--sea-600)' : 'var(--coral-600)' }}
        title={scanHealthy ? 'Last finished scan was healthy' : 'Last finished scan was not healthy — see Scan health'}
      >
        scan {scanAgo} {scanHealthy ? '✓' : '⚠'}
      </span>
      {runningSince && (
        <span style={{ ...MONO, color: 'var(--amber-700)' }}>scan running since {runningSince}</span>
      )}
      <span style={{ ...MONO, color: 'var(--fg-3)' }}>next {nextScan}</span>
      <span style={{ ...MONO, color: queued > 0 ? 'var(--amber-700)' : 'var(--fg-3)' }}>
        {queued > 0 ? `${queued} queued` : 'queue idle'}
      </span>
    </div>
  );
}
