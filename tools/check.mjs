// Проверка перед публикацией: ищет незаполненные [[заглушки]] и битые локальные ссылки.
// Запуск: cd tools && npm run check
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const skip = new Set(['node_modules', 'tools', 'photos-original', '.git', 'redaktor.html', 'redaktor.js', 'main.js', 'style.css', 'data.backup.js']);
const exts = /\.(html|js|css|json|xml|txt|webmanifest)$/;

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skip.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else if (exts.test(e.name)) out.push(p);
  }
  return out;
}

let todo = 0;
const counts = {};
for (const f of walk(root)) {
  const text = fs.readFileSync(f, 'utf8');
  const m = text.match(/\[\[(?!\.\.\.)[^\]]+\]\]/g) || [];
  if (m.length) { counts[path.relative(root, f)] = m.length; todo += m.length; }
}
console.log(`Незаполненных заглушек [[...]]: ${todo}`);
for (const [f, c] of Object.entries(counts)) console.log(`  ${f}: ${c}`);

// локальные ссылки и картинки из index.html
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
let bad = 0;
for (const m of html.matchAll(/\s(?:href|src)="([^"]+)"/g)) {
  const u = m[1];
  if (/^(https?:|mailto:|tel:|data:)/.test(u) || u.includes('[[')) continue;
  if (u.startsWith('#')) { if (u !== '#' && !ids.has(u.slice(1))) { bad++; console.log('Нет такого раздела:', u); } continue; }
  if (!fs.existsSync(path.join(root, u.split('#')[0]))) { bad++; console.log('Нет файла:', u); }
}
console.log(bad ? `Битых ссылок: ${bad}` : 'Битых локальных ссылок нет.');
process.exit(bad ? 1 : 0);
