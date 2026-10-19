import { test, expect } from '@playwright/test';

test('account name HTML does not execute in board', async ({ page }) => {
  await page.goto('/hood-cert/app/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  const xssName = '<img src=x onerror="window.__xss=1">';
  await page.getByRole('button', { name: 'Add new restaurant' }).click();
  await page.fill('#new-name', xssName);
  await page.fill('#new-address', '1 Test St');
  await page.getByRole('button', { name: 'Save restaurant' }).click();

  await page.getByRole('button', { name: 'Board' }).click();
  await page.getByRole('button', { name: 'Preview Pro board (demo)' }).click();
  const boardName = page.getByRole('region', { name: 'Rebook board' }).locator('.board-row__name').first();
  await expect(boardName).toContainText('img');

  const xssFlag = await page.evaluate(() => window.__xss);
  expect(xssFlag).toBeUndefined();
});
