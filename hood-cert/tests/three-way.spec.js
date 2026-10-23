import { test, expect } from '@playwright/test';

test('area result is mutually exclusive in saved job', async ({ page }) => {
  await page.goto('/hood-cert/app/?sample=1');
  await page.selectOption('#account-select', { label: 'Wok Express 24' });
  await page.getByRole('button', { name: 'Continue to checklist' }).click();

  const hood = page.locator('.checklist-item').filter({ hasText: 'Hood' });
  await hood.getByRole('button', { name: 'No access' }).click();
  await hood.locator('#no-access-reason-hood').fill('Locked rooftop hatch');

  await page.getByRole('button', { name: 'Mark remaining as Pass' }).click();
  const items = page.locator('.checklist-item');
  const count = await items.count();
  for (let i = 1; i < count; i++) {
    const item = items.nth(i);
    await item.getByRole('button', { name: 'No access' }).click();
    await item.locator('input[type="text"]').fill('Demo sealed');
  }

  await page.getByRole('button', { name: 'Review job' }).click();
  await page.getByRole('button', { name: 'Complete job' }).click();

  const hoodItem = await page.evaluate(() => {
    const job = window.HoodCertApp.getState().jobs[0];
    return job.checklist.find((c) => c.id === 'hood');
  });
  expect(hoodItem.status).toBe('no_access');
  expect(hoodItem.afterPhoto).toBeNull();
  expect(hoodItem.note).toBeFalsy();
});
