'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { label: 'Scan health', href: '/machine/scan-health' },
  { label: 'Coverage', href: '/machine/coverage' },
  { label: 'Templates', href: '/machine/templates' },
  { label: 'Routes', href: '/machine/routes' },
  { label: 'Zones', href: '/machine/zones' },
  { label: 'Audiences', href: '/machine/audiences' },
  { label: 'Moments', href: '/machine/moments' },
];

export function MachineTabs() {
  const pathname = usePathname();
  return (
    <div
      style={{
        display: 'flex',
        gap: 4,
        borderBottom: '1px solid var(--line)',
        overflowX: 'auto',
      }}
    >
      {TABS.map(({ label, href }) => {
        const on = pathname === href || pathname.startsWith(href + '/');
        return (
          <Link
            key={href}
            href={href}
            style={{
              textDecoration: 'none',
              fontFamily: 'var(--font-body)',
              fontWeight: 600,
              fontSize: 13,
              padding: '8px 14px',
              whiteSpace: 'nowrap',
              color: on ? 'var(--amber-700)' : 'var(--fg-2)',
              borderBottom: on ? '2px solid var(--amber-500)' : '2px solid transparent',
              marginBottom: -1,
            }}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}
