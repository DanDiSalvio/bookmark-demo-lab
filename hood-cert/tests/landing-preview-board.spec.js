import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const assetsDir = path.join(__dirname, '../assets');

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

test.describe('HC-13 hero preview assets', () => {
  test('desktop and mobile PNGs include visible hood photo pair', async () => {
    const desktop = path.join(assetsDir, 'certificate-preview.png');
    const mobile = path.join(assetsDir, 'certificate-preview-mobile.png');
    expect(fs.existsSync(desktop)).toBe(true);
    expect(fs.existsSync(mobile)).toBe(true);

    const desktopMeta = await sharp(desktop).metadata();
    expect(desktopMeta.width).toBe(2080);
    expect(desktopMeta.height).toBeGreaterThanOrEqual(1800);

    const mobileMeta = await sharp(mobile).metadata();
    expect(mobileMeta.width).toBe(2080);

    async function assertPhotosVisible(pngPath) {
      const { width: w, height: h } = await sharp(pngPath).metadata();
      const photoTop = Math.round(h * 0.55);
      const photoHeight = Math.min(Math.round(h * 0.35), h - photoTop);
      const crop = {
        left: Math.round(w * 0.05),
        top: photoTop,
        width: Math.round(w * 0.9),
        height: photoHeight
      };
      expect(await photoRegionHasContent(pngPath, crop)).toBe(true);
    }

    await assertPhotosVisible(desktop);
    await assertPhotosVisible(mobile);
  });

  for (const width of [390, 1440]) {
    test(`landing hero shows preview image @ ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/hood-cert/');
      const img = page.locator('.hero__preview-img');
      await expect(img).toBeVisible();
      const box = await img.boundingBox();
      expect(box).toBeTruthy();
      expect(box.height).toBeGreaterThan(120);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    });
  }
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
