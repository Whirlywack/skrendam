// A small, dependency-free Markdown → HTML renderer for the desk's Guide page.
//
// It renders exactly the subset `docs/DESK-GUIDE.md` uses — `#`–`###` headings
// (with slug ids for anchors), paragraphs, `>` quotes, `-` bullet lists (one
// level), numbered lists, `**bold**`, `` `code` ``, fenced code blocks, links
// and simple pipe tables. Every piece of text is HTML-escaped before any
// inline markup is applied, so the output never carries raw HTML from the
// source. The only consumer is the Guide page, which feeds it a file from the
// repo itself (never user input).

export interface TocEntry {
  id: string;
  text: string;
  level: number;
}

export interface Rendered {
  html: string;
  /** Every `##` heading, in document order — the page's table of contents. */
  toc: TocEntry[];
}

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ESCAPES[ch]);
}

/** `## 2. A normal morning` → `2-a-normal-morning`; deduped by the caller. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
}

/** Inline markup over already-escaped text: code spans first (their content is
 *  literal), then links, then bold. Code spans are parked in placeholders so a
 *  `**` or `[` inside backticks is never treated as markup. */
export function renderInline(raw: string): string {
  const codes: string[] = [];
  // NUL-delimited placeholders: escapeHtml never emits NUL and the source is a
  // text file, so they cannot collide with real content.
  let s = escapeHtml(raw).replace(/`([^`]+)`/g, (_m, code: string) => {
    codes.push(`<code>${code}</code>`);
    return `\u0000${codes.length - 1}\u0000`;
  });
  // [text](href) — href is already escaped (quotes → &quot;), so it is safe in
  // an attribute; only http(s), mailto, anchors and relative paths are linked.
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, text: string, href: string) => {
    if (!/^(https?:|mailto:|#|\/|\.\/|\.\.\/)/.test(href)) return m;
    const external = /^https?:/.test(href);
    return `<a href="${href}"${external ? ' target="_blank" rel="noreferrer"' : ''}>${text}</a>`;
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  return s.replace(/\u0000(\d+)\u0000/g, (_m, i: string) => codes[Number(i)]);
}

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());
}

const isTableRow = (l: string) => /^\s*\|.*\|\s*$/.test(l);
const isSeparator = (l: string) => /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(l);
const isBullet = (l: string) => /^- /.test(l);
const isNumbered = (l: string) => /^\d+\. /.test(l);
const isContinuation = (l: string) => /^ {2,}\S/.test(l);
const isBlockStart = (l: string) =>
  l.trim() === '' || /^#{1,3} /.test(l) || /^```/.test(l) || /^> ?/.test(l) ||
  isBullet(l) || isNumbered(l) || isTableRow(l);

export function renderMarkdown(src: string): Rendered {
  const lines = src.replace(/\r\n?/g, '\n').split('\n');
  const out: string[] = [];
  const toc: TocEntry[] = [];
  const seenIds = new Map<string, number>();
  let i = 0;

  const uniqueId = (text: string) => {
    const base = slugify(text) || 'section';
    const n = seenIds.get(base) ?? 0;
    seenIds.set(base, n + 1);
    return n === 0 ? base : `${base}-${n + 1}`;
  };

  // Collect one list item plus its indented continuation lines.
  const listItem = (first: string): string => {
    const parts = [first];
    while (i < lines.length && isContinuation(lines[i]) && !isBlockStart(lines[i].trim())) {
      parts.push(lines[i].trim());
      i += 1;
    }
    return renderInline(parts.join(' '));
  };

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === '') {
      i += 1;
      continue;
    }

    // Fenced code block — content is escaped verbatim, no inline markup.
    if (/^```/.test(line)) {
      i += 1;
      const code: string[] = [];
      while (i < lines.length && !/^```/.test(lines[i])) {
        code.push(lines[i]);
        i += 1;
      }
      i += 1; // closing fence (or EOF)
      out.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);
      continue;
    }

    const heading = /^(#{1,3}) (.+)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      const text = heading[2].trim();
      const id = uniqueId(text);
      if (level === 2) toc.push({ id, text, level });
      out.push(`<h${level} id="${id}">${renderInline(text)}</h${level}>`);
      i += 1;
      continue;
    }

    if (/^> ?/.test(line)) {
      const quote: string[] = [];
      while (i < lines.length && /^> ?/.test(lines[i])) {
        quote.push(lines[i].replace(/^> ?/, ''));
        i += 1;
      }
      out.push(`<blockquote><p>${renderInline(quote.join(' '))}</p></blockquote>`);
      continue;
    }

    if (isTableRow(line) && i + 1 < lines.length && isSeparator(lines[i + 1])) {
      const head = splitRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && isTableRow(lines[i])) {
        rows.push(splitRow(lines[i]));
        i += 1;
      }
      const th = head.map((c) => `<th>${renderInline(c)}</th>`).join('');
      const body = rows
        .map((r) => `<tr>${r.map((c) => `<td>${renderInline(c)}</td>`).join('')}</tr>`)
        .join('');
      out.push(`<table><thead><tr>${th}</tr></thead><tbody>${body}</tbody></table>`);
      continue;
    }

    if (isBullet(line)) {
      const items: string[] = [];
      while (i < lines.length && isBullet(lines[i])) {
        const first = lines[i].slice(2);
        i += 1;
        items.push(`<li>${listItem(first)}</li>`);
      }
      out.push(`<ul>${items.join('')}</ul>`);
      continue;
    }

    if (isNumbered(line)) {
      const items: string[] = [];
      const start = Number(/^(\d+)\./.exec(line)?.[1] ?? 1);
      while (i < lines.length && isNumbered(lines[i])) {
        const first = lines[i].replace(/^\d+\. /, '');
        i += 1;
        items.push(`<li>${listItem(first)}</li>`);
      }
      out.push(`<ol${start !== 1 ? ` start="${start}"` : ''}>${items.join('')}</ol>`);
      continue;
    }

    // Paragraph: run of plain lines up to the next blank line or block start.
    const para: string[] = [line.trim()];
    i += 1;
    while (i < lines.length && !isBlockStart(lines[i])) {
      para.push(lines[i].trim());
      i += 1;
    }
    out.push(`<p>${renderInline(para.join(' '))}</p>`);
  }

  return { html: out.join('\n'), toc };
}
