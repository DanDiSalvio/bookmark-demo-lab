import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '../assets');
const appHtml = path.join(__dirname, '../app/index.html');
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`file://${appHtml}`);
await page.waitForFunction(() => window.jspdf && window.HoodCertPdf);

const dataUri = await page.evaluate(async () => {
  const payload = {
    companyName: 'Summit Hood Services',
    techName: 'Maria Lopez',
    recordNumber: 'HC-20261019-A1B2',
    account: { name: 'Harbor Grill', address: '412 Dock St, Portland, OR 97204' },
    serviceDate: 'Oct 19, 2026',
    nextDue: 'Jan 19, 2027',
    checklist: [
      { id: 'hood', status: 'pass', note: '', beforePhoto: null, afterPhoto: null },
      {
        id: 'fan',
        status: 'deficiency',
        note: 'Belt wear noted, fan cleaned and operational.',
        beforePhoto: null,
        afterPhoto: null
      }
    ]
  };
  const { doc } = await window.HoodCertPdf.buildServiceRecordPdf(payload);
  return doc.output('datauristring');
});

const viewer = await browser.newPage({ viewport: { width: 560, height: 726 } });
await viewer.setContent(`<!DOCTYPE html><html><body style="margin:0;background:#fff"><embed src="${dataUri}" type="application/pdf" width="560" height="726" /></body></html>`);
await viewer.waitForTimeout(1200);
await viewer.screenshot({ path: path.join(outDir, 'certificate-preview.png') });
await browser.close();
console.log('Wrote assets/certificate-preview.png');
