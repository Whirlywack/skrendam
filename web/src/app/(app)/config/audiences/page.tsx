import { listAudiences } from '@/lib/config-queries';
import { ConfigShell } from '@/components/ConfigShell';
import { AudienceForm } from './AudienceForm';

export default async function AudiencesPage() {
  const rows = await listAudiences();

  return (
    <ConfigShell title="Audiences">
      <p style={{ fontSize: 13, color: 'var(--fg-3)', marginTop: 0, marginBottom: 6 }}>
        Audience segments define who a deal targets.{' '}
        <strong style={{ color: 'var(--fg-2)' }}>default_itinerary_tolerance</strong> controls how
        strictly the engine filters stopovers and long layovers for this audience.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 24 }}>
        {rows.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--fg-3)' }}>No audiences yet. Add one below.</p>
        )}
        {rows.map((row) => (
          <AudienceForm key={row.id} audience={row} />
        ))}

        {/* Create form */}
        <div
          style={{
            borderTop: '1px solid var(--line)',
            paddingTop: 18,
            marginTop: 6,
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '.08em',
              textTransform: 'uppercase',
              color: 'var(--fg-3)',
              marginBottom: 12,
            }}
          >
            New audience
          </div>
          <AudienceForm audience={null} />
        </div>
      </div>
    </ConfigShell>
  );
}
