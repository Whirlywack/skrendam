import { test, expect } from '@playwright/test';

test('deal detail — price, booking button, back link', async ({ page }) => {
  await page.goto('/');

  // Ensure at least one .bc card is present
  await expect(page.locator('.bc').first()).toBeVisible();

  // Click the first "See the deal" link
  await page.locator('.bc .see').first().click();

  // Should navigate to /deal/<id>
  await page.waitForURL(/\/deal\/\d+/);

  // Price is visible
  await expect(page.locator('.price').first()).toBeVisible();

  // Booking button is visible and has expected text
  const bookBtn = page.locator('.btn').first();
  await expect(bookBtn).toBeVisible();
  await expect(bookBtn).toContainText('Open in Google Flights');

  // Back link is visible
  await expect(page.locator('.back').first()).toBeVisible();
  await expect(page.locator('.back').first()).toContainText('All deals');

  // Sparkline — conditional: present only when route has price history
  const sparkCount = await page.locator('.spark').count();
  if (sparkCount > 0) {
    await expect(page.locator('.spark').first()).toBeVisible();
  }
});
