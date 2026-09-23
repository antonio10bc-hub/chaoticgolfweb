/* =========================================================
   IA de los bots — decide simulando jugadas reales sobre el motor.

   1) enumeratePlays: para cada carta jugable, recorre TODAS las elecciones de
      la acción pendiente que abre (destino, pelota, pasos del dedo, casilla…)
      sobre copias del estado → lista de jugadas completas con su resultado.
   2) evaluate: puntúa el estado resultante desde el punto de vista del bot.
   3) choosePlan / chooseReaction / chooseJaqueSave / discardPlan eligen.

   Es genérico: una carta nueva que use los tipos de acción pendiente del motor
   funciona con la IA sin tocar este archivo.
   ========================================================= */
import { CARDS } from '../content/cards/index.js';

// personalidades: pesos de la evaluación y ganas de reaccionar con naranjas
export const STYLES = {
  // agresivo: prioriza su propio avance, reacciona menos
  aggro: { self: 12, ready: 18, trap: 7, opp: 2, threat: 30, oppTrap: 3, orangeReserve: 14, reactMin: 36, reactChance: .42, tileBias: 0 },
  // tramposo: frena más a los rivales y gasta naranjas con más alegría
  trick: { self: 10, ready: 14, trap: 7, opp: 4, threat: 44, oppTrap: 5, orangeReserve: 9, reactMin: 26, reactChance: .6, tileBias: 2 },
};
export const WIN = 100000;
const MAX_LEAVES = 4000; // tope de seguridad por decisión

/* ---------- lectura del tablero ---------- */

// ¿puede la pelota embocar con un solo palo? (alineada con el hoyo a 1-3 y sin nada en medio)
function alignedClear(g, b) {
  const h = g.S.hole;
  if (b.x !== h.x && b.y !== h.y) return false;
  const dist = g.holeDist(b.x, b.y);
  if (dist < 1 || dist > 3) return false;
  const dx = Math.sign(h.x - b.x), dy = Math.sign(h.y - b.y);
  for (let i = 1; i < dist; i++) {
    const x = b.x + dx * i, y = b.y + dy * i;
    if (g.tileAt(x, y) || g.ballAt(x, y)) return false;
  }
  return true;
}

// ¿llega el dedo (≤3 pasos, camino libre y codicioso) al hoyo?
function dedoReach(g, b) {
  const h = g.S.hole;
  let x = b.x, y = b.y;
  const steps = g.holeDist(x, y);
  if (steps < 1 || steps > 3) return false;
  const free = (ox, oy) => g.inBoard(ox, oy) && (g.isHole(ox, oy) || (!g.tileAt(ox, oy) && !g.ballAt(ox, oy)));
  for (let s = 0; s < steps; s++) {
    const dx = Math.sign(h.x - x), dy = Math.sign(h.y - y);
    if (dx && free(x + dx, y)) x += dx;
    else if (dy && free(x, y + dy)) y += dy;
    else return false;
  }
  return true;
}

// 0 = lejos, 1 = el dedo llega, 2 = un palo emboca directo
export function sinkThreat(g, b) {
  if (!b || b.holed) return 0;
  if (alignedClear(g, b)) return 2;
  return dedoReach(g, b) ? 1 : 0;
}

/* ---------- evaluación ---------- */

export function evaluate(g, p, style = 'trick') {
  const S = g.S, W = STYLES[style] || STYLES.trick;
  if (S.winner !== null) return S.winners.includes(p) ? WIN : -WIN;
  let score = 0;
  const me = g.ownBall(p);
  if (me && !me.holed) {
    score -= g.holeDist(me.x, me.y) * W.self;
    if (g.inTrap(me)) score -= W.trap;
    score += sinkThreat(g, me) * W.ready;
  }
  for (const b of S.balls) {
    if (b.player === p || b.holed || b.decoy) continue;
    score += Math.min(g.holeDist(b.x, b.y), 8) * W.opp;
    score -= sinkThreat(g, b) * W.threat;
    if (g.inTrap(b)) score += W.oppTrap;
  }
  return score;
}

/* ---------- enumeración de jugadas ---------- */

// elecciones posibles de la acción pendiente actual → [acción, …]
function pendingChoices(g) {
  const pd = g.pending, S = g.S, out = [];
  switch (pd.kind) {
    case 'move': for (const t of pd.targets) out.push(['cell', t.x, t.y]); break;
    case 'serpent': for (const t of g.serpentTargets()) out.push(['cell', t.x, t.y]); break;
    case 'dedoAmount': for (const n of [1, 2, 3]) out.push(['amount', n]); break;
    case 'pickHoled': for (const b of S.balls) if (b.holed) out.push(['pickHoled', b.player]); break;
    case 'pickBall':
    case 'placeTile':
      for (let y = 0; y < S.rows; y++) for (let x = 0; x < S.cols; x++) if (g.selectableAt(x, y)) out.push(['cell', x, y]);
      break;
  }
  return out;
}

export function applyAction(g, a) {
  switch (a[0]) {
    case 'card': return g.clickCard(a[1], a[2]);
    case 'cell': return g.clickCell(a[1], a[2]);
    case 'amount': return g.chooseAmount(a[1]);
    case 'pickHoled': return g.pickHoled(a[1]);
  }
  return false;
}

// todas las jugadas completas de `p` con las cartas que pasen `filter(def)`
// → [{ actions, key, idx, result: Game }]
export function enumeratePlays(game, p, filter = () => true) {
  const plays = [];
  const hand = game.S.hands[p];
  const seen = new Set();
  for (let idx = 0; idx < hand.length; idx++) {
    const key = hand[idx], def = CARDS[key];
    if (!def || !filter(def) || !game.canPlay(p, key)) continue;
    if (seen.has(key)) continue; // dos copias de la misma carta dan las mismas jugadas
    seen.add(key);
    const g0 = game.clone({ lite: true });
    if (!g0.clickCard(p, idx)) continue;
    const walk = (g, actions, depth) => {
      if (plays.length >= MAX_LEAVES) return;
      if (!g.pending) { plays.push({ actions, key, idx, result: g }); return; }
      if (depth > 6) return;
      for (const a of pendingChoices(g)) {
        const g2 = g.clone({ lite: true });
        if (!applyAction(g2, a)) continue;
        walk(g2, [...actions, a], depth + 1);
      }
    };
    walk(g0, [['card', p, idx]], 0);
  }
  return plays;
}

/* ---------- decisiones ---------- */

const styleOf = (game, p) => game.S.aiStyles?.[p] || 'trick';

// mejor jugada del turno propio (negras y naranjas); null si ninguna merece la pena
export function choosePlan(game, p, rand = Math.random) {
  const style = styleOf(game, p), W = STYLES[style];
  const base = evaluate(game, p, style);
  let best = null;
  for (const pl of enumeratePlays(game, p)) {
    const def = CARDS[pl.key];
    let s = evaluate(pl.result, p, style);
    if (def.color === 'orange') s -= W.orangeReserve; // las naranjas valen más guardadas para reaccionar
    if (def.staysOnBoard) s += W.tileBias;
    s += rand() * 0.5; // desempate con algo de variedad
    if (!best || s > best.score) best = { ...pl, score: s };
  }
  if (!best || best.score < base) return null;
  return { actions: best.actions, key: best.key, score: best.score, gain: best.score - base };
}

// reacción con naranja fuera de su turno: solo si frena algo serio
export function chooseReaction(game, p, rand = Math.random) {
  const style = styleOf(game, p), W = STYLES[style];
  const base = evaluate(game, p, style);
  let best = null;
  for (const pl of enumeratePlays(game, p, def => def.color === 'orange')) {
    const s = evaluate(pl.result, p, style) + rand() * 0.5;
    if (!best || s > best.score) best = { ...pl, score: s };
  }
  if (!best || best.score - base < W.reactMin) return null;
  return { actions: best.actions, key: best.key, gain: best.score - base, chance: W.reactChance };
}

// JAQUE de un rival: ¿hay una naranja que evite la victoria?
export function chooseJaqueSave(game, p, rand = Math.random) {
  const style = styleOf(game, p);
  let best = null;
  for (const pl of enumeratePlays(game, p, def => def.color === 'orange')) {
    const S = pl.result.S;
    if (S.winner !== null && !S.winners.includes(p)) continue; // no la evita
    const s = evaluate(pl.result, p, style) + rand() * 0.5;
    if (!best || s > best.score) best = { ...pl, score: s };
  }
  return best && { actions: best.actions, key: best.key, score: best.score };
}

// orden en el que se sacrifica una naranja si la mano está llena de ellas (la NO es la más valiosa)
const ORANGE_KEEP = { no: 3, oPalo1: 2 };

// descarte (solo en su turno y sin haber jugado nada): renovar la mano en lugar de
// atascarse. Se tiran las negras que ahora mismo no aportan (ninguna jugada mejora
// la posición) y, si la mano está llena de naranjas, la menos valiosa.
export function discardPlan(game, p) {
  const S = game.S, hand = S.hands[p], style = styleOf(game, p);
  const base = evaluate(game, p, style);
  const junk = [];
  hand.forEach((k, idx) => {
    const def = CARDS[k];
    if (!def || def.color !== 'black') return;
    if (def.staysOnBoard && S.tiles.length >= 4 && hand.filter(x => x === k).length > 1) { junk.push(idx); return; }
    if (def.canPlay && !def.canPlay(game, p)) { junk.push(idx); return; } // p. ej. palo 1 desde el búnker
    const plays = enumeratePlays(game, p, d => d.id === k);
    if (!plays.some(pl => evaluate(pl.result, p, style) > base)) junk.push(idx);
  });
  if (!junk.length && hand.length >= 2 && hand.every(k => CARDS[k]?.color === 'orange')) {
    let worst = 0;
    hand.forEach((k, i) => { if ((ORANGE_KEEP[k] || 1) < (ORANGE_KEEP[hand[worst]] || 1)) worst = i; });
    junk.push(worst);
  }
  return junk.slice(0, 2);
}

// quien "va peor" (más lejos del hoyo) gasta antes sus cartas defensivas
export function farness(game, p) {
  const b = game.ownBall(p);
  return !b || b.holed ? -1 : game.holeDist(b.x, b.y);
}
