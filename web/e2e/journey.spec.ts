import { test, expect } from '@playwright/test';

const USER = process.env.ADMIN_USERNAME ?? 'admin';
const PASS = process.env.E2E_ADMIN_PASSWORD!;

test('curator logs in, reviews a real candidate, and publishes it', async ({ page }) => {
  // 1. Unauthenticated root redirect to /login (auth gate)
  await page.goto('/');
  await expect(page).toHaveURL(/\/login/, { timeout: 15000 });

  // 2. Log in with admin credentials
  await page.fill('input[name=username]', USER);
  await page.fill('input[name=password]', PASS);
  // Wait for the server-action redirect to complete (away from /login)
  await Promise.all([
    page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 }),
    page.click('button[type=submit]'),
  ]);

  // 3. Navigate to queue and assert real data renders
  await page.goto('/queue');
  const firstRow = page.locator('.qrow').first();
  await expect(firstRow).toBeVisible({ timeout: 15000 });

  // 4. Click the first row to open the Composer drawer
  await firstRow.click();
  await expect(page.locator('.drawer')).toBeVisible({ timeout: 15000 });

  // 5. Approve & publish
  await page.getByRole('button', { name: /approve & publish/i }).click();

  // 6. Navigate to /published and assert at least one deal row is visible
  await page.goto('/published');
  // PublishedBoard renders DealRow with className="qrow" — same selector as queue rows
  await expect(page.locator('.qrow').first()).toBeVisible({ timeout: 15000 });
});
