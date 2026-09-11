import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ConfigShell } from '@/components/ConfigShell';
import { renderMarkdown } from '@/lib/markdown';

// Read on every request so an edit to the guide shows up on reload — no build
// step, no cache: the desk always runs from `web/` inside the repo.
export const dynamic = 'force-dynamic';

/** The guide lives in the repo, one level up from `web/`. */
const GUIDE_PATH = path.join(process.cwd(), '..', 'docs', 'DESK-GUIDE.md');

export default async function GuidePage() {
  let source: string | null = null;
  try {
    source = await readFile(GUIDE_PATH, 'utf8');
  } catch {
    source = null;
  }

  if (source === null) {
    return (
      <ConfigShell title="Guide">
        <div className="scan-health-banner" role="alert">
          <strong>Guide file not found</strong>
          <span>
            {' '}at <code>{GUIDE_PATH}</code> — the desk must run from <code>web/</code> inside the
            repo, with <code>docs/DESK-GUIDE.md</code> present.
          </span>
        </div>
      </ConfigShell>
    );
  }

  const { html, toc } = renderMarkdown(source);

  return (
    <ConfigShell title="Guide">
      <div className="guide">
        <p className="guide-src">
          docs/DESK-GUIDE.md — read live from the repo; edit the file, reload the page.
        </p>
        {toc.length > 0 && (
          <nav className="guide-toc" aria-label="Contents">
            <ol>
              {toc.map((h) => (
                <li key={h.id}>
                  <a href={`#${h.id}`}>{h.text}</a>
                </li>
              ))}
            </ol>
          </nav>
        )}
        {/* dangerouslySetInnerHTML is safe here and only here: the HTML comes
            from `renderMarkdown` over a file checked into this repository
            (docs/DESK-GUIDE.md), never from a request or the database, and the
            renderer HTML-escapes every character of the source before adding
            its own tags. Do not reuse this pattern for user or DB content. */}
        <article className="guide-body" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </ConfigShell>
  );
}
