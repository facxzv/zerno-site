// Сжимает фото из photos-original/ и делает версии 480, 800 и 1200 px в WebP и AVIF.
// Результат кладёт в assets/photos/ и печатает строки для data.js.
// Запуск: cd tools && npm install && npm run photos
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'photos-original');
const dst = path.join(root, 'assets', 'photos');
const WIDTHS = [480, 800, 1200];

fs.mkdirSync(dst, { recursive: true });
const files = fs.readdirSync(src).filter((f) => /\.(jpe?g|png|webp|tiff?)$/i.test(f));
if (!files.length) {
  console.log('В папке photos-original нет фото (нужны JPG или PNG).');
  process.exit(0);
}

const slug = (s) =>
  s.toLowerCase().replace(/\.[^.]+$/, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'foto';

const lines = [];
let n = 0;
for (const f of files) {
  n++;
  const name = slug(f) === 'foto' ? `foto-${n}` : slug(f); // русские имена превращаем в foto-1, foto-2...
  // .rotate() учитывает поворот, записанный телефоном; метаданные (включая геопозицию) не сохраняются
  const base = sharp(path.join(src, f)).rotate();
  const meta = await sharp(await base.clone().toBuffer()).metadata();
  const ratio = meta.height / meta.width;
  for (const w of WIDTHS) {
    const width = Math.min(w, meta.width);
    const img = base.clone().resize({ width, withoutEnlargement: true });
    await img.clone().webp({ quality: 78 }).toFile(path.join(dst, `${name}-${w}.webp`));
    await img.clone().avif({ quality: 52 }).toFile(path.join(dst, `${name}-${w}.avif`));
  }
  const h = Math.round(1200 * ratio);
  const size = ratio > 1.15 ? 'tall' : ratio < 0.7 ? 'wide' : '';
  lines.push(`    { "file": "${name}", "alt": "ОПИШИТЕ, ЧТО НА ФОТО", "caption": "", "w": 1200, "h": ${h}, "size": "${size}", "avif": true },`);
  console.log(`✓ ${f} -> ${name}`);
}
console.log('\nСкопируйте эти строки в data.js, в список gallery (вместо заглушек), и впишите alt:\n');
console.log(lines.join('\n'));
