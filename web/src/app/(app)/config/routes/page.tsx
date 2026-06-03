import { listRoutes, listZones } from '@/lib/config-queries';
import { ConfigShell } from '@/components/ConfigShell';
import { RouteForm } from './RouteForm';

export default async function RoutesPage() {
  const [rows, zoneRows] = await Promise.all([listRoutes(), listZones()]);

  return (
    <ConfigShell title="Routes">
      <p style={{ fontSize: 13, color: 'var(--fg-3)', marginTop: 0, marginBottom: 6 }}>
        Routes define the origin–destination pairs the engine scans. Each route belongs to a{' '}
        <strong style={{ color: 'var(--fg-2)' }}>zone</strong> (inheriting its price thresholds)
        and a cabin class. Disabled routes are skipped during scanning.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 24 }}>
        {rows.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--fg-3)' }}>No routes yet. Add one below.</p>
        )}
        {rows.map((row) => (
          <RouteForm key={row.id} route={row} zones={zoneRows} />
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
            New route
          </div>
          <RouteForm route={null} zones={zoneRows} />
        </div>
      </div>
    </ConfigShell>
  );
}
