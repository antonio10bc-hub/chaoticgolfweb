// Genera assets/art/manifest.json con el arte bitmap que existe de verdad.
//   1) suelta los PNG en assets/art/ con los nombres de ART_FILES (src/art.js)
//   2) npm run art-manifest
// El juego solo pide los archivos listados (sin peticiones 404 al arrancar).
import fs from 'node:fs';
import path from 'node:path';

const DIR = path.resolve(new URL('../assets/art/', import.meta.url).pathname);
const src = fs.readFileSync(new URL('../src/art.js', import.meta.url), 'utf8');
const block = src.slice(src.indexOf('ART_FILES = {'), src.indexOf('};', src.indexOf('ART_FILES = {')));
const expected = Object.fromEntries([...block.matchAll(/'([\w.]+)':\s*'([\w.-]+)'/g)].map(m => [m[1], m[2]]));

fs.mkdirSync(DIR, { recursive: true });
const present = new Set(fs.readdirSync(DIR));
const manifest = Object.fromEntries(Object.entries(expected).filter(([, file]) => present.has(file)));
fs.writeFileSync(path.join(DIR, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

const missing = Object.entries(expected).filter(([, f]) => !present.has(f)).map(([k, f]) => `${k} (${f})`);
console.log(`arte encontrado: ${Object.keys(manifest).length}/${Object.keys(expected).length}`);
if (missing.length) console.log('sin PNG (se usa el fallback emoji/CSS):\n  ' + missing.join('\n  '));
