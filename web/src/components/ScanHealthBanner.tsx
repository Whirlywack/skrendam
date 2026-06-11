export function ScanHealthBanner({ status, reasons }: { status: string; reasons: string[] }) {
  if (status !== 'degraded' && status !== 'failed') return null;
  return (
    <div className="scan-health-banner" role="alert">
      <strong>{status === 'failed' ? 'Last scan failed' : 'Last scan degraded'}</strong>
      <span> — its results are not a trustworthy picture of the market. Avoid bulk rechecks.</span>
      {reasons.length > 0 && (
        <ul>
          {reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
