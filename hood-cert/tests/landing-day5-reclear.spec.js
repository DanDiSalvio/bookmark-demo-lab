import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const assetsDir = path.join(__dirname, '../assets');
const PDF_PATH = path.join(assetsDir, 'sample-service-record.pdf');

const HERO_WIDTHS = [320, 390, 768, 1024, 1280, 1440];
const TILE_URL_RE = /hero-tiles\/hood-(before|after)-/;

async function titleLineCount(page, selector) {
  return page.locator(selector).evaluate((el) => {
    const tops = new Set();
    for (const r of el.getClientRects()) {
      tops.add(Math.round(r.top));
    }
    return tops.size;
  });
}

test.describe('Day 5 re-clear landing', () => {
  test('W1 mobile tile byte budget and zero desktop tile bytes', async ({ browser, browserName }) => {
    test.skip(browserName !== 'chromium', 'resource timing probe uses Chromium');

    for (const dpr of [1, 2, 3]) {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: dpr
      });
      const probePage = await context.newPage();
      const bytes = [];
      probePage.on('response', async (res) => {
        const url = res.url();
        if (!TILE_URL_RE.test(url)) return;
        const body = await res.body().catch(() => null);
        if (body) bytes.push(body.length);
      });

      await probePage.goto('/hood-cert/', { waitUntil: 'networkidle' });
      await expect(probePage.locator('.hero-preview__tile img').first()).toBeVisible();
      const total = bytes.reduce((a, b) => a + b, 0);
      expect(total).toBeGreaterThan(0);
      expect(total).toBeLessThanOrEqual(160 * 1024);
      await context.close();
    }

    const desktopCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const desktopPage = await desktopCtx.newPage();
    const tileRequests = [];
    desktopPage.on('request', (req) => {
      if (TILE_URL_RE.test(req.url())) tileRequests.push(req.url());
    });
    await desktopPage.goto('/hood-cert/', { waitUntil: 'networkidle' });
    expect(tileRequests).toHaveLength(0);
    await desktopCtx.close();
  });

  test('W2 hero due date matches fixed PDF sample dates', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/hood-cert/');
    await expect(page.locator('#hero-next-due')).toHaveText('Next cleaning due: Jan 19, 2027');
    await expect(page.locator('#hero-before-time')).toHaveText('Oct 19, 10:05 AM');
    await expect(page.locator('#hero-after-time')).toHaveText('Oct 19, 11:40 AM');
  });

  test('W3 h1 is at most two lines across key widths', async ({ page }) => {
    for (const width of HERO_WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/hood-cert/');
      const lines = await titleLineCount(page, '.hero__title');
      expect(lines).toBeLessThanOrEqual(2);
    }
  });

  test('W4 landing board rows match app overdue and due sections', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/hood-cert/');
    await expect(page.locator('#landing-rebook-root')).toHaveAttribute('data-ui', 'rebook-board-preview');
    await expect(page.getByRole('link', { name: 'Send rebook note' }).first()).toHaveAttribute(
      'href',
      /sample=1&rebook=/
    );
    const landingNames = await page
      .locator('#landing-rebook-root .landing-rebook__name')
      .allTextContents();

    await page.addInitScript(() => localStorage.clear());
    await page.goto('/hood-cert/app/?sample=1');
    await page.getByRole('button', { name: 'Board' }).click();
    const unlock = page.getByRole('button', { name: 'Preview Pro board (demo)' });
    if (await unlock.isVisible()) await unlock.click();

    const appNames = await page
      .locator('.board-section')
      .filter({ has: page.locator('.board-section__title', { hasText: /Overdue|Due in 30 days/ }) })
      .locator('.board-row__name')
      .allTextContents();

    expect(landingNames).toEqual(appNames);
  });

  test('W5 PDF text has accurate disclaimer and no Cropped wording', () => {
    const text = execSync(`pdftotext -layout "${PDF_PATH}" -`, { encoding: 'utf8' });
    expect(text).toContain('Sample photos, not from a real job.');
    expect(text).toContain('Recompressed, not cropped.');
    expect(text.toLowerCase()).not.toContain('cropped and');
  });

  test('M6 no-JS board and hero dates are present in HTML', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/hood-cert/');
    await expect(page.locator('#landing-rebook-root .landing-rebook__name').first()).toBeVisible();
    await expect(page.locator('#hero-next-due')).toContainText('Jan 19, 2027');
    await context.close();
  });
});
