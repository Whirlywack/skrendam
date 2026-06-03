import { listTemplates, listAudiences, listMoments } from '@/lib/config-queries';
import { ConfigShell } from '@/components/ConfigShell';
import { TemplateForm } from './TemplateForm';
import { TemplateRow } from './TemplateRow';

export default async function TemplatesPage() {
  const [tmpls, auds, moments] = await Promise.all([
    listTemplates(),
    listAudiences(),
    listMoments(),
  ]);

  return (
    <ConfigShell title="Deal templates">
      <p style={{ fontSize: 13, color: 'var(--fg-3)', marginTop: 0, marginBottom: 6 }}>
        Each template defines a deal archetype — the audience, travel moment, price ceilings,
        itinerary constraints, and the content angle the curator tool uses when a match is found.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 24 }}>
        {tmpls.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--fg-3)' }}>No templates yet. Add one below.</p>
        )}

        {tmpls.map((t) => (
          <TemplateRow
            key={t.id}
            id={t.id}
            name={t.name}
            slug={t.slug}
            enabled={t.enabled}
            tripType={t.tripType}
            audienceSegmentId={t.audienceSegmentId}
            travelMomentId={t.travelMomentId}
            audiences={auds}
            moments={moments}
          >
            <TemplateForm template={t} audiences={auds} moments={moments} />
          </TemplateRow>
        ))}

        {/* ── Create new template ───────────────────────────── */}
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
            New template
          </div>
          <TemplateForm template={null} audiences={auds} moments={moments} />
        </div>
      </div>
    </ConfigShell>
  );
}
