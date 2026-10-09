// Auditoría de Lo básico: cada nivel, su solución, su dificultad (% de jugadas que ganan) y sus problemas, con el
// solucionador de verdad (monedas, ruleta y túnel con la semilla del nivel).
//   node tools/puzzle-audit.mjs
import fs from 'node:fs';
import { quality, describe } from './lib/basics-solver.mjs';
const file = new URL('../src/content/levels/basics.json', import.meta.url).pathname;
let n = 0;
for (const row of JSON.parse(fs.readFileSync(file))) for (const L of row.levels) {
  const id = L.id, q = quality(L);
  console.log(String(++n).padStart(3), id.padEnd(12), (L.name || '').padEnd(24), L.cols + 'x' + L.rows, L.hand.join('+').padEnd(30), `${q.wins}/${q.total} ${(100 * (q.ratio || 0)).toFixed(1)}%`,
    q.wins ? '' : 'SIN SOLUCIÓN', q.robust === false ? 'azar!' : '', q.spareCards?.length ? 'sobra:' + q.spareCards : '', q.idleTiles?.length ? 'piezas inútiles:' + q.idleTiles.join(' ') : '',
    q.idleDecoys?.length ? 'obst. inútiles:' + q.idleDecoys : '', q.sol ? describe(L, q.sol) : '');
}
