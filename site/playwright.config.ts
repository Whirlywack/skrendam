import { defineConfig } from '@playwright/test';
import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

// signup-flow.spec.ts writes subscriber rows, so e2e must never point at the
// production database. Require an explicit, distinct E2E database.
const e2eDb = process.env.E2E_DATABASE_URL;
if (!e2eDb) {
  throw new Error(
    'E2E_DATABASE_URL is not set. The site e2e suite creates subscribers — ' +
      'point E2E_DATABASE_URL at a disposable database first.',
  );
}
if (e2eDb === process.env.DATABASE_URL) {
  throw new Error(
    'E2E_DATABASE_URL equals DATABASE_URL — refusing to run mutating e2e specs ' +
      'against the app database.',
  );
}

export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://localhost:3001' },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3001',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { ...process.env, DATABASE_URL: e2eDb },
  },
});
