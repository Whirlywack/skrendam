'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Inbox, Send, BarChart3, Settings, LayoutTemplate, Users, Map, CalendarDays, Plane, LogOut } from 'lucide-react';
import { logoutAction } from '@/app/auth-actions';
import { Wordmark } from './Wordmark';

type NavItem = {
  label: string;
  href: string;
  icon: React.ReactNode;
  /** Use exact pathname match only (no startsWith). */
  exact?: boolean;
};

const navItems: NavItem[] = [
  { label: 'Queue', href: '/queue', icon: <Inbox size={18} />, exact: true },
  { label: 'Published', href: '/published', icon: <Send size={18} />, exact: true },
  { label: 'Insights', href: '/scans', icon: <BarChart3 size={18} />, exact: true },
  // Config section
  { label: 'Settings', href: '/config', icon: <Settings size={18} />, exact: true },
  { label: 'Templates', href: '/config/templates', icon: <LayoutTemplate size={18} /> },
  { label: 'Zones', href: '/config/zones', icon: <Map size={18} /> },
  { label: 'Audiences', href: '/config/audiences', icon: <Users size={18} /> },
  { label: 'Moments', href: '/config/moments', icon: <CalendarDays size={18} /> },
  { label: 'Routes', href: '/config/routes', icon: <Plane size={18} /> },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="side">
      <div className="brand">
        <Wordmark size={26} />
        <span className="tag">Curator</span>
      </div>
      <nav>
        {navItems.map(({ label, href, icon, exact }) => {
          const isActive = exact
            ? pathname === href
            : pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={label}
              href={href}
              className={'navi' + (isActive ? ' on' : '')}
              style={{ textDecoration: 'none' }}
            >
              {icon}
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="who">
        <span className="av">CU</span>
        <div>
          <div className="nm">Curator</div>
          <div className="ro">Curator · Yip</div>
        </div>
        <form action={logoutAction} style={{ marginLeft: 'auto' }}>
          <button
            type="submit"
            className="navi"
            title="Sign out"
            aria-label="Sign out"
            style={{ border: 'none', background: 'none', cursor: 'pointer' }}
          >
            <LogOut size={16} />
          </button>
        </form>
      </div>
    </aside>
  );
}
