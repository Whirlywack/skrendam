import { listMoments } from '@/lib/config-queries';
import { ConfigShell } from '@/components/ConfigShell';
import { MomentForm } from './MomentForm';

export default async function MomentsPage() {
  const rows = await listMoments();

  return (
    <ConfigShell title="Travel moments">
      <p style={{ fontSize: 13, color: 'var(--fg-3)', marginTop: 0, marginBottom: 6 }}>
        Travel moments describe the travel context for a deal — the timing pattern and the
        copywriting angle the curator uses when a template matches.{' '}
        <strong style={{ color: 'var(--fg-2)' }}>moment_type</strong> controls whether the window
        is computed relative to now, from a seasonal range, or from fixed dates.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 24 }}>
        {rows.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--fg-3)' }}>No moments yet. Add one below.</p>
        )}
        {rows.map((row) => (
          <MomentForm key={row.id} moment={row} />
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
            New moment
          </div>
          <MomentForm moment={null} />
        </div>
      </div>
    </ConfigShell>
  );
}
