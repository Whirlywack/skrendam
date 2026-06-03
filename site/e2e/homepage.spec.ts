import { test, expect } from '@playwright/test';

test('homepage — hero, book-now card, inspiration tab, capture form', async ({ page }) => {
  await page.goto('/');

  // Hero h1 visible
  await expect(page.locator('h1')).toBeVisible();
  await expect(page.locator('h1')).toContainText('fares from the Baltics');

  // Book now tab shows ≥1 .bc card
  await expect(page.locator('.bc').first()).toBeVisible();

  // Click Inspiration tab
  const inspirationTab = page.getByRole('tab', { name: /inspiration/i });
  await inspirationTab.click();

  // Panel updates — either cards or empty-state subtitle
  const hasCards = await page.locator('.bc').count();
  if (hasCards === 0) {
    await expect(page.locator('.subtitle').first()).toBeVisible();
  }

  // Submit capture form
  await page.locator('.capform input[type="email"]').fill('qa+demo@example.com');
  await page.locator('.capbtn').click();

  // Confirmation heading
  await expect(page.getByText("You're in")).toBeVisible();
});
