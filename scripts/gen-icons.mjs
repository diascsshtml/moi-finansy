// Разовый скрипт: растеризует SVG-иконки в PNG нужных размеров для PWA-манифеста.
// Запуск: node scripts/gen-icons.mjs
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '..', 'public');
mkdirSync(publicDir, { recursive: true });

const jobs = [
  { src: 'icon-source.svg', out: 'pwa-192.png', size: 192 },
  { src: 'icon-source.svg', out: 'pwa-512.png', size: 512 },
  { src: 'icon-source.svg', out: 'apple-touch-icon.png', size: 180 },
  { src: 'icon-maskable-source.svg', out: 'pwa-maskable-512.png', size: 512 },
  { src: 'icon-source.svg', out: 'favicon-32.png', size: 32 },
];

for (const job of jobs) {
  const src = path.join(publicDir, job.src);
  const out = path.join(publicDir, job.out);
  await sharp(src).resize(job.size, job.size).png().toFile(out);
  console.log(`generated ${job.out}`);
}
