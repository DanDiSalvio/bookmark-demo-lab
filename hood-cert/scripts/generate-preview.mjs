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
const SAMPLE_PHOTO_DISCLAIMER = 'Sample photos for demo, not from a real job';
const SERVICE_ISO = '2026-10-19';

fs.mkdirSync(outDir, { recursive: true });

const beforeB64 = fs.readFileSync(path.join(samplesDir, 'hood-before.jpg')).toString('base64');
const afterB64 = fs.readFileSync(path.join(samplesDir, 'hood-after.jpg')).toString('base64');

const beforeAt = new Date(`${SERVICE_ISO}T10:05:00`).toISOString();
const afterAt = new Date(`${SERVICE_ISO}T11:40:00`).toISOString();

const areaIds = [
  'hood',
  'filters',
  'ductwork',
  'fan',
  'accessPanels',
  'greaseContainment',
  'fireSuppressionNozzles'
];

function buildChecklist(beforeUrl, afterUrl) {
  return areaIds.map((id) => {
    if (id === 'hood') {
      return {
        id,
        status: 'pass',
        note: '',
        beforePhoto: beforeUrl,
        afterPhoto: afterUrl,
        beforeAt,
        afterAt,
        noAccessReason: ''
      };
    }
    if (id === 'fan') {
      return {
        id,
        status: 'deficiency',
        note: 'Belt wear noted, fan cleaned and operational.',
        beforePhoto: null,
        afterPhoto: null,
        beforeAt: null,
        afterAt: null,
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
  });
}

const previewPayload = {
  companyName: 'Summit Hood Services',
  techName: 'Maria Lopez',
  recordNumber: 'HC-20261019-A1B2',
  account: { name: 'Harbor Grill', address: '412 Dock St, Portland, OR 97204' },
  serviceDate: 'Oct 19, 2026',
  nextDue: 'Jan 19, 2027',
  samplePhotoDisclaimer: SAMPLE_PHOTO_DISCLAIMER,
  checklist: buildChecklist(
    `data:image/jpeg;base64,${beforeB64}`,
    `data:image/jpeg;base64,${afterB64}`
  )
};

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`file://${appHtml}`);
await page.waitForFunction(() => window.jspdf && window.HoodCertPdf);

const pdfBytes = await page.evaluate(async (payload) => {
  const { doc } = await window.HoodCertPdf.buildServiceRecordPdf(payload);
  return Array.from(new Uint8Array(doc.output('arraybuffer')));
}, previewPayload);

await browser.close();

const pdfPath = path.join(outDir, 'sample-service-record.pdf');
const tempPdf = path.join(outDir, 'certificate-preview-temp.pdf');
const prefix = path.join(outDir, 'certificate-preview-page');
fs.writeFileSync(pdfPath, Buffer.from(pdfBytes));
fs.writeFileSync(tempPdf, Buffer.from(pdfBytes));
execSync(`pdftoppm -r 200 -png -f 1 -l 1 "${tempPdf}" "${prefix}"`, { stdio: 'inherit' });
const rendered = `${prefix}-1.png`;

const full = await sharp(rendered).resize({ width: 2080 }).toBuffer();
const fullMeta = await sharp(full).metadata();
const fullH = fullMeta.height;
const fullW = fullMeta.width;

const desktopCropHeight = Math.min(Math.round(1000 * 2), fullH);
const desktopPng = await sharp(full)
  .extract({ left: 0, top: 0, width: fullW, height: desktopCropHeight })
  .png()
  .toBuffer();

const desktopMeta = await sharp(desktopPng).metadata();
const photoTop = Math.round(desktopMeta.height * 0.52);
const photoHeight = Math.min(Math.round(desktopMeta.height * 0.48), desktopMeta.height - photoTop);
const heroPhotosPng = await sharp(desktopPng)
  .extract({ left: 0, top: photoTop, width: desktopMeta.width, height: photoHeight })
  .png()
  .toBuffer();

const sectionMobilePng = await sharp(full)
  .resize({ width: 1080, withoutEnlargement: false })
  .png()
  .toBuffer();

async function writeCompactPng(pngBuffer, filePath, maxWidth) {
  let quality = 78;
  let out = await sharp(pngBuffer)
    .resize({ width: maxWidth, withoutEnlargement: false })
    .png({ compressionLevel: 9, palette: true, quality, effort: 10 })
    .toBuffer();
  while (out.length > 400 * 1024 && quality > 48) {
    quality -= 6;
    out = await sharp(pngBuffer)
      .resize({ width: maxWidth, withoutEnlargement: false })
      .png({ compressionLevel: 9, palette: true, quality, effort: 10 })
      .toBuffer();
  }
  fs.writeFileSync(filePath, out);
  return out;
}

async function writeVariants(baseName, pngBuffer, maxWidth) {
  const pngPath = path.join(outDir, `${baseName}.png`);
  const webpPath = path.join(outDir, `${baseName}.webp`);
  const compact = await writeCompactPng(pngBuffer, pngPath, maxWidth);
  await sharp(compact).webp({ quality: 82, effort: 6 }).toFile(webpPath);
  const pngKb = Math.round(fs.statSync(pngPath).size / 1024);
  const webpKb = Math.round(fs.statSync(webpPath).size / 1024);
  console.log(`${baseName}: ${maxWidth}px PNG ${pngKb} KB, WebP ${webpKb} KB`);
}

await writeVariants('certificate-preview', desktopPng, 2080);
await writeVariants('certificate-preview-hero-photos', heroPhotosPng, 1080);
await writeVariants('certificate-preview-section-mobile', sectionMobilePng, 1080);

fs.unlinkSync(rendered);
fs.unlinkSync(tempPdf);
console.log('Wrote sample-service-record.pdf and preview assets.');
