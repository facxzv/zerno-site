// Рисует логотип-предложение, favicon-набор и заглушку для превью в соцсетях.
// Слово «Зерно» переводится в контуры (шрифт Lora), поэтому SVG выглядит одинаково везде.
// Запуск: cd tools && npm install && npm run brand
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import opentype from 'opentype.js';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = (...p) => path.join(root, ...p);

const INK = '#2B1D16';     // эспрессо
const CREAM = '#F6EFE4';
const ACCENT = '#A2431F';

const font = opentype.parse(
  fs.readFileSync(out('tools/node_modules/@fontsource/lora/files/lora-cyrillic-700-normal.woff')).buffer.slice(0)
);
const fontLatin = opentype.parse(
  fs.readFileSync(out('tools/node_modules/@fontsource/lora/files/lora-latin-700-normal.woff')).buffer.slice(0)
);

// Кириллический набор шрифта без знаков препинания, их берём из латинского.
function textPath(text, size) {
  const merged = new opentype.Path();
  let x = 0;
  for (const ch of text) {
    const f = font.charToGlyphIndex(ch) > 0 ? font : fontLatin;
    const g = f.charToGlyph(ch);
    merged.extend(g.getPath(x, 0, size));
    x += g.advanceWidth * size / f.unitsPerEm;
  }
  return { d: merged.toPathData(2), box: merged.getBoundingBox() };
}

// Знак: круг, внутри зерно с бороздкой. Рисуется в квадрате 100x100.
const mark = (bg, bean, groove) => `
  <circle cx="50" cy="50" r="50" fill="${bg}"/>
  <g transform="translate(50 50) rotate(32)">
    <ellipse rx="19" ry="29.5" fill="${bean}"/>
    <path d="M0 -23 C10 -12 -10 -4 0 1 C8 9 -6 15 0 23" fill="none" stroke="${groove}" stroke-width="4.6" stroke-linecap="round"/>
  </g>`;

// ---------- логотип: знак + слово ----------
const word = textPath('Зерно', 66);
const gap = 22;
const wordX = 100 + gap;
const baseline = 50 - (word.box.y1 + word.box.y2) / 2; // вертикальный центр по высоте букв
const W = Math.ceil(wordX + (word.box.x2 - word.box.x1) + 2);
const logo = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} 100" width="${W}" height="100" role="img" aria-label="Зерно">
  <title>Зерно</title>${mark(INK, CREAM, INK)}
  <path transform="translate(${wordX - word.box.x1} ${baseline})" d="${word.d}" fill="${INK}"/>
</svg>
`;
fs.writeFileSync(out('assets/logo-proposal.svg'), logo);
// сайт подключает assets/logo.svg: по умолчанию это новый вариант, его можно заменить любым файлом
fs.copyFileSync(out('assets/logo-proposal.svg'), out('assets/logo.svg'));

// ---------- favicon ----------
const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${mark(ACCENT, CREAM, ACCENT)}
</svg>
`;
fs.writeFileSync(out('assets/favicon.svg'), faviconSvg);

const png = (size) => sharp(Buffer.from(faviconSvg), { density: 384 }).resize(size, size).png().toBuffer();

// apple-touch-icon без прозрачности: круг на кремовом фоне
const appleSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="${CREAM}"/><g transform="translate(10 10) scale(.8)">${mark(ACCENT, CREAM, ACCENT)}</g></svg>`;
await sharp(Buffer.from(appleSvg), { density: 384 }).resize(180, 180).png().toFile(out('assets/apple-touch-icon.png'));
await sharp(await png(192)).toFile(out('assets/icon-192.png'));
await sharp(await png(512)).toFile(out('assets/icon-512.png'));

// favicon.ico (PNG внутри ICO: 16, 32, 48)
const sizes = [16, 32, 48];
const imgs = await Promise.all(sizes.map(png));
const head = Buffer.alloc(6);
head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(sizes.length, 4);
let offset = 6 + 16 * sizes.length;
const dir = Buffer.concat(sizes.map((s, i) => {
  const e = Buffer.alloc(16);
  e.writeUInt8(s, 0); e.writeUInt8(s, 1); e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6);
  e.writeUInt32LE(imgs[i].length, 8); e.writeUInt32LE(offset, 12);
  offset += imgs[i].length;
  return e;
}));
fs.writeFileSync(out('favicon.ico'), Buffer.concat([head, dir, ...imgs]));

// ---------- превью для соцсетей (заглушка 1200x630) ----------
const slogan = textPath('Кофе, выпечка и никакой спешки', 44);
const scale = 1.9;
const lw = W * scale;
const og = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <rect width="1200" height="630" fill="${CREAM}"/>
  <rect x="24" y="24" width="1152" height="582" rx="28" fill="none" stroke="${ACCENT}" stroke-width="3" stroke-dasharray="2 12" stroke-linecap="round"/>
  <g transform="translate(${(1200 - lw) / 2} 170) scale(${scale})">${mark(INK, CREAM, INK)}
    <path transform="translate(${wordX - word.box.x1} ${baseline})" d="${word.d}" fill="${INK}"/>
  </g>
  <path transform="translate(${(1200 - (slogan.box.x2 - slogan.box.x1)) / 2 - slogan.box.x1} 450)" d="${slogan.d}" fill="${ACCENT}"/>
</svg>`;
await sharp(Buffer.from(og), { density: 144 }).png({ compressionLevel: 9 }).toFile(out('assets/og-image.png'));

console.log('Готово: assets/logo-proposal.svg, logo.svg, favicon.svg, favicon.ico, apple-touch-icon.png, icon-192/512.png, og-image.png');
