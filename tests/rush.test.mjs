// Contrarreloj: los cazadores (dónde salen, qué pueden jugar, que no ganan y salen si entran en el hoyo, sus golpes)
// y su IA (van a por tu pelota, no al hoyo).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/engine/game.js';
import { mulberry32 } from '../src/engine/rng.js';
import { generateLevel, placeHunters } from '../src/content/levels/generate.js';
import { choosePlan, evaluate } from '../src/ai/bot.js';
import { simulateGame } from '../src/ai/autoplay.js';

const d = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
// tablero 7×7: tu pelota abajo, el hoyo arriba y dos cazadores donde se diga
function level(hunters, extra = {}) {
  const g = Game.fromLevel({ cols: 7, rows: 7, hole: { x: 3, y: 0 }, ball: { x: 3, y: 6 }, parCells: [], tiles: [],
    deckCounts: { palo1: 10, palo2: 10 }, hunters, ...extra }, { seed: 3 });
  g.takeEvents();
  return g;
}

test('salida de los cazadores: en el borde, lejos de tu pelota (nunca a su lado), sin tocar el hoyo y separados', () => {
  for (let tier = 0; tier < 5; tier++) for (let s = 1; s <= 80; s++) {
    const L = generateLevel(s * 977, tier), H = placeHunters(L, s * 977, 2);
    assert.equal(H.length, 2, `hoyo ${tier + 1}, semilla ${s}`);
    for (const h of H) {
      assert.ok(h.x === 0 || h.y === 0 || h.x === L.cols - 1 || h.y === L.rows - 1, 'en el borde');
      assert.ok(d(h, L.ball) >= 3, 'lejos de tu pelota');
      assert.ok(Math.abs(h.x - L.ball.x) > 1 || Math.abs(h.y - L.ball.y) > 1, 'no pegado a ella');
      assert.ok(d(h, L.hole) >= 2, 'no junto al hoyo');
      assert.ok(![...L.tiles, ...L.extraBalls, ...L.parCells].some(c => c.x === h.x && c.y === h.y), 'en una casilla libre');
    }
    assert.notDeepEqual(H[0], H[1]);
    assert.deepEqual(placeHunters(L, s * 977, 2), H, 'la misma semilla, los mismos sitios');
  }
});

test('partida con cazadores: tres jugadores, empiezas tú, cada cazador con su mano', () => {
  const g = level([{ x: 0, y: 3 }, { x: 6, y: 3 }]), S = g.S;
  assert.equal(S.nPlayers, 3);
  assert.deepEqual(S.hunters, [1, 2]);
  assert.equal(S.turn, 0); assert.equal(S.human, 0);
  assert.deepEqual(S.aiStyles, [null, 'hunter', 'hunter']);
  assert.ok(S.hands.every(h => h.length === 2));
  assert.ok(S.balls[1].hunter && S.balls[2].hunter && !S.balls[0].hunter);
});

test('cazador: una sola negra por turno y nunca fuera de su turno (ni reacciona ni salva el JAQUE)', () => {
  const g = level([{ x: 0, y: 3 }, { x: 6, y: 3 }]), S = g.S;
  S.hands[1] = ['palo1', 'oPalo1'];
  assert.equal(g.canPlay(1, 'oPalo1'), false, 'fuera de su turno, ni las naranjas');
  g.endTurn();
  assert.equal(S.turn, 1);
  S.hands[1] = ['palo1', 'palo1'];
  assert.ok(g.clickCard(1, 0)); assert.ok(g.clickCell(1, 3));
  assert.equal(g.canPlay(1, 'palo1'), false, 'la segunda negra, no');
});

test('cazador en el hoyo: no gana, sale de la partida (sin cartas) y ya no juega', () => {
  const g = level([{ x: 2, y: 0 }, { x: 6, y: 3 }]), S = g.S;
  g.endTurn(); // turno del cazador 1, junto al hoyo
  S.hands[1] = ['palo1', 'palo2'];
  assert.ok(g.clickCard(1, 0)); assert.ok(g.clickCell(3, 0));
  assert.equal(S.winner, null, 'no gana');
  assert.ok(S.balls[1].holed && g.hunterGone(1));
  assert.deepEqual(S.hands[1], []);
  g.endTurn(); assert.equal(S.turn, 2);
  g.endTurn(); assert.equal(S.turn, 0);
  g.endTurn(); assert.equal(S.turn, 2, 'se salta al que ha salido');
});

test('golpes de los cazadores: cuentan los que dan a tu pelota (no los que se dan entre ellos)', () => {
  const g = level([{ x: 3, y: 4 }, { x: 4, y: 4 }]), S = g.S;
  g.endTurn();
  S.hands[1] = ['palo1', 'palo1'];
  S.balls[1].y = 5; // justo encima de la tuya
  assert.ok(g.clickCard(1, 0)); assert.ok(g.clickCell(3, 6)); // baja y choca con la tuya
  assert.equal(S.huntHits, 1);
  g.endTurn();
  S.hands[2] = ['palo1', 'palo1'];
  S.balls[1].x = 3; S.balls[1].y = 4;
  assert.ok(g.clickCard(2, 0)); assert.ok(g.clickCell(3, 4)); // a la izquierda: da al otro cazador
  assert.equal(S.huntHits, 1);
});

test('IA del cazador: golpea tu pelota en lugar de acercarse al hoyo', () => {
  const g = level([{ x: 3, y: 3 }, { x: 6, y: 0 }]), S = g.S;
  S.balls[0].y = 5; // tu pelota, a dos casillas por debajo del cazador
  g.endTurn();
  S.hands[1] = ['palo2', 'palo1'];
  const plan = choosePlan(g, 1, mulberry32(1));
  assert.ok(plan, 'juega');
  const sim = g.clone({ lite: true });
  for (const a of plan.actions) a[0] === 'card' ? sim.clickCard(a[1], a[2]) : sim.clickCell(a[1], a[2]);
  assert.equal(sim.S.huntHits, 1, 'te golpea');
  // y nunca prefiere meterse en el hoyo
  const g2 = level([{ x: 3, y: 2 }, { x: 6, y: 6 }]);
  g2.endTurn(); g2.S.hands[1] = ['palo2', 'palo1'];
  assert.ok(evaluate(g2, 1, 'hunter') > -1e4);
  const p2 = choosePlan(g2, 1, mulberry32(2)), sim2 = g2.clone({ lite: true });
  if (p2) for (const a of p2.actions) a[0] === 'card' ? sim2.clickCard(a[1], a[2]) : sim2.clickCell(a[1], a[2]);
  assert.equal(sim2.S.balls[1].holed, false, 'no se mete en el hoyo');
});

test('hoyos del contrarreloj con cazadores: terminan casi siempre (bots en tu lugar)', () => {
  const rand = mulberry32(5);
  let done = 0, n = 0;
  for (let tier = 0; tier < 5; tier++) for (let i = 0; i < 6; i++, n++) {
    const seed = (rand() * 2 ** 32) >>> 0, L = generateLevel(seed, tier);
    L.hunters = placeHunters(L, seed, 2);
    const g = Game.fromLevel(L, { seed: seed ^ 0x5bd1e995 });
    simulateGame(g, { rand, maxTurns: 150 });
    if (g.S.winner === 0) done++;
    assert.ok(g.S.winner === null || g.S.winners.every(w => w === 0), 'solo puedes ganar tú');
  }
  assert.ok(done >= n * .8, `${done}/${n}`);
});
