// Auditoría de los puzles de la colección: soluciones, dificultad (% de jugadas que ganan) y problemas.
//   node tools/puzzle-audit.mjs
import fs from 'node:fs';
import { quality } from './lib/puzzle-quality.mjs';
const dir = new URL('../src/content/levels/puzzles/', import.meta.url).pathname;
for (const f of JSON.parse(fs.readFileSync(dir + 'index.json'))) {
  const L = JSON.parse(fs.readFileSync(dir + f)), q = quality(L);
  console.log(f, (L.name || '').padEnd(24), L.cols + 'x' + L.rows, L.hand.join('+').padEnd(30), `${q.wins}/${q.total} ${(q.ratio * 100).toFixed(1)}%`, q.ok ? 'OK' : 'NO', q.robust ? '' : 'azar!', q.spareCards.length ? 'sobra:' + q.spareCards : '', q.idleTiles.length ? 'piezas inútiles:' + q.idleTiles.join(' ') : '', q.idleDecoys?.length ? 'obst. inútiles:' + q.idleDecoys : '');
}
