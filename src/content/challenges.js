// Desafíos (cada semana, 5 de ellos: weekChallenges) y reto diario: partidas contra bots con reglas, mazo y, sobre todo,
// un campo diseñado.
// Cada campo es un diseño hecho a mano en coordenadas relativas al recorrido (el hoyo arriba en el
// centro, la columna de PAR debajo y la fila de salidas; ver Game.standard) y cada partida lo varía un
// poco con su semilla: se refleja de lado, cambian los giros de algunas piezas o una pieza secundaria
// elige entre varios sitios. Así siempre está bien pensado y no se aprende de memoria.
// Sin interfaz: lo usan screen-modes.js y las simulaciones de balanceo (y sus tests).
import { mulberry32 } from '../engine/rng.js';
import { CARDS, defaultCounts } from './cards/index.js';
import { deckById } from './decks.js';
import { outline, clockStations } from '../engine/train.js';
import { SEASONS } from '../engine/seasons.js';

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
  train: () => deckOf('train'),
  seasons: () => deckOf('seasons'),
  // una estación fija (sin cartas de cambio de estación): la de siempre, sin búnkeres ni portales, y lo de esa estación
  autumnOnly: () => ({ ...defaultCounts(), bunker: 0, portal: 0 }),
  winterOnly: () => ({ ...defaultCounts(), bunker: 0, portal: 0, oNieve: 3 }),
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
  // (multiverso) asteroides: rocas en el campo y más que caen con la lluvia de meteoritos; una gravedad naranja para salir del paso
  rocks: () => ({ ...defaultCounts(), bunker: 0, portal: 0, meteoritos: 1, oGravedad: 1 }),
  // horizonte de sucesos: el agujero negro ya está en el campo (sin su carta) y meteoritos; sin gravedad
  horizon: () => ({ ...deckOf('multiverse'), agujeroNegro: 0, gravedad: 0, oGravedad: 0, meteoritos: 2 }),
  // pozo de gravedad: el hoyo en un pozo de rocas; más gravedad que nunca
  well: () => ({ ...deckOf('multiverse'), agujeroNegro: 0, gravedad: 1, oGravedad: 1, meteoritos: 2 }),
  // (casino) lluvia de monedas: el mazo de siempre (sin búnkeres ni portales) y una ruleta; aquí mandan las monedas
  coins: () => ({ ...defaultCounts(), bunker: 0, portal: 0, ruleta: 1 }),
  // dados cargados: los dados ya están en el campo; uno más en el mazo y las ruletas
  dice: () => ({ ...deckOf('gambling'), dado: 0, ruleta: 1 }),
  // la banca: todo al dorado (una ruleta más)
  house: () => ({ ...deckOf('gambling'), dado: 1, ruleta: 3 }),
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
const rock = (x, y) => ({ type: 'meteorite', x, y }); // (multiverso) roca de meteorito: un muro
const die = (x, y, t) => ({ type: 'dice', x, y, t }); // (casino) un dado que marca t (el resto de caras se completa al montar la partida)

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

  // paso a nivel: una vía entre la salida y el hoyo, a lo ancho: hay que cruzarla dos veces sin que te pille el tren
  { id: 'crossing', group: 'warmup', icon: 'i-train', board: { cols: 9, rows: 9, par: 4 }, opps: 2, diff: 'normal', deck: 'train', scene: 'rail', noPar: true,
    track: (C, v) => { const x0 = v.pick([0, 1]), x1 = C.cols - 1 - v.pick([0, 1]), n = x1 - x0 + 1;
      return { path: outline(x0, Array(n).fill(C.hy + 1), Array(n).fill(C.by - 1)) }; } },

  // hojarasca (otoño, sin cambio de estación): una alfombra de hojas secas entre la salida y el hoyo (cada una resta 1)
  // con un pasillo que cambia de sitio, y charcos a los lados del hoyo; entre turnos siguen cayendo hojas y lloviendo
  { id: 'leafLitter', group: 'warmup', icon: 'i-leaf', board: { cols: 9, rows: 9, par: 4 }, opps: 2, diff: 'normal', deck: 'autumnOnly', scene: 'seasons', mirror: true,
    season: { now: 'autumn' },
    layout: (C, v) => { const gap = v.pick([-2, 2, 3]);
      return [...[-4, -3, -2, -1, 1, 2, 3, 4].filter(dx => dx !== gap).map(dx => ({ type: 'leaf', x: C.cx + dx, y: C.hy + 2 })),
        ...[-2, 2].map(dx => ({ type: 'leaf', x: C.cx + dx + v.pick([0, 1]), y: C.hy + 4 })),
        { type: 'puddle', x: C.cx - 2, y: C.hy }, { type: 'puddle', x: C.cx + 2, y: C.hy + v.pick([0, 1]) }]; } },

  // horizonte de sucesos (multiverso): un agujero negro a un lado del camino; pasar a su lado parte la pelota en cuatro (más
  // opciones de llegar… y copias que se pierden por el borde), y el hoyo, si lo llevas hasta él, también se multiplica
  { id: 'eventHorizon', group: 'warmup', icon: 'i-spiral', board: { cols: 9, rows: 9, par: 4 }, opps: 2, diff: 'normal', deck: 'horizon', scene: 'space', mirror: true,
    layout: (C, v) => [{ type: 'blackhole', x: C.cx + 2, y: C.hy + v.pick([1, 2]) }, rock(C.cx - 2, C.hy + v.pick([2, 3]))] },
  // lluvia de monedas (casino): una alfombra de monedas entre la salida y el hoyo; cada una, cara o cruz. Por el borde, sin
  // monedas, se va más despacio pero sin sustos
  { id: 'coinRain', group: 'warmup', icon: 'i-coin', board: { cols: 7, rows: 9, par: 3 }, opps: 2, diff: 'normal', deck: 'coins', scene: 'casino', mirror: true,
    gamble: (C, v) => ({ gold: { x: C.cx + 3, y: C.hy + v.pick([1, 2]) }, fill: false,
      coins: [[-1, 1], [1, 2], [-2, 2], [-1, 3], [1, 3], [v.pick([-2, 2]), 1]].map(([dx, dy]) => ({ x: C.cx + dx, y: C.hy + dy })) }) },
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

  // estación central: el hoyo, dentro de un circuito pequeño por el que el tren da vueltas (con un vagón de arena)
  { id: 'station', group: 'mid', icon: 'i-train', board: { cols: 9, rows: 9, par: 4 }, opps: 2, diff: 'normal', deck: 'train', scene: 'rail', noPar: true, mirror: true,
    layout: C => [{ type: 'bunker', x: C.cx - 3, y: C.by - 2 }, { type: 'bunker', x: C.cx + 2, y: C.by - 1 }],
    track: (C, v) => { const x0 = C.cx - v.pick([2, 3]), x1 = C.cx + 2, n = x1 - x0 + 1, bot = C.hy + v.pick([2, 3]);
      return { path: outline(x0, Array(n).fill(C.hy - 1), Array(n).fill(bot)), cars: 1 }; } },
  // pista de hielo (invierno, sin cambio de estación): dos carriles de hielo suben hacia el hoyo (cada casilla suma 1: hay
  // que medir el tiro para no pasarse) y la bola de nieve espera junto al hoyo; sus tres cartas la mueven
  { id: 'iceRink', group: 'mid', icon: 'i-snow', board: { cols: 9, rows: 9, par: 4 }, opps: 2, diff: 'normal', deck: 'winterOnly', scene: 'seasons', mirror: true,
    season: { now: 'winter', snow: (C, v) => ({ x: C.cx + v.pick([2, 3]), y: C.hy }) },
    layout: (C, v) => [...col('ice', C.cx - 2, C.hy + 1, C.by - 1), ...col('ice', C.cx + 2, C.hy + 2, C.by), ...cells('ice', [[C.cx - 1, C.hy - 1], [C.cx - 3, C.by + v.pick([1, 2])]])] },
  // campo de asteroides (multiverso): rocas que hacen de muro entre la salida y el hoyo (rebota lo que llega) y una junto al
  // hoyo, que devuelve al hoyo el tiro que se pasa; la lluvia de meteoritos deja más
  { id: 'asteroids', group: 'mid', icon: 'i-block', board: { cols: 9, rows: 9, par: 4 }, opps: 2, diff: 'normal', deck: 'rocks', scene: 'space', mirror: true,
    layout: (C, v) => [rock(C.cx + 2, C.hy), rock(C.cx - 2, C.hy + 2 + v.pick([0, 1])), rock(C.cx + v.pick([2, 3]), C.hy + 3)] },
  // dados cargados (casino): dados a los lados del hoyo y en la subida: chocar te devuelve lo que marquen (y cada turno
  // cambian de número: hay que elegir el momento)
  { id: 'loadedDice', group: 'mid', icon: 'i-dice', board: { cols: 9, rows: 9, par: 4 }, opps: 2, diff: 'normal', deck: 'dice', scene: 'casino', mirror: true,
    layout: (C, v) => [die(C.cx - 1, C.hy, 3), die(C.cx + 2, C.hy, 5), die(C.cx - 2, C.hy + 2, v.pick([2, 4])), die(C.cx + 1, C.hy + 3, 6)],
    gamble: (C, v) => ({ gold: { x: C.cx - 3, y: C.hy + 1 }, count: 3 }) },
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
  // expreso: una vía larga, con escalón, entre la salida y el hoyo y charcas en sus curvas: lo que el tren empuja en una
  // esquina sale despedido al agua (y vuelve a su salida). Dos vagones de arena y tres rivales
  { id: 'express', group: 'expert', icon: 'i-train', board: { cols: 9, rows: 10, par: 5 }, opps: 2, diff: 'normal', deck: 'train', scene: 'rail', noPar: true, mirror: true,
    layout: (C, v) => [...cells('lake', [[6, C.hy + 1], [7, C.hy + 1]]), ...cells('lake', [[C.cols - 1, C.by]]), { type: 'bunker', x: v.pick([2, 3]), y: C.hy + 3 }], // (charcas: a la salida de las curvas)
    track: C => { const n = C.cols, top = Array.from({ length: n }, (_, i) => i < 5 ? C.hy + 1 : C.hy + 2);
      return { path: outline(0, top, Array(n).fill(C.by - 1)), cars: 2 }; } },
  // jardín carnívoro (empieza en primavera, con toda la baraja): plantas carnívoras guardan el hoyo (quien se para a su lado,
  // a su salida) y el viento sopla cada tres turnos. Cambiar al verano las seca… pero trae los incendios
  { id: 'carnivore', group: 'expert', icon: 'i-season', board: { cols: 9, rows: 9, par: 3 }, opps: 2, diff: 'normal', deck: 'seasons', scene: 'seasons', mirror: true,
    season: { now: 'spring' },
    layout: (C, v) => [...cells('plant', [[C.cx - 2, C.hy], [C.cx + 1, C.hy + 2], [C.cx - 1, C.hy + 3]]), { type: 'plant', x: C.cx + v.pick([2, 3]), y: C.hy - 1 + v.pick([0, 1]) }] },
  // pozo de gravedad (multiverso, sin PAR): el hoyo en un pozo de rocas, abierto solo por un lado (que cambia), rocas en la
  // subida y un agujero negro al otro lado. La gravedad saca el hoyo del pozo… o mete la pelota
  { id: 'gravityWell', group: 'expert', icon: 'i-burst', board: { cols: 9, rows: 10, par: 5 }, opps: 2, diff: 'normal', deck: 'well', scene: 'space', mirror: true, noPar: true,
    layout: (C, v) => { const o = v.pick([-1, 1]); // (el lado por el que se abre el pozo)
      return [rock(C.cx - 1, C.hy - 1), rock(C.cx, C.hy - 1), rock(C.cx + 1, C.hy - 1), rock(C.cx - o, C.hy), rock(C.cx - 1, C.hy + 1), rock(C.cx, C.hy + 1), rock(C.cx + 1, C.hy + 1),
        rock(C.cx + 3 * o, C.hy + 3), rock(C.cx - 2 * o, C.hy + 4), { type: 'blackhole', x: C.cx - 3 * o, y: C.hy + 2 }]; } },
  // la banca (casino, sin PAR): la casilla dorada, pegada al hoyo y guardada por dados; tres ruletas en el mazo. Quien
  // llegue a la dorada puede ganar con el dorado… o perderlo todo si el hoyo se planta en ella
  { id: 'highRoller', group: 'expert', icon: 'i-roulette', board: { cols: 9, rows: 10, par: 5 }, opps: 2, diff: 'normal', deck: 'house', scene: 'casino', mirror: true, noPar: true,
    layout: (C, v) => [die(C.cx + 1, C.hy - 1, 4), die(C.cx + 3, C.hy, 2), die(C.cx + 2, C.hy + 1, 6), die(C.cx - 1, C.hy + 2, v.pick([3, 5])), die(C.cx - 2, C.hy, 1),
      die(C.cx + v.pick([-3, 2]), C.hy + 4, 4)],
    gamble: (C, v) => ({ gold: { x: C.cx + 2, y: C.hy }, count: 6 }) },
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

/* ---------- las reglas del antiguo desafío semanal (remezcla de los campos de arriba), ya como desafíos ---------- */
const layoutOf = id => CHALLENGES.find(c => c.id === id).layout;
CHALLENGES.push(
  { id: 'bigHitters', group: 'mid', icon: 'i-club', board: { cols: 9, rows: 11, par: 4 }, opps: 2, diff: 'normal', deck: 'drive' },
  { id: 'driftDuel', group: 'warmup', icon: 'i-hole', board: { cols: 5, rows: 5, par: 2 }, opps: 1, diff: 'hard', rules: { holeDrift: true } },
  { id: 'floodDrift', group: 'warmup', icon: 'i-wave', board: { cols: 7, rows: 7, par: 3 }, opps: 2, diff: 'normal', deck: 'water', scene: 'lake', rules: { holeDrift: true }, layout: layoutOf('rapids'), mirror: true },
  { id: 'iriParty', group: 'warmup', icon: 'i-prism', board: { cols: 7, rows: 7, par: 3 }, opps: 2, diff: 'normal', deck: 'prism', scene: 'prism', layout: layoutOf('prism') },
  { id: 'fingerFest', group: 'warmup', icon: 'i-hand', board: { cols: 7, rows: 7, par: 3 }, opps: 2, diff: 'normal', deck: 'fingers', scene: 'mini', layout: layoutOf('warren'), mirror: true },
  { id: 'tinyChaos', group: 'mid', icon: 'i-users', board: { cols: 5, rows: 6, par: 2 }, opps: 3, diff: 'hard' },
  // portales a los lados y detrás de la salida (lejos del hoyo, que se mueve solo y también los cruza)
  { id: 'portalMaze', group: 'mid', icon: 'i-spiral', board: { cols: 9, rows: 9, par: 4 }, opps: 2, diff: 'normal', deck: 'noPortals', rules: { holeDrift: true }, mirror: true,
    layout: C => [
      { type: 'portal', pair: 1, x: C.cx - 4, y: C.hy + 2 }, { type: 'portal', pair: 1, x: C.cx + 4, y: C.hy + 4 },
      { type: 'portal', pair: 2, x: C.cx - 2, y: C.by + 1 }, { type: 'portal', pair: 2, x: C.cx + 3, y: C.hy - 1 },
      { type: 'bunker', x: C.cx + 1, y: C.hy + 2 },
    ] },
  { id: 'lakeDuel', group: 'mid', icon: 'i-drop', board: { cols: 9, rows: 9, par: 4 }, opps: 1, diff: 'hard', deck: 'water', scene: 'lake', layout: layoutOf('archipelago'), mirror: true },
  { id: 'duel', group: 'mid', icon: 'i-trophy', board: { cols: 9, rows: 9, par: 4 }, opps: 1, diff: 'hard' },
  { id: 'bunkerCrowd', group: 'mid', icon: 'i-sand', board: { cols: 9, rows: 9, par: 4 }, opps: 4, diff: 'normal', layout: layoutOf('noPalo3') },
  // noche de casino: los dados cargados con tres rivales
  { id: 'casinoNight', group: 'mid', icon: 'i-roulette', board: { cols: 9, rows: 9, par: 4 }, opps: 3, diff: 'normal', deck: 'dice', scene: 'casino', mirror: true,
    layout: (C, v) => layoutOf('loadedDice')(C, v), gamble: C => ({ gold: { x: C.cx - 3, y: C.hy + 1 } }) },
  { id: 'woodDuel', group: 'expert', icon: 'i-burst', board: { cols: 9, rows: 9, par: 4 }, opps: 1, diff: 'hard', deck: 'wood', scene: 'mini', layout: layoutOf('pinball'), mirror: true },
  { id: 'launchCrowd', group: 'expert', icon: 'i-launch', board: { cols: 9, rows: 9, par: 4 }, opps: 4, diff: 'normal', deck: 'wood', scene: 'mini', layout: layoutOf('launchpads'), mirror: true },
);

/* ---------- desafíos de las barajas con menos (y combinaciones de dos barajas: decks) ---------- */
const merge = (...cs) => { const o = {}; for (const c of cs) for (const [k, n] of Object.entries(c)) o[k] = Math.max(o[k] || 0, n); return o; };
Object.assign(DECKS, {
  // (estaciones) verano fijo: el mazo de siempre, sin cartas de incendio (los del campo ya crecen solos)
  summerOnly: () => ({ ...defaultCounts(), bunker: 0, portal: 0 }),
  // (estaciones + agua) otoño fijo con ríos y lagos
  monsoon: () => ({ ...defaultCounts(), bunker: 0, portal: 0, river: 2, lake: 1 }),
  // (estaciones + casino) invierno fijo, su bola de nieve, un dado y una ruleta
  snowDice: () => ({ ...defaultCounts(), bunker: 0, portal: 0, oNieve: 3, dado: 1, ruleta: 1 }),
  // (multiverso) lluvia de estrellas: meteoritos de sobra y una gravedad naranja
  shower: () => ({ ...defaultCounts(), bunker: 0, portal: 0, meteoritos: 3, oGravedad: 1 }),
  // (multiverso) estrella binaria: los agujeros negros ya están; meteoritos y sin gravedad (que acortaba mucho la partida)
  binary: () => ({ ...defaultCounts(), bunker: 0, portal: 0, meteoritos: 2 }),
  // (multiverso + casino) todo lo de las dos barajas
  cosmicCasino: () => merge(deckOf('multiverse'), deckOf('gambling')),
  // (casino) el bote: tres ruletas
  jackpot: () => ({ ...defaultCounts(), bunker: 0, portal: 0, ruleta: 3 }),
  // (Ultimate + agua) unos cuantos palos iridiscentes y ríos
  rainbow: () => ({ ...defaultCounts(), bunker: 0, portal: 0, paloIri: 4, river: 2, lake: 1 }),
  // (tren + agua) el mercancías: lo del tren y lagos (sin cartas de río: llevaban el hoyo a la vía y el tren ganaba solo)
  freight: () => ({ ...deckOf('train'), lake: 2 }),
});
CHALLENGES.push(
  /* calentamiento */
  // la cochera: las salidas, dentro del circuito del tren; para ir al hoyo hay que salir cruzando la vía
  { id: 'depot', group: 'warmup', icon: 'i-train', board: { cols: 9, rows: 9, par: 4 }, opps: 2, diff: 'normal', deck: 'train', scene: 'rail', noPar: true, mirror: true,
    layout: (C, v) => [{ type: 'bunker', x: C.cx - 2, y: C.hy + 1 }, { type: 'bunker', x: C.cx + 2, y: C.hy + v.pick([1, 2]) }],
    track: () => ({ path: outline(2, Array(5).fill(5), Array(5).fill(7)) }) }, // (C.by = 6: las salidas, en medio de la vuelta)
  // ola de calor (verano fijo): dos incendios a los lados del camino que crecen solos; cruzarlos suma 2 al tiro
  { id: 'heatwave', group: 'warmup', icon: 'i-flame', board: { cols: 9, rows: 9, par: 4 }, opps: 2, diff: 'normal', deck: 'summerOnly', scene: 'seasons', mirror: true,
    season: { now: 'summer' },
    layout: (C, v) => cells('fire', [[C.cx - 3, C.hy + 3], [C.cx + 3, C.hy + v.pick([0, 1])]]) },
  // el bote (casino): la casilla dorada a medio camino, tres ruletas, pocas monedas y un búnker en la calle del PAR
  { id: 'jackpot', group: 'warmup', icon: 'i-coin', board: { cols: 7, rows: 9, par: 3 }, opps: 2, diff: 'normal', deck: 'jackpot', scene: 'casino', mirror: true,
    layout: C => [{ type: 'bunker', x: C.cx, y: C.hy + 2, onPar: true }],
    gamble: (C, v) => ({ gold: { x: C.cx + v.pick([-2, 2]), y: C.hy + 2 }, count: 4 }) },
  // río arcoíris (Ultimate + agua): palos iridiscentes y dos ríos que bajan por los lados; los búnkeres paran el tiro
  { id: 'rainbowRiver', group: 'warmup', icon: 'i-prism', board: { cols: 7, rows: 9, par: 3 }, opps: 2, diff: 'normal', deck: 'rainbow', scene: 'prism', decks: ['ultimate', 'water'], mirror: true,
    layout: (C, v) => [...col('river', 0, C.hy - 1, C.hy + 2), ...col('river', C.cols - 1, C.hy + 1, C.by - 1),
      { type: 'bunker', x: C.cx - 1, y: C.hy - 1 }, { type: 'bunker', x: C.cx + 1, y: C.hy }, { type: 'bunker', x: C.cx + v.pick([-2, 2]), y: C.hy + 3 }] },
  /* intermedio */
  // monzón (otoño fijo + agua): ríos que bajan entre la hojarasca y charcos junto al hoyo
  { id: 'monsoon', group: 'mid', icon: 'i-leaf', board: { cols: 9, rows: 9, par: 4 }, opps: 2, diff: 'normal', deck: 'monsoon', scene: 'seasons', decks: ['seasons', 'water'], mirror: true,
    season: { now: 'autumn' },
    layout: (C, v) => [...col('river', C.cx - 3, C.hy, C.hy + 3), ...col('river', C.cx + 2, C.hy + 2, C.by - 1),
      ...cells('leaf', [[C.cx - 1, C.hy + 2], [C.cx + 1, C.hy + 3], [C.cx - 2, C.hy + 4], [C.cx + 3, C.hy + 1]]),
      { type: 'puddle', x: C.cx + 1, y: C.hy }, { type: 'puddle', x: C.cx - 1, y: C.hy - 1 + v.pick([0, 1]) }] },
  // casino en la nieve (invierno fijo + casino): dados junto al hoyo, carriles de hielo y la bola de nieve
  { id: 'snowDice', group: 'mid', icon: 'i-snow', board: { cols: 9, rows: 9, par: 4 }, opps: 2, diff: 'normal', deck: 'snowDice', scene: 'seasons', decks: ['seasons', 'gambling'], mirror: true,
    season: { now: 'winter', snow: (C, v) => ({ x: C.cx - 3, y: C.hy + v.pick([0, 1]) }) },
    layout: (C, v) => [die(C.cx + 1, C.hy, 5), die(C.cx - 2, C.hy + 2, v.pick([2, 3])), ...col('ice', C.cx + 2, C.hy + 2, C.by - 1), ...cells('ice', [[C.cx - 1, C.hy + 4]])],
    gamble: C => ({ gold: { x: C.cx + 3, y: C.hy }, fill: false }) },
  // casino cósmico (multiverso + casino): un agujero negro junto a las monedas (cada copia de la pelota lanza las suyas)
  { id: 'cosmicCasino', group: 'mid', icon: 'i-blackhole', board: { cols: 9, rows: 9, par: 4 }, opps: 2, diff: 'normal', deck: 'cosmicCasino', scene: 'space', decks: ['multiverse', 'gambling'], mirror: true,
    layout: (C, v) => [{ type: 'blackhole', x: C.cx + 2, y: C.hy + v.pick([2, 3]) }, die(C.cx - 2, C.hy + 1, 4)],
    gamble: C => ({ gold: { x: C.cx - 3, y: C.hy }, count: 6 }) },
  // lluvia de estrellas (multiverso): dos rocas junto al hoyo y meteoritos de sobra en el mazo
  { id: 'meteorShower', group: 'mid', icon: 'i-meteor', board: { cols: 9, rows: 9, par: 4 }, opps: 2, diff: 'normal', deck: 'shower', scene: 'space', mirror: true,
    layout: (C, v) => [rock(C.cx - 1, C.hy), rock(C.cx + 2, C.hy + 2 + v.pick([0, 1]))] },
  /* experto */
  // el mercancías (tren + agua): una vuelta ancha entre la salida y el hoyo con dos vagones, un río por la banda que baja
  // hasta un lago y otro lago al otro lado (lo que el tren saca por las curvas acaba en el agua)
  { id: 'freight', group: 'expert', icon: 'i-train', board: { cols: 9, rows: 10, par: 5 }, opps: 2, diff: 'normal', deck: 'freight', scene: 'rail', decks: ['train', 'water'], noPar: true, mirror: true,
    layout: (C, v) => [...col('river', 0, C.hy - 1, C.hy + 2), ...cells('lake', [[0, C.hy + 3], [C.cols - 1, C.hy + 4]]), { type: 'bunker', x: C.cx - 2, y: C.hy + v.pick([0, 1]) }],
    track: C => ({ path: outline(1, Array(C.cols - 2).fill(C.hy + 2), Array(C.cols - 2).fill(C.hy + 4)), cars: 2 }) },
  // estrella binaria (multiverso, sin PAR): dos agujeros negros a los lados del camino, rocas que guardan el hoyo (solo se
  // entra por abajo) y tres rivales
  { id: 'binaryStar', group: 'expert', icon: 'i-blackhole', board: { cols: 9, rows: 11, par: 6 }, opps: 3, diff: 'normal', deck: 'binary', scene: 'space', noPar: true, mirror: true,
    layout: (C, v) => [{ type: 'blackhole', x: C.cx - 3, y: C.hy + 2 }, { type: 'blackhole', x: C.cx + 3, y: C.hy + 4 },
      rock(C.cx - 1, C.hy), rock(C.cx + 1, C.hy), rock(C.cx, C.hy - 1), rock(C.cx + v.pick([-2, 2]), C.by - 2)] },
);

/* ---------- las barajas de cada desafío ---------- */
// la del fondo (scene) y, en las combinaciones, las que mezcla (decks: la primera es la principal)
const SCENE_DECK = { lake: 'water', mini: 'minigolf', rail: 'train', seasons: 'seasons', space: 'multiverse', casino: 'gambling', prism: 'ultimate' };
export const challengeDecks = ch => ch.decks || [SCENE_DECK[ch.scene] || 'classic'];
for (const id of ['sawmill', 'locks']) CHALLENGES.find(c => c.id === id).decks = ['minigolf', 'water']; // (aserradero y esclusas: madera y agua)

/* ---------- los desafíos de la semana ---------- */
// Cada semana (de lunes a domingo, la semana ISO) tocan 5: dos de calentamiento, dos intermedios y uno experto, cada uno de
// una baraja distinta (una combinación ocupa sus dos barajas). Se eligen al azar con la semilla de la semana entre los que
// no han salido hace poco (cada uno vuelve, como pronto, cuando ya han salido casi todos los de su grupo), así que hay que
// ir semana a semana desde la primera (CH_EPOCH). Un desafío nuevo entra desde su semana (`from: 'AAAA-Www'`): las de antes
// no cambian.
export const CH_EPOCH = '2026-W41';
export const WEEK_SLOTS = ['warmup', 'warmup', 'mid', 'mid', 'expert'];
// el lunes (UTC) de una semana "AAAA-Www" y la semana de un lunes
export function weekMonday(wk) {
  const [y, w] = wk.split('-W').map(Number), jan4 = Date.UTC(y, 0, 4), dow = new Date(jan4).getUTCDay() || 7;
  return new Date(jan4 + ((w - 1) * 7 - (dow - 1)) * 864e5);
}
function keyOfMonday(d) {
  const u = new Date(d), wd = u.getUTCDay() || 7;
  u.setUTCDate(u.getUTCDate() + 4 - wd);
  const y = u.getUTCFullYear(), n = Math.ceil(((u - Date.UTC(y, 0, 1)) / 864e5 + 1) / 7);
  return `${y}-W${String(n).padStart(2, '0')}`;
}
function seedOfStr(str) { let h = 0x811c9dc5; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h >>> 0; }
const weekCache = new Map();
export function weekChallenges(wk) {
  if (wk < CH_EPOCH) wk = CH_EPOCH;
  if (weekCache.has(wk)) return weekCache.get(wk);
  const last = {}, t0 = weekMonday(CH_EPOCH).getTime(), end = weekMonday(wk).getTime();
  let out = null;
  for (let n = 0, t = t0; t <= end; n++, t += 7 * 864e5) {
    const key = keyOfMonday(t), r = mulberry32(seedOfStr('crowns:' + key));
    const pool = CHALLENGES.filter(c => !c.from || c.from <= key), picked = [], used = new Set();
    const left = { warmup: 2, mid: 2, expert: 1 };
    for (let k = 0; k < WEEK_SLOTS.length; k++) {
      // (los huecos que quedan: sus desafíos sin repetir baraja; si no hay, sin repetir la principal; si no, cualquiera)
      const of = pool.filter(c => left[c.group] > 0 && !picked.includes(c)), free = c => challengeDecks(c).every(d => !used.has(d));
      const cands = of.some(free) ? of.filter(free) : of.some(c => !used.has(challengeDecks(c)[0])) ? of.filter(c => !used.has(challengeDecks(c)[0])) : of;
      const age = c => last[c.id] ?? -99, gap = c => Math.floor(pool.filter(x => x.group === c.group).length / WEEK_SLOTS.filter(x => x === c.group).length * .6);
      const fresh = cands.filter(c => n - age(c) >= gap(c)).sort((x, y) => age(x) - age(y));
      // (al azar entre el cuarto que lleva más tiempo sin salir; si no queda ninguno, el que más)
      const from = fresh.length ? fresh.slice(0, Math.ceil(fresh.length / 4)) : [cands.reduce((x, c) => age(c) < age(x) ? c : x)];
      const ch = from[Math.floor(r() * from.length)];
      picked.push(ch); left[ch.group]--; challengeDecks(ch).forEach(d => used.add(d));
    }
    for (const c of picked) last[c.id] = n;
    out = WEEK_SLOTS.map((g, i) => picked.filter(c => c.group === g)[i - WEEK_SLOTS.indexOf(g)]);
    if (!weekCache.has(key)) weekCache.set(key, out);
  }
  return out;
}
// cuándo se acaba la semana (el lunes siguiente a las 00:00, hora local) desde `now`
export function weekEndsAt(now = new Date()) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate()), wd = d.getDay() || 7;
  d.setDate(d.getDate() + 8 - wd);
  return d;
}

/* ---------- montar una partida ---------- */
// lo que necesita Game.pve de un desafío: tamaño, mazo y reglas
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
  const tr = challengeTrain(ch, S, seed), onTrack = t => tr?.path.some(([x, y]) => x === t.x && y === t.y);
  return sanitize(tiles, C).filter(t => !onTrack(t)); // (nada encima de las vías)
}
// (desafíos del tren) el circuito diseñado para esta partida: con el mismo reflejo que sus piezas, 4 paradas y la
// locomotora en una de ellas
export function challengeTrain(ch, S, seed) {
  if (!ch.track) return null;
  const C = courseOf({ cols: S.cols, rows: S.rows, par: S.par }, S.nPlayers), v = variation(seed ?? 1);
  if (ch.layout) ch.layout(C, v); // (el mismo sorteo que challengeTiles: el reflejo sale igual)
  const mirrored = ch.mirror && v.chance(.5);
  let { path, cars = 0, stops = null, maxCars } = ch.track(C, v);
  // stops: paradas a mano (casillas [[x, y]…]: el reto diario lleva solo 2); si no, las 4 del reloj
  if (mirrored) { path = path.map(([x, y]) => [C.cols - 1 - x, y]).reverse(); stops = stops?.map(([x, y]) => [C.cols - 1 - x, y]); } // (al reflejar, se recorre al revés: sigue yendo con el reloj)
  const L = path.length, at = ([x, y]) => path.findIndex(p => p[0] === x && p[1] === y);
  const stations = stops ? stops.map(at).sort((a, b) => a - b) : clockStations(path, v.r) || [0, 1, 2, 3].map(k => Math.floor(k * L / 4));
  return { path, stations, pos: v.pick(stations), cars, ...(maxCars != null ? { maxCars } : {}) };
}
// el campo entero de un desafío sobre su partida: piezas (designed: Game.designed, para que su agua sea fija), tren y,
// si lo pide (el tren cruza la columna), sin PAR
// (estaciones) la estación del desafío y, si la hay, la bola de nieve (con el mismo reflejo que sus piezas)
export function challengeSeason(ch, S, seed) {
  if (!ch.season) return null;
  const C = courseOf({ cols: S.cols, rows: S.rows, par: S.par }, S.nPlayers), v = variation(seed ?? 1);
  if (ch.layout) ch.layout(C, v); // (el mismo sorteo que challengeTiles)
  const mirrored = ch.mirror && v.chance(.5);
  let snow = ch.season.snow ? ch.season.snow(C, v) : null;
  if (snow && mirrored) snow = { x: C.cols - 1 - snow.x, y: snow.y };
  return { now: ch.season.now, wind: null, snow: snow ? { ...snow, dir: null } : null, fireId: 0 };
}
// (casino) el suelo del desafío: la casilla dorada diseñada (con el mismo reflejo que sus piezas), sus monedas y, hasta 3
// por jugador (o `count`; con fill: false, ninguna), más monedas al azar (con la semilla) en casillas vacías
export function challengeGamble(ch, S, seed) {
  if (!ch.gamble) return null;
  const C = courseOf({ cols: S.cols, rows: S.rows, par: S.par }, S.nPlayers), v = variation(seed ?? 1);
  if (ch.layout) ch.layout(C, v);
  const mirrored = ch.mirror && v.chance(.5), spec = ch.gamble(C, v);
  const flip = c => c && (mirrored ? { x: C.cols - 1 - c.x, y: c.y } : { x: c.x, y: c.y });
  const busy = (x, y) => S.tiles.some(t => t.x === x && t.y === y) || S.balls.some(b => b.spawnX === x && b.spawnY === y) || (S.hole.x === x && S.hole.y === y) ||
    S.parCells.some(p => p.x === x && p.y === y) || S.train?.path.some(([px, py]) => px === x && py === y);
  const inside = c => c.x >= 0 && c.y >= 0 && c.x < S.cols && c.y < S.rows;
  let gold = flip(spec.gold);
  if (gold && (!inside(gold) || busy(gold.x, gold.y))) gold = null;
  const coins = [];
  for (const c of (spec.coins || []).map(flip)) if (inside(c) && !busy(c.x, c.y) && !(gold && gold.x === c.x && gold.y === c.y) && !coins.some(o => o.x === c.x && o.y === c.y)) coins.push(c);
  const free = [];
  for (let y = 0; y < S.rows; y++) for (let x = 0; x < S.cols; x++) if (!busy(x, y) && !(gold && gold.x === x && gold.y === y) && !coins.some(o => o.x === x && o.y === y)) free.push({ x, y });
  for (let want = spec.fill === false ? 0 : spec.count ?? 3 * S.balls.filter(b => !b.decoy && !b.hunter).length; coins.length < want && free.length;) coins.push(free.splice(Math.floor(v.r() * free.length), 1)[0]);
  return { gold, coins };
}
// (casino) los dados del diseño solo dicen qué número marcan: el resto de caras (opuestas suman 7) y su número de dado
function dressDice(S) {
  for (const t of S.tiles) {
    if (t.type !== 'dice' || t.id) continue;
    const side = [1, 2, 3, 4, 5, 6].filter(f => f !== t.t && f !== 7 - t.t);
    t.n = side[0]; t.e = side.find(f => f !== t.n && f !== 7 - t.n);
    S.diceSeq = (S.diceSeq || 0) + 1; t.id = S.diceSeq;
  }
}
export function setupChallenge(S, ch, seed, designed = t => t) {
  S.tiles.push(...designed(challengeTiles(ch, S, seed)));
  dressDice(S);
  const tr = challengeTrain(ch, S, seed);
  if (tr) S.train = tr;
  if (ch.noPar) S.parCells = [];
  const se = challengeSeason(ch, S, seed);
  if (se) {
    if (se.snow) S.tiles = S.tiles.filter(t => t.x !== se.snow.x || t.y !== se.snow.y);
    S.season = se;
    // (los incendios del diseño: un grupo por mancha, como los de un nivel)
    const fires = S.tiles.filter(t => t.type === 'fire');
    for (const f of fires) if (!f.g) { const g = ++se.fireId, stack = [f]; f.g = g;
      while (stack.length) { const c = stack.pop(); for (const o of fires) if (!o.g && Math.abs(o.x - c.x) + Math.abs(o.y - c.y) === 1) { o.g = g; stack.push(o); } } }
  }
  const gb = challengeGamble(ch, S, seed);
  if (gb) S.gamble = gb;
}
export const challengeById = id => CHALLENGES.find(c => c.id === id);

/* ---------- reto diario: tablero pequeño y una sola mecánica cada día ---------- */
// El tablero es el de siempre (5×5, PAR 2) y, algún día, una o dos filas o columnas más (sizes: los
// tamaños posibles de esa mecánica; el primero es el normal). Cada mecánica está pensada para lo poco
// que cabe: una pieza que decide la partida. Se turnan en un orden fijo (nunca dos días igual seguidos).
const S5 = { cols: 5, rows: 5, par: 2 };
// scene: el fondo de la partida, el de la baraja de su pieza (lago para el agua, madera para el minigolf, iridiscente
// para el palo iridiscente; portales y arenero, el campo de siempre)
export const DAILY_FEATURES = [
  // portales: de la banda de la salida a la de arriba, junto al hoyo (atajo lateral)
  { id: 'portal', icon: 'i-spiral', sizes: [S5, { cols: 7, rows: 5, par: 2 }], mirror: true,
    layout: C => [{ type: 'portal', pair: 1, x: C.cols - 1, y: C.by }, { type: 'portal', pair: 1, x: 0, y: C.hy + 1 }] },
  // catapultas: una delante de cada salida lateral, girando en sentidos opuestos: cuando una apunta al
  // centro o arriba es un atajo; si no, te saca del tablero (hay que elegir el turno)
  { id: 'launcher', scene: 'mini', icon: 'i-launch', sizes: [S5, { cols: 5, rows: 6, par: 2 }],
    layout: (C, v) => { const r = v.rot(); return [{ type: 'launcher', x: C.cx - 1, y: C.by - 1, rot: r }, { type: 'launcher', x: C.cx + 1, y: C.by - 1, rot: (r + 2) % 4 }]; } },
  // arenero: justo delante del hoyo, en la calle del PAR: el camino recto se atasca
  { id: 'bunker', icon: 'i-sand', sizes: [S5],
    layout: C => [{ type: 'bunker', x: C.cx, y: C.hy + 1, onPar: true }] },
  // río pequeño: baja por una banda desde la fila del hoyo; si el hoyo cae en él, la corriente lo
  // acerca a las pelotas
  { id: 'river', scene: 'lake', icon: 'i-wave', sizes: [S5, { cols: 5, rows: 6, par: 2 }], mirror: true,
    layout: C => [...col('river', C.cols - 1, C.hy, C.hy + 1)] },
  // caja con agujeros: un túnel en diagonal al hoyo: sales por un lado al azar, muy cerca de él
  { id: 'tunnel', scene: 'mini', icon: 'i-tunnel', sizes: [S5], mirror: true,
    layout: C => [{ type: 'tunnel', x: C.cx + 1, y: C.hy + 1 }] },
  // bloque junto al hoyo: un tiro por la fila del hoyo que se pasa rebota y vuelve a entrar
  { id: 'block', scene: 'mini', icon: 'i-block', sizes: [S5, { cols: 6, rows: 5, par: 2 }], mirror: true,
    layout: C => [{ type: 'block', x: C.cx + 1, y: C.hy }] },
  // charca: dos casillas de lago a un lado del hoyo: empujar el hoyo dentro lo devuelve a su sitio
  { id: 'lake', scene: 'lake', icon: 'i-drop', sizes: [S5, { cols: 5, rows: 6, par: 2 }], mirror: true,
    layout: C => [{ type: 'lake', x: C.cx - 1, y: C.hy }, { type: 'lake', x: C.cx - 2, y: C.hy }] },
  // esquina: en lo alto de una banda; lo que sube por ella gira hacia el hoyo
  { id: 'corner', scene: 'mini', icon: 'i-prism', sizes: [S5, { cols: 5, rows: 6, par: 2 }], mirror: true,
    layout: C => [{ type: 'corner', x: 0, y: C.hy, rot: 0 }] },
  // palo iridiscente: tres en el mazo; en un tablero tan pequeño, las demás pelotas son los topes
  { id: 'iri', scene: 'prism', icon: 'i-prism', sizes: [S5], deck: 'dailyIri' },
  // tren (versión mínima): una vía alrededor de las salidas, por todo el borde de abajo y entre ellas y el hoyo; solo
  // 2 paradas (a los lados o arriba y abajo) y como mucho 1 vagón. Para salir hacia el hoyo hay que cruzarla
  { id: 'train', scene: 'rail', icon: 'i-train', sizes: [{ cols: 5, rows: 6, par: 2 }], deck: 'dailyTrain', noPar: true,
    track: (C, v) => { const n = C.cols, top = C.hy + 1, bot = C.rows - 1;
      const stops = v.chance(.5) ? [[0, top + 1], [n - 1, bot - 1]] : [[C.cx, top], [C.cx, bot]];
      return { path: outline(0, Array(n).fill(top), Array(n).fill(bot)), stops, maxCars: 1 }; } },
  // estaciones: cada vez que le toca, la siguiente (primavera, verano, otoño, invierno), con lo suyo en pequeño. Primavera:
  // dos plantas carnívoras junto al camino y el viento (calma, aviso, sopla) · verano: un fuego en un lado que crece
  // solo (hasta 5 casillas) · otoño: hojas secas, un charco y la lluvia · invierno: la bola de nieve (y sus cartas) y hielo
  { id: 'season', scene: 'seasons', icon: 'i-season', sizes: [S5, { cols: 5, rows: 6, par: 2 }], mirror: true,
    seasons: {
      spring: { layout: C => cells('plant', [[0, C.hy + 1], [C.cols - 1, C.hy + 2]]) },
      summer: { layout: C => cells('fire', [[0, C.hy + 2]]) }, // (sin la carta de incendio: en 5×5, un fuego basta)
      autumn: { layout: C => [...cells('leaf', [[C.cx - 1, C.hy + 1], [C.cx + 1, C.hy + 2], [C.cx - 2, C.hy + 2]]), { type: 'puddle', x: C.cx + 2, y: C.hy }] },
      winter: { deck: 'dailyWinter', snow: C => ({ x: 0, y: C.hy + 1 }), layout: C => cells('ice', [[C.cx + 1, C.hy + 1]]) },
    } },
  // multiverso: cada vez que le toca, lo siguiente (agujero negro, gravedad, meteoritos), en pequeño. Agujero negro: uno en
  // la fila de las salidas, a un lado (salir por ahí parte la pelota en cuatro) · gravedad: dos cartas y una roca que estorba ·
  // meteoritos: dos lluvias y una roca junto al hoyo que devuelve el tiro que se pasa
  { id: 'multiverse', scene: 'space', icon: 'i-spiral', sizes: [S5, { cols: 5, rows: 6, par: 2 }], mirror: true,
    variants: {
      blackhole: { layout: C => [{ type: 'blackhole', x: C.cx + 2, y: C.by }] },
      gravity: { deck: 'dailyGravity', layout: C => [rock(C.cx - 1, C.hy + 1)] },
      meteors: { deck: 'dailyMeteors', layout: C => [rock(C.cx + 1, C.hy)] },
    } },
  // casino: cada vez que le toca, lo siguiente, en pequeño. Monedas: cuatro en el camino (cara o cruz) · dado: uno junto al
  // hoyo que devuelve el tiro que se pasa · ruleta: la casilla dorada a un lado y dos ruletas en el mazo
  { id: 'gambling', scene: 'casino', icon: 'i-roulette', sizes: [S5, { cols: 5, rows: 6, par: 2 }], mirror: true,
    variants: {
      coins: { gamble: C => ({ coins: [[C.cx - 1, C.hy + 1], [C.cx + 1, C.hy + 2], [C.cx - 2, C.hy + 2], [C.cx + 2, C.hy]].map(([x, y]) => ({ x, y })), fill: false }) },
      dice: { deck: 'dailyDice', layout: C => [die(C.cx + 1, C.hy, 4)], gamble: () => ({ fill: false }) },
      roulette: { deck: 'dailyRoulette', gamble: C => ({ gold: { x: C.cols - 1, y: C.hy + 1 }, fill: false }) },
    } },
];
DECKS.daily = () => ({ ...defaultCounts(), bunker: 0, portal: 0 }); // (solo la pieza del día en el campo)
DECKS.dailyGravity = () => ({ ...DECKS.daily(), gravedad: 2, oGravedad: 1 });
DECKS.dailyMeteors = () => ({ ...DECKS.daily(), meteoritos: 2 });
DECKS.dailyWinter = () => ({ ...DECKS.daily(), oNieve: 2 });
DECKS.dailyIri = () => ({ ...DECKS.daily(), paloIri: 3 });
DECKS.dailyTrain = () => ({ ...DECKS.daily(), trenVuelta: 1, oTren1: 2, vagon: 1 });
DECKS.dailyDice = () => ({ ...DECKS.daily(), dado: 1 });
DECKS.dailyRoulette = () => ({ ...DECKS.daily(), ruleta: 2 });
// el orden de las mecánicas: cada vez que entra una nueva, la rueda sigue donde iba (ese día y los de antes, lo mismo para
// todo el mundo): el tren, el 2 de octubre de 2026; las estaciones, el 3; el multiverso, el 6; el casino, el 9
const DAILY_WHEELS = [
  { from: null, order: ['portal', 'launcher', 'bunker', 'river', 'tunnel', 'block', 'lake', 'corner', 'iri'] },
  { from: '2026-10-02', order: ['portal', 'launcher', 'bunker', 'river', 'tunnel', 'block', 'lake', 'corner', 'iri', 'train'] },
  { from: '2026-10-03', order: ['portal', 'launcher', 'bunker', 'river', 'tunnel', 'block', 'lake', 'corner', 'iri', 'train', 'season'] },
  { from: '2026-10-06', order: ['portal', 'launcher', 'bunker', 'river', 'tunnel', 'block', 'lake', 'corner', 'iri', 'train', 'season', 'multiverse'] },
  { from: '2026-10-09', order: ['portal', 'launcher', 'bunker', 'river', 'tunnel', 'block', 'lake', 'corner', 'iri', 'train', 'season', 'multiverse', 'gambling'] },
];
// número de día desde el 1 de enero de 2026 (fechas "AAAA-MM-DD" en hora local)
const dayNumber = date => { const [y, m, d] = date.split('-').map(Number); return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(2026, 0, 1)) / 864e5); };
const mod = (a, m) => ((a % m) + m) % m;
// la mecánica del día (y, en la de las estaciones, cuántas veces ha salido ya: para turnarse las cuatro)
function dailyFeature(date) {
  const w = DAILY_WHEELS.findLastIndex(x => !x.from || date >= x.from), { from, order } = DAILY_WHEELS[w], n = dayNumber(date);
  if (!from) return { id: order[mod(n, order.length)], turn: Math.floor(n / order.length) };
  // (la rueda nueva arranca con la mecánica que sigue a la del día anterior)
  const n0 = dayNumber(from), prev = DAILY_WHEELS[w - 1].from ? dailyFeature(dateBefore(from)).id : DAILY_WHEELS[w - 1].order[mod(n0 - 1, DAILY_WHEELS[w - 1].order.length)];
  const k = n - n0 + order.indexOf(prev) + 1;
  return { id: order[mod(k, order.length)], turn: Math.floor(k / order.length) };
}
const dateBefore = date => { const [y, m, d] = date.split('-').map(Number), x = new Date(Date.UTC(y, m - 1, d - 1)); return x.toISOString().slice(0, 10); };
// el reto del día como un desafío más (tamaño, mazo, reglas y campo)
export function dailyChallenge(date, seed) {
  const { id, turn } = dailyFeature(date);
  const f = DAILY_FEATURES.find(x => x.id === id), r = mulberry32((seed ^ 0x6a09e667) >>> 0);
  // uno de cada cuatro días (si la mecánica lo admite), el tablero crece un poco
  const board = f.sizes.length > 1 && r() < .25 ? f.sizes[1 + Math.floor(r() * (f.sizes.length - 1))] : f.sizes[0];
  const ch = { id: 'daily-' + id, feature: id, icon: f.icon, board, opps: 2, deck: f.deck || 'daily', rules: f.rules, layout: f.layout, mirror: f.mirror, track: f.track, noPar: f.noPar, gamble: f.gamble };
  if (f.seasons) { // (estaciones: le toca la siguiente cada vez que sale)
    const now = SEASONS[mod(turn, 4)], sv = f.seasons[now];
    Object.assign(ch, { layout: sv.layout, deck: sv.deck || ch.deck, season: { now, snow: sv.snow } });
  }
  if (f.variants) { // (multiverso: agujero negro, gravedad y meteoritos, por turnos; casino: monedas, dado y ruleta)
    const keys = Object.keys(f.variants), sub = keys[mod(turn, keys.length)], sv = f.variants[sub];
    Object.assign(ch, { layout: sv.layout, deck: sv.deck || ch.deck, gamble: sv.gamble, sub });
  }
  return ch;
}
