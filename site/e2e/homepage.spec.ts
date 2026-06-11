import { test, expect } from '@playwright/test';

test('homepage — H1 visible and correct', async ({ page }) => {
  await page.goto('/');

  // H1 should be visible and contain the known substring
  const h1 = page.locator('h1').first();
  await expect(h1).toBeVisible();
  await expect(h1).toContainText('Hand-checked');
  await expect(h1).toContainText('Vilnius');
});

test('homepage — deal cards or empty-state', async ({ page }) => {
  await page.goto('/');

  // At least one .feat or .deal card, OR no cards at all (thin seed data)
  const cardCount = await page.locator('.feat, .deal').count();
  if (cardCount > 0) {
    // First card is visible and links to /deal/<id>
    const firstCard = page.locator('.feat, .deal').first();
    await expect(firstCard).toBeVisible();
    const href = await firstCard.getAttribute('href');
    expect(href).toMatch(/^\/deal\/\d+/);
  } else {
    // Acceptable: dev seed may have zero live deals
    // Just assert that the hero H1 is still visible (page loaded correctly)
    await expect(page.locator('h1').first()).toBeVisible();
  }
});

test('homepage — collections section has at least one .ctile', async ({ page }) => {
  await page.goto('/');

  // Collections section (.ctile tiles) must render
  await expect(page.locator('.ctile').first()).toBeVisible();
  const count = await page.locator('.ctile').count();
  expect(count).toBeGreaterThanOrEqual(1);
});

test('homepage — Header nav hrefs are correct', async ({ page }) => {
  await page.goto('/');

  // "Deals" link → /
  const dealsLink = page.getByRole('link', { name: /^deals$/i });
  await expect(dealsLink).toHaveAttribute('href', '/');

  // "Collections" link → /collections
  const collectionsLink = page.getByRole('link', { name: /^collections$/i });
  await expect(collectionsLink).toHaveAttribute('href', '/collections');
});

test('homepage — SignupCard inline email form shows success', async ({ page }) => {
  await page.goto('/');

  // Fill the inline email input inside .cap
  const emailInput = page.locator('.cap input[type="email"]').first();
  await expect(emailInput).toBeVisible();
  await emailInput.fill('qa+s21@example.com');

  // Click the submit button
  const submitBtn = page.locator('.cap button[type="submit"]').first();
  await expect(submitBtn).toBeVisible();
  await submitBtn.click();

  // Success state — "You're in" text should appear
  await expect(page.locator('.cap').first()).toContainText("You're in", { timeout: 8000 });
});
