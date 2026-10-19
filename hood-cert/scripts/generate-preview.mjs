import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '../assets');
const appHtml = path.join(__dirname, '../app/index.html');
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`file://${appHtml}`);
await page.waitForFunction(() => window.jspdf && window.HoodCertPdf);

const pdfBytes = await page.evaluate(async () => {
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
      },
      {
        id: 'ductwork',
        status: 'no_access',
        note: '',
        noAccessReason: 'Panel sealed, documented no access',
        beforePhoto: null,
        afterPhoto: null
      }
    ]
  };
  const { doc } = await window.HoodCertPdf.buildServiceRecordPdf(payload);
  const buf = doc.output('arraybuffer');
  return Array.from(new Uint8Array(buf));
});

await browser.close();

const pdfPath = path.join(outDir, 'certificate-preview-temp.pdf');
const prefix = path.join(outDir, 'certificate-preview-page');
fs.writeFileSync(pdfPath, Buffer.from(pdfBytes));
execSync(`pdftoppm -r 144 -png -f 1 -l 1 "${pdfPath}" "${prefix}"`, { stdio: 'inherit' });
const rendered = `${prefix}-1.png`;
const finalPath = path.join(outDir, 'certificate-preview.png');
fs.renameSync(rendered, finalPath);
fs.unlinkSync(pdfPath);
console.log('Wrote assets/certificate-preview.png');
