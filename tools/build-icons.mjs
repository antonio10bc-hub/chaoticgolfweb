// Genera todos los iconos a partir de assets/icons/favicon.svg (la pelota de golf blanca sobre verde):
//   icon.svg (el del manifest), icon-192.png e icon-512.png (app instalada y apple-touch-icon: a sangre, sin esquinas, que
//   el sistema ya las redondea y el 512 también sirve de "maskable"), favicon-32/48/96.png y favicon.ico (32 y 48, en la raíz)
//   npm run icons            (necesita Chrome: CHROME_PATH si no lo encuentra)
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const DIR = path.join(ROOT, 'assets/icons');
const CHROME = process.env.CHROME_PATH || ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium']
  .find(p => fs.existsSync(p));
if (!CHROME) { console.error('No encuentro Chrome: define CHROME_PATH'); process.exit(2); }

const svg = fs.readFileSync(path.join(DIR, 'favicon.svg'), 'utf8');
const fullBleed = svg.replace(/<rect width="64" height="64" rx="15"/, '<rect width="64" height="64"'); // (a sangre)
fs.writeFileSync(path.join(DIR, 'icon.svg'), svg);

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage();
async function png(src, size) {
  await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
  await page.setContent(`<html><body style="margin:0;background:transparent">${src.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  return page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
}
const out = {};
for (const n of [32, 48, 96]) fs.writeFileSync(path.join(DIR, `favicon-${n}.png`), out[n] = await png(svg, n));
for (const n of [192, 512]) fs.writeFileSync(path.join(DIR, `icon-${n}.png`), await png(fullBleed, n));
await browser.close();

// favicon.ico: un ICO con los PNG de 32 y 48 dentro (cabecera de 6 bytes, 16 por imagen y los datos)
const imgs = [32, 48].map(n => ({ n, data: Buffer.from(out[n]) }));
const head = Buffer.alloc(6 + 16 * imgs.length);
head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(imgs.length, 4);
let off = head.length;
imgs.forEach(({ n, data }, i) => {
  const e = 6 + 16 * i;
  head.writeUInt8(n, e); head.writeUInt8(n, e + 1); head.writeUInt8(0, e + 2); head.writeUInt8(0, e + 3);
  head.writeUInt16LE(1, e + 4); head.writeUInt16LE(32, e + 6); head.writeUInt32LE(data.length, e + 8); head.writeUInt32LE(off, e + 12);
  off += data.length;
});
fs.writeFileSync(path.join(ROOT, 'favicon.ico'), Buffer.concat([head, ...imgs.map(i => i.data)]));
console.log('iconos generados en assets/icons y favicon.ico');
