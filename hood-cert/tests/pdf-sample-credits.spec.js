import { test, expect } from '@playwright/test';

test.describe('HC-21a / HC-22 sample photo credits in PDF', () => {
  test('photoCreditTopY sits below the photo box', async ({ page }) => {
    await page.goto('/hood-cert/app/');
    await page.waitForFunction(() => window.HoodCertPdf && window.HoodCertPdf.photoCreditTopY);
    const top = await page.evaluate(() => {
      const boxTop = 120;
      const cellH = 189;
      return window.HoodCertPdf.photoCreditTopY(boxTop, cellH);
    });
    expect(top).toBe(120 + 189 + 5);
    expect(top).toBeGreaterThan(120 + 189);
  });

  test('sample PDF includes per-column credits with Commons links', async ({ page }) => {
    await page.goto('/hood-cert/app/?sample=1');
    await page.waitForFunction(() => window.HoodCertPhotoCredits && window.HoodCertPdf);

    const pdfBytes = await page.evaluate(async () => {
      const credits = window.HoodCertPhotoCredits.SAMPLE_HOOD_FILTER_CREDITS;
      const job = window.HoodCertApp.getState().jobs[0];
      const payload = {
        companyName: 'Summit Hood Services',
        techName: 'Maria Lopez',
        recordNumber: job.recordNumber,
        account: { name: 'Harbor Grill', address: '412 Dock St' },
        serviceDate: 'Oct 19, 2026',
        nextDue: 'Jan 19, 2027',
        samplePhotoCredits: credits,
        omitPhotolessAreas: true,
        checklist: job.checklist
      };
      const { doc } = await window.HoodCertPdf.buildServiceRecordPdf(payload);
      return Array.from(new Uint8Array(doc.output('arraybuffer')));
    });

    const raw = Buffer.from(pdfBytes).toString('latin1');
    expect(raw).toContain('Long-uncleaned kitchen hood filter, close-up');
    expect(raw).toContain('Kitchen hood filter after being washed in a dishwasher, close-up');
    expect(raw).toContain('Veikk0.ma');
    expect(raw).toContain('CC BY-SA 4.0');
    expect(raw).toContain('commons.wikimedia.org');
    expect(raw).toContain('/URI');
  });
});
