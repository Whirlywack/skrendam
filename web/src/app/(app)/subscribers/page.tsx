import { ConfigShell } from '@/components/ConfigShell';
import { PlanToggle } from '@/components/PlanToggle';
import { listSubscribers, prefsOf, referralCounts } from '@/lib/subscribers-queries';
import { refCode } from '@/lib/refcode';

export const dynamic = 'force-dynamic';

/** `2026-09-10` from either timestamp flavour (`created_at` has no zone,
 *  `unsubscribed_at` does); '—' for null. Day precision is what the curator
 *  needs here — when someone joined or left, not the minute. */
const day = (ts: string | null) => (ts ? ts.slice(0, 10) : '—');

const strList = (v: unknown): string =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').join(' ') || '—' : '—';

const utmSource = (prefs: Record<string, unknown>): string => {
  const utm = prefs.utm;
  const src = typeof utm === 'object' && utm !== null ? (utm as Record<string, unknown>).source : null;
  return typeof src === 'string' && src !== '' ? src : '—';
};

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

const mono: React.CSSProperties = { ...td, fontFamily: 'var(--font-mono)', fontSize: 11, whiteSpace: 'nowrap' };

export default async function SubscribersPage() {
  const rows = await listSubscribers();
  const referrals = referralCounts(rows);
  const total = rows.length;
  const confirmed = rows.filter((r) => r.confirmed).length;
  const paid = rows.filter((r) => r.plan === 'paid').length;
  const unsubscribed = rows.filter((r) => r.unsubscribedAt != null).length;

  return (
    <ConfigShell title="Subscribers">
      <p style={{ fontSize: 13, color: 'var(--fg-3)', marginTop: 0, marginBottom: 4, maxWidth: 720 }}>
        Everyone who signed up, newest first, with the choices they made at signup. The plan flip is
        manual for now (no payment webhook): when a payment lands, flip that row to paid here.
      </p>
      <p
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          letterSpacing: '.04em',
          color: 'var(--fg-2)',
          margin: '0 0 12px',
        }}
      >
        {total} total · {confirmed} confirmed · {paid} paid · {unsubscribed} unsubscribed
      </p>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 1000 }}>
          <thead>
            <tr>
              <th style={th}>Email</th>
              <th style={th}>Plan</th>
              <th style={th}>Confirmed</th>
              <th style={th}>Moments</th>
              <th style={th}>Origins</th>
              <th style={th}>utm.source</th>
              <th style={th}>Founding</th>
              <th style={th}>Referrals</th>
              <th style={th}>Created</th>
              <th style={th}>Unsubscribed</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td style={{ ...td, color: 'var(--fg-3)' }} colSpan={10}>
                  No subscribers yet.
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const prefs = prefsOf(r);
              const gone = r.unsubscribedAt != null;
              return (
                <tr key={r.id} style={gone ? { color: 'var(--fg-3)' } : undefined}>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>{r.email}</td>
                  <td style={td}>
                    <PlanToggle id={r.id} plan={r.plan} />
                  </td>
                  <td style={mono}>{r.confirmed ? 'yes' : 'no'}</td>
                  <td style={{ ...td, maxWidth: 220 }}>{strList(prefs.moments)}</td>
                  <td style={mono}>{strList(prefs.origins)}</td>
                  <td style={mono}>{utmSource(prefs)}</td>
                  <td style={mono}>{prefs.founding_interest === true ? 'yes' : '—'}</td>
                  <td style={mono}>{referrals.get(refCode(r.id)) ?? 0}</td>
                  <td style={mono}>{day(r.createdAt)}</td>
                  <td style={mono}>{day(r.unsubscribedAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </ConfigShell>
  );
}
