import { expect, test } from 'vitest';
import { escapeHtml, renderInline, renderMarkdown, slugify } from './markdown';

test('headings get slug ids and the H2s form the table of contents', () => {
  const { html, toc } = renderMarkdown('# Guide\n\n## 2. A normal morning\n\n### The 06:00 scan\n');
  expect(html).toContain('<h1 id="guide">Guide</h1>');
  expect(html).toContain('<h2 id="2-a-normal-morning">2. A normal morning</h2>');
  expect(html).toContain('<h3 id="the-06-00-scan">The 06:00 scan</h3>');
  expect(toc).toEqual([{ id: '2-a-normal-morning', text: '2. A normal morning', level: 2 }]);
});

test('duplicate heading text gets a distinct id', () => {
  const { html } = renderMarkdown('## Today\n\n## Today\n');
  expect(html).toContain('id="today"');
  expect(html).toContain('id="today-2"');
});

test('slugify keeps letters and digits only', () => {
  expect(slugify('8. When something looks wrong')).toBe('8-when-something-looks-wrong');
  expect(slugify('Letters & subscribers')).toBe('letters-subscribers');
});

test('paragraphs join wrapped lines and stop at blank lines', () => {
  const { html } = renderMarkdown('one\ntwo\n\nthree\n');
  expect(html).toBe('<p>one two</p>\n<p>three</p>');
});

test('bullet lists (with wrapped items) and numbered lists', () => {
  const md = '- first\n  continues here\n- second\n\n1. a\n2. b\n';
  const { html } = renderMarkdown(md);
  expect(html).toContain('<ul><li>first continues here</li><li>second</li></ul>');
  expect(html).toContain('<ol><li>a</li><li>b</li></ol>');
});

test('numbered list keeps a non-1 start', () => {
  expect(renderMarkdown('3. c\n4. d\n').html).toBe('<ol start="3"><li>c</li><li>d</li></ol>');
});

test('inline bold, code and links', () => {
  expect(renderInline('**bold** and `code` and [docs](https://yip.lt/x)')).toBe(
    '<strong>bold</strong> and <code>code</code> and <a href="https://yip.lt/x" target="_blank" rel="noreferrer">docs</a>',
  );
  expect(renderInline('[anchor](#2-a-normal-morning)')).toBe('<a href="#2-a-normal-morning">anchor</a>');
});

test('single asterisks emphasise — the guide labels its scopes that way', () => {
  expect(renderInline('*New today* shows the top ten')).toBe(
    '<em>New today</em> shows the top ten',
  );
  expect(renderMarkdown('- **Scopes:** *New today*, *Saved*, *History*.\n').html).toBe(
    '<ul><li><strong>Scopes:</strong> <em>New today</em>, <em>Saved</em>, <em>History</em>.</li></ul>',
  );
});

test('bold and italic on one line both render, bold first so it is not eaten', () => {
  expect(renderInline('**bold** and *italic*')).toBe(
    '<strong>bold</strong> and <em>italic</em>',
  );
  // The bold rule must win: **x** must never come out as *<em>x</em>*.
  expect(renderInline('**bold**')).toBe('<strong>bold</strong>');
});

test('a lone asterisk in prose is left alone', () => {
  expect(renderInline('2 * 3 and 4 * 5')).toBe('2 * 3 and 4 * 5');
  expect(renderInline('a * b')).toBe('a * b');
});

test('emphasis inside a code span stays literal', () => {
  expect(renderInline('`*not em*` but *em*')).toBe('<code>*not em*</code> but <em>em</em>');
});

test('a literal NUL in the source cannot alias a code-span placeholder', () => {
  // Code spans are parked as \u0000<index>\u0000. A literal \u0000 0 \u0000 in the source
  // used to read back as index 0, restoring that code span a second time.
  const nul = 'a \u00000\u0000 b `c`';
  expect(renderInline(nul)).toBe('a 0 b <code>c</code>');
  expect(renderMarkdown(nul + '\n').html).toBe('<p>a 0 b <code>c</code></p>');
});

test('markup inside a code span is literal and numbers in prose survive', () => {
  expect(renderInline('`**not bold**` costs 5 min and `[x](y)` too')).toBe(
    '<code>**not bold**</code> costs 5 min and <code>[x](y)</code> too',
  );
});

test('unsafe link schemes are left as text', () => {
  expect(renderInline('[x](javascript:alert(1))')).toBe('[x](javascript:alert(1))');
});

test('fenced code blocks are escaped verbatim with no inline markup', () => {
  const { html } = renderMarkdown('```\nA **b** <c>\n```\n');
  expect(html).toBe('<pre><code>A **b** &lt;c&gt;</code></pre>');
});

test('pipe tables render head and body cells with inline markup', () => {
  const md = '| Action | Calls |\n|---|---|\n| **Publish** | none |\n| `Recheck` | 1 |\n';
  const { html } = renderMarkdown(md);
  expect(html).toBe(
    '<table><thead><tr><th>Action</th><th>Calls</th></tr></thead>' +
      '<tbody><tr><td><strong>Publish</strong></td><td>none</td></tr>' +
      '<tr><td><code>Recheck</code></td><td>1</td></tr></tbody></table>',
  );
});

test('blockquotes render as a quoted paragraph', () => {
  expect(renderMarkdown('> Read this first.\n> Then that.\n').html).toBe(
    '<blockquote><p>Read this first. Then that.</p></blockquote>',
  );
});

test('HTML in the source is escaped everywhere', () => {
  expect(escapeHtml('<script>"x" & \'y\'</script>')).toBe(
    '&lt;script&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/script&gt;',
  );
  const { html } = renderMarkdown('# <b>t</b>\n\n<img src=x onerror=alert(1)>\n\n- <i>li</i>\n');
  expect(html).not.toMatch(/<(b|img|i)\b/);
  expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
});
