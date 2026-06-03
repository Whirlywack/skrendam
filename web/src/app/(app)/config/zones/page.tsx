import { listZones } from '@/lib/config-queries';
import { ConfigShell } from '@/components/ConfigShell';
import { ZoneForm } from './ZoneForm';

export default async function ZonesPage() {
  const rows = await listZones();

  return (
    <ConfigShell title="Zones">
      <p style={{ fontSize: 13, color: 'var(--fg-3)', marginTop: 0, marginBottom: 6 }}>
        <strong style={{ color: 'var(--fg-2)' }}>threshold_price_eur</strong> is the one-way price
        ceiling for routes in this zone — deals above it will not score as &quot;cheap&quot;.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 24 }}>
        {rows.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--fg-3)' }}>No zones yet. Add one below.</p>
        )}
        {rows.map((row) => (
          <ZoneForm key={row.zone} zone={row} />
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
            New zone
          </div>
          <ZoneForm zone={null} />
        </div>
      </div>
    </ConfigShell>
  );
}
