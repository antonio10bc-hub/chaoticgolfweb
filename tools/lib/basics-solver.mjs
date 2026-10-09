// Solucionador de los niveles de Lo básico ("gana en 1 turno"): recorre TODAS las jugadas de un turno con el motor de
// verdad (sin el modo rápido de la IA: las monedas se lanzan, la dorada gira la ruleta, el túnel sortea) y con la
// semilla del nivel, así que lo que sale al azar es lo mismo que verá quien juegue la misma jugada.
//   plays(L)    todas las secuencias del turno: [{ seq, win, cards, evs }]
//   quality(L)  soluciones, dificultad, cartas que sobran, piezas que no cambian nada y si la solución depende del azar
// Criterios: cada carta hace falta (salvo pistas falsas a propósito), cada pieza cambia algo, y la solución gana con
// cualquier semilla (o, con `seed`, con la suya).
import { Game } from '../../src/engine/game.js';
import { pendingChoices, applyAction } from '../../src/ai/bot.js';
import { mulberry32 } from '../../src/engine/rng.js';

export const seedOf = L => L.seed ?? 1;
// copia fiel (también el estado del azar)
const fork = g => { const h = g.clone(); h.rand = mulberry32(g.rand.getState()); return h; };
export function act(g, a) {
  if (a[0] === 'cancel') return g.cancel();
  return applyAction(g, a);
}
const won = g => g.S.winner === 0 && !g.S.holeWin && !g.S.trainWin;
// las elecciones desde un estado: con una acción pendiente, sus casillas (y renunciar a una cara); si no, cada carta jugable
function choices(g) {
  if (g.pending) return [...pendingChoices(g), ...(g.pending.bonus ? [['cancel']] : [])];
  const out = [], seen = new Set(), hand = g.S.hands[0];
  hand.forEach((k, i) => { if (!seen.has(k) && g.canPlay(0, k)) { seen.add(k); out.push(['card', 0, i]); } });
  return out;
}
// todas las secuencias de un turno (cada estado sin acción pendiente es un final posible: se puede acabar el turno ahí)
export function plays(L, { seed = seedOf(L), cap = 60000, events = false } = {}) {
  let g0; try { g0 = Game.fromLevel(L, { seed }); } catch (e) { return null; }
  g0.takeEvents();
  const out = []; let nodes = 0;
  const walk = (g, seq, cards, evs, depth) => {
    if (++nodes > cap || depth > 40) return;
    if (!g.pending) {
      out.push({ seq, win: won(g), cards, ...(events ? { evs } : {}) });
      if (g.S.winner !== null) return;
    }
    for (const a of choices(g)) {
      const h = fork(g);
      if (!act(h, a)) continue;
      const e = h.takeEvents();
      walk(h, [...seq, a], cards + (a[0] === 'card' ? 1 : 0), events ? [...evs, ...e] : evs, depth + 1);
    }
  };
  walk(g0, [], 0, [], 0);
  return nodes > cap ? null : out;
}
export function replay(L, seq, seed = seedOf(L)) {
  const g = Game.fromLevel(L, { seed }); g.takeEvents(); const evs = [];
  for (const a of seq) { if (!act(g, a)) return null; evs.push(...g.takeEvents()); }
  return { g, evs, won: won(g) };
}
export const winsOf = L => { if (!L.hand.length) return 0; const a = plays(L); return a ? a.filter(s => s.win).length : -1; }; // (sin mano, el motor repartiría del mazo)

// la calidad de un nivel. need(evs): lo que tiene que pasar en TODAS las soluciones (la mecánica que enseña)
export function quality(L, { need = null } = {}) {
  const all = plays(L, { events: true });
  if (!all) return { ok: false, why: 'demasiadas jugadas' };
  const wins = all.filter(s => s.win);
  const q = { wins: wins.length, total: all.length, ratio: wins.length / all.length, hand: L.hand.length };
  if (!wins.length) return { ...q, ok: false, why: 'sin solución' };
  q.minCards = Math.min(...wins.map(w => w.cards));
  q.sol = wins.find(w => w.cards === q.minCards).seq;
  // sin semilla: alguna solución gana con cualquier semilla (no depende del azar)
  q.robust = L.seed != null || wins.some(w => [1, 2, 3, 4, 5, 6].every(sd => replay(L, w.seq, sd)?.won));
  q.needOk = !need || wins.every(w => need(w.evs, w));
  q.spareCards = L.hand.filter((_, i) => winsOf({ ...L, hand: L.hand.filter((__, j) => j !== i) }) > 0);
  const touched = new Set();
  for (const s of all) for (const e of s.evs) if (e.x != null) touched.add(e.x + ',' + e.y);
  q.idleTiles = (L.tiles || []).filter((tl, i) => !touched.has(tl.x + ',' + tl.y) && winsOf({ ...L, tiles: L.tiles.filter((_, j) => j !== i) }) === wins.length).map(t => `${t.type}@${t.x},${t.y}`);
  q.idleDecoys = (L.extraBalls || []).filter((e, i) => winsOf({ ...L, extraBalls: L.extraBalls.filter((_, j) => j !== i) }) === wins.length).map(e => `${e.x},${e.y}`);
  q.ok = q.robust && q.needOk && !q.spareCards.length;
  return q;
}
// la solución, legible: [palo3] →(2,1) …
export function describe(L, seq) {
  const g = Game.fromLevel(L, { seed: seedOf(L) }); const out = [];
  for (const a of seq) {
    if (a[0] === 'card') out.push(`[${g.S.hands[0][a[2]]}]`);
    else if (a[0] === 'cancel') out.push('renuncia');
    else if (a[0] === 'amount') out.push(`×${a[1]}`);
    else out.push(`(${a.slice(1).join(',')})`);
    act(g, a);
  }
  return out.join(' ');
}
