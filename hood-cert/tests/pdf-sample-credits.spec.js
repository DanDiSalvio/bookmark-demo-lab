import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const assetsDir = path.join(__dirname, '../assets');
const SAMPLE_DISCLAIMER = 'Sample photos, not from a real job.';

function pdfLatin1(bytes) {
  return Buffer.from(bytes).toString('latin1');
}

async function buildSamplePdfBytes(page, extra = {}) {
  return page.evaluate(async (opts) => {
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
      samplePhotoDisclaimer: window.HoodCertPhotoCredits.SAMPLE_PHOTO_DISCLAIMER,
      omitPhotolessAreas: true,
      checklist: job.checklist,
      ...opts
    };
    const { doc, layout } = await window.HoodCertPdf.buildServiceRecordPdf(payload);
    return {
      bytes: Array.from(new Uint8Array(doc.output('arraybuffer'))),
      layout
    };
  }, extra);
}

test.describe('HC-24 sample photo disclaimer in PDFs', () => {
  test('generated sample PDF includes disclaimer text', async ({ page }) => {
    await page.goto('/hood-cert/app/?sample=1');
    await page.waitForFunction(() => window.HoodCertPhotoCredits && window.HoodCertPdf);
    const { bytes } = await buildSamplePdfBytes(page);
    const raw = pdfLatin1(bytes);
    expect(raw).toContain(SAMPLE_DISCLAIMER);
  });

  test('shipped sample-service-record.pdf includes disclaimer text', () => {
    const pdfPath = path.join(assetsDir, 'sample-service-record.pdf');
    const raw = fs.readFileSync(pdfPath).toString('latin1');
    expect(raw).toContain(SAMPLE_DISCLAIMER);
  });
});

test.describe('HC-21a / HC-22 sample photo credits in PDF', () => {
  test('photo credit constants use 7.5pt type and 14pt clear space', async ({ page }) => {
    await page.goto('/hood-cert/app/');
    await page.waitForFunction(() => window.HoodCertPdf && window.HoodCertPdf.photoCreditTopY);
    const constants = await page.evaluate(() => ({
      gap: window.HoodCertPdf.PHOTO_CREDIT_GAP,
      fontSize: window.HoodCertPdf.CREDIT_FONT_SIZE,
      top: window.HoodCertPdf.photoCreditTopY(120, 189)
    }));
    expect(constants.gap).toBe(14);
    expect(constants.fontSize).toBe(7.5);
    expect(constants.top).toBe(120 + 189 + 14);
  });

  test('sample PDF credits sit below photo boxes with measured clear space', async ({ page }) => {
    await page.goto('/hood-cert/app/?sample=1');
    await page.waitForFunction(() => window.HoodCertPhotoCredits && window.HoodCertPdf);
    const { bytes, layout } = await buildSamplePdfBytes(page, { recordLayout: true });
    const raw = pdfLatin1(bytes);
    expect(raw).toContain('Long-uncleaned kitchen hood filter, close-up');
    expect(raw).toContain('Kitchen hood filter after being washed in a dishwasher, close-up');
    expect(raw).toContain('Veikk0.ma');
    expect(raw).toContain('CC BY-SA 4.0');
    expect(raw).toContain('commons.wikimedia.org');
    expect(raw).toContain('/URI');

    expect(layout.photoCredits.length).toBe(2);
    for (const block of layout.photoCredits) {
      expect(block.fontSize).toBe(7.5);
      expect(block.gap).toBeGreaterThanOrEqual(13.5);
      expect(block.gap).toBeLessThanOrEqual(14.5);
      expect(block.creditTop).toBeGreaterThanOrEqual(block.boxBottom + 13.5);
      if (block.imageBottom != null) {
        expect(block.imageBottom).toBeLessThanOrEqual(block.boxBottom + 0.5);
        expect(block.creditTop).toBeGreaterThan(block.imageBottom + 12);
      }
    }
  });
});
