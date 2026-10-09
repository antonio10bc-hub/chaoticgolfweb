// Buscador de niveles de Lo básico por lección: genera tableros pequeños al azar con las piezas y la mano de la
// lección, y se queda con los que la enseñan de verdad: TODAS las soluciones pasan por lo que pide (`need`), cada carta
// hace falta, ninguna pieza sobra y la dificultad cae en su banda. Guarda los mejores en
// puzzle-candidates/basics-<lección>.json y los enseña en ASCII con su solución (copiarlos a tools/basics-design.mjs).
//   node tools/basics-search.mjs <lección> [intentos=4000] [semilla=1] [cuántos=4]
// Las lecciones están en la tabla LESSONS (añadir más ahí).
import fs from 'node:fs';
import { plays, quality, describe } from './lib/basics-solver.mjs';
import { drawLevel } from './lib/basics-ascii.mjs';

const [lesson, TRIES = 4000, SEED = 1, SHOW = 4] = process.argv.slice(2);
let st = (+SEED * 2654435761) >>> 0;
const rnd = () => { st = (st + 0x6D2B79F5) >>> 0; let t = st; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const ri = n => Math.floor(rnd() * n), pick = a => a[ri(a.length)], range = r => Array.isArray(r) ? r[0] + ri(r[1] - r[0] + 1) : r;
const tip = k => evs => evs.some(e => e.t === 'tip' && e.key === k);
const ev = (t, f = () => true) => evs => evs.some(e => e.t === t && f(e));
const HOLE = ['hoyoUp', 'hoyoDown', 'hoyoLeft', 'hoyoRight'], OHOLE = ['oHoyoUp', 'oHoyoDown', 'oHoyoLeft', 'oHoyoRight'], CLUBS = ['palo1', 'palo2', 'palo3'];

// lección: cols, rows (rango), tiles { tipo: n }, decoys (rango), hand (fija) o pool + n, need [predicados sobre los
// eventos de cada solución], band [ratio mínimo, máximo], dmin (distancia mínima pelota-hoyo), max (jugadas como mucho)
const LESSONS = {
  // palos y hoyo
  orange:   { cols: [5, 6], rows: [5, 6], hand: { pool: [...CLUBS], n: 2, plus: OHOLE }, need: [ev('card', e => e.key.startsWith('oHoyo'))], band: [.03, .3] },
  fallHome: { cols: [4, 6], rows: [4, 6], hand: { pool: [...CLUBS, ...HOLE], n: 2, plus: ['oPalo1', ...OHOLE] }, need: [ev('fall', e => e.p === 'b0'), ev('sink')], band: [.01, .3] },
  holeHome: { cols: [4, 6], rows: [4, 6], hand: { pool: [...CLUBS, ...HOLE], n: 2, plus: [...OHOLE] }, need: [tip('holeFell'), tip('swallow')], band: [.01, .3] },
  swallow:  { cols: [4, 6], rows: [4, 6], hand: { pool: [...CLUBS, ...HOLE], n: 2 }, need: [tip('swallow')], band: [.05, .35] },
  hit:      { cols: [4, 6], rows: [5, 6], decoys: 1, hand: { pool: [...CLUBS], n: 2 }, need: [tip('hit')], band: [.03, .3] },
  decoy:    { cols: [4, 6], rows: [5, 6], decoys: 1, hand: { pool: [...CLUBS, ...HOLE], n: 2 }, need: [tip('decoy')], band: [.02, .3] },
  chain:    { cols: [4, 6], rows: [4, 7], decoys: 2, hand: { pool: [...CLUBS, ...HOLE, 'oPalo1'], n: 2 }, need: [tip('chain')], band: [.002, .4] },
  dedoHit:  { cols: [4, 6], rows: [4, 6], decoys: [1, 2], hand: { pool: [...CLUBS, ...HOLE, ...OHOLE, 'oPalo1'], n: 1, plus: ['dedo'] }, need: [evs => evs.some((e, i) => e.t === 'card' && e.key === 'dedo' && evs.slice(i).some(m => m.t === 'impact' && m.p === 'b0'))], band: [.002, .4] },
  dedoHit2: { cols: [4, 6], rows: [4, 6], decoys: [1, 2], hand: { pool: [...CLUBS, ...HOLE], n: 1, plus: ['dedo'] }, need: [ev('impact', e => e.p === 'b0'), ev('card', e => e.key === 'dedo')], band: [.005, .2] },
  nudge:    { cols: [4, 6], rows: [4, 6], decoys: 1, hand: { pool: [...CLUBS, ...HOLE], n: 1, plus: ['oPalo1'] }, need: [ev('card', e => e.key === 'oPalo1')], band: [.02, .3] },
  nudgeDecoy: { cols: [4, 6], rows: [5, 6], decoys: [1, 2], hand: { pool: [...CLUBS, ...HOLE], n: 1, plus: ['oPalo1'] }, need: [evs => evs.some((e, i) => e.t === 'card' && e.key === 'oPalo1' && evs.slice(i).some(m => m.t === 'move' && m.p !== 'b0' && m.p !== 'hole'))], band: [.01, .3] },
  // clásica
  bunkerStop: { cols: [4, 6], rows: [5, 6], tiles: { bunker: 1 }, hand: { pool: [...CLUBS, ...HOLE], n: 2 }, need: [ev('settle', e => e.p === 'b0')], band: [.03, .3] },
  bunkerExit: { cols: [4, 6], rows: [5, 6], tiles: { bunker: 1 }, ballOn: 'bunker', hand: { pool: [...CLUBS, ...HOLE], n: 2 }, need: [tip('trapExit')], band: [.03, .3] },
  holeBunker: { cols: [4, 6], rows: [5, 6], tiles: { bunker: 1 }, hand: { pool: [...CLUBS, ...HOLE, ...OHOLE], n: 2 }, need: [ev('settle', e => e.p === 'hole')], band: [.02, .3] },
  holeInBunker: { cols: [4, 6], rows: [5, 6], tiles: { bunker: 1 }, holeOn: 'bunker', hand: { pool: [...CLUBS, ...HOLE, ...OHOLE], n: 2 }, need: [ev('card', e => /^hoyo/.test(e.key))], band: [.02, .3] },
  placeBunker: { cols: [4, 5], rows: [4, 6], hand: { pool: [...CLUBS, ...HOLE, ...OHOLE], n: 1, plus: ['bunker'] }, need: [ev('tilePlaced'), evs => evs.some(e => e.t === 'settle')], band: [.001, .4], max: 8000 },
  transferBunker: { cols: [4, 6], rows: [5, 6], tiles: { bunker: 1 }, decoys: 1, decoyOn: 'bunker', hand: { pool: [...CLUBS, ...HOLE], n: 2 }, need: [ev('impact', e => e.p === 'b0')], band: [.02, .3] },
  portal:   { cols: [5, 6], rows: [5, 7], tiles: { portal: 2 }, hand: { pool: [...CLUBS, ...HOLE], n: 2 }, need: [ev('teleport', e => e.p === 'b0')], band: [.03, .3] },
  holePortal: { cols: [5, 6], rows: [5, 7], tiles: { portal: 2 }, hand: { pool: [...CLUBS, ...HOLE], n: 2 }, need: [ev('teleport', e => e.p === 'hole')], band: [.03, .3] },
  placePortal: { cols: [5, 6], rows: [5, 7], tiles: { portal: 1 }, hand: { pool: [...CLUBS, ...HOLE], n: 1, plus: ['portal'] }, need: [ev('tilePlaced'), ev('teleport')], band: [.002, .2], max: 6000 },
  portalHit: { cols: [5, 6], rows: [5, 7], tiles: { portal: 2 }, decoys: 1, hand: { pool: [...CLUBS, ...HOLE], n: 2 }, need: [ev('teleport'), ev('impact', e => e.p === 'b0')], band: [.01, .3] },
  portalFall: { cols: [4, 6], rows: [4, 6], tiles: { portal: 2 }, hand: { pool: [...CLUBS, ...HOLE], n: 2, plus: ['oPalo1', ...OHOLE] }, need: [ev('fall', e => e.p === 'b0'), ev('teleport', e => e.p === 'b0')], band: [.005, .3] },
  holeFallPortal: { cols: [4, 6], rows: [4, 6], tiles: { portal: 2 }, hand: { pool: [...CLUBS, ...HOLE], n: 2, plus: [...OHOLE] }, need: [tip('holeFell'), ev('teleport', e => e.p === 'hole')], band: [.005, .3] },
}[lesson];
if (!LESSONS) throw new Error('lección ' + lesson);
const T = LESSONS;

function build() {
  const cols = range(T.cols), rows = range(T.rows), used = new Set(), k = (x, y) => x + ',' + y;
  const free = (x, y) => x >= 0 && y >= 0 && x < cols && y < rows && !used.has(k(x, y));
  const cell = () => { for (let i = 0; i < 200; i++) { const x = ri(cols), y = ri(rows); if (free(x, y)) { used.add(k(x, y)); return { x, y }; } } return null; };
  const tiles = [];
  for (const [type, n] of Object.entries(T.tiles || {})) for (let i = 0; i < n; i++) {
    const c = cell(); if (!c) return null;
    const tl = { type, ...c };
    if (type === 'corner' || type === 'launcher') { const r = ri(4); if (r) tl.rot = r; }
    tiles.push(tl);
  }
  // pelota, hoyo y obstáculos: sobre una pieza si la lección lo pide (ballOn / holeOn / decoyOn)
  const onTile = type => { const tl = tiles.find(q => q.type === type && !q.taken); if (!tl) return null; tl.taken = true; return { x: tl.x, y: tl.y }; };
  const ball = T.ballOn ? onTile(T.ballOn) : cell(), hole = T.holeOn ? onTile(T.holeOn) : cell();
  if (!ball || !hole || Math.abs(ball.x - hole.x) + Math.abs(ball.y - hole.y) < (T.dmin || 2)) return null;
  const extraBalls = [];
  const nd = range(T.decoys || 0);
  for (let i = 0; i < nd; i++) { const c = i === 0 && T.decoyOn ? onTile(T.decoyOn) : cell(); if (!c) return null; extraBalls.push(c); }
  tiles.forEach(t => delete t.taken);
  let hand;
  if (T.hand.fixed) hand = [...T.hand.fixed];
  else {
    hand = [];
    while (hand.length < T.hand.n) { const c = pick(T.hand.pool); if (!hand.includes(c)) hand.push(c); }
    if (T.hand.plus) hand.push(pick(T.hand.plus));
    hand.sort(() => rnd() - .5);
  }
  const L = { version: 1, puzzle: true, cols, rows, hole, ball, tiles, hand, parCells: [], deckCounts: { palo1: 3, palo2: 3, palo3: 3 } };
  if (extraBalls.length) L.extraBalls = extraBalls;
  return L;
}

let best = [];
const [rmin, rmax] = T.band, mid = Math.sqrt(rmin * rmax);
for (let i = 0; i < +TRIES; i++) {
  const L = build(); if (!L) continue;
  const all = plays(L, { events: true, cap: T.max || 3000 }); if (!all) continue;
  const wins = all.filter(s => s.win); if (!wins.length) continue;
  const ratio = wins.length / all.length;
  if (ratio < rmin || ratio > rmax) continue;
  if (!wins.every(w => T.need.every(f => f(w.evs)))) continue;
  const q = quality(L, { need: evs => T.need.every(f => f(evs)) });
  if (!q.ok || q.idleTiles.length || q.idleDecoys.length) continue;
  const score = Math.abs(Math.log(q.ratio / mid)) + .08 * (L.cols * L.rows - 25) + .2 * L.tiles.length + .25 * (L.extraBalls?.length || 0);
  const key = JSON.stringify([L.hole, L.ball, L.tiles, L.extraBalls, L.hand]);
  if (best.some(b => b.key === key)) continue;
  best.push({ score, key, ratio: +q.ratio.toFixed(3), wins: q.wins, total: q.total, L, sol: q.sol });
  best.sort((a, b) => a.score - b.score); best = best.slice(0, 12);
}
fs.mkdirSync('puzzle-candidates', { recursive: true });
fs.writeFileSync(`puzzle-candidates/basics-${lesson}.json`, JSON.stringify(best.map(({ key, ...b }) => b), null, 1));
if (!best.length) console.log(lesson, ': nada');
for (const [n, b] of best.slice(0, +SHOW).entries()) {
  console.log(`\n#${n} ${lesson} ${b.L.cols}x${b.L.rows} ratio ${b.ratio} (${b.wins}/${b.total}) mano: ${b.L.hand.join(' ')}`);
  console.log(drawLevel(b.L) + 'solución: ' + describe(b.L, b.sol));
}
