import Link from 'next/link';
import { ConfigShell } from '@/components/ConfigShell';
import { LayoutTemplate, Map, Users, CalendarDays, Plane } from 'lucide-react';

const editors: {
  href: string;
  label: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  {
    href: '/config/templates',
    label: 'Templates',
    description: 'Deal templates: price ceilings, discount thresholds, copy angles and itinerary constraints.',
    icon: <LayoutTemplate size={20} strokeWidth={1.75} />,
  },
  {
    href: '/config/zones',
    label: 'Zones',
    description: 'Haul-type zones with per-zone price ceilings and minimum savings thresholds.',
    icon: <Map size={20} strokeWidth={1.75} />,
  },
  {
    href: '/config/audiences',
    label: 'Audiences',
    description: 'Audience segments controlling itinerary tolerance and newsletter targeting.',
    icon: <Users size={20} strokeWidth={1.75} />,
  },
  {
    href: '/config/moments',
    label: 'Moments',
    description: 'Travel moments (weekend escape, school holiday…) that shape content angle.',
    icon: <CalendarDays size={20} strokeWidth={1.75} />,
  },
  {
    href: '/config/routes',
    label: 'Routes',
    description: 'Monitored origin–destination pairs with zone assignment and cabin class.',
    icon: <Plane size={20} strokeWidth={1.75} />,
  },
];

export default function ConfigIndexPage() {
  return (
    <ConfigShell title="Settings">
      <p style={{ fontSize: 14, color: 'var(--fg-3)', marginTop: 0, marginBottom: 28 }}>
        Engine tuning. Changes here affect which deals surface and how they are scored.
      </p>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: 14,
        }}
      >
        {editors.map(({ href, label, description, icon }) => (
          <Link
            key={href}
            href={href}
            style={{ textDecoration: 'none' }}
          >
            <div
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--line)',
                borderRadius: 'var(--radius-md)',
                padding: '18px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                transition: 'box-shadow var(--dur-fast), border-color var(--dur-fast)',
                cursor: 'pointer',
              }}
              className="config-card"
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--amber-50)',
                  color: 'var(--amber-700)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flex: 'none',
                }}
              >
                {icon}
              </div>
              <div>
                <div
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 700,
                    fontSize: 15,
                    color: 'var(--fg-1)',
                    marginBottom: 4,
                  }}
                >
                  {label}
                </div>
                <div style={{ fontSize: 13, color: 'var(--fg-3)', lineHeight: 1.45 }}>
                  {description}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </ConfigShell>
  );
}
