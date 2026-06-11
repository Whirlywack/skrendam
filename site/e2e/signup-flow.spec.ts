import { test, expect } from '@playwright/test';

test('/subscribe — idle state renders email form', async ({ page }) => {
  await page.goto('/subscribe');

  // H1 text for idle state
  await expect(page.locator('h1').first()).toBeVisible();
  await expect(page.locator('h1').first()).toContainText('Get hand-checked cheap flights');

  // Email input is present
  const emailInput = page.getByLabel(/email address/i).first();
  await expect(emailInput).toBeVisible();

  // Submit button text
  const submitBtn = page.getByRole('button', { name: /get free weekly deals/i });
  await expect(submitBtn).toBeVisible();
});

test('/subscribe — submit email leads to confirmed state (dev single-opt-in)', async ({ page }) => {
  // NOTE: This test guards the end-to-end subscribe form flow. If it fails, verify that
  // the server action manifest is correctly populated (the server-reference-manifest.json
  // in .next/dev/server/ must not be empty — see known Turbopack issue).
  //
  // Dev: RESEND_API_KEY unset → single opt-in → redirect to ?state=confirmed
  // Prod: RESEND_API_KEY set → double opt-in → redirect to ?state=check-email

  await page.goto('/subscribe');
  await page.waitForLoadState('networkidle');

  // Fill and submit the form
  const emailInput = page.getByLabel(/email address/i).first();
  await emailInput.fill('qa+sub@example.com');

  const submitBtn = page.getByRole('button', { name: /get free weekly deals/i });
  await submitBtn.click();

  // Accept either state as valid
  await page.waitForURL(/\/subscribe\?state=(confirmed|check-email)/, { timeout: 20000 });

  const url = page.url();

  if (url.includes('state=confirmed')) {
    // Confirmed state shows "You're confirmed." heading or preference chips
    await expect(page.locator('h1, h2').first()).toBeVisible();
    // Either "confirmed" text or the prefs form
    const pageText = await page.textContent('body');
    expect(pageText?.toLowerCase()).toMatch(/confirm|you.?re confirmed|departing from/i);
  } else if (url.includes('state=check-email')) {
    // Double opt-in: check-email state
    await expect(page.locator('h1').first()).toBeVisible();
    await expect(page.locator('h1').first()).toContainText('Almost there');
  }
});

test('/early-alerts — free-vs-early comparison and join form', async ({ page }) => {
  await page.goto('/early-alerts');

  // H1 is visible
  await expect(page.locator('h1').first()).toBeVisible();

  // Two .cmpcard columns (Free weekly + Early alerts)
  const cmpCards = page.locator('.cmpcard');
  const cardCount = await cmpCards.count();
  expect(cardCount).toBeGreaterThanOrEqual(2);

  // Both column headings are present
  await expect(page.getByRole('heading', { name: /free weekly email/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /early alerts/i })).toBeVisible();

  // Join form inside the early-alerts column (aria-label set in the component)
  const joinForm = page.getByRole('form', { name: /join the early-alerts waitlist/i });
  await expect(joinForm).toBeVisible();

  // Join form contains an email input
  const joinEmailInput = joinForm.getByLabel(/email address/i);
  await expect(joinEmailInput).toBeVisible();

  // Join form submit button
  const joinBtn = joinForm.getByRole('button');
  await expect(joinBtn).toBeVisible();
  await expect(joinBtn).toContainText(/waitlist/i);
});

test('/early-alerts — submitting join form (dev: single opt-in) leads to confirmed/check-email', async ({ page }) => {
  // NOTE: This test guards the early-alerts join form action flow. If it fails, verify the
  // server-reference-manifest.json is populated (Turbopack dev server action registry issue).
  //
  // Dev: redirects to ?state=confirmed; prod: ?state=check-email

  await page.goto('/early-alerts');
  await page.waitForLoadState('networkidle');

  const joinForm = page.getByRole('form', { name: /join the early-alerts waitlist/i });
  const joinEmailInput = joinForm.getByLabel(/email address/i);
  await joinEmailInput.fill('qa+early@example.com');

  const joinBtn = joinForm.getByRole('button');
  await joinBtn.click();

  // Dev: redirects to ?state=confirmed; prod: ?state=check-email
  await page.waitForURL(/\/subscribe\?state=(confirmed|check-email)/, { timeout: 20000 });

  const url = page.url();
  expect(url).toMatch(/\/subscribe\?state=(confirmed|check-email)/);
});
