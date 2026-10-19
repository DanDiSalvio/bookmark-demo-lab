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
      if (id === 'accessPanels') {
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
      if (i >= 5) {
        return {
          id,
          status: 'pass',
          note: '',
          beforePhoto: null,
          afterPhoto: null,
          beforeAt: null,
          afterAt: null,
          noAccessReason: ''
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

const meta = await sharp(rendered).metadata();
const full = await sharp(rendered).resize({ width: 2080 }).toBuffer();
const fullMeta = await sharp(full).metadata();
const fullH = fullMeta.height;
const fullW = fullMeta.width;

/** Desktop: header through first Hood before/after row (includes checklist). */
const desktopCropHeight = Math.min(Math.round(1000 * 2), fullH);
const desktopPng = await sharp(full)
  .extract({ left: 0, top: 0, width: fullW, height: desktopCropHeight })
  .png()
  .toBuffer();

/** Mobile: header through account, then hood photo row from desktop crop (no checklist). */
const topEnd = Math.round(fullH * 0.195);
const topBand = await sharp(full).extract({ left: 0, top: 0, width: fullW, height: topEnd }).png().toBuffer();
const desktopMeta = await sharp(desktopPng).metadata();
const photoTop = Math.round(desktopMeta.height * 0.52);
const photoHeight = Math.min(Math.round(desktopMeta.height * 0.46), desktopMeta.height - photoTop);
const photoBand = await sharp(desktopPng)
  .extract({ left: 0, top: photoTop, width: desktopMeta.width, height: photoHeight })
  .png()
  .toBuffer();
const topMeta = await sharp(topBand).metadata();
const photoMeta = await sharp(photoBand).metadata();
const mobileComposite = await sharp({
  create: {
    width: fullW,
    height: topMeta.height + photoMeta.height,
    channels: 3,
    background: { r: 255, g: 255, b: 255 }
  }
})
  .composite([
    { input: topBand, top: 0, left: 0 },
    { input: photoBand, top: topMeta.height, left: 0 }
  ])
  .png()
  .toBuffer();

async function writeVariants(baseName, pngBuffer, mobileWidth) {
  const width = mobileWidth ?? 2080;
  const resized = await sharp(pngBuffer).resize({ width, withoutEnlargement: false }).toBuffer();
  const pngPath = path.join(outDir, `${baseName}.png`);
  const webpPath = path.join(outDir, `${baseName}.webp`);
  await sharp(resized).png({ compressionLevel: 9 }).toFile(pngPath);
  await sharp(resized).webp({ quality: 82, effort: 6 }).toFile(webpPath);
  const pngKb = Math.round(fs.statSync(pngPath).size / 1024);
  const webpKb = Math.round(fs.statSync(webpPath).size / 1024);
  console.log(`${baseName}: ${width}px PNG ${pngKb} KB, WebP ${webpKb} KB`);
}

await writeVariants('certificate-preview', desktopPng, 2080);
await writeVariants('certificate-preview-mobile', mobileComposite, 1080);

fs.unlinkSync(rendered);
fs.unlinkSync(pdfPath);
console.log('Wrote certificate preview assets (PNG + WebP).');
