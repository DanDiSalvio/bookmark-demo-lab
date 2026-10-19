import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const widths = [320, 390, 1024, 1440];

async function assertDarkContrast(page) {
  const results = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();
  expect(results.violations).toEqual([]);
}

test.describe('dark mode color contrast', () => {
  for (const width of widths) {
    test(`landing @ ${width}px`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/hood-cert/');
      await assertDarkContrast(page);
    });
  }

  for (const width of [320, 390, 1024, 1440]) {
    test(`app job tab @ ${width}px`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/hood-cert/app/?sample=1');
      await assertDarkContrast(page);
    });
  }

  for (const width of widths) {
    test(`app board tab @ ${width}px`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/hood-cert/app/?sample=1');
      await page.getByRole('button', { name: 'Board' }).click();
      await assertDarkContrast(page);
    });
  }

  for (const width of widths) {
    test(`record dialog @ ${width}px`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.setViewportSize({ width, height: 844 });
      await page.goto('/hood-cert/app/?sample=1');
      await page.getByRole('button', { name: 'Board' }).click();
      await page.getByRole('button', { name: 'Records' }).first().click();
      await expect(page.locator('#record-dialog')).toBeVisible();
      await assertDarkContrast(page);
    });
  }
});
