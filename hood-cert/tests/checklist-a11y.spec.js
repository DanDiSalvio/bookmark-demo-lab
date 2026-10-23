import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('checklist has no axe label errors at 390px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/hood-cert/app/?sample=1');
  await page.selectOption('#account-select', { label: 'Harbor Grill' });
  await page.getByRole('button', { name: 'Continue to checklist' }).click();
  await expect(page.locator('#checklist-root')).toBeVisible();

  const results = await new AxeBuilder({ page }).withRules(['label']).analyze();
  expect(results.violations).toEqual([]);

  const height = await page.locator('#job-step-checklist .card').evaluate((el) => el.scrollHeight);
  expect(height).toBeLessThanOrEqual(1600);
});
