import { defineConfig } from '@playwright/test';
import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());
export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://localhost:3001' },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3001',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
