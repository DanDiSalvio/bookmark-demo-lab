import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '../assets');
const appHtml = path.join(__dirname, '../app/index.html');
const samplesDir = path.join(__dirname, '../app/samples');
fs.mkdirSync(outDir, { recursive: true });

const beforeB64 = fs.readFileSync(path.join(samplesDir, 'hood-before.jpg')).toString('base64');
const afterB64 = fs.readFileSync(path.join(samplesDir, 'hood-after.jpg')).toString('base64');

const areaIds = [
  'hood',
  'filters',
  'ductwork',
  'fan',
  'accessPanels',
  'greaseContainment',
  'fireSuppressionNozzles'
];

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`file://${appHtml}`);
await page.waitForFunction(() => window.jspdf && window.HoodCertPdf);

const pdfBytes = await page.evaluate(
  async ({ beforeB64: b64Before, afterB64: b64After, areaIds: ids }) => {
    const beforeUrl = `data:image/jpeg;base64,${b64Before}`;
    const afterUrl = `data:image/jpeg;base64,${b64After}`;
    const stamp = new Date().toISOString();
    const checklist = ids.map((id, i) => {
      if (id === 'fan') {
        return {
          id,
          status: 'deficiency',
          note: 'Belt wear noted, fan cleaned and operational.',
          beforePhoto: beforeUrl,
          afterPhoto: afterUrl,
          beforeAt: stamp,
          afterAt: stamp,
          noAccessReason: ''
        };
      }
      if (i >= 4) {
        return {
          id,
          status: 'no_access',
          note: '',
          noAccessReason: 'Panel sealed, documented no access',
          beforePhoto: null,
          afterPhoto: null,
          beforeAt: null,
          afterAt: null
        };
      }
      return {
        id,
        status: 'pass',
        note: '',
        beforePhoto: i === 0 ? beforeUrl : null,
        afterPhoto: i === 0 ? afterUrl : null,
        beforeAt: i === 0 ? stamp : null,
        afterAt: i === 0 ? stamp : null,
        noAccessReason: ''
      };
    });

    const payload = {
      companyName: 'Summit Hood Services',
      techName: 'Maria Lopez',
      recordNumber: 'HC-20261019-A1B2',
      account: { name: 'Harbor Grill', address: '412 Dock St, Portland, OR 97204' },
      serviceDate: 'Oct 19, 2026',
      nextDue: 'Jan 19, 2027',
      checklist
    };
    const { doc } = await window.HoodCertPdf.buildServiceRecordPdf(payload);
    const buf = doc.output('arraybuffer');
    return Array.from(new Uint8Array(buf));
  },
  { beforeB64, afterB64, areaIds }
);

await browser.close();

const pdfPath = path.join(outDir, 'certificate-preview-temp.pdf');
const prefix = path.join(outDir, 'certificate-preview-page');
fs.writeFileSync(pdfPath, Buffer.from(pdfBytes));
execSync(`pdftoppm -r 200 -png -f 1 -l 1 "${pdfPath}" "${prefix}"`, { stdio: 'inherit' });
const rendered = `${prefix}-1.png`;
const finalPath = path.join(outDir, 'certificate-preview.png');

const meta = await sharp(rendered).metadata();
const cropHeight = Math.min(Math.round(meta.height * 0.62), 1100);
await sharp(rendered)
  .extract({ left: 0, top: 0, width: meta.width, height: cropHeight })
  .resize({ width: 1040, withoutEnlargement: false })
  .png()
  .toFile(finalPath);

fs.unlinkSync(rendered);
fs.unlinkSync(pdfPath);
console.log('Wrote assets/certificate-preview.png');
