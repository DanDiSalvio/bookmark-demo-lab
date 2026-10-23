import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const samplesDir = path.join(__dirname, '../app/samples');
const outDir = path.join(__dirname, '../assets/hero-tiles');

const widths = [400, 800];
const files = ['hood-before', 'hood-after'];

fs.mkdirSync(outDir, { recursive: true });

for (const base of files) {
  const input = path.join(samplesDir, `${base}.jpg`);
  for (const w of widths) {
    const h = Math.round((w * 3) / 4);
    const resized = sharp(input).resize(w, h, { fit: 'inside', withoutEnlargement: true });
    const jpegQ = w >= 800 ? 62 : 78;
    const webpQ = w >= 800 ? 38 : 80;
    await resized.jpeg({ quality: jpegQ, mozjpeg: true }).toFile(path.join(outDir, `${base}-${w}.jpg`));
    await resized.webp({ quality: webpQ, effort: 6 }).toFile(path.join(outDir, `${base}-${w}.webp`));
    const jpgKb = Math.round(fs.statSync(path.join(outDir, `${base}-${w}.jpg`)).size / 1024);
    const webpKb = Math.round(fs.statSync(path.join(outDir, `${base}-${w}.webp`)).size / 1024);
    console.log(`${base}-${w}: JPG ${jpgKb} KB, WebP ${webpKb} KB`);
  }
}

console.log('Wrote hero tile derivatives to assets/hero-tiles/');
