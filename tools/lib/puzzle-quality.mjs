// Calidad de un puzle "gana en 1 turno": todas las secuencias de un turno (con el motor y la IA),
// soluciones, cartas sobrantes, piezas u obstáculos que no cambian nada y si la solución depende del azar.
// Criterios de la colección: cada carta hace falta (salvo alguna pista falsa a propósito en los
// difíciles), cada pieza cambia la solución o es una trampa que toca alguna jugada, y la solución gana
// con cualquier semilla.
import { Game } from '../../src/engine/game.js';
import { enumeratePlays, applyAction } from '../../src/ai/bot.js';
export function sequences(L, cap = 40000) {
  let g0; try { g0 = Game.fromLevel(L, { seed: 1 }); } catch (e) { return null; }
  const out = []; let nodes = 0;
  const walk = (g, seq, cards) => {
    if (++nodes > cap) return;
    if (g.S.winner !== null) { out.push({ seq, win: true, cards }); return; }
    out.push({ seq, win: false, cards });
    for (const pl of enumeratePlays(g, 0)) walk(pl.result, [...seq, ...pl.actions], cards + 1);
  };
  walk(g0, [], 0);
  return nodes > cap ? null : out;
}
export function replay(L, seq, seed) {
  const g = Game.fromLevel(L, { seed }); g.takeEvents(); const evs = [];
  for (const a of seq) { if (!applyAction(g, a)) return null; evs.push(...g.takeEvents()); }
  return { g, evs };
}
export const winsOf = L => { const a = sequences(L); return a ? a.filter(s => s.win).length : -1; };
export function quality(L) {
  const all = sequences(L); if (!all) return { ok: false, why: 'demasiadas jugadas' };
  const wins = all.filter(s => s.win);
  const q = { wins: wins.length, total: all.length, ratio: wins.length / all.length, minCards: Math.min(...wins.map(w => w.cards)), hand: L.hand.length };
  if (!wins.length) return { ...q, ok: false, why: 'sin solución' };
  // una solución que gane con cualquier semilla
  q.robust = wins.some(w => [1, 2, 3, 4, 5, 6].every(sd => { const r = replay(L, w.seq, sd); return r && r.g.S.winner !== null; }));
  // cartas imprescindibles: sin cada una, ¿sigue teniendo solución?
  q.spareCards = L.hand.filter((_, i) => winsOf({ ...L, hand: L.hand.filter((__, j) => j !== i) }) > 0);
  // piezas y obstáculos que no cambian nada al quitarlos
  // casillas que toca alguna jugada (ganadora o no): pasos, rebotes, corrientes, caídas en búnker…
  const touched = new Set();
  for (const s of all) { const r = replay(L, s.seq, 1); if (!r) continue; for (const e of r.evs) { if (e.x != null) touched.add(e.x + ',' + e.y); if (e.t === 'bump' || e.t === 'deflect') touched.add(e.x + ',' + e.y); } }
  q.idleTiles = L.tiles.filter((tl, i) => !touched.has(tl.x + ',' + tl.y) && winsOf({ ...L, tiles: L.tiles.filter((_, j) => j !== i) }) === wins.length).map(t => `${t.type}@${t.x},${t.y}`);
  q.idleDecoys = (L.extraBalls || []).filter((e, i) => winsOf({ ...L, extraBalls: L.extraBalls.filter((_, j) => j !== i) }) === wins.length).map(e => `${e.x},${e.y}`);
  q.ok = q.robust && q.minCards >= 2 && !q.spareCards.length;
  return q;
}
