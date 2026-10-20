import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const assetsDir = path.join(__dirname, '../assets');

const CREDIT_SNIPPET = 'Long-uncleaned kitchen hood filter, close-up';

async function photoRegionHasContent(pngPath, crop) {
  const { data, info } = await sharp(pngPath)
    .extract(crop)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const channels = info.channels;
  let min = 255;
  let max = 0;
  for (let i = 0; i < data.length; i += channels) {
    const v = data[i];
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return max - min > 40;
}

test.describe('HC-20 sample photo credit', () => {
  test('landing shows CC BY-SA attribution in hero and footer', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/hood-cert/');
    const credit = page.locator('.sample-photo-credit').first();
    await expect(credit).toContainText(CREDIT_SNIPPET);
    await expect(credit.getByRole('link', { name: /Veikk0\.ma/ })).toHaveAttribute(
      'href',
      'https://commons.wikimedia.org/wiki/User:Veikk0.ma'
    );
    await expect(credit.getByRole('link', { name: /CC BY-SA 4\.0/ })).toHaveAttribute(
      'href',
      'https://creativecommons.org/licenses/by-sa/4.0/'
    );
    await expect(page.locator('.sample-photo-credit--footer')).toBeVisible();
  });
});

test.describe('HC-13 hero preview assets', () => {
  test('desktop and hero photo PNGs include visible filter photo pair', async () => {
    const desktop = path.join(assetsDir, 'certificate-preview.png');
    const heroPhotos = path.join(assetsDir, 'certificate-preview-hero-photos.png');
    const sectionMobile = path.join(assetsDir, 'certificate-preview-section-mobile.png');
    expect(fs.existsSync(desktop)).toBe(true);
    expect(fs.existsSync(heroPhotos)).toBe(true);
    expect(fs.existsSync(sectionMobile)).toBe(true);
    expect(fs.statSync(desktop).size).toBeLessThanOrEqual(400 * 1024);
    expect(fs.statSync(heroPhotos).size).toBeLessThanOrEqual(400 * 1024);
    expect(fs.statSync(path.join(assetsDir, 'certificate-preview-hero-photos.webp')).size).toBeLessThanOrEqual(
      120 * 1024
    );

    const desktopMeta = await sharp(desktop).metadata();
    expect(desktopMeta.width).toBeGreaterThanOrEqual(2000);
    expect(desktopMeta.height).toBeGreaterThanOrEqual(1650);

    const heroMeta = await sharp(heroPhotos).metadata();
    expect(heroMeta.width).toBeGreaterThanOrEqual(1000);

    const sectionMeta = await sharp(sectionMobile).metadata();
    expect(sectionMeta.width).toBe(1080);
    expect(sectionMeta.height).toBeGreaterThan(heroMeta.height);

    async function assertPhotosVisible(pngPath) {
      const { width: w, height: h } = await sharp(pngPath).metadata();
      const photoTop = Math.round(h * 0.2);
      const photoHeight = Math.min(Math.round(h * 0.7), h - photoTop);
      const crop = {
        left: Math.round(w * 0.05),
        top: photoTop,
        width: Math.round(w * 0.9),
        height: photoHeight
      };
      expect(await photoRegionHasContent(pngPath, crop)).toBe(true);
    }

    await assertPhotosVisible(desktop);
    const { width: hw, height: hh } = await sharp(heroPhotos).metadata();
    const halfW = Math.floor(hw / 2);
    expect(await photoRegionHasContent(heroPhotos, { left: 0, top: 0, width: halfW - 4, height: hh })).toBe(true);
    expect(
      await photoRegionHasContent(heroPhotos, { left: halfW + 4, top: 0, width: halfW - 4, height: hh })
    ).toBe(true);
  });

  test('mobile hero uses HTML caption and large photo tiles @ 390px', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/hood-cert/');
    await expect(page.getByText('Next cleaning due: Jan 19, 2027')).toBeVisible();
    await expect(page.getByText('Sample photos for demo, not from a real job')).toHaveCount(0);
    const link = page.locator('.hero-preview__img-link');
    await expect(link).toHaveAttribute('href', /sample-service-record\.pdf$/);
    const img = page.locator('.hero-preview__picture img');
    await expect(img).toBeVisible();
    const box = await img.boundingBox();
    expect(box).toBeTruthy();
    expect(box.width / 2).toBeGreaterThanOrEqual(170);
    const times = page.locator('.hero-preview__times-mobile');
    const fontSize = await times.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(fontSize).toBeGreaterThanOrEqual(11);
  });

  test('mobile first load skips desktop hero image', async ({ page }) => {
    const requested = [];
    page.on('request', (req) => {
      const url = req.url();
      if (url.includes('certificate-preview') && !url.includes('hero-photos')) {
        requested.push(url);
      }
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/hood-cert/');
    await expect(page.locator('.hero-preview__picture img')).toBeVisible();
    expect(requested.some((u) => u.includes('certificate-preview.png') || u.includes('certificate-preview.webp'))).toBe(
      false
    );
  });

  test('desktop hero shows full preview @ 1440px', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/hood-cert/');
    const img = page.locator('.hero-preview__picture img');
    await expect(img).toBeVisible();
    const box = await img.boundingBox();
    expect(box).toBeTruthy();
    expect(box.height).toBeGreaterThan(120);
    await expect(page.locator('.hero-preview__caption')).toBeVisible();
  });
});

test.describe('HC-14 rebook board layout', () => {
  async function openProBoard(page, width) {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(() => localStorage.clear());
    await page.goto('/hood-cert/app/?sample=1');
    await page.waitForFunction(() =>
      window.HoodCertApp.getState().accounts.some((a) => a.id.startsWith('sample-'))
    );
    await page.getByRole('button', { name: 'Board' }).click();
    const unlock = page.getByRole('button', { name: 'Preview Pro board (demo)' });
    if (await unlock.isVisible()) {
      await unlock.click();
    }
    await expect(
      page.getByRole('region', { name: 'Rebook board' }).getByRole('button', { name: 'Send rebook note' }).first()
    ).toBeVisible();
  }

  for (const width of [768, 1024, 1440]) {
    test(`action buttons share one baseline @ ${width}px`, async ({ page }) => {
      await openProBoard(page, width);
      const actions = page
        .locator('.board-table__cell--actions')
        .filter({ has: page.getByRole('button', { name: 'Send rebook note' }) })
        .first();
      const records = actions.getByRole('button', { name: 'Records' });
      const rebook = actions.getByRole('button', { name: 'Send rebook note' });
      await expect(records).toBeVisible();
      await expect(rebook).toBeVisible();
      const rBox = await records.boundingBox();
      const bBox = await rebook.boundingBox();
      expect(rBox && bBox).toBeTruthy();
      expect(Math.abs(rBox.y - bBox.y)).toBeLessThan(2);
      const nowrap = await actions.evaluate((el) => getComputedStyle(el).flexWrap);
      expect(nowrap).toBe('nowrap');
    });
  }

  test('never-serviced row shows one No visit yet badge only', async ({ page }) => {
    await openProBoard(page, 1024);
    const row = page.locator('.board-table__row', {
      has: page.locator('.board-row__name', { hasText: 'Northside Commissary' })
    });
    await expect(row).toHaveCount(1);
    await expect(row.getByText('No visit yet')).toHaveCount(1);
    await expect(row.locator('.board-row__meta')).toHaveText(/Medium volume \(quarterly\)/);
    await expect(row.locator('.board-row__overdue')).toHaveCount(0);
  });
});
