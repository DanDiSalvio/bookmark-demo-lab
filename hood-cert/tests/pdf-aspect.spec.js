import { test, expect } from '@playwright/test';

test('computeDrawSize preserves aspect ratio within 2%', async ({ page }) => {
  await page.goto('/hood-cert/app/');
  await page.waitForFunction(() => window.HoodCertPdf && window.HoodCertPdf.computeDrawSize);

  const result43 = await page.evaluate(() => {
    const fit = window.HoodCertPdf.computeDrawSize(400, 300, 252, 189, 180);
    const orig = 400 / 300;
    const drawn = fit.drawW / fit.drawH;
    return Math.abs(orig - drawn) / orig;
  });
  expect(result43).toBeLessThan(0.02);

  const result34 = await page.evaluate(() => {
    const fit = window.HoodCertPdf.computeDrawSize(300, 400, 252, 189, 180);
    const orig = 300 / 400;
    const drawn = fit.drawW / fit.drawH;
    return Math.abs(orig - drawn) / orig;
  });
  expect(result34).toBeLessThan(0.02);
});
