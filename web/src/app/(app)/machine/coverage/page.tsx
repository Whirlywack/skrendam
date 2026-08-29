import { listTemplates, listAudiences, listMoments } from '@/lib/config-queries';
import { ConfigShell } from '@/components/ConfigShell';

export const dynamic = 'force-dynamic';

type Template = Awaited<ReturnType<typeof listTemplates>>[number];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const mmdd = (s: string | null) => {
  if (!s) return '?';
  const [m, d] = s.split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}`;
};

const fdate = (s: string | null) => {
  if (!s) return '?';
  const d = new Date(s + 'T00:00:00');
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
};

function when(t: Template): { text: string; stale: boolean } {
  if (t.dateWindowType === 'seasonal') {
    const lead = t.relOffsetStartDays ? ` · booked ≥${t.relOffsetStartDays} d ahead` : '';
    return { text: `${mmdd(t.seasonStartMmdd)} – ${mmdd(t.seasonEndMmdd)}, every year${lead}`, stale: false };
  }
  if (t.dateWindowType === 'relative') {
    return { text: `${t.relOffsetStartDays ?? 0}–${t.relOffsetEndDays ?? 0} days from today`, stale: false };
  }
  // fixed: one-off dates that must be refreshed (e.g. school breaks per school year)
  const stale = t.fixedEndDate != null && new Date(t.fixedEndDate) < new Date();
  return { text: `${fdate(t.fixedStartDate)} – ${fdate(t.fixedEndDate)}`, stale };
}

function where(t: Template): string {
  const dests = t.includedDestinations as string[] | null;
  const zonesArr = t.includedZones as string[] | null;
  if (dests?.length) return dests.join(' ');
  if (zonesArr?.length) return zonesArr.map((z) => z.replaceAll('_', ' ').toLowerCase()).join(', ');
  return 'all routes';
}

function gates(t: Template): string {
  const parts: string[] = [];
  if (t.maxPriceEur != null) parts.push(`≤ €${t.maxPriceEur}`);
  if (t.minDiscountPct != null) parts.push(`≥ ${t.minDiscountPct}% off`);
  else parts.push('zone % off');
  if (t.psychologicalPriceThresholdEur != null) parts.push(`psych ≤ €${t.psychologicalPriceThresholdEur}`);
  if (t.minDepartureDates != null) parts.push(`≥ ${t.minDepartureDates} dates`);
  return parts.join(' · ');
}

function trip(t: Template): string {
  const len =
    t.tripLenMinDays != null
      ? ` ${t.tripLenMinDays}${t.tripLenMaxDays != null ? `–${t.tripLenMaxDays}` : ''} d`
      : '';
  const days = (t.preferredDepartureDays as string[] | null)?.length
    ? ` · departs ${(t.preferredDepartureDays as string[]).join('/')}`
    : '';
  return `${t.tripType === 'roundtrip' ? 'return' : 'one-way'}${len}${days}`;
}

const th: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  letterSpacing: '.08em',
  textTransform: 'uppercase',
  color: 'var(--fg-3)',
  textAlign: 'left',
  padding: '8px 14px 8px 0',
  borderBottom: '1px solid var(--line)',
  whiteSpace: 'nowrap',
};

const td: React.CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontSize: 13,
  padding: '9px 14px 9px 0',
  borderBottom: '1px solid var(--line)',
  verticalAlign: 'top',
};

export default async function CoveragePage() {
  const [tmpls, moments, audiences] = await Promise.all([
    listTemplates(),
    listMoments(),
    listAudiences(),
  ]);
  const momentById = new Map(moments.map((m) => [m.id, m]));
  const audById = new Map(audiences.map((a) => [a.id, a]));
  // group templates under their moment, moments in seed order
  const byMoment = new Map<number, Template[]>();
  for (const t of tmpls) {
    byMoment.set(t.travelMomentId, [...(byMoment.get(t.travelMomentId) ?? []), t]);
  }

  return (
    <ConfigShell title="Coverage — which deals cover what">
      <p style={{ fontSize: 13, color: 'var(--fg-3)', marginTop: 0, marginBottom: 4, maxWidth: 720 }}>
        The scanner&apos;s full coverage map: every travel moment, the template(s) that serve it,
        when they scan, where they look, and the price gates a fare must clear. Fixed-date rows
        (school breaks) need new dates each school year — stale ones are flagged.
      </p>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 900 }}>
          <thead>
            <tr>
              <th style={th}>Moment</th>
              <th style={th}>Template</th>
              <th style={th}>When it scans</th>
              <th style={th}>Where</th>
              <th style={th}>Trip</th>
              <th style={th}>Price gates</th>
              <th style={th}>Audience</th>
              <th style={th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {[...byMoment.entries()].map(([momentId, list]) =>
              list.map((t, i) => {
                const w = when(t);
                const status = !t.enabled ? 'off' : w.stale ? 'dates passed' : 'live';
                return (
                  <tr key={t.id}>
                    <td style={{ ...td, whiteSpace: 'nowrap', fontWeight: 600 }}>
                      {i === 0 ? (momentById.get(momentId)?.name ?? momentId) : ''}
                    </td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>
                      {t.name}
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-3)' }}>
                        {t.slug}
                      </div>
                    </td>
                    <td style={td}>{w.text}</td>
                    <td style={{ ...td, maxWidth: 260 }}>{where(t)}</td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>{trip(t)}</td>
                    <td style={td}>{gates(t)}</td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>
                      {audById.get(t.audienceSegmentId)?.name ?? '—'}
                    </td>
                    <td
                      style={{
                        ...td,
                        whiteSpace: 'nowrap',
                        color:
                          status === 'live'
                            ? 'var(--ok, #2e7d32)'
                            : status === 'dates passed'
                              ? 'var(--amber-700)'
                              : 'var(--fg-3)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11,
                      }}
                    >
                      {status}
                    </td>
                  </tr>
                );
              }),
            )}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 14, maxWidth: 720 }}>
        Notes: a fare can match several templates at once (e.g. an autumn-break Cyprus fare files
        under both School holidays and Last warm days) — the Review queue shows it under each.
        &ldquo;zone % off&rdquo; means the template inherits its discount gate from the
        route&apos;s zone. Windows and gates are edited on the Templates tab.
      </p>
    </ConfigShell>
  );
}
