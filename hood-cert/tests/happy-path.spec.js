import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const samplePhoto = path.join(__dirname, '../app/samples/hood-before.jpg');

async function fillChecklistForSubmit(page) {
  await page.getByRole('button', { name: 'Mark remaining as Pass' }).click();
  const inputs = page.locator('input[id^="no-access-"]');
  const count = await inputs.count();
  for (let i = 0; i < count; i++) {
    await inputs.nth(i).fill('Demo no access note');
  }
}

test('hood cert happy path: job, complete, pdf, board', async ({ page }) => {
  await page.goto('/hood-cert/app/?sample=1');
  await page.selectOption('#account-select', { label: 'Riverside BBQ Pit' });
  await page.getByRole('button', { name: 'Continue to checklist' }).click();
  await fillChecklistForSubmit(page);
  await page.getByRole('button', { name: 'Review job' }).click();
  await page.getByRole('button', { name: 'Complete job' }).click();
  await expect(page.getByText(/HC-/)).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download PDF' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/hood-service-record/);

  await page.getByRole('button', { name: 'Board' }).click();
  const board = page.getByRole('region', { name: 'Rebook board' });
  await expect(board.getByText('Riverside BBQ Pit')).toBeVisible();
});

test('double complete creates one job only', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  await page.goto('/hood-cert/app/?sample=1');
  const jobsBefore = await page.evaluate(() => window.HoodCertApp.getState().jobs.length);

  await page.selectOption('#account-select', { label: 'Lakeview Diner' });
  await page.getByRole('button', { name: 'Continue to checklist' }).click();
  await fillChecklistForSubmit(page);
  await page.getByRole('button', { name: 'Review job' }).click();

  await page.getByRole('button', { name: 'Complete job' }).dblclick();
  await expect(page.getByRole('button', { name: 'Download PDF' })).toBeVisible();
  const jobsAfter = await page.evaluate(() => window.HoodCertApp.getState().jobs.length);
  expect(jobsAfter).toBe(jobsBefore + 1);
});
