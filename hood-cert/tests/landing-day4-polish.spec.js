import { test, expect } from '@playwright/test';

async function titleLineCount(page, selector) {
  return page.locator(selector).evaluate((el) => {
    const rects = el.getClientRects();
    const tops = new Set();
    for (const r of rects) {
      tops.add(Math.round(r.top));
    }
    return tops.size;
  });
}

test.describe('Day 4 landing polish', () => {
  test('T1 hero headline stays under three lines @ 1280 and 390', async ({ page }) => {
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/hood-cert/');
      const lines = await titleLineCount(page, '.hero__title');
      expect(lines).toBeLessThan(3);
    }
  });

  test('T2 rebook fragment renders sample board rows with dates', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/hood-cert/');
    const board = page.getByRole('region', { name: 'Rebook board preview' });
    await expect(board).toBeVisible();
    await expect(board.getByText('Harbor Grill')).toBeVisible();
    await expect(board.getByText('Brick Oven Pizza Co')).toBeVisible();
    await expect(board.getByText(/days overdue/)).toHaveCount(2, { timeout: 5000 });
    await expect(board.locator('.badge--overdue').first()).toBeVisible();
  });

  test('HC-23a hero PDF link works from 768px and up', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 900 });
    await page.goto('/hood-cert/');
    const link = page.locator('.hero-preview__img-link--desktop');
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', /sample-service-record\.pdf$/);
    await expect(link).toHaveAttribute('target', '_blank');
    const pe = await link.evaluate((el) => getComputedStyle(el).pointerEvents);
    expect(pe).not.toBe('none');
  });

  test('HC-23b photo pair uses CSS gap between tiles @ 390px', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/hood-cert/');
    const pair = page.locator('.hero-preview__photo-pair');
    await expect(pair).toBeVisible();
    const gap = await pair.evaluate((el) => getComputedStyle(el).gap);
    expect(gap).not.toBe('normal');
    expect(parseFloat(gap)).toBeGreaterThan(0);
    const marginLeft = await page
      .locator('.hero-preview__tile')
      .nth(1)
      .evaluate((el) => getComputedStyle(el).marginLeft);
    expect(parseFloat(marginLeft) || 0).toBe(0);
  });

  test('HC-23c caption matches sample disclaimer wording', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/hood-cert/');
    await expect(page.locator('.hero-preview__caption-disclaimer')).toHaveText(
      'Sample photos, not from a real job.'
    );
    await expect(page.locator('.hero-preview__pdf-status')).toHaveText('Pass');
  });

  test('HC-23d landing Pass labels match PDF status constants', async ({ page }) => {
    await page.goto('/hood-cert/');
    await page.waitForFunction(() => window.HoodCertSampleBoard);
    const pdfPass = await page.evaluate(
      () => window.HoodCertSampleBoard.PDF_AREA_STATUS.pass
    );
    const labels = await page.locator('[data-pdf-status="pass"]').allTextContents();
    expect(labels.length).toBeGreaterThan(0);
    labels.forEach((text) => expect(text.trim()).toBe(pdfPass));
  });

  test('HC-23e photo tiles fit at 320px without horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto('/hood-cert/');
    const overflow = await page.evaluate(() => {
      const doc = document.documentElement;
      return doc.scrollWidth - doc.clientWidth;
    });
    expect(overflow).toBeLessThanOrEqual(1);
    const pair = page.locator('.hero-preview__photo-pair');
    const box = await pair.boundingBox();
    expect(box).toBeTruthy();
    expect(box.width).toBeLessThanOrEqual(320 - 32 + 1);
  });

  test('HC-25 desktop hero photo credit is fully in viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/hood-cert/');
    const credit = page.locator('.sample-photo-credit--hero');
    await expect(credit).toBeVisible();
    const inView = await credit.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      const parent = el.parentElement;
      const parentRect = parent ? parent.getBoundingClientRect() : rect;
      const clipped =
        rect.bottom > parentRect.bottom + 0.5 ||
        rect.top < parentRect.top - 0.5 ||
        rect.right > parentRect.right + 0.5 ||
        rect.left < parentRect.left - 0.5;
      const overflowY = getComputedStyle(parent).overflowY;
      const overflowHidden = overflowY === 'hidden' || overflowY === 'clip';
      return !clipped || !overflowHidden;
    });
    expect(inView).toBe(true);
    const fullyVisible = await credit.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return rect.top >= 0 && rect.bottom <= window.innerHeight && rect.height > 0;
    });
    expect(fullyVisible).toBe(true);
  });
});
