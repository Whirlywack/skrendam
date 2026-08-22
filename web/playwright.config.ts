import { defineConfig } from '@playwright/test';
import { loadEnvConfig } from '@next/env';

loadEnvConfig(process.cwd());

// The journey spec MUTATES data (publishes a real candidate, edits config), so
// it must never run against the production database. Require an explicit,
// distinct E2E database and start the dev server against it.
const e2eDb = process.env.E2E_DATABASE_URL;
if (!e2eDb) {
  throw new Error(
    'E2E_DATABASE_URL is not set. The web e2e suite publishes deals and edits ' +
      'engine config — point E2E_DATABASE_URL at a disposable database first.',
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
  use: { baseURL: 'http://localhost:3000' },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000/login',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { ...process.env, DATABASE_URL: e2eDb },
  },
});
