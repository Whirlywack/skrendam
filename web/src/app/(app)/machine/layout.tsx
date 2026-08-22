import { MachineTabs } from '@/components/MachineTabs';

export default function MachineLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <div style={{ padding: '18px 28px 0' }}>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: 30,
            letterSpacing: '-0.02em',
            margin: '0 0 4px',
          }}
        >
          Machine
        </h1>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--fg-2)', margin: '0 0 14px' }}>
          Engine tuning and health. Changes here affect which deals surface and how they are scored.
        </p>
        <MachineTabs />
      </div>
      {children}
    </div>
  );
}
