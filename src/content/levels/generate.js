// Generador de niveles en solitario (reto diario y contrarreloj).
// Determinista: la misma semilla da siempre el mismo tablero; el mazo lo baraja Game.fromLevel
// con esa misma semilla, así que para todos sale igual.
import { mulberry32 } from '../../engine/rng.js';

// mazo de los niveles generados: de todo un poco (sin NO: en solitario solo te anularía a ti)
const DECK = {
  palo1: 4, palo2: 5, palo3: 4, dedo: 3,
  hoyoUp: 1, hoyoDown: 1, hoyoLeft: 1, hoyoRight: 1,
  bunker: 0, portal: 0,
  oPalo1: 2, oHoyoUp: 1, oHoyoDown: 1, oHoyoLeft: 1, oHoyoRight: 1, no: 0,
};

// dificultad 0..4: más grande, con más búnkeres, portales y pelotas de obstáculo
const TIERS = [
  { cols: 5, rows: 7, bunkers: 1, portals: 0, decoys: 0 },
  { cols: 6, rows: 8, bunkers: 2, portals: 0, decoys: 1 },
  { cols: 7, rows: 9, bunkers: 2, portals: 2, decoys: 1 },
  { cols: 7, rows: 9, bunkers: 3, portals: 2, decoys: 2 },
  { cols: 8, rows: 10, bunkers: 4, portals: 2, decoys: 2 },
];

export function generateLevel(seed, difficulty = 2) {
  const rand = mulberry32(seed >>> 0);
  const T = TIERS[Math.max(0, Math.min(TIERS.length - 1, difficulty))];
  const { cols, rows } = T;
  const ri = n => Math.floor(rand() * n);
  const used = new Set();
  const key = (x, y) => x + ',' + y;
  const take = (x, y) => used.add(key(x, y));
  const free = (x, y) => x >= 0 && y >= 0 && x < cols && y < rows && !used.has(key(x, y));

  // hoyo en el tercio de arriba; PAR debajo de él; pelota en la fila de abajo, desplazada
  const hx = 1 + ri(cols - 2), hy = ri(Math.max(1, Math.floor(rows / 3)));
  take(hx, hy);
  const parCells = [];
  for (let i = 1; i <= 3 && hy + i < rows - 1; i++) { parCells.push({ x: hx, y: hy + i, n: 4 - i }); }
  let bx;
  do bx = ri(cols); while (bx === hx && cols > 2);
  const by = rows - 1;
  take(bx, by);
  // casillas que no deben taparse: la columna del PAR (referencia) y la vecindad de la pelota
  for (const p of parCells) take(p.x, p.y);
  const reserved = new Set([key(bx, by - 1), key(bx - 1, by), key(bx + 1, by)]);
  const spot = () => {
    for (let tries = 0; tries < 200; tries++) {
      const x = ri(cols), y = 1 + ri(rows - 2);
      if (free(x, y) && !reserved.has(key(x, y))) { take(x, y); return { x, y }; }
    }
    return null;
  };
  const tiles = [];
  for (let i = 0; i < T.bunkers; i++) { const s = spot(); if (s) tiles.push({ type: 'bunker', ...s }); }
  if (T.portals) { // los dos portales, lejos el uno del otro
    const a = spot(); let b = null;
    for (let tries = 0; tries < 30 && a; tries++) {
      const c = spot();
      if (c && Math.abs(c.x - a.x) + Math.abs(c.y - a.y) >= Math.floor((cols + rows) / 3)) { b = c; break; }
      if (c) used.delete(key(c.x, c.y));
    }
    if (a && b) tiles.push({ type: 'portal', ...a }, { type: 'portal', ...b });
  }
  const extraBalls = [];
  for (let i = 0; i < T.decoys; i++) { const s = spot(); if (s) extraBalls.push(s); }

  return {
    version: 1, generated: true,
    name: '', cols, rows,
    hole: { x: hx, y: hy }, ball: { x: bx, y: by },
    parCells, tiles, extraBalls,
    deckCounts: { ...DECK },
  };
}

// semilla del día (hora local): "2026-09-24" → número
export function dateKey(d = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
export function seedOf(str) { // FNV-1a
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
