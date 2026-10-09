// Precarga del arranque: todos los módulos que importa src/main.js (directa o indirectamente) y los niveles
// integrados (Lo básico: basics/), como <link rel="modulepreload"> / rel="preload" en index.html. Sin esto el
// navegador los descubre por niveles (main → sus imports → los de estos…: 5 viajes de red, y luego el índice de
// niveles y cada nivel: 2 más); con la lista, los pide todos a la vez desde el principio. Sin paso de build:
// el bloque va entre marcadores en index.html y este script lo regenera.
//   npm run preload        (tests/preload.test.mjs avisa si la lista no está al día)
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const START = '<!-- precarga (npm run preload) -->', END = '<!-- /precarga -->';

// módulos importados de forma estática desde main.js, en orden de profundidad (los primeros, antes)
function modules() {
  const depth = new Map();
  const walk = (file, d) => {
    if (depth.has(file) && depth.get(file) <= d) return;
    depth.set(file, d);
    const src = fs.readFileSync(file, 'utf8');
    for (const m of src.matchAll(/^\s*(?:import|export)\s[^'"]*?\sfrom\s+['"](\.[^'"]+)['"]|^\s*import\s+['"](\.[^'"]+)['"]/gm))
      walk(path.resolve(path.dirname(file), m[1] || m[2]), d + 1);
  };
  walk(path.join(ROOT, 'src/main.js'), 0);
  return [...depth].filter(([, d]) => d > 0).sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0])).map(([f]) => path.relative(ROOT, f));
}
const levels = () => {
  const base = 'src/content/levels/basics/';
  const rows = JSON.parse(fs.readFileSync(path.join(ROOT, base, 'index.json'), 'utf8'));
  return [base + 'index.json', ...rows.flatMap(r => r.levels.map(id => base + id + '.json'))];
};

export function preloadBlock() {
  const lines = [...modules().map(f => `<link rel="modulepreload" href="${f}">`),
    ...levels().map(f => `<link rel="preload" href="${f}" as="fetch" crossorigin>`)];
  return `${START}\n${lines.join('\n')}\n${END}`;
}
export const currentBlock = html => { const a = html.indexOf(START), b = html.indexOf(END); return a < 0 || b < 0 ? null : html.slice(a, b + END.length); };

if (import.meta.url === `file://${process.argv[1]}`) {
  const file = path.join(ROOT, 'index.html');
  let html = fs.readFileSync(file, 'utf8');
  const block = preloadBlock(), cur = currentBlock(html);
  html = cur ? html.replace(cur, block) : html.replace('<script type="module" src="src/main.js"></script>', `<script type="module" src="src/main.js"></script>\n${block}`);
  fs.writeFileSync(file, html);
  console.log(`precarga: ${block.split('\n').length - 2} archivos`);
}
