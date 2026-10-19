import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const samplePhoto = path.join(__dirname, '../app/samples/hood-before.jpg');

test('hood cert happy path: job, photos, pdf, board', async ({ page }) => {
  await page.goto('/hood-cert/app/?sample=1');
  await expect(page.getByRole('heading', { name: 'New job' })).toBeVisible();

  await page.selectOption('#account-select', { label: 'Riverside BBQ Pit' });
  await page.getByRole('button', { name: 'Continue to checklist' }).click();
  await expect(page.getByText('Riverside BBQ Pit checklist')).toBeVisible();

  const fileInputs = page.locator('input[type="file"]');
  await fileInputs.nth(0).setInputFiles(samplePhoto);
  await fileInputs.nth(1).setInputFiles(samplePhoto);

  await page.getByRole('button', { name: 'Review and generate PDF' }).click();
  await page.fill('#tech-name', 'Test Tech');
  await page.fill('#company-name', 'Demo Hood Co');

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download PDF' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/hood-service-record/);

  await page.getByRole('button', { name: 'Board' }).click();
  const board = page.getByRole('region', { name: 'Rebook board' });
  await expect(board.getByText('Riverside BBQ Pit')).toBeVisible();
  const row = board.locator('.board-row').filter({ hasText: 'Riverside BBQ Pit' });
  await expect(row.getByText(/OK|Due in 30 days/)).toBeVisible();
});
