import { test, expect } from '@playwright/test';

async function completeOneJob(page) {
  await page.goto('/hood-cert/app/?sample=1');
  await page.selectOption('#account-select', { label: 'Summit Catering Kitchen' });
  const before = await page.evaluate(() => {
    const acc = window.HoodCertApp.getState().accounts.find((a) => a.name.includes('Summit Catering'));
    return acc ? acc.lastServiceDate : null;
  });
  await page.getByRole('button', { name: 'Continue to checklist' }).click();
  const items = page.locator('.checklist-item');
  const count = await items.count();
  for (let i = 0; i < count; i++) {
    const item = items.nth(i);
    await item.getByRole('button', { name: 'No access' }).click();
    await item.locator('input[type="text"]').fill('No access demo');
  }
  await page.getByRole('button', { name: 'Review job' }).click();
  await page.getByRole('button', { name: 'Complete job' }).click();
  await expect(page.getByRole('button', { name: 'Download PDF' })).toBeVisible();
  return before;
}

test('pdf failure does not create extra jobs', async ({ page }) => {
  await completeOneJob(page);
  const jobsBefore = await page.evaluate(() => window.HoodCertApp.getState().jobs.length);

  await page.evaluate(() => {
    window.HoodCertPdf.downloadServiceRecordPdf = async () => {
      throw new Error('PDF failed');
    };
  });
  await page.getByRole('button', { name: 'Download PDF' }).click();
  await expect(page.locator('#pdf-error')).toBeVisible();

  const jobsAfter = await page.evaluate(() => window.HoodCertApp.getState().jobs.length);
  expect(jobsAfter).toBe(jobsBefore);
});
