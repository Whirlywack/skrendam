'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Inbox, Send, LayoutTemplate, Users, BarChart3, Settings } from 'lucide-react';
import { Wordmark } from './Wordmark';

type NavItem = {
  label: string;
  href: string | null;
  icon: React.ReactNode;
};

const navItems: NavItem[] = [
  { label: 'Queue', href: '/queue', icon: <Inbox size={18} /> },
  { label: 'Published', href: '/published', icon: <Send size={18} /> },
  { label: 'Templates', href: null, icon: <LayoutTemplate size={18} /> },
  { label: 'Audience', href: null, icon: <Users size={18} /> },
  { label: 'Insights', href: '/scans', icon: <BarChart3 size={18} /> },
  { label: 'Settings', href: null, icon: <Settings size={18} /> },
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
        {navItems.map(({ label, href, icon }) => {
          const isActive = href !== null && pathname === href;
          if (href === null) {
            return (
              <span
                key={label}
                className="navi"
                aria-disabled="true"
                style={{ opacity: 0.45, cursor: 'default', textDecoration: 'none' }}
              >
                {icon}
                {label}
              </span>
            );
          }
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
      </div>
    </aside>
  );
}
