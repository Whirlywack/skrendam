import type { ReactNode } from 'react';

interface ConfigShellProps {
  title: string;
  children: ReactNode;
}

/**
 * Presentational wrapper for config editor pages.
 * Provides a branded page header and a scrollable content area.
 */
export function ConfigShell({ title, children }: ConfigShellProps) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div className="topbar">
        <div className="pagehead">
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 26, letterSpacing: '-0.02em', margin: 0 }}>
              {title}
            </h1>
          </div>
        </div>
      </div>
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '4px 28px 40px',
        }}
      >
        {children}
      </div>
    </div>
  );
}
