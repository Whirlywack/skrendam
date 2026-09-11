import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { LIVE_STATUSES } from './statuses';

const src = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');

describe('LIVE_STATUSES (WP9)', () => {
  test('the shared module says exactly live + changed', () => {
    expect([...LIVE_STATUSES]).toEqual(['live', 'changed']);
  });

  test('queries.ts never compares status to a literal live', () => {
    const queries = src('./queries.ts');
    expect(queries).not.toMatch(/status,\s*'live'\)/);
    expect(queries).toContain("import { LIVE_STATUSES } from './statuses'");
    expect(queries).toMatch(/inArray\(publishedDeals\.status, \[\.\.\.LIVE_STATUSES\]\)/);
  });

  test('the deal page never compares status to a literal live', () => {
    const page = src('../app/deal/[id]/page.tsx');
    expect(page).not.toMatch(/status\s*[!=]==\s*'live'/);
    expect(page).toContain("import { LIVE_STATUSES } from '@/lib/statuses'");
  });
});
