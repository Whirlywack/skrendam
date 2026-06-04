import { test, expect } from '@playwright/test';

test('deal detail — navigates from homepage card, shows price + booking CTA', async ({ page }) => {
  await page.goto('/');

  // Check if any deal cards exist on the homepage
  const cardCount = await page.locator('.feat, .deal').count();

  if (cardCount === 0) {
    // No cards in seed data — skip this test gracefully
    test.skip(true, 'No deal cards in dev seed; skipping deal-detail journey.');
    return;
  }

  // Click the first deal card
  await page.locator('.feat, .deal').first().click();

  // URL must match /deal/<id>/
  await page.waitForURL(/\/deal\/\d+/);
  expect(page.url()).toMatch(/\/deal\/\d+/);

  // Price (.price) is visible — the big price block in .dbook
  await expect(page.locator('.price').first()).toBeVisible();

  // Booking CTA button (.bookbtn) is visible — current text is "Open in Google Flights →"
  const bookBtn = page.locator('.bookbtn').first();
  await expect(bookBtn).toBeVisible();
  await expect(bookBtn).toContainText('Open in Google Flights');

  // "Why it's good" and "The catch" headings are present
  await expect(page.getByRole('heading', { name: /why it.?s good/i }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: /the catch/i }).first()).toBeVisible();

  // Back link: "← All deals"
  const backLink = page.locator('.back').first();
  await expect(backLink).toBeVisible();
  await expect(backLink).toContainText('All deals');

  // Similar deals — conditional: grid3 section only if present
  const similarCount = await page.locator('.grid3 .deal, .grid3 .feat').count();
  if (similarCount > 0) {
    await expect(page.locator('.grid3').first()).toBeVisible();
  }

  // Price sparkline — conditional: only assert visibility if element exists
  const sparkCount = await page.locator('canvas, .spark, .sparkline').count();
  if (sparkCount > 0) {
    await expect(page.locator('canvas, .spark, .sparkline').first()).toBeVisible();
  }
});

test('deal detail — direct URL navigation works', async ({ page }) => {
  // Navigate directly to a known slug pattern; if notFound, the page should 404
  // Here we verify that a valid deal ID from the seed renders correctly,
  // or we accept that the seed may only have expired deals.

  // First, find a valid deal ID by checking the homepage
  await page.goto('/');
  const firstCard = page.locator('.feat, .deal').first();
  const cardCount = await page.locator('.feat, .deal').count();

  if (cardCount === 0) {
    test.skip(true, 'No deal cards in dev seed; skipping direct URL navigation test.');
    return;
  }

  const href = await firstCard.getAttribute('href');
  expect(href).toBeTruthy();

  // Navigate directly to the deal URL
  await page.goto(href!);
  await page.waitForURL(/\/deal\/\d+/);

  // H1 is visible (destination city shown in .himg-h1)
  await expect(page.locator('h1').first()).toBeVisible();

  // .dh (deal headline) is visible
  await expect(page.locator('.dh').first()).toBeVisible();
});
