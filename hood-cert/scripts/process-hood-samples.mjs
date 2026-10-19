import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const samplesDir = path.join(__dirname, '../app/samples');

const jobs = [
  {
    input: '/tmp/hood-samples/before-src.jpg',
    output: 'hood-before.jpg',
    position: 'top'
  },
  {
    input: '/tmp/hood-samples/after-commercial.jpg',
    output: 'hood-after.jpg',
    position: 'top'
  }
];

for (const job of jobs) {
  let quality = 88;
  const outPath = path.join(samplesDir, job.output);
  while (quality >= 58) {
    await sharp(job.input)
      .resize(1600, 1200, { fit: 'cover', position: job.position })
      .jpeg({ quality, mozjpeg: true })
      .toFile(outPath);
    const { size } = fs.statSync(outPath);
    if (size <= 150 * 1024) break;
    quality -= 4;
  }
  const { size } = fs.statSync(outPath);
  console.log(`${job.output}: ${Math.round(size / 1024)} KB @ q${quality}`);
}
