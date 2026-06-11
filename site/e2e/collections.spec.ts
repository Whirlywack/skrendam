import { test, expect } from '@playwright/test';

test('collections index — renders at least one .ctile', async ({ page }) => {
  await page.goto('/collections');

  // H1 is visible
  await expect(page.locator('h1').first()).toBeVisible();
  await expect(page.locator('h1').first()).toContainText('Where do you want to go');

  // At least one collection tile must render
  await expect(page.locator('.ctile').first()).toBeVisible();
  const count = await page.locator('.ctile').count();
  expect(count).toBeGreaterThanOrEqual(1);
});

test('collections index — can navigate to cheap-flights-from-vilnius', async ({ page }) => {
  await page.goto('/collections');

  // Click the Vilnius collection tile (either by label text or href)
  const vilniusLink = page.getByRole('link', { name: /cheap flights from vilnius/i });
  await expect(vilniusLink).toBeVisible();
  await vilniusLink.click();

  await page.waitForURL(/cheap-flights-from-vilnius/);

  // Breadcrumb (.crumb) is visible
  await expect(page.locator('.crumb')).toBeVisible();

  // H1 is present
  await expect(page.locator('h1').first()).toBeVisible();

  // Either a .grid3 of deal cards OR a .coll-empty state — both are valid
  const hasDeals = await page.locator('.grid3').count();
  const hasEmpty = await page.locator('.coll-empty').count();
  expect(hasDeals + hasEmpty).toBeGreaterThanOrEqual(1);
});

test('collection page — direct URL: breadcrumb + h1 + deals or empty', async ({ page }) => {
  await page.goto('/cheap-flights-from-vilnius');

  // Breadcrumb contains navigation links
  await expect(page.locator('.crumb')).toBeVisible();
  const homeLink = page.locator('.crumb').getByRole('link', { name: /home/i });
  await expect(homeLink).toBeVisible();

  // H1 present
  const h1 = page.locator('.coll-h1').first();
  await expect(h1).toBeVisible();
  await expect(h1).toContainText('Vilnius');

  // Deal grid or empty state
  const dealsCount = await page.locator('.grid3 .deal, .grid3 .feat').count();
  const emptyCount = await page.locator('.coll-empty').count();
  expect(dealsCount + emptyCount).toBeGreaterThanOrEqual(1);
});

test('collection page — unknown slug returns 404', async ({ page }) => {
  const res = await page.goto('/this-is-not-a-collection');
  expect(res?.status()).toBe(404);
});
