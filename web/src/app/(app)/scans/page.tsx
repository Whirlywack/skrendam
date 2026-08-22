import { getRecentScanRuns, getPendingScanRequests } from '@/lib/queries';
import { parseEngineTs, timeAgo } from '@/lib/format';

// ── helpers ──────────────────────────────────────────────────────────────────

function fmtDuration(startedAt: string, finishedAt: string | null): string {
  if (!finishedAt) return '—';
  const secs = Math.round(
    (parseEngineTs(finishedAt).getTime() - parseEngineTs(startedAt).getTime()) / 1000,
  );
  // The engine writes started_at and finished_at together at commit time, so old
  // runs show a degenerate ~0s duration; hide it rather than display a lie.
  if (secs < 1) return '—';
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function fmtTs(iso: string | null): string {
  if (!iso) return '—';
  const d = parseEngineTs(iso);
  return d.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

// ── tokens ───────────────────────────────────────────────────────────────────

const CARD: React.CSSProperties = {
  background: 'var(--bg-surface)',
  border: '1px solid var(--line)',
  borderRadius: 'var(--radius-lg)',
  padding: '20px 24px',
  boxShadow: 'var(--shadow-sm)',
};

const EYEBROW: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  letterSpacing: '0.1em',
  textTransform: 'uppercase' as const,
  color: 'var(--fg-3)',
  margin: '0 0 4px',
};

const META: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 12,
  color: 'var(--fg-2)',
};

const NUM: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontWeight: 700,
  fontSize: 14,
  color: 'var(--fg-1)',
};

// status pill colours (inline to avoid new CSS rules)
const PILL_SEA: React.CSSProperties = {
  display: 'inline-block',
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase' as const,
  padding: '3px 9px',
  borderRadius: '999px',
  background: 'var(--sea-50)',
  color: 'var(--sea-700)',
};

const PILL_CORAL: React.CSSProperties = {
  ...PILL_SEA,
  background: 'var(--coral-50)',
  color: 'var(--coral-600)',
};

const PILL_AMBER: React.CSSProperties = {
  ...PILL_SEA,
  background: 'var(--amber-50)',
  color: 'var(--amber-700)',
};

const PILL_SAND: React.CSSProperties = {
  ...PILL_SEA,
  background: 'var(--sand-100)',
  color: 'var(--sand-500)',
};

function runPill(status: string): React.CSSProperties {
  if (status === 'completed') return PILL_SEA;
  if (status === 'failed' || status === 'error' || status === 'degraded') return PILL_CORAL;
  if (status === 'running') return PILL_AMBER;
  return PILL_SAND;
}

function reqPill(status: string): React.CSSProperties {
  if (status === 'running') return PILL_AMBER;
  if (status === 'queued') return PILL_SAND;
  return PILL_SAND;
}

// ── row component ─────────────────────────────────────────────────────────────

type ScanRunRow = Awaited<ReturnType<typeof getRecentScanRuns>>[number];

function ScanRunCard({ run }: { run: ScanRunRow }) {
  // Status is carried by the pill; unhealthy runs get a soft tint (like the
  // dashboard's attention block) instead of a side stripe.
  const unhealthy =
    run.status === 'failed' || run.status === 'error' || run.status === 'degraded';
  return (
    <div
      style={{
        ...CARD,
        ...(unhealthy
          ? { background: 'var(--coral-50)', border: '1px solid var(--coral-100)' }
          : {}),
      }}
    >
      {/* top row: status pill + duration + version */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <span style={runPill(run.status)}>{run.status}</span>
        <span style={{ ...META, fontSize: 11 }}>
          {fmtTs(run.startedAt)}
        </span>
        <span style={{ ...META, fontSize: 11, marginLeft: 'auto' }}>
          {fmtDuration(run.startedAt, run.finishedAt)}
        </span>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '0.06em',
            color: 'var(--fg-3)',
            background: 'var(--bg-sunken)',
            padding: '2px 7px',
            borderRadius: 6,
          }}
        >
          v{run.scannerVersion}
        </span>
      </div>

      {/* metrics grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(96px, 1fr))',
          gap: '10px 14px',
        }}
      >
        {([
          ['Templates', run.templatesScanned],
          ['Routes', run.routesScanned],
          ['API calls', run.apiCalls],
          ['429s', run.http429S],
          ['Candidates', run.candidatesFound],
          ['Matches', run.matchesCreated],
          ['Errors', run.errors],
        ] as [string, number][]).map(([label, value]) => (
          <div key={label}>
            <p style={EYEBROW}>{label}</p>
            <p
              style={{
                ...NUM,
                color:
                  label === 'Errors' && value > 0
                    ? 'var(--coral-500)'
                    : label === '429s' && value > 0
                      ? 'var(--amber-600)'
                      : label === 'Matches' && value > 0
                        ? 'var(--sea-600)'
                        : 'var(--fg-1)',
              }}
            >
              {value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── page ──────────────────────────────────────────────────────────────────────

export default async function ScansPage() {
  const [runs, pending] = await Promise.all([
    getRecentScanRuns(20),
    getPendingScanRequests(),
  ]);

  return (
    <div className="topbar" style={{ flex: 1, overflowY: 'auto', paddingBottom: 40 }}>
      {/* heading */}
      <h1
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 800,
          fontSize: 32,
          letterSpacing: '-0.02em',
          margin: '0 0 6px',
          color: 'var(--fg-1)',
        }}
      >
        Scan health
      </h1>
      <p
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          color: 'var(--fg-3)',
          margin: '0 0 28px',
          letterSpacing: '0.04em',
        }}
      >
        Last {runs.length} scan runs · {pending.length} queued / running
      </p>

      {/* pending requests */}
      {pending.length > 0 && (
        <section style={{ marginBottom: 28 }}>
          <h2
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--fg-3)',
              margin: '0 0 12px',
            }}
          >
            Queued / Running
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pending.map((req) => (
              <div
                key={req.id}
                style={{
                  ...CARD,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '12px 18px',
                }}
              >
                <span style={reqPill(req.status)}>{req.status}</span>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 12,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: 'var(--fg-1)',
                  }}
                >
                  {req.kind}
                </span>
                {req.candidateId != null && (
                  <span style={META}>candidate #{req.candidateId}</span>
                )}
                <span style={{ ...META, marginLeft: 'auto', fontSize: 11 }}>
                  {timeAgo(req.createdAt ? String(req.createdAt) : null)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* scan runs list */}
      <section>
        <h2
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--fg-3)',
            margin: '0 0 12px',
          }}
        >
          Recent runs
        </h2>

        {runs.length === 0 ? (
          <div
            style={{
              ...CARD,
              textAlign: 'center',
              padding: '40px 24px',
              color: 'var(--fg-3)',
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
            }}
          >
            No scan runs yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {runs.map((run) => (
              <ScanRunCard key={run.id} run={run} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
