// Real itinerary_snapshot keys (from skrendam/fli_adapter/live_backend.py + fare.raw):
//   stops, duration (total minutes), legs, self_transfer, mixed_cabin
// airport_change and overnight_layover are NOT stored in fare.raw — omitted.
type Snap = {
  stops?: number;
  duration?: number; // total minutes (stored as "duration" in raw, not duration_minutes)
  self_transfer?: boolean;
  mixed_cabin?: boolean;
};

export function Itinerary({ snapshot, airline }: { snapshot: unknown; airline: string }) {
  const s = (snapshot ?? {}) as Snap;
  const stops = Number(s.stops ?? 0);
  const totalMin = Number(s.duration ?? 0);
  const dur = totalMin > 0
    ? `${Math.floor(totalMin / 60)}h${String(totalMin % 60).padStart(2, '0')}`
    : null;

  const summary = `${stops === 0 ? 'Direct' : `${stops} stop${stops > 1 ? 's' : ''}`}${dur ? ` · ${dur} total` : ''} · ${airline}`;

  // The catch (coral) — only show issues that are actually present
  const catches: string[] = [];
  if (stops >= 1) catches.push(`${stops} stop${stops > 1 ? 's' : ''} — not a direct flight`);
  if (s.self_transfer) catches.push('Self-transfer — you re-check bags + bear the risk of a missed connection');
  if (s.mixed_cabin) catches.push('Mixed cabin across legs');

  // The all-clear (sea) — the good news
  const clears: string[] = [];
  if (!s.self_transfer) clears.push('No self-transfer risk');
  if (!s.mixed_cabin) clears.push('Single cabin');

  return (
    <div className="sec">
      <h3>Your itinerary &middot; {summary}</h3>
      {catches.map((c, i) => (
        <div key={i} className="flag flag-bad">The catch: {c}</div>
      ))}
      {clears.length > 0 && (
        <div className="flag flag-ok">{clears.join(' · ')}.</div>
      )}
    </div>
  );
}
