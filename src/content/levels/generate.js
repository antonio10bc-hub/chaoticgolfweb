// Generador de niveles en solitario (reto diario y contrarreloj).
// Determinista: la misma semilla da siempre el mismo tablero; el mazo lo baraja Game.fromLevel
// con esa misma semilla, así que para todos sale igual.
import { mulberry32 } from '../../engine/rng.js';

// mazo de los niveles generados: de todo un poco (sin NO: en solitario solo te anularía a ti).
// En los hoyos grandes entran palos de 4 (tier.long)
const DECK = {
  palo1: 4, palo2: 5, palo3: 4, dedo: 3,
  hoyoUp: 1, hoyoDown: 1, hoyoLeft: 1, hoyoRight: 1,
  bunker: 0, portal: 0,
  oPalo1: 2, oHoyoUp: 1, oHoyoDown: 1, oHoyoLeft: 1, oHoyoRight: 1, no: 0,
};

// dificultad 0..4 (los 5 hoyos del contrarreloj): cada hoyo presenta algo nuevo y el último lo mezcla todo.
//   0 búnker · 1 río y una pelota de obstáculo · 2 portales y madera · 3 lago, esquinas y lanzadera ·
//   4 campo grande con de todo y palos de 4
const TIERS = [
  { cols: 5, rows: 7, bunker: 1 },
  { cols: 6, rows: 8, bunker: 1, river: 1, decoys: 1 },
  { cols: 7, rows: 9, bunker: 1, portals: 1, block: 2 },
  { cols: 7, rows: 9, lake: 1, corner: 2, launcher: 1, decoys: 1 },
  { cols: 8, rows: 10, bunker: 1, river: 1, lake: 1, corner: 1, launcher: 1, portals: 1, decoys: 2, long: true },
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
  // casillas que no deben taparse: la columna del PAR (referencia) y la vecindad de la pelota y del hoyo
  for (const p of parCells) take(p.x, p.y);
  const reserved = new Set([key(bx, by - 1), key(bx - 1, by), key(bx + 1, by), key(hx - 1, hy), key(hx + 1, hy), key(hx, hy + 1)]);
  const ok = (x, y) => free(x, y) && !reserved.has(key(x, y));
  const spot = (y0 = 1, y1 = rows - 2) => {
    for (let tries = 0; tries < 200; tries++) {
      const x = ri(cols), y = y0 + ri(Math.max(1, y1 - y0 + 1));
      if (ok(x, y)) { take(x, y); return { x, y }; }
    }
    return null;
  };
  // la zona entre la pelota y el hoyo (con una columna de margen): ahí las piezas deciden la jugada
  const x0 = Math.max(0, Math.min(bx, hx) - 1), x1 = Math.min(cols - 1, Math.max(bx, hx) + 1);
  const route = () => {
    for (let tries = 0; tries < 120; tries++) {
      const x = x0 + ri(x1 - x0 + 1), y = hy + ri(Math.max(1, by - hy));
      if (ok(x, y)) { take(x, y); return { x, y }; }
    }
    return spot();
  };
  const tiles = [];
  const put = (type, extra = {}) => { const s = route(); if (s) tiles.push({ type, ...s, ...extra }); };
  for (let i = 0; i < (T.bunker || 0); i++) put('bunker');
  for (let i = 0; i < (T.block || 0); i++) put('block');
  for (let i = 0; i < (T.corner || 0); i++) put('corner', { rot: ri(4) });
  for (let i = 0; i < (T.launcher || 0); i++) put('launcher', { rot: ri(4) });
  // río: una columna de 2 o 3, que no desemboque en la pelota ni en el hoyo
  for (let i = 0; i < (T.river || 0); i++) {
    for (let tries = 0; tries < 60; tries++) {
      const len = 2 + ri(2), x = tries < 40 ? x0 + ri(x1 - x0 + 1) : ri(cols), y0 = 1 + ri(Math.max(1, rows - 3 - len));
      const cells = Array.from({ length: len }, (_, k) => ({ x, y: y0 + k })), mouth = { x, y: y0 + len };
      if (!cells.every(c => ok(c.x, c.y)) || (mouth.x === bx && mouth.y === by) || (mouth.x === hx && mouth.y === hy)) continue;
      cells.forEach(c => { take(c.x, c.y); tiles.push({ type: 'river', ...c }); });
      break;
    }
  }
  // lago: una mancha de 2 o 3 casillas
  for (let i = 0; i < (T.lake || 0); i++) {
    const s = route(); if (!s) continue;
    const cells = [s];
    for (let tries = 0; tries < 20 && cells.length < 2 + ri(2); tries++) {
      const b = cells[ri(cells.length)], [dx, dy] = [[1, 0], [-1, 0], [0, 1], [0, -1]][ri(4)];
      if (ok(b.x + dx, b.y + dy)) { take(b.x + dx, b.y + dy); cells.push({ x: b.x + dx, y: b.y + dy }); }
    }
    cells.forEach(c => tiles.push({ type: 'lake', ...c }));
  }
  if (T.portals) { // los dos portales, lejos el uno del otro (uno en la zona del camino)
    const a = route(); let b = null;
    for (let tries = 0; tries < 30 && a; tries++) {
      const c = spot();
      if (c && Math.abs(c.x - a.x) + Math.abs(c.y - a.y) >= Math.floor((cols + rows) / 3)) { b = c; break; }
      if (c) used.delete(key(c.x, c.y));
    }
    if (a && b) tiles.push({ type: 'portal', ...a }, { type: 'portal', ...b });
  }
  const extraBalls = [];
  for (let i = 0; i < (T.decoys || 0); i++) { const s = spot(); if (s) extraBalls.push(s); }

  return {
    version: 1, generated: true,
    name: '', cols, rows,
    hole: { x: hx, y: hy }, ball: { x: bx, y: by },
    parCells, tiles, extraBalls,
    deckCounts: T.long ? { ...DECK, palo4: 3, palo1: 3 } : { ...DECK },
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
