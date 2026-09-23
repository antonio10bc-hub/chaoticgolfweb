// IA: termina partidas, gana al azar con claridad y evita los JAQUEs cuando puede.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, PLAYER_COLORS } from '../src/engine/game.js';
import { defaultCounts } from '../src/content/cards/index.js';
import { mulberry32 } from '../src/engine/rng.js';
import { simulateGame } from '../src/ai/autoplay.js';
import { choosePlan, chooseJaqueSave, enumeratePlays, evaluate } from '../src/ai/bot.js';

const pve = (seed, players = 3) => {
  const g = Game.pve({ players, cols: 7, rows: 9, par: 3, humanColor: PLAYER_COLORS[0] }, { seed });
  g.S.human = -1;
  g.S.aiStyles = g.S.aiStyles.map((s, i) => s || (i % 2 ? 'aggro' : 'trick'));
  return g;
};

test('bot contra bot: las partidas terminan', () => {
  const rand = mulberry32(99);
  let finished = 0;
  for (let i = 0; i < 60; i++) if (simulateGame(pve(1000 + i), { rand }).finished) finished++;
  assert.ok(finished >= 58, `solo terminaron ${finished}/60`);
});

test('la IA gana con claridad a un jugador aleatorio', () => {
  const rand = mulberry32(7);
  const randomPlan = (game, p, r) => {
    const plays = enumeratePlays(game, p);
    if (!plays.length || r() < .25) return null;
    const pl = plays[Math.floor(r() * plays.length)];
    return { actions: pl.actions, key: pl.key };
  };
  let randomWins = 0, finished = 0;
  for (let i = 0; i < 80; i++) {
    const r = simulateGame(pve(5000 + i), { rand, planFor: p => (p === 0 ? randomPlan : null) });
    if (!r.finished) continue;
    finished++;
    if (r.winners.includes(0)) randomWins++;
  }
  assert.ok(randomWins / finished < 0.15, `el aleatorio ganó ${randomWins}/${finished}`);
});

test('si puede embocar, emboca', () => {
  const g = pve(3);
  const S = g.S, p = S.turn, b = g.ownBall(p);
  S.hole.x = b.x; S.hole.y = b.y - 2;
  S.hands[p] = ['palo2', 'palo1'];
  const plan = choosePlan(g, p, () => 0);
  assert.ok(plan);
  assert.equal(plan.key, 'palo2');
  assert.deepEqual(plan.actions.at(-1), ['cell', b.x, b.y - 2]);
});

test('en JAQUE rival, usa una naranja que lo evite', () => {
  const g = Game.free({ players: 2, par: 2, cols: 5, rows: 6, counts: defaultCounts() }, { seed: 9 });
  const S = g.S, b0 = S.balls[0];
  S.hole.x = b0.x; S.hole.y = b0.y - 2;
  S.hands[0] = ['palo2']; S.hands[1] = ['oHoyoLeft'];
  g.clickCard(0, 0); g.clickCell(b0.x, b0.y - 2);
  assert.equal(S.jaque, true);
  const save = chooseJaqueSave(g, 1, () => 0);
  assert.ok(save, 'debería encontrar la salvada');
  for (const a of save.actions) if (a[0] === 'card') g.clickCard(a[1], a[2]); else g.clickCell(a[1], a[2]);
  assert.equal(S.winner, null);
});

test('nunca regala el hoyo a un rival si tiene alternativa', () => {
  const g = pve(21);
  const S = g.S, p = S.turn;
  const rival = S.balls.find(b => b.player !== p);
  // el hoyo a 2 de la pelota rival: la carta de hoyo en esa dirección se la tragaría
  S.hole.x = rival.x; S.hole.y = rival.y - 2;
  S.hands[p] = ['hoyoDown', 'palo1'];
  const plan = choosePlan(g, p, () => 0);
  const after = g.clone({ lite: true });
  if (plan) for (const a of plan.actions) a[0] === 'card' ? after.clickCard(a[1], a[2]) : after.clickCell(a[1], a[2]);
  assert.ok(!(after.S.winner !== null && !after.S.winners.includes(p)));
  assert.ok(evaluate(after, p) > -1000);
});
