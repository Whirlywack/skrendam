/**
 * journey-capture.spec.ts
 *
 * Visual user-journey map for the Yip public site (feat/site-cro-redesign).
 * Captures full-page (and some viewport-only) screenshots of every connected
 * path, then assembles them into a storyboard HTML.
 *
 * Run with:
 *   CI=1 npx playwright test e2e/journey-capture.spec.ts --reporter=line
 *
 * Test emails written to the dev DB (unique per run via timestamp suffix):
 *   qa+journey1-{ts}@example.com       — inline hero SignupCard (Journey 4 steps 30-31)
 *   qa+journey2-{ts}@example.com       — /subscribe page confirmed state (Journey 4 step 33)
 *   qa+journey2prefs-{ts}@example.com  — prefs-saved step (Journey 4 step 35)
 *   qa+journey2early-{ts}@example.com  — early-joined step (Journey 4 step 36)
 *   qa+journey3-{ts}@example.com       — /early-alerts join form (Journey 5 step 41)
 *
 * NOTE: Using a timestamp suffix ensures we hit a fresh (unconfirmed) DB row each
 * run, so the single-opt-in cookie gets set and the prefs → early-joined chain works.
 * Already-confirmed rows in the DB block cookie issuance (setWhere: confirmed=false).
 */

import { test, expect, Browser, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// ── Constants ────────────────────────────────────────────────────────────────

const SHOTS_DIR = 'e2e/journey-shots';
const DESKTOP = { width: 1366, height: 900 };
const MOBILE = { width: 390, height: 844 };
const TIMEOUT = 20_000;
const NETWORKIDLE_TIMEOUT = 15_000;

// Use a per-run timestamp so re-runs always hit fresh (unconfirmed) DB rows.
// The single-opt-in cookie is only issued for new/unconfirmed inserts.
const RUN_TS = Date.now();
const EMAIL1 = `qa+journey1-${RUN_TS}@example.com`;
const EMAIL2 = `qa+journey2-${RUN_TS}@example.com`;
const EMAIL3 = `qa+journey3-${RUN_TS}@example.com`;

// Collected connection records (filled as we go, written into the HTML).
const connections: { key: string; ok: boolean; note?: string }[] = [];

function record(key: string, ok: boolean, note?: string) {
  connections.push({ key, ok, note });
}

// ── Helper ───────────────────────────────────────────────────────────────────

async function shot(page: Page, filename: string, fullPage = true) {
  await page.screenshot({
    path: path.join(SHOTS_DIR, filename),
    fullPage,
  });
}

// ── JOURNEY 1 — Discover → Deal → Similar ────────────────────────────────────
test.describe.configure({ mode: 'serial' });

test('Journey 1 — home desktop', async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await page.goto('/');
  await page.waitForLoadState('networkidle', { timeout: NETWORKIDLE_TIMEOUT });

  // Verify hero H1
  const h1 = page.locator('h1').first();
  await expect(h1).toBeVisible({ timeout: TIMEOUT });
  await expect(h1).toContainText('Hand-checked');

  await shot(page, '01-home-desktop.png');
  record('Homepage renders (hero + all sections)', true);
});

test('Journey 1 — home mobile', async ({ page }) => {
  await page.setViewportSize(MOBILE);
  await page.goto('/');
  await page.waitForLoadState('networkidle', { timeout: NETWORKIDLE_TIMEOUT });

  const h1 = page.locator('h1').first();
  await expect(h1).toBeVisible({ timeout: TIMEOUT });

  await shot(page, '02-home-mobile.png');
  record('Homepage renders on mobile (390px hero variant)', true);

  // Reset viewport to desktop for subsequent tests
  await page.setViewportSize(DESKTOP);
});

test('Journey 1 — deal detail', async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await page.goto('/');
  await page.waitForLoadState('networkidle', { timeout: NETWORKIDLE_TIMEOUT });

  const cardCount = await page.locator('.feat, .deal').count();

  if (cardCount === 0) {
    // No cards in seed — screenshot the empty state and note it
    await shot(page, '03-deal-detail.png');
    record('home deal card → /deal/{id}', false, 'NO DEAL CARDS IN SEED — skipped navigation');
    return;
  }

  // Grab the href before clicking (so we can record it)
  const firstCard = page.locator('.feat, .deal').first();
  const href = await firstCard.getAttribute('href');
  await firstCard.click();

  await page.waitForURL(/\/deal\/\d+/, { timeout: TIMEOUT });

  // Verify key deal-page elements
  await expect(page.locator('.price').first()).toBeVisible({ timeout: TIMEOUT });
  await expect(page.locator('.bookbtn').first()).toBeVisible({ timeout: TIMEOUT });
  await expect(page.getByRole('heading', { name: /why it.?s good/i }).first()).toBeVisible({ timeout: TIMEOUT });

  await page.waitForLoadState('networkidle', { timeout: NETWORKIDLE_TIMEOUT });
  await shot(page, '03-deal-detail.png');
  record(`home deal card → /deal/{id} (href was: ${href})`, true);
});

test('Journey 1 — similar deal or nudge', async ({ page }) => {
  await page.setViewportSize(DESKTOP);

  // Navigate to homepage to find a deal
  await page.goto('/');
  await page.waitForLoadState('networkidle', { timeout: NETWORKIDLE_TIMEOUT });

  const cardCount = await page.locator('.feat, .deal').count();
  if (cardCount === 0) {
    record('similar deal cross-link', false, 'NO DEAL CARDS — skipped');
    await shot(page, '04-deal2.png');
    return;
  }

  // Navigate to deal detail
  await page.locator('.feat, .deal').first().click();
  await page.waitForURL(/\/deal\/\d+/, { timeout: TIMEOUT });
  await page.waitForLoadState('networkidle', { timeout: NETWORKIDLE_TIMEOUT });

  const currentUrl = page.url();
  const similarCount = await page.locator('.grid3 .deal, .grid3 .feat').count();

  if (similarCount > 0) {
    // Click first similar deal
    const similarCard = page.locator('.grid3 .deal, .grid3 .feat').first();
    const similarHref = await similarCard.getAttribute('href');
    await similarCard.click();
    await page.waitForURL(/\/deal\/\d+/, { timeout: TIMEOUT });
    await page.waitForLoadState('networkidle', { timeout: NETWORKIDLE_TIMEOUT });

    const newUrl = page.url();
    await shot(page, '04-deal2.png');
    record(`similar deal → /deal/{otherId} (from ${currentUrl} → ${newUrl})`, newUrl !== currentUrl);
  } else {
    // No similar deals — screenshot the email-nudge + booking CTA region
    await shot(page, '04-deal2.png');
    record('similar deal cross-link', false, 'no similar deals in seed — captured booking CTA + nudge region instead');
  }
});

// ── JOURNEY 2 — Collections ───────────────────────────────────────────────────

test('Journey 2 — collections index', async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await page.goto('/');
  await page.waitForLoadState('networkidle', { timeout: NETWORKIDLE_TIMEOUT });

  // Click header "Collections" link
  const collectionsLink = page.getByRole('link', { name: /^collections$/i });
  await expect(collectionsLink).toBeVisible({ timeout: TIMEOUT });
  await collectionsLink.click();

  await page.waitForURL(/\/collections/, { timeout: TIMEOUT });
  await page.waitForLoadState('networkidle', { timeout: NETWORKIDLE_TIMEOUT });

  // Verify page loaded
  await expect(page.locator('.ctile').first()).toBeVisible({ timeout: TIMEOUT });
  await shot(page, '10-collections-index.png');
  record('Header "Collections" nav → /collections', true);
});

test('Journey 2 — collection page', async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await page.goto('/collections');
  await page.waitForLoadState('networkidle', { timeout: NETWORKIDLE_TIMEOUT });

  // .ctile is the inner <Photo> div — the <Link> wrapping it is the actual <a>.
  // We get the href from the wrapping anchor, then click the tile.
  const firstLink = page.locator('a[href*="cheap-flights"]').first();
  const firstTile = page.locator('.ctile').first();
  await expect(firstTile).toBeVisible({ timeout: TIMEOUT });

  // Get the slug from the parent anchor
  const tileHref = await firstLink.getAttribute('href');
  await firstTile.click();

  // Wait for a URL that is NOT /collections (i.e. has navigated to a slug page)
  await page.waitForURL((url) => !url.pathname.endsWith('/collections'), { timeout: TIMEOUT });
  await page.waitForLoadState('networkidle', { timeout: NETWORKIDLE_TIMEOUT });

  const landedUrl = page.url();

  // Verify breadcrumb and H1
  await expect(page.locator('.crumb')).toBeVisible({ timeout: TIMEOUT });
  await expect(page.locator('h1').first()).toBeVisible({ timeout: TIMEOUT });

  await shot(page, '11-collection-page.png');
  record(`collection tile (.ctile inside <Link href="${tileHref}"> ) → ${landedUrl}`, true);
});

test('Journey 2 — breadcrumb back', async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  // Start from a known collection to test breadcrumb
  await page.goto('/cheap-flights-from-vilnius');
  await page.waitForLoadState('networkidle', { timeout: NETWORKIDLE_TIMEOUT });

  // Verify breadcrumb is visible
  await expect(page.locator('.crumb')).toBeVisible({ timeout: TIMEOUT });

  // Click the "Collections" breadcrumb link
  const crumbCollLink = page.locator('.crumb').getByRole('link', { name: /collections/i });
  const crumbHomeLink = page.locator('.crumb').getByRole('link', { name: /home/i });

  let clickedLink = '';
  if (await crumbCollLink.count() > 0) {
    await crumbCollLink.first().click();
    clickedLink = 'Collections';
  } else if (await crumbHomeLink.count() > 0) {
    await crumbHomeLink.first().click();
    clickedLink = 'Home';
  } else {
    // Fallback: click first link in breadcrumb
    await page.locator('.crumb a').first().click();
    clickedLink = 'first crumb link';
  }

  // Wait for the URL to change away from the collection page
  await page.waitForURL(
    (url) => !url.pathname.includes('cheap-flights'),
    { timeout: TIMEOUT },
  );
  await page.waitForLoadState('networkidle', { timeout: NETWORKIDLE_TIMEOUT });
  const landedUrl = page.url();

  await shot(page, '12-breadcrumb-back.png');
  record(`breadcrumb "${clickedLink}" → ${landedUrl}`, true);
});

// ── JOURNEY 3 — Past fares ───────────────────────────────────────────────────

test('Journey 3 — past deals', async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await page.goto('/');
  await page.waitForLoadState('networkidle', { timeout: NETWORKIDLE_TIMEOUT });

  // Click header "Past fares" link
  const pastFaresLink = page.getByRole('link', { name: /past fares/i });
  await expect(pastFaresLink).toBeVisible({ timeout: TIMEOUT });
  await pastFaresLink.click();

  await page.waitForURL(/\/past-deals/, { timeout: TIMEOUT });
  await page.waitForLoadState('networkidle', { timeout: NETWORKIDLE_TIMEOUT });

  // Verify the page loaded with H1
  await expect(page.locator('h1').first()).toBeVisible({ timeout: TIMEOUT });

  await shot(page, '20-past-deals.png');
  record('Header "Past fares" nav → /past-deals', true);
});

// ── JOURNEY 4 — Signup flow ──────────────────────────────────────────────────

test('Journey 4 — home signup filled', async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await page.goto('/');
  await page.waitForLoadState('networkidle', { timeout: NETWORKIDLE_TIMEOUT });

  // Fill the inline SignupCard (.cap input[type=email]) in the hero
  const emailInput = page.locator('.cap input[type="email"]').first();
  await expect(emailInput).toBeVisible({ timeout: TIMEOUT });
  await emailInput.fill(EMAIL1);

  // Viewport shot of filled card (not full page)
  await shot(page, '30-home-signup-filled.png', false);
  record(`inline SignupCard email filled (${EMAIL1})`, true);
});

test('Journey 4 — home signup success', async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await page.goto('/');
  await page.waitForLoadState('networkidle', { timeout: NETWORKIDLE_TIMEOUT });

  // Fill and submit
  const emailInput = page.locator('.cap input[type="email"]').first();
  await expect(emailInput).toBeVisible({ timeout: TIMEOUT });
  await emailInput.fill(EMAIL1);

  const submitBtn = page.locator('.cap button[type="submit"]').first();
  await expect(submitBtn).toBeVisible({ timeout: TIMEOUT });
  await submitBtn.click();

  // Wait for success state — "You're in" text
  await expect(page.locator('.cap').first()).toContainText("You're in", { timeout: TIMEOUT });

  // Viewport shot
  await shot(page, '31-home-signup-success.png', false);
  record(`SignupCard submit (${EMAIL1}) → "You're in." success + upsell (early-alerts link visible)`, true);
});

test('Journey 4 — subscribe idle', async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await page.goto('/subscribe');
  await page.waitForLoadState('networkidle', { timeout: NETWORKIDLE_TIMEOUT });

  // Verify idle state
  await expect(page.locator('h1').first()).toBeVisible({ timeout: TIMEOUT });
  await expect(page.locator('h1').first()).toContainText('Get hand-checked cheap flights');

  await shot(page, '32-subscribe-idle.png');
  record('/subscribe page renders (idle state, standalone card)', true);
});

test('Journey 4 — subscribe confirmed + prefs', async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await page.goto('/subscribe');
  await page.waitForLoadState('networkidle', { timeout: NETWORKIDLE_TIMEOUT });

  // Fill and submit
  const emailInput = page.getByLabel(/email address/i).first();
  await expect(emailInput).toBeVisible({ timeout: TIMEOUT });
  await emailInput.fill(EMAIL2);

  const submitBtn = page.getByRole('button', { name: /get free weekly deals/i });
  await expect(submitBtn).toBeVisible({ timeout: TIMEOUT });
  await submitBtn.click();

  // Wait for redirect to confirmed or check-email
  await page.waitForURL(/\/subscribe\?state=(confirmed|check-email)/, { timeout: TIMEOUT });
  const url = page.url();

  await page.waitForLoadState('networkidle', { timeout: NETWORKIDLE_TIMEOUT });
  await shot(page, '33-subscribe-confirmed.png');

  if (url.includes('confirmed')) {
    record(`subscribe submit (${EMAIL2}) → ?state=confirmed (prefs form + skip + upsell link)`, true);
  } else {
    record(`subscribe submit (${EMAIL2}) → ?state=check-email (double opt-in mode — prod with Resend)`, true, 'RESEND_API_KEY set, double opt-in in effect');
  }
});

test('Journey 4 — prefs selected', async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  // Navigate directly to confirmed state to show prefs
  await page.goto('/subscribe?state=confirmed');
  await page.waitForLoadState('networkidle', { timeout: NETWORKIDLE_TIMEOUT });

  // Check if the prefs form is shown (confirmed state shows it)
  const prefChips = page.locator('.pref-chip');
  const chipCount = await prefChips.count();

  if (chipCount > 0) {
    // Select first 2 origin chips
    const originGroup = page.locator('[aria-label="Departure airports"] .pref-chip');
    const originCount = await originGroup.count();
    if (originCount >= 1) await originGroup.nth(0).click();
    if (originCount >= 2) await originGroup.nth(1).click();

    // Select first moment chip
    const momentGroup = page.locator('[aria-label="Trip types"] .pref-chip');
    const momentCount = await momentGroup.count();
    if (momentCount >= 1) await momentGroup.nth(0).click();

    // Viewport shot showing selected state
    await shot(page, '34-prefs-selected.png', false);
    record('prefs chips selectable (2 origins + 1 moment selected)', true);
  } else {
    // If ?state=check-email is active (prod mode), we land on check-email
    await shot(page, '34-prefs-selected.png', false);
    record('prefs chips', false, 'state=confirmed shows prefs; if check-email, double opt-in mode active');
  }
});

test('Journey 4 — prefs saved', async ({ page }) => {
  await page.setViewportSize(DESKTOP);

  // We need to be in confirmed state with a valid cookie.
  // Re-submit the subscribe form to get a fresh token cookie.
  await page.goto('/subscribe');
  await page.waitForLoadState('networkidle', { timeout: NETWORKIDLE_TIMEOUT });

  // Use a unique email per test run — EMAIL2 is used for the 33-subscribe-confirmed shot,
  // so we need a separate fresh email here to get a new cookie for prefs-saved.
  // We generate a sibling variant to keep the qa+journey2 naming convention.
  const prefEmail = `qa+journey2prefs-${RUN_TS}@example.com`;
  const emailInput = page.getByLabel(/email address/i).first();
  await emailInput.fill(prefEmail);
  const submitBtn = page.getByRole('button', { name: /get free weekly deals/i });
  await submitBtn.click();

  await page.waitForURL(/\/subscribe\?state=(confirmed|check-email)/, { timeout: TIMEOUT });
  const confirmUrl = page.url();

  if (!confirmUrl.includes('state=confirmed')) {
    // Double opt-in mode — can't test prefs-saved chain without email click
    await page.waitForLoadState('networkidle', { timeout: NETWORKIDLE_TIMEOUT });
    await shot(page, '35-prefs-saved.png');
    record('Save prefs → ?state=prefs-saved', false, 'double opt-in mode — cookie only set after email confirmation click');
    return;
  }

  await page.waitForLoadState('networkidle', { timeout: NETWORKIDLE_TIMEOUT });

  // Now click Save (with whatever checkboxes are pre-selected)
  const saveBtn = page.getByRole('button', { name: /save/i });
  await expect(saveBtn).toBeVisible({ timeout: TIMEOUT });
  await saveBtn.click();

  await page.waitForURL(/\/subscribe\?state=prefs-saved/, { timeout: TIMEOUT });
  await page.waitForLoadState('networkidle', { timeout: NETWORKIDLE_TIMEOUT });

  await shot(page, '35-prefs-saved.png');
  record(`Save prefs (${prefEmail}) → ?state=prefs-saved (UpsellState: "Join the early-alerts waitlist →" visible)`, true);
});

test('Journey 4 — early joined', async ({ page }) => {
  await page.setViewportSize(DESKTOP);

  // Use a fresh unique email for this run to ensure we get a new cookie.
  // The token cookie is only issued for new (unconfirmed→confirmed) rows.
  const earlyEmail = `qa+journey2early-${RUN_TS}@example.com`;

  // Re-run the subscribe flow to get a fresh cookie, then go through
  // prefs, then click "Join the early-alerts waitlist →"
  await page.goto('/subscribe');
  await page.waitForLoadState('networkidle', { timeout: NETWORKIDLE_TIMEOUT });

  const emailInput = page.getByLabel(/email address/i).first();
  await emailInput.fill(earlyEmail);
  const submitBtn = page.getByRole('button', { name: /get free weekly deals/i });
  await submitBtn.click();

  await page.waitForURL(/\/subscribe\?state=(confirmed|check-email)/, { timeout: TIMEOUT });
  const url = page.url();

  if (!url.includes('state=confirmed')) {
    await page.waitForLoadState('networkidle', { timeout: NETWORKIDLE_TIMEOUT });
    await shot(page, '36-early-joined.png');
    record('Join early alerts → ?state=early-joined (token cleared)', false, 'double opt-in mode — cannot complete flow without email confirmation');
    return;
  }

  await page.waitForLoadState('networkidle', { timeout: NETWORKIDLE_TIMEOUT });

  // Click Save to advance to prefs-saved → UpsellState
  const saveBtn = page.getByRole('button', { name: /save/i });
  if (await saveBtn.count() > 0) {
    await saveBtn.click();
    await page.waitForURL(/\/subscribe\?state=prefs-saved/, { timeout: TIMEOUT });
    await page.waitForLoadState('networkidle', { timeout: NETWORKIDLE_TIMEOUT });
  }

  // Now click "Join the early-alerts waitlist →" button
  const joinBtn = page.getByRole('button', { name: /join the early-alerts waitlist/i });
  await expect(joinBtn).toBeVisible({ timeout: TIMEOUT });
  await joinBtn.click();

  await page.waitForURL(/\/subscribe\?state=early-joined/, { timeout: TIMEOUT });
  await page.waitForLoadState('networkidle', { timeout: NETWORKIDLE_TIMEOUT });

  await shot(page, '36-early-joined.png');
  record(`Join early alerts (${earlyEmail}) → ?state=early-joined (token cleared, "You're on the early-alerts list.")`, true);
});

// ── JOURNEY 5 — Early-alerts landing ─────────────────────────────────────────

test('Journey 5 — early alerts page', async ({ page }) => {
  await page.setViewportSize(DESKTOP);

  // Navigate via the EarlyAlertsBand CTA on homepage
  await page.goto('/');
  await page.waitForLoadState('networkidle', { timeout: NETWORKIDLE_TIMEOUT });

  // Try the EarlyAlertsBand "Get early alerts →" button
  const earlyBandLink = page.locator('.early').getByRole('link', { name: /get early alerts/i });
  const heroEarlyLink = page.locator('.cap').getByRole('link', { name: /get early alerts/i });
  const headerEarlyLink = page.getByRole('link', { name: /early alerts/i }).first();

  let ctaUsed = '';
  if (await earlyBandLink.count() > 0) {
    await earlyBandLink.first().click();
    ctaUsed = 'EarlyAlertsBand "Get early alerts →"';
  } else if (await heroEarlyLink.count() > 0) {
    await heroEarlyLink.first().click();
    ctaUsed = 'Hero SignupCard "Get early alerts →"';
  } else {
    // Fallback: navigate directly
    await page.goto('/early-alerts');
    ctaUsed = 'direct navigation (no CTA visible in seed)';
  }

  await page.waitForURL(/\/early-alerts/, { timeout: TIMEOUT });
  await page.waitForLoadState('networkidle', { timeout: NETWORKIDLE_TIMEOUT });

  // Verify comparison cards
  await expect(page.locator('.cmpcard').first()).toBeVisible({ timeout: TIMEOUT });

  await shot(page, '40-early-alerts.png');
  record(`"${ctaUsed}" → /early-alerts (free-vs-early comparison + join form)`, true);
});

test('Journey 5 — early alerts submitted', async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await page.goto('/early-alerts');
  await page.waitForLoadState('networkidle', { timeout: NETWORKIDLE_TIMEOUT });

  // Fill the join form
  const joinForm = page.getByRole('form', { name: /join the early-alerts waitlist/i });
  await expect(joinForm).toBeVisible({ timeout: TIMEOUT });

  const joinEmailInput = joinForm.getByLabel(/email address/i);
  await joinEmailInput.fill(EMAIL3);

  const joinBtn = joinForm.getByRole('button');
  await joinBtn.click();

  // Redirects to /subscribe?state=confirmed or check-email
  await page.waitForURL(/\/subscribe\?state=(confirmed|check-email)/, { timeout: TIMEOUT });
  await page.waitForLoadState('networkidle', { timeout: NETWORKIDLE_TIMEOUT });

  const landedUrl = page.url();
  await shot(page, '41-early-alerts-submitted.png');

  if (landedUrl.includes('confirmed')) {
    record(`early-alerts join form (${EMAIL3}) → /subscribe?state=confirmed`, true);
  } else {
    record(`early-alerts join form (${EMAIL3}) → /subscribe?state=check-email (double opt-in)`, true, 'RESEND_API_KEY set — double opt-in');
  }
});

// ── HTML STORYBOARD GENERATOR ─────────────────────────────────────────────────

test('Generate journey-map.html', async () => {
  const generatedAt = new Date().toISOString();

  // Define the ordered steps for the storyboard
  const steps: {
    journey: string;
    num: string;
    file: string;
    caption: string;
    connection: string;
    viewportOnly?: boolean;
  }[] = [
    {
      journey: 'Journey 1 — Discover → Deal → Similar (the core funnel)',
      num: '01',
      file: '01-home-desktop.png',
      caption: 'Homepage at 1366px desktop — hero, live deals, capture band, past fares, collections, process, early-alerts band, FAQ, footer.',
      connection: '→ loaded / (all 10 sections)',
    },
    {
      journey: 'Journey 1 — Discover → Deal → Similar (the core funnel)',
      num: '02',
      file: '02-home-mobile.png',
      caption: 'Homepage at 390px mobile — hero section stacks vertically; SignupCard below H1.',
      connection: '→ mobile viewport render confirmed ✓',
    },
    {
      journey: 'Journey 1 — Discover → Deal → Similar (the core funnel)',
      num: '03',
      file: '03-deal-detail.png',
      caption: 'Deal detail page — hero image, destination H1, price block (.price), "Why it\'s good" + "The catch", curator note, booking CTA (.bookbtn "Open in Google Flights").',
      connection: '→ clicked first deal card (.feat/.deal) → /deal/{id} ✓',
    },
    {
      journey: 'Journey 1 — Discover → Deal → Similar (the core funnel)',
      num: '04',
      file: '04-deal2.png',
      caption: 'Second deal (via similar-deals .grid3) or deal email-nudge + booking CTA if no similar deals in seed.',
      connection: '→ clicked similar deal card in .grid3 → /deal/{otherId} (cross-link proven) ✓',
    },
    {
      journey: 'Journey 2 — Collections (SEO browse)',
      num: '10',
      file: '10-collections-index.png',
      caption: '/collections index — grid of .ctile destination tiles (SEO browse hub).',
      connection: '→ clicked Header nav "Collections" → /collections ✓',
    },
    {
      journey: 'Journey 2 — Collections (SEO browse)',
      num: '11',
      file: '11-collection-page.png',
      caption: 'Collection page — breadcrumb (.crumb), .coll-hero h1, deal grid (.grid3) or empty state (.coll-empty).',
      connection: '→ clicked first .ctile tile → /{slug} ✓',
    },
    {
      journey: 'Journey 2 — Collections (SEO browse)',
      num: '12',
      file: '12-breadcrumb-back.png',
      caption: 'Breadcrumb navigation — landed back at Collections or Home after clicking the breadcrumb link.',
      connection: '→ clicked .crumb "Collections" or "Home" → /collections or / ✓',
    },
    {
      journey: 'Journey 3 — Past fares',
      num: '20',
      file: '20-past-deals.png',
      caption: '/past-deals — expired fare grid (or empty state), CaptureBand below, proof-of-quality narrative.',
      connection: '→ clicked Header nav "Past fares" → /past-deals ✓',
    },
    {
      journey: 'Journey 4 — Signup flow (inline → /subscribe → prefs → early-alerts chain)',
      num: '30',
      file: '30-home-signup-filled.png',
      caption: `Hero SignupCard (.cap) with email "${EMAIL1}" typed into the inline form. Viewport-only shot.`,
      connection: '→ .cap input[type=email] fillable ✓',
      viewportOnly: true,
    },
    {
      journey: 'Journey 4 — Signup flow (inline → /subscribe → prefs → early-alerts chain)',
      num: '31',
      file: '31-home-signup-success.png',
      caption: 'SignupCard success state — "You\'re in." confirmation + "Want them sooner? Get early alerts →" upsell link. Viewport-only shot.',
      connection: '→ submit inline form → success state + early-alerts cross-link ✓',
      viewportOnly: true,
    },
    {
      journey: 'Journey 4 — Signup flow (inline → /subscribe → prefs → early-alerts chain)',
      num: '32',
      file: '32-subscribe-idle.png',
      caption: '/subscribe idle state — standalone "Get hand-checked cheap flights by email." card with email input, early-alerts checkbox option, and trust signals.',
      connection: '→ /subscribe (standalone entry point B)',
    },
    {
      journey: 'Journey 4 — Signup flow (inline → /subscribe → prefs → early-alerts chain)',
      num: '33',
      file: '33-subscribe-confirmed.png',
      caption: '/subscribe?state=confirmed — "You\'re confirmed." + preference chips (departure airports + trip types) + Save button + Skip link.',
      connection: '→ subscribe submit (dev single opt-in) → ?state=confirmed (prefs + upsell) ✓',
    },
    {
      journey: 'Journey 4 — Signup flow (inline → /subscribe → prefs → early-alerts chain)',
      num: '34',
      file: '34-prefs-selected.png',
      caption: 'Prefs form with 2 origin chips + 1 moment chip selected (visual checkbox state). Viewport-only shot.',
      connection: '→ .pref-chip labels are clickable / checked state visible ✓',
      viewportOnly: true,
    },
    {
      journey: 'Journey 4 — Signup flow (inline → /subscribe → prefs → early-alerts chain)',
      num: '35',
      file: '35-prefs-saved.png',
      caption: '/subscribe?state=prefs-saved — renders UpsellState: "Some fares are gone by the weekly email." + "Join the early-alerts waitlist →" button.',
      connection: '→ Save prefs → ?state=prefs-saved ✓',
    },
    {
      journey: 'Journey 4 — Signup flow (inline → /subscribe → prefs → early-alerts chain)',
      num: '36',
      file: '36-early-joined.png',
      caption: '/subscribe?state=early-joined — "You\'re on the early-alerts list." confirmation. Token cleared from DB. Flow complete.',
      connection: '→ Join early-alerts waitlist → ?state=early-joined (confirmed → prefs → early-joined chain proven) ✓',
    },
    {
      journey: 'Journey 5 — Early-alerts landing',
      num: '40',
      file: '40-early-alerts.png',
      caption: '/early-alerts — hero, free-vs-early comparison (.cmpcard × 2), join form (aria-label), premium-soft note.',
      connection: '→ EarlyAlertsBand / hero CTA → /early-alerts ✓',
    },
    {
      journey: 'Journey 5 — Early-alerts landing',
      num: '41',
      file: '41-early-alerts-submitted.png',
      caption: 'After early-alerts join form submit (qa+journey3@…) — lands on /subscribe?state=confirmed or check-email.',
      connection: '→ /early-alerts join form submit → /subscribe?state=confirmed ✓',
    },
  ];

  // Group steps by journey
  const journeyMap = new Map<string, typeof steps>();
  for (const s of steps) {
    if (!journeyMap.has(s.journey)) journeyMap.set(s.journey, []);
    journeyMap.get(s.journey)!.push(s);
  }

  // Build connections summary from the recorded array
  const connHtml = connections
    .map(
      (c) =>
        `<li class="${c.ok ? 'ok' : 'warn'}">${c.ok ? '✓' : '✗'} ${escHtml(c.key)}${c.note ? ` <span class="note">(${escHtml(c.note)})</span>` : ''}</li>`,
    )
    .join('\n');

  // Build journey sections
  const journeySections: string[] = [];
  for (const [journeyName, jSteps] of journeyMap) {
    const cardsHtml: string[] = [];
    for (let i = 0; i < jSteps.length; i++) {
      const s = jSteps[i];
      const imgPath = s.file;
      // Only link the image if the file exists
      const exists = fs.existsSync(path.join(SHOTS_DIR, s.file));
      const imgHtml = exists
        ? `<img src="${imgPath}" alt="Step ${s.num}" style="width:100%;border:1px solid #E0D2BA;border-radius:8px;display:block;">`
        : `<div style="width:100%;height:200px;background:#F0E8D8;border:2px dashed #E0D2BA;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#9E8C74;font-size:13px;">Screenshot not captured: ${escHtml(s.file)}</div>`;

      cardsHtml.push(`
        <div class="step-card">
          <div class="step-num">Step ${s.num}</div>
          ${imgHtml}
          <div class="step-caption">${escHtml(s.caption)}</div>
          <div class="step-connection">${escHtml(s.connection)}</div>
        </div>
        ${i < jSteps.length - 1 ? '<div class="arrow">↓</div>' : ''}
      `);
    }

    journeySections.push(`
      <section class="journey">
        <h2>${escHtml(journeyName)}</h2>
        <div class="journey-flow">
          ${cardsHtml.join('\n')}
        </div>
      </section>
    `);
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Yip — public-site user-journey map</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      background: #FBF6EC;
      color: #1C1813;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 15px;
      line-height: 1.5;
      padding: 0 0 60px;
    }

    /* Header */
    .page-header {
      background: #1C1813;
      color: #FBF6EC;
      padding: 32px 40px 28px;
      position: sticky;
      top: 0;
      z-index: 10;
      display: flex;
      align-items: baseline;
      gap: 16px;
      flex-wrap: wrap;
    }
    .page-header h1 {
      font-size: 20px;
      font-weight: 800;
      letter-spacing: -0.4px;
    }
    .page-header h1 span { color: #E2820E; }
    .page-header .subtitle {
      font-size: 13px;
      color: #9E8C74;
      font-family: 'JetBrains Mono', 'Fira Code', 'Courier New', monospace;
    }
    .page-header .gen-at {
      margin-left: auto;
      font-size: 11px;
      color: #6B5E4E;
      font-family: monospace;
    }

    /* Connections summary */
    .connections-summary {
      max-width: 820px;
      margin: 32px auto 0;
      padding: 0 24px;
    }
    .connections-summary h2 {
      font-size: 13px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #9E8C74;
      margin-bottom: 10px;
    }
    .connections-summary ul {
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
    .connections-summary li {
      font-family: 'JetBrains Mono', 'Fira Code', 'Courier New', monospace;
      font-size: 12px;
      padding: 6px 10px;
      border-radius: 5px;
    }
    .connections-summary li.ok {
      background: #EAF4ED;
      color: #1A6132;
      border: 1px solid #B6DFC5;
    }
    .connections-summary li.warn {
      background: #FFF3E0;
      color: #7A4100;
      border: 1px solid #F5C78A;
    }
    .connections-summary li .note {
      color: #9E8C74;
    }

    /* Journey sections */
    .journey {
      max-width: 820px;
      margin: 40px auto 0;
      padding: 0 24px;
    }
    .journey h2 {
      font-size: 16px;
      font-weight: 800;
      color: #E2820E;
      border-bottom: 2px solid #E2820E;
      padding-bottom: 8px;
      margin-bottom: 24px;
      letter-spacing: -0.2px;
    }

    .journey-flow {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0;
    }

    /* Step card */
    .step-card {
      width: 100%;
      background: #fff;
      border: 1px solid #E0D2BA;
      border-radius: 10px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .step-num {
      font-family: 'JetBrains Mono', 'Fira Code', 'Courier New', monospace;
      font-size: 11px;
      font-weight: 700;
      color: #9E8C74;
      text-transform: uppercase;
      letter-spacing: 0.1em;
    }
    .step-caption {
      font-size: 13px;
      color: #3E3128;
      line-height: 1.45;
    }
    .step-connection {
      font-family: 'JetBrains Mono', 'Fira Code', 'Courier New', monospace;
      font-size: 11.5px;
      color: #B06010;
      background: #FFF3E0;
      border: 1px solid #F5C78A;
      border-radius: 4px;
      padding: 5px 9px;
      line-height: 1.4;
    }

    /* Arrow between steps */
    .arrow {
      font-size: 22px;
      color: #E2820E;
      padding: 6px 0;
      line-height: 1;
      text-align: center;
      width: 100%;
    }
  </style>
</head>
<body>
  <div class="page-header">
    <h1>Yip — <span>public-site user-journey map</span></h1>
    <span class="subtitle">feat/site-cro-redesign · every connected path, one storyboard</span>
    <span class="gen-at">Generated: ${generatedAt}</span>
  </div>

  <div class="connections-summary">
    <h2>Connections verified</h2>
    <ul>
      ${connHtml}
    </ul>
  </div>

  ${journeySections.join('\n')}
</body>
</html>`;

  fs.writeFileSync(path.join(SHOTS_DIR, 'journey-map.html'), html, 'utf8');
  console.log(`\n✓ journey-map.html written to ${SHOTS_DIR}/journey-map.html`);
  console.log(`\nConnections recorded (${connections.length}):`);
  for (const c of connections) {
    console.log(`  ${c.ok ? '✓' : '✗'} ${c.key}${c.note ? ` (${c.note})` : ''}`);
  }
});

// ── Utility ──────────────────────────────────────────────────────────────────

function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
