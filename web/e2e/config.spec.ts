import { test, expect } from '@playwright/test';

const USER = process.env.ADMIN_USERNAME ?? 'admin';
const PASS = process.env.E2E_ADMIN_PASSWORD!;

// Fixed deterministic value — stable across re-runs.
const NEW_THRESHOLD = '222';

test('zones config editor persists a threshold_price_eur edit', async ({ page }) => {
  // 1. Log in (mirrors journey.spec.ts login pattern)
  await page.goto('/');
  await expect(page).toHaveURL(/\/login/, { timeout: 15000 });

  await page.fill('input[name=username]', USER);
  await page.fill('input[name=password]', PASS);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 }),
    page.click('button[type=submit]'),
  ]);

  // 2. Navigate to the zones config editor
  await page.goto('/config/zones');
  await page.waitForLoadState('networkidle');

  // 3. Scope to the first ZoneForm <form> on the page
  //    (the "create new zone" form is last; existing zone rows come first)
  const firstForm = page.locator('form').first();
  await expect(firstForm).toBeVisible({ timeout: 15000 });

  const thresholdInput = firstForm.locator('input[name="threshold_price_eur"]');
  await expect(thresholdInput).toBeVisible({ timeout: 10000 });

  // 4. Set the deterministic new value and submit
  await thresholdInput.fill(NEW_THRESHOLD);
  await firstForm.locator('button[type=submit]').click();

  // 5. Wait for the "Saved" toast to confirm the server action completed
  const toast = firstForm.locator('.toast');
  await expect(toast).toContainText('Saved', { timeout: 10000 });

  // 6. Reload and assert the value persisted
  await page.goto('/config/zones');
  await page.waitForLoadState('networkidle');

  const reloadedFirstForm = page.locator('form').first();
  const reloadedInput = reloadedFirstForm.locator('input[name="threshold_price_eur"]');
  await expect(reloadedInput).toHaveValue(NEW_THRESHOLD, { timeout: 10000 });
});
