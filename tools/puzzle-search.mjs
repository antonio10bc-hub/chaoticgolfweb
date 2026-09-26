// Buscador de puzles: genera tableros pequeños de un tema y se queda con los mejores según la calidad
// estricta (lib/puzzle-quality.mjs) y la banda de dificultad de su grupo (warm / mid / exp). Limpia las
// piezas que nadie toca. Guarda los candidatos en puzzle-candidates/<tema>.json (verlos con puzzle-show).
//   node tools/puzzle-search.mjs <tema> [intentos=3000] [semilla=1]
// Temas: bunker river block corner launcher lake iri launchBlock lakeCorner portalLaunch iriLaunch
//        riverLaunch chaos dance iriPortal placeLaunch (añadir más en la tabla T)
import fs from 'node:fs';
import { CARD_KEYS } from '../src/content/cards/index.js';
import { sequences, replay, winsOf, quality } from './lib/puzzle-quality.mjs';
const theme = process.argv[2], TRIES = +(process.argv[3] || 3000), SEED = +(process.argv[4] || 1);
let st = SEED * 2654435761 >>> 0;
const rnd = () => { st = (st + 0x6D2B79F5) >>> 0; let t = st; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const ri = n => Math.floor(rnd() * n), pick = a => a[ri(a.length)];
const HOLE = ['hoyoUp', 'hoyoDown', 'hoyoLeft', 'hoyoRight'], OHOLE = ['oHoyoUp', 'oHoyoDown', 'oHoyoLeft', 'oHoyoRight'], CLUBS = ['palo1', 'palo2', 'palo3'];
// band: warm (2 cartas, fácil) · mid · exp (3 cartas, difícil). ess: piezas sin las que no hay solución
const B = { warm: { hand: 2, spare: 0, rmin: .05, rmax: .25, tmin: 8, tmax: 90 }, mid: { hand: [2, 3], spare: 1, rmin: .015, rmax: .09, tmin: 20, tmax: 250 }, exp: { hand: 3, spare: 1, rmin: .003, rmax: .045, tmin: 40, tmax: 600 } };
const T = {
  bunker:   { band: 'warm', tiles: { bunker: 3 }, pool: [...CLUBS, ...HOLE], need: ['settle'], ess: ['bunker'] },
  river:    { band: 'warm', tiles: { river: 1 }, pool: [...CLUBS, ...HOLE], need: ['drift'], ess: ['river'] },
  block:    { band: 'warm', tiles: { block: 2 }, pool: [...CLUBS, 'palo4', ...HOLE], need: ['bump'], ess: ['block'] },
  corner:   { band: 'warm', tiles: { corner: 2 }, pool: [...CLUBS, 'palo4', ...HOLE], need: ['deflect'], ess: ['corner'] },
  launcher: { band: 'warm', tiles: { launcher: 1 }, pool: [...CLUBS, ...HOLE], need: ['launch'], ess: ['launcher'] },
  lake:     { band: 'mid', tiles: { lake: 1 }, pool: [...CLUBS, ...HOLE, ...OHOLE], need: [], obst: ['lake'], trap: 'splash' },
  iri:      { band: 'mid', tiles: { block: 1 }, decoys: 1, pool: ['paloIri', 'palo1', 'palo2', ...HOLE], need: ['iri'], card: /paloIri/, iriSink: true },
  launchBlock: { band: 'mid', tiles: { launcher: 1, block: 1 }, pool: [...CLUBS, 'palo4', ...HOLE], need: ['launch', 'bump'], ess: ['launcher', 'block'] },
  lakeCorner: { band: 'mid', tiles: { lake: 1, corner: 1 }, pool: [...CLUBS, 'palo4', ...HOLE, 'oPalo1'], need: ['deflect'], ess: ['corner'], obst: ['lake'] },
  portalLaunch: { band: 'exp', tiles: { launcher: 1, portal: 1 }, pool: [...CLUBS, ...HOLE, 'oPalo1'], need: ['launch', 'teleport'], ess: ['portal', 'launcher'] },
  iriLaunch: { band: 'exp', tiles: { launcher: 1, block: 1 }, decoys: 1, pool: ['paloIri', 'palo1', 'palo2', ...HOLE, 'oPalo1'], need: ['iri', 'launch'], card: /paloIri/, ess: ['launcher'], iriSink: true },
  riverLaunch: { band: 'exp', tiles: { river: 1, launcher: 1 }, pool: [...CLUBS, ...HOLE, 'oPalo1'], need: ['drift', 'launch'], ess: ['river', 'launcher'] },
  chaos:    { band: 'exp', tiles: { river: 1, corner: 1, launcher: 1, block: 1, portal: 1 }, pool: [...CLUBS, 'palo4', ...HOLE, 'paloIri', 'oPalo1'], need: ['launch', 'deflect'], ess: ['launcher', 'corner'] },
  dance:    { band: 'exp', tiles: { bunker: 2 }, pool: [...CLUBS, ...HOLE, ...OHOLE, 'oPalo1', 'dedo'], need: [], ess: [] },
  iriPortal: { band: 'exp', tiles: { portal: 1, bunker: 1 }, decoys: 1, pool: ['paloIri', 'palo1', 'palo2', ...HOLE, 'oPalo1'], need: ['iri', 'teleport'], card: /paloIri/, ess: ['portal'], iriSink: true },
  placeLaunch: { band: 'exp', tiles: { block: 1 }, pool: ['launcher', 'palo1', 'palo2', 'palo3'], hand: 2, need: ['tilePlaced', 'launch'], card: /launcher/, big: true },
}[theme];
if (!T) throw new Error('tema ' + theme);
const band = B[T.band];

function build() {
  const cols = 5 + ri(3), rows = 6 + ri(3);
  const used = new Set(), k = (x, y) => x + ',' + y;
  const free = (x, y) => x >= 0 && y >= 0 && x < cols && y < rows && !used.has(k(x, y));
  const cell = () => { for (let i = 0; i < 200; i++) { const x = ri(cols), y = ri(rows); if (free(x, y)) { used.add(k(x, y)); return { x, y }; } } return null; };
  const hole = cell(), ball = cell();
  if (!hole || !ball || Math.abs(hole.x - ball.x) + Math.abs(hole.y - ball.y) < 3) return null;
  const tiles = [];
  for (const [type, n] of Object.entries(T.tiles)) for (let i = 0; i < n; i++) {
    if (type === 'river') {
      const len = 2 + ri(3), x = ri(cols), y0 = ri(rows - len);
      const cs = Array.from({ length: len }, (_, j) => ({ x, y: y0 + j }));
      if (!cs.every(c => free(c.x, c.y))) return null;
      cs.forEach(c => { used.add(k(c.x, c.y)); tiles.push({ type, ...c }); });
    } else if (type === 'lake') {
      const c0 = cell(); if (!c0) return null; const cs = [c0]; tiles.push({ type, ...c0 });
      const n2 = 1 + ri(3);
      for (let j = 0; j < 20 && cs.length < n2 + 1; j++) { const b = pick(cs), d = pick([[1, 0], [-1, 0], [0, 1], [0, -1]]); const c = { x: b.x + d[0], y: b.y + d[1] }; if (free(c.x, c.y)) { used.add(k(c.x, c.y)); cs.push(c); tiles.push({ type, ...c }); } }
    } else if (type === 'portal') {
      const a = cell(), b = cell(); if (!a || !b) return null;
      tiles.push({ type, ...a, pair: 1 }, { type, ...b, pair: 1 });
    } else {
      const c = cell(); if (!c) return null;
      const tl = { type, ...c };
      if (type === 'corner' || type === 'launcher') { const r = ri(4); if (r) tl.rot = r; }
      tiles.push(tl);
    }
  }
  const extraBalls = [];
  for (let i = 0; i < (T.decoys || 0); i++) { const c = cell(); if (!c) return null; extraBalls.push(c); }
  const hn = T.hand || (Array.isArray(band.hand) ? pick(band.hand) : band.hand), hand = [];
  while (hand.length < hn) { const c = pick(T.pool); if (!hand.includes(c)) hand.push(c); }
  if (T.card && !hand.some(c => T.card.test(c))) hand[0] = T.pool.find(c => T.card.test(c));
  const deckCounts = Object.fromEntries(CARD_KEYS.map(c => [c, CLUBS.includes(c) ? 3 : 0]));
  const L = { version: 1, puzzle: true, cols, rows, hole, ball, tiles, hand, parCells: [], deckCounts };
  if (extraBalls.length) L.extraBalls = extraBalls;
  return L;
}
const has = (evs, need) => need.every(n => n === 'iri' ? evs.some(e => e.t === 'move' && e.iri) : evs.some(e => e.t === n));
const iriSink = evs => { const i = evs.findIndex(e => e.t === 'sink' && e.p === 'b0'); if (i < 0) return false; for (let j = i - 1; j >= 0; j--) if (evs[j].t === 'move' && evs[j].p === 'b0') return !!evs[j].iri; return false; };

let best = [];
for (let i = 0; i < TRIES; i++) {
  const L = build(); if (!L) continue;
  const all = sequences(L, T.big ? 40000 : 8000); if (!all) continue;
  const wins = all.filter(s => s.win); if (!wins.length || wins.some(w => w.cards < 2)) continue;
  const ratio = wins.length / all.length;
  if (ratio < band.rmin || ratio > band.rmax || all.length < band.tmin || all.length > band.tmax * (T.big ? 100 : 1)) continue;
  const good = wins.find(w => [1, 2, 3, 4, 5, 6].every(sd => { const r = replay(L, w.seq, sd); return r && r.g.S.winner !== null && has(r.evs, T.need) && (!T.iriSink || iriSink(r.evs)); }));
  if (!good) continue;
  if (T.trap && !all.some(s => { const r = replay(L, s.seq, 1); return r && r.evs.some(e => e.t === T.trap); })) continue;
  if (T.ess && T.ess.some(tp => winsOf({ ...L, tiles: L.tiles.filter(q => q.type !== tp) }) > 0)) continue;
  if (T.obst && T.obst.some(tp => winsOf({ ...L, tiles: L.tiles.filter(q => q.type !== tp) }) <= wins.length)) continue;
  const q = quality(L);
  if (!q.robust || q.spareCards.length > band.spare) continue;
  // limpieza: fuera las piezas y obstáculos que no toca nadie ni cambian nada
  const idle = new Set(q.idleTiles), idleD = new Set(q.idleDecoys);
  L.tiles = L.tiles.filter(t => !idle.has(`${t.type}@${t.x},${t.y}`));
  if (L.extraBalls) { L.extraBalls = L.extraBalls.filter(e => !idleD.has(`${e.x},${e.y}`)); if (!L.extraBalls.length) delete L.extraBalls; }
  if (T.ess && T.ess.some(tp => !L.tiles.some(t => t.type === tp))) continue;
  const q2 = quality(L); if (!q2.ok && !(q2.robust && q2.spareCards.length <= band.spare && q2.minCards >= 2)) continue;
  const mid = (band.rmin + band.rmax) / 2;
  const score = Math.abs(Math.log(q2.ratio / mid)) + (q2.spareCards.length ? .3 : 0) + (L.tiles.length > 6 ? .3 : 0);
  best.push({ score, ratio: +q2.ratio.toFixed(3), total: q2.total, wins: q2.wins, spare: q2.spareCards, L, sol: good.seq });
  best.sort((a, b) => a.score - b.score); best = best.slice(0, 6);
}
fs.mkdirSync('puzzle-candidates', { recursive: true });
fs.writeFileSync(`puzzle-candidates/${theme}.json`, JSON.stringify(best, null, 1));
console.log(theme, best.map(b => `${b.ratio} (${b.wins}/${b.total}) ${b.L.cols}x${b.L.rows} ${b.L.hand.join('+')}${b.spare.length ? ' [sobra ' + b.spare + ']' : ''}`).join(' | ') || 'nada');
