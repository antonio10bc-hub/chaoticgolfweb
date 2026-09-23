// Partidas bot-contra-bot instantáneas sobre el motor (sin interfaz ni esperas).
// Lo usan tools/simulate.mjs (telemetría de balanceo) y los tests de la IA.
// La interfaz tiene su propio orquestador con ritmo y animaciones (ui/ai-driver.js),
// pero toma exactamente las mismas decisiones de src/ai/bot.js.
import { choosePlan, chooseReaction, chooseJaqueSave, discardPlan, applyAction, farness } from './bot.js';
import { CARDS } from '../content/cards/index.js';

export function runPlan(game, plan) {
  for (const a of plan.actions) if (!applyAction(game, a)) break;
  if (game.pending?.kind === 'serpent') game.endSerpent(); // blindaje: nunca dejar un dedo a medias
  else if (game.pending) game.cancel();
}

// tras una jugada de `author`, ¿algún otro bot reacciona con una naranja?
export function maybeReact(game, author, rand, isBot = () => true) {
  const S = game.S;
  if (S.winner !== null || game.pending) return null;
  const cands = [];
  for (let p = 0; p < S.nPlayers; p++) {
    if (p === author || !isBot(p)) continue;
    const r = chooseReaction(game, p, rand);
    if (r) cands.push({ p, ...r });
  }
  if (!cands.length) return null;
  cands.sort((a, b) => b.gain - a.gain || farness(game, b.p) - farness(game, a.p));
  const c = cands[0];
  return rand() < c.chance ? c : null;
}

// JAQUE: el primer bot capaz de evitarlo (el que va peor) lo evita; si no, null
export function jaqueSaver(game, rand, isBot = () => true) {
  const S = game.S;
  const cands = [];
  for (let p = 0; p < S.nPlayers; p++) {
    if (!isBot(p) || S.winners.includes(p)) continue;
    const s = chooseJaqueSave(game, p, rand);
    if (s) cands.push({ p, ...s });
  }
  if (!cands.length) return null;
  cands.sort((a, b) => (b.key === 'no') - (a.key === 'no') || farness(game, b.p) - farness(game, a.p));
  return cands[0];
}

// partida completa entre bots; devuelve estadísticas
// planFor(p) permite cambiar la política de un asiento (p. ej. un bot aleatorio de referencia)
export function simulateGame(game, { rand = Math.random, maxTurns = 400, onPlay, planFor } = {}) {
  const plan = (p) => (planFor?.(p) || choosePlan)(game, p, rand);
  const S = () => game.S;
  const stats = { turns: 0, plays: 0, reactions: 0, saves: 0, cards: {} };
  const played = key => { stats.plays++; stats.cards[key] = (stats.cards[key] || 0) + 1; onPlay?.(key); };

  const settleJaque = () => {
    while (S().jaque && S().winner !== null) {
      const saver = jaqueSaver(game, rand);
      if (!saver) { game.confirmWin(); return true; }
      stats.saves++; played(saver.key);
      runPlan(game, saver);
    }
    return S().winner !== null && !S().jaque;
  };

  while (stats.turns < maxTurns) {
    if (settleJaque()) break;
    const p = S().turn;
    for (let n = 0; n < 3; n++) {
      if (S().winner !== null || S().turn !== p) break;
      const pl = plan(p);
      if (!pl) break;
      played(pl.key);
      runPlan(game, pl);
      if (settleJaque()) break;
      const react = maybeReact(game, p, rand);
      if (react) { stats.reactions++; played(react.key); runPlan(game, react); if (settleJaque()) break; }
    }
    if (S().winner !== null) { if (!S().jaque) break; continue; }
    if (S().playedThisTurn === 0 && discardPlan(game, p).length) {
      game.startDiscard();
      for (const i of discardPlan(game, p)) game.clickCard(p, i);
      if (!game.confirmDiscard()) { game.cancel(); game.endTurn(); }
    } else game.endTurn();
    stats.turns++;
  }
  game.takeEvents();
  return { ...stats, winners: [...S().winners], finished: S().winner !== null && !S().jaque };
}

export const orangeKeys = () => Object.values(CARDS).filter(c => c.color === 'orange').map(c => c.id);
