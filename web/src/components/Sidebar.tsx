'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sun, Inbox, Send, Cog, LogOut } from 'lucide-react';
import { logoutAction } from '@/app/auth-actions';
import { Wordmark } from './Wordmark';

type NavItem = {
  label: string;
  href: string;
  icon: React.ReactNode;
  /** Use exact pathname match only (no startsWith). */
  exact?: boolean;
  badge?: number;
  /** Coral badge — something needs attention, not just a count. */
  alert?: boolean;
};

export function Sidebar({
  toReview,
  attention,
}: {
  /** Distinct fresh candidates waiting for review (badge on Review). */
  toReview: number;
  /** Live deals needing attention — stale price etc. (alert badge on Live). */
  attention: number;
}) {
  const pathname = usePathname();

  const navItems: NavItem[] = [
    { label: 'Today', href: '/', icon: <Sun size={18} />, exact: true },
    { label: 'Review', href: '/queue', icon: <Inbox size={18} />, badge: toReview },
    { label: 'Live', href: '/published', icon: <Send size={18} />, badge: attention, alert: true },
    { label: 'Machine', href: '/machine', icon: <Cog size={18} /> },
  ];

  return (
    <aside className="side">
      <Link href="/" className="brand" style={{ textDecoration: 'none', cursor: 'pointer' }}>
        <Wordmark size={26} />
        <span className="tag">Deal Desk</span>
      </Link>
      <nav>
        {navItems.map(({ label, href, icon, exact, badge, alert }) => {
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
              {badge != null && badge > 0 && (
                <span
                  style={{
                    marginLeft: 'auto',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    padding: '2px 7px',
                    borderRadius: 99,
                    background: alert ? 'var(--coral-100)' : 'var(--bg-sunken)',
                    color: alert ? 'var(--coral-600)' : 'var(--fg-2)',
                    fontWeight: alert ? 700 : 400,
                  }}
                >
                  {badge}
                  {alert ? ' !' : ''}
                </span>
              )}
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
