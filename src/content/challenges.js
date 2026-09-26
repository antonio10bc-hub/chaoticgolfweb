// Desafíos y desafío semanal: partidas contra bots con reglas, mazo y, sobre todo, un campo diseñado.
// Cada campo es un diseño hecho a mano en coordenadas relativas al recorrido (el hoyo arriba en el
// centro, la columna de PAR debajo y la fila de salidas; ver Game.standard) y cada partida lo varía un
// poco con su semilla: se refleja de lado, cambian los giros de algunas piezas o una pieza secundaria
// elige entre varios sitios. Así siempre está bien pensado y no se aprende de memoria.
// Sin interfaz: lo usan screen-modes.js y las simulaciones de balanceo (y sus tests).
import { mulberry32 } from '../engine/rng.js';
import { CARDS, defaultCounts } from './cards/index.js';
import { deckById } from './decks.js';

export const CH_GROUPS = ['warmup', 'mid', 'expert'];

/* ---------- mazos ---------- */
const zero = () => Object.fromEntries(Object.keys(CARDS).map(k => [k, 0]));
const BASE = { palo1: 6, palo2: 8, palo3: 0, dedo: 2, hoyoUp: 2, hoyoDown: 2, hoyoLeft: 2, hoyoRight: 2, bunker: 1, portal: 1,
  oPalo1: 2, oHoyoUp: 1, oHoyoDown: 1, oHoyoLeft: 1, oHoyoRight: 1, no: 2 };
const deckOf = id => deckById(id).counts ? deckById(id).counts(defaultCounts()) : defaultCounts();
export const DECKS = {
  classic: () => defaultCounts(),
  water: () => deckOf('water'),
  minigolf: () => deckOf('minigolf'),
  ultimate: () => deckOf('ultimate'),
  // paso corto: sin palo 3, más palos cortos y más dedo (precisión)
  short: () => ({ ...zero(), ...BASE, dedo: 4 }),
  // solo reacciones
  orange: () => ({ ...zero(), oPalo1: 12, oHoyoUp: 1, oHoyoDown: 3, oHoyoLeft: 1, oHoyoRight: 1 }), // (el hoyo tiende a bajar hacia las pelotas)
  // atajos: los portales ya están en el campo
  noPortals: () => ({ ...defaultCounts(), portal: 0 }),
  // campo largo: palos largos (y uno de 10 que puede pasarse de frenada)
  long: () => ({ ...zero(), palo1: 3, palo2: 4, palo3: 4, palo4: 5, palo5: 4, palo10: 2, dedo: 2, hoyoUp: 2, hoyoDown: 2, hoyoLeft: 2, hoyoRight: 2,
    bunker: 2, oPalo1: 2, oHoyoUp: 1, oHoyoDown: 1, oHoyoLeft: 1, oHoyoRight: 1, no: 2 }),
  // madera ligera: el campo ya trae sus piezas, el mazo solo añade alguna
  wood: () => ({ ...deckOf('minigolf'), block: 1, corner: 2, tunnel: 1, launcher: 1 }),
  // agua y madera a la vez (aserradero, esclusas), también ligero
  mill: () => ({ ...deckOf('minigolf'), block: 1, corner: 2, tunnel: 0, launcher: 1, river: 2, lake: 1 }),
  // espejos: esquinas para colocar y algún palo iridiscente
  mirrors: () => ({ ...deckOf('minigolf'), corner: 3, block: 0, tunnel: 0, launcher: 0, paloIri: 3 }),
  // prisma: casi todo son palos iridiscentes, y cartas de hoyo para ponerlo donde para la pelota
  prism: () => ({ ...zero(), paloIri: 10, palo1: 3, palo2: 2, hoyoUp: 3, hoyoDown: 3, hoyoLeft: 3, hoyoRight: 3, oPalo1: 3,
    oHoyoUp: 1, oHoyoDown: 1, oHoyoLeft: 1, oHoyoRight: 1, no: 2 }),
  // caos total: todas las cartas, pero con menos piezas para colocar (el campo ya trae de todo)
  chaos: () => ({ ...deckOf('ultimate'), river: 2, lake: 2, block: 2, corner: 2, tunnel: 1, launcher: 1, bunker: 1, portal: 1 }),
  // dedo: el dedo manda
  fingers: () => ({ ...zero(), ...BASE, palo1: 4, palo2: 4, palo3: 2, dedo: 8 }),
  // largos: solo tiros largos (semanal)
  drive: () => ({ ...zero(), ...BASE, palo1: 0, palo2: 4, palo3: 10 }),
};

/* ---------- geometría del recorrido (la misma cuenta que Game.standard) ---------- */
export function courseOf({ cols, rows, par }, players) {
  const len = par + 2, R = Math.max(rows, len), cx = Math.floor(cols / 2), hy = Math.floor((R - len) / 2), by = hy + par + 1;
  let sx = cx - Math.floor((players - 1) / 2);
  sx = Math.max(0, Math.min(sx, cols - players));
  return { cols, rows: R, par, cx, hy, by, spawns: Array.from({ length: players }, (_, i) => ({ x: sx + i, y: by })) };
}

// herramientas de diseño: C (recorrido) + v (variación con la semilla)
//   v.pick(a) · v.chance(p) · v.rot() · v.jit(n): -n..n
function variation(seed) {
  const r = mulberry32((seed ^ 0x2f6b1c3d) >>> 0);
  return { r, pick: a => a[Math.floor(r() * a.length)], chance: p => r() < p, rot: () => Math.floor(r() * 4), jit: n => Math.floor(r() * (2 * n + 1)) - n };
}
const MIRROR_ROT = { corner: [1, 0, 3, 2], launcher: [0, 3, 2, 1] }; // (reflejo izquierda ↔ derecha)
function mirrorTiles(tiles, cols) {
  return tiles.map(t => ({ ...t, x: cols - 1 - t.x, ...(MIRROR_ROT[t.type] && t.rot != null ? { rot: MIRROR_ROT[t.type][t.rot] } : {}) }));
}
// piezas que no pueden ir: fuera, repetidas, en el hoyo, en una salida o (salvo búnker marcado) en el PAR
function sanitize(tiles, C) {
  const seen = new Set(), out = [];
  const par = new Set(Array.from({ length: C.par }, (_, i) => C.cx + ',' + (C.hy + 1 + i)));
  const spawn = new Set(C.spawns.map(s => s.x + ',' + s.y));
  for (const t of tiles) {
    const k = t.x + ',' + t.y;
    if (t.x < 0 || t.y < 0 || t.x >= C.cols || t.y >= C.rows || seen.has(k) || spawn.has(k) || (t.x === C.cx && t.y === C.hy)) continue;
    if (par.has(k) && !(t.onPar && t.type === 'bunker')) continue;
    seen.add(k);
    const { onPar, ...clean } = t;
    if (clean.rot === 0) delete clean.rot;
    out.push(clean);
  }
  return out;
}
const col = (type, x, y0, y1) => Array.from({ length: y1 - y0 + 1 }, (_, i) => ({ type, x, y: y0 + i })); // columna (ríos)
const cells = (type, list) => list.map(([x, y]) => ({ type, x, y }));

/* ---------- los desafíos ---------- */
// board: tamaño del campo (y su PAR) · opps: bots · diff · deck: su mazo · scene: fondo (baraja)
// rules: reglas especiales · layout(C, v): el diseño · mirror: si se refleja al azar
export const CHALLENGES = [
  /* --- calentamiento: una sola idea, clara --- */
  { id: 'noPalo3', group: 'warmup', icon: 'i-club', board: { cols: 7, rows: 7, par: 3 }, opps: 2, diff: 'normal', deck: 'short',
    layout: (C, v) => [
      { type: 'bunker', x: C.cx - 1, y: C.hy + 1 }, { type: 'bunker', x: C.cx + 1, y: C.hy + 1 },
      { type: 'bunker', x: C.cx, y: C.hy + 2, onPar: true }, // (la calle del PAR no es una autopista)
      { type: 'bunker', x: C.cx + v.pick([-2, 2]), y: C.hy + 3 },
    ] },
  { id: 'holeDrift', group: 'warmup', icon: 'i-hole', board: { cols: 9, rows: 9, par: 4 }, opps: 2, diff: 'normal', rules: { holeDrift: true }, mirror: true,
    layout: C => [{ type: 'bunker', x: C.cx - 1, y: C.hy }, { type: 'bunker', x: C.cx + 2, y: C.hy + 1 }, { type: 'bunker', x: C.cx - 2, y: C.hy + 3 }] },
  { id: 'bunkers', group: 'warmup', icon: 'i-sand', board: { cols: 9, rows: 9, par: 4 }, opps: 2, diff: 'normal', mirror: true,
    layout: (C, v) => { const b = (x, y) => ({ type: 'bunker', x, y, onPar: true });
      const wall1 = [], wall2 = [];
      for (let x = 0; x < C.cols; x++) { if (x < C.cols - 3) wall1.push(b(x, C.hy + 1)); if (x > 2) wall2.push(b(x, C.hy + 3)); }
      return [...wall1, ...wall2, b(C.cx + v.pick([-3, 3]), C.by - 1)]; } },
  // trampolines: dos lanzaderas junto a la salida; giran cada turno: cuando apuntan arriba son un atajo
  // hacia el hoyo, y si no, un desvío (una sola idea: saber cuándo subirse)
  { id: 'springboard', group: 'warmup', icon: 'i-launch', board: { cols: 7, rows: 7, par: 3 }, opps: 2, diff: 'normal', deck: 'wood', scene: 'mini',
    layout: (C, v) => { const r = v.rot();
      return [{ type: 'launcher', x: C.cx - 2, y: C.by, rot: r }, { type: 'launcher', x: C.cx + 2, y: C.by, rot: (r + 2) % 4 }]; } },
  { id: 'rapids', group: 'warmup', icon: 'i-wave', board: { cols: 7, rows: 7, par: 3 }, opps: 2, diff: 'normal', deck: 'water', scene: 'lake', mirror: true,
    layout: (C, v) => { const long = v.chance(.5) ? 1 : 0;
      return [...col('river', C.cx - 2, C.hy, C.hy + 1 + long), ...col('river', C.cx + 2, C.hy, C.hy + 2 - long)]; } },
  { id: 'archipelago', group: 'warmup', icon: 'i-drop', board: { cols: 9, rows: 9, par: 4 }, opps: 2, diff: 'normal', deck: 'water', scene: 'lake', mirror: true,
    layout: (C, v) => [
      ...cells('lake', [[C.cx - 3, C.hy + 1], [C.cx - 2, C.hy + 1], [C.cx - 3, C.hy + 2], [C.cx - 2, C.hy + 2]]),
      ...cells('lake', [[C.cx + 2, C.hy + 3], [C.cx + 3, C.hy + 3], [C.cx + 3, C.hy + 4]]),
      ...cells('lake', [[C.cx + 2, C.hy], [C.cx + 2, C.hy - 1]]),
      ...cells('lake', v.pick([[[C.cx - 2, C.by + 1], [C.cx - 1, C.by + 1]], [[C.cx + 1, C.by + 1], [C.cx + 2, C.by + 1]]])),
    ] },

  /* --- intermedio: la mecánica pide pensar la jugada --- */
  { id: 'portals', group: 'mid', icon: 'i-spiral', board: { cols: 9, rows: 9, par: 4 }, opps: 2, diff: 'normal', deck: 'noPortals', mirror: true,
    layout: (C, v) => [
      { type: 'portal', pair: 1, x: C.cx - 3, y: C.by - 1 }, { type: 'portal', pair: 1, x: C.cx + 2, y: C.hy + 1 },
      { type: 'portal', pair: 2, x: C.cx + 3, y: C.by - 1 + v.jit(1) }, { type: 'portal', pair: 2, x: C.cx - 3, y: C.hy + 2 },
      { type: 'portal', pair: 3, x: C.cx - 1, y: C.by + 1 }, { type: 'portal', pair: 3, x: C.cx + 1, y: C.hy - 1 },
      { type: 'bunker', x: C.cx - 1, y: C.hy + 1 },
    ] },
  { id: 'pinball', group: 'mid', icon: 'i-burst', board: { cols: 9, rows: 9, par: 4 }, opps: 2, diff: 'normal', deck: 'wood', scene: 'mini', mirror: true,
    layout: (C, v) => [
      { type: 'corner', x: C.cx - 3, y: C.hy, rot: 0 }, { type: 'corner', x: C.cx + 3, y: C.hy, rot: 1 },  // arriba: hacia el hoyo
      { type: 'corner', x: C.cx - 3, y: C.by, rot: 3 }, { type: 'corner', x: C.cx + 3, y: C.by, rot: 2 },  // abajo: a la calle
      { type: 'block', x: C.cx - 2, y: C.hy + 2 }, { type: 'block', x: C.cx + 2, y: C.hy + 3 },
      { type: 'block', x: v.pick([C.cx - 1, C.cx + 1]), y: C.hy - 1 },
    ] },
  { id: 'warren', group: 'mid', icon: 'i-tunnel', board: { cols: 7, rows: 7, par: 3 }, opps: 2, diff: 'normal', deck: 'wood', scene: 'mini', mirror: true,
    layout: (C, v) => [
      { type: 'tunnel', x: C.cx - 2, y: C.hy + 1 }, { type: 'tunnel', x: C.cx + 2, y: C.hy + 2 },
      { type: 'tunnel', x: C.cx + 1, y: C.hy - 1 }, { type: 'tunnel', x: C.cx - 2, y: C.by }, // (junto a la salida: la apuesta del primer turno)
    ] },
  { id: 'launchpads', group: 'mid', icon: 'i-launch', board: { cols: 9, rows: 9, par: 4 }, opps: 2, diff: 'normal', deck: 'wood', scene: 'mini', mirror: true,
    layout: (C, v) => { const r0 = v.rot();
      return [
        { type: 'launcher', x: C.cx - 3, y: C.by - 1, rot: r0 }, { type: 'launcher', x: C.cx + 3, y: C.by - 1, rot: (r0 + 2) % 4 },
        // (izquierda: cuando la de abajo apunta arriba, la de arriba apunta al centro; derecha: igual, dos turnos después)
        { type: 'launcher', x: C.cx - 3, y: C.by - 4, rot: (r0 + 1) % 4 }, { type: 'launcher', x: C.cx + 3, y: C.by - 4, rot: (r0 + 1) % 4 },
        { type: 'launcher', x: C.cx - 1, y: C.by + 1, rot: v.rot() },
      ]; } },
  { id: 'longDrive', group: 'mid', icon: 'i-flag', board: { cols: 7, rows: 12, par: 7 }, opps: 2, diff: 'normal', deck: 'long',
    layout: (C, v) => [
      { type: 'bunker', x: C.cx - 1, y: C.by - 4 }, { type: 'bunker', x: C.cx + 1, y: C.by - 5 }, // aterrizaje de los palos de 4 y 5
      { type: 'bunker', x: C.cx + v.pick([-2, 2]), y: C.by - 3 },
      ...cells('lake', [[C.cx - 2, C.hy - 1], [C.cx - 1, C.hy - 1], [C.cx + 1, C.hy - 1], [C.cx + 2, C.hy - 1]]), // pasarse del hoyo
      { type: 'bunker', x: C.cx - 1, y: C.hy + 1 }, { type: 'bunker', x: C.cx + 1, y: C.hy + 1 },
    ] },

  { id: 'onlyOrange', group: 'mid', icon: 'i-bolt', board: { cols: 5, rows: 5, par: 1 }, opps: 1, diff: 'normal', deck: 'orange', rules: { onlyOrange: true } },
  /* --- experto: combinaciones y mucho que leer --- */
  { id: 'sawmill', group: 'expert', icon: 'i-block', board: { cols: 9, rows: 9, par: 4 }, opps: 2, diff: 'normal', deck: 'mill', scene: 'lake', mirror: true,
    layout: (C, v) => [
      ...col('river', C.cx - 3, C.hy - 1, C.hy + 2), { type: 'corner', x: C.cx - 3, y: C.hy + 3, rot: 3 }, // baja y gira a la derecha
      ...col('river', C.cx + 3, C.hy, C.hy + 3), { type: 'corner', x: C.cx + 3, y: C.hy + 4, rot: 2 },     // baja y gira a la izquierda
      { type: 'tunnel', x: C.cx + v.pick([-2, 2]), y: C.by + 1 },
      { type: 'block', x: C.cx - 1, y: C.hy - 1 },
    ] },
  { id: 'locks', group: 'expert', icon: 'i-wave', board: { cols: 9, rows: 9, par: 4 }, opps: 2, diff: 'normal', deck: 'mill', scene: 'lake', mirror: true,
    layout: (C, v) => [
      ...col('river', C.cx - 2, C.hy, C.hy + 2), { type: 'launcher', x: C.cx - 2, y: C.hy + 3, rot: v.rot() },
      ...col('river', C.cx + 2, C.hy + 1, C.hy + 3), { type: 'launcher', x: C.cx + 2, y: C.hy + 4, rot: v.rot() },
      ...cells('lake', [[C.cx - 4, C.hy + 4], [C.cx - 4, C.hy + 5]]),
      { type: 'bunker', x: C.cx + 1, y: C.hy - 1 },
    ] },
  { id: 'mirrors', group: 'expert', icon: 'i-prism', board: { cols: 9, rows: 9, par: 4 }, opps: 2, diff: 'normal', deck: 'mirrors', scene: 'mini', mirror: true,
    layout: (C, v) => [
      { type: 'corner', x: C.cx - 2, y: C.hy, rot: 0 }, { type: 'corner', x: C.cx + 2, y: C.hy, rot: 1 },
      { type: 'corner', x: C.cx - 2, y: C.hy + 3, rot: 3 }, { type: 'corner', x: C.cx + 2, y: C.hy + 3, rot: 2 }, // (desde el centro, por la banda, al embudo)
      { type: 'corner', x: C.cx - 1, y: C.by + 1, rot: v.pick([2, 3]) }, { type: 'corner', x: C.cx + 1, y: C.hy - 1, rot: v.pick([0, 3]) },
    ] },
  { id: 'prism', group: 'expert', icon: 'i-prism', board: { cols: 7, rows: 7, par: 3 }, opps: 1, diff: 'hard', deck: 'prism', scene: 'prism',
    layout: C => [
      { type: 'corner', x: 0, y: C.hy, rot: 0 }, { type: 'corner', x: C.cols - 1, y: C.hy, rot: 1 },
      { type: 'bunker', x: C.cx - 2, y: C.hy }, { type: 'bunker', x: C.cx + 2, y: C.hy }, { type: 'bunker', x: C.cx, y: C.hy - 1 },
      { type: 'bunker', x: 1, y: C.by }, { type: 'bunker', x: C.cols - 2, y: C.by }, { type: 'block', x: C.cx, y: C.by + 1 },
    ] },
  { id: 'crowd', group: 'expert', icon: 'i-users', board: { cols: 9, rows: 9, par: 4 }, opps: 6, diff: 'hard',
    layout: C => [{ type: 'bunker', x: C.cx - 2, y: C.hy }, { type: 'bunker', x: C.cx + 2, y: C.hy }] },
  { id: 'fullChaos', group: 'expert', icon: 'i-chaos', board: { cols: 11, rows: 10, par: 5 }, opps: 3, diff: 'normal', deck: 'chaos', scene: 'prism', mirror: true,
    layout: (C, v) => [
      ...col('river', C.cx - 4, C.hy - 1, C.hy + 2), ...cells('lake', [[C.cx - 4, C.by], [C.cx - 5, C.by], [C.cx - 5, C.by - 1]]),
      { type: 'corner', x: C.cx + 3, y: C.hy, rot: 1 }, { type: 'block', x: C.cx + 4, y: C.hy + 3 },
      { type: 'launcher', x: C.cx + 3, y: C.by - 1, rot: v.rot() }, { type: 'tunnel', x: C.cx + 1, y: C.by + 1 },
      { type: 'portal', pair: 1, x: C.cx - 2, y: C.by + 1 }, { type: 'portal', pair: 1, x: C.cx + 2, y: C.hy - 1 },
      { type: 'bunker', x: C.cx - 1, y: C.hy + 1 }, { type: 'bunker', x: C.cx + 1, y: C.hy + 1 },
      { type: 'corner', x: C.cx - 2, y: C.hy + 3, rot: v.pick([0, 3]) },
    ] },
];

/* ---------- desafío semanal: una regla por semana (remezcla de los campos de arriba) ---------- */
const layoutOf = id => CHALLENGES.find(c => c.id === id).layout;
export const WEEKLY = [
  { id: 'tinyChaos', icon: 'i-users', board: { cols: 5, rows: 6, par: 2 }, opps: 3, diff: 'hard' },
  // portales a los lados y detrás de la salida (lejos del hoyo, que se mueve solo y también los cruza)
  { id: 'portalMaze', icon: 'i-spiral', board: { cols: 9, rows: 9, par: 4 }, opps: 2, diff: 'normal', deck: 'noPortals', rules: { holeDrift: true }, mirror: true,
    layout: C => [
      { type: 'portal', pair: 1, x: C.cx - 4, y: C.hy + 2 }, { type: 'portal', pair: 1, x: C.cx + 4, y: C.hy + 4 },
      { type: 'portal', pair: 2, x: C.cx - 2, y: C.by + 1 }, { type: 'portal', pair: 2, x: C.cx + 3, y: C.hy - 1 },
      { type: 'bunker', x: C.cx + 1, y: C.hy + 2 },
    ] },
  { id: 'lakeDuel', icon: 'i-drop', board: { cols: 9, rows: 9, par: 4 }, opps: 1, diff: 'hard', deck: 'water', scene: 'lake', layout: layoutOf('archipelago'), mirror: true },
  { id: 'bigHitters', icon: 'i-club', board: { cols: 9, rows: 11, par: 4 }, opps: 2, diff: 'normal', deck: 'drive' },
  { id: 'duel', icon: 'i-trophy', board: { cols: 9, rows: 9, par: 4 }, opps: 1, diff: 'hard' },
  { id: 'bunkerCrowd', icon: 'i-sand', board: { cols: 9, rows: 9, par: 4 }, opps: 4, diff: 'normal', layout: layoutOf('noPalo3') },
  { id: 'driftDuel', icon: 'i-hole', board: { cols: 5, rows: 5, par: 2 }, opps: 1, diff: 'hard', rules: { holeDrift: true } },
  { id: 'floodDrift', icon: 'i-wave', board: { cols: 7, rows: 7, par: 3 }, opps: 2, diff: 'normal', deck: 'water', scene: 'lake', rules: { holeDrift: true }, layout: layoutOf('rapids'), mirror: true },
  { id: 'woodDuel', icon: 'i-burst', board: { cols: 9, rows: 9, par: 4 }, opps: 1, diff: 'hard', deck: 'wood', scene: 'mini', layout: layoutOf('pinball'), mirror: true },
  { id: 'iriParty', icon: 'i-prism', board: { cols: 7, rows: 7, par: 3 }, opps: 2, diff: 'normal', deck: 'prism', scene: 'prism', layout: layoutOf('prism') },
  { id: 'launchCrowd', icon: 'i-launch', board: { cols: 9, rows: 9, par: 4 }, opps: 4, diff: 'normal', deck: 'wood', scene: 'mini', layout: layoutOf('launchpads'), mirror: true },
  { id: 'fingerFest', icon: 'i-hand', board: { cols: 7, rows: 7, par: 3 }, opps: 2, diff: 'normal', deck: 'fingers', scene: 'mini', layout: layoutOf('warren'), mirror: true },
];

/* ---------- montar una partida ---------- */
// lo que necesita Game.pve de un desafío (o regla semanal): tamaño, mazo y reglas
export function challengeCfg(ch) {
  const extra = { ...ch.board, counts: ch.deck ? DECKS[ch.deck]() : undefined };
  if (!extra.counts) delete extra.counts;
  if (ch.rules) extra.rules = { ...ch.rules };
  return { cfg: { opps: ch.opps, diff: ch.diff }, extra };
}
// las piezas del campo para esta partida (seed: la de la partida)
export function challengeTiles(ch, S, seed) {
  if (!ch.layout) return [];
  const C = courseOf({ cols: S.cols, rows: S.rows, par: S.par }, S.nPlayers);
  const v = variation(seed ?? 1);
  let tiles = ch.layout(C, v);
  if (ch.mirror && v.chance(.5)) tiles = mirrorTiles(tiles, C.cols);
  return sanitize(tiles, C);
}
export const challengeById = id => CHALLENGES.find(c => c.id === id);
export const weeklyById = id => WEEKLY.find(c => c.id === id);
