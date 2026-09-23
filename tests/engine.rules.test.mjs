// Reglas concretas, escritas a mano (complementan al oráculo con casos raros).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Game } from '../src/engine/game.js';
import { CARD_KEYS, defaultCounts } from '../src/content/cards/index.js';

// nivel de 1 jugador con pelotas de obstáculo; la mano se fija a mano
function level(opts) {
  const g = Game.fromLevel({ cols: 5, rows: 5, hole: { x: 4, y: 4 }, ball: { x: 0, y: 0 }, parCells: [], tiles: [], deckCounts: { palo1: 4 }, ...opts }, { seed: 1 });
  g.takeEvents();
  return g;
}
const hand = (g, p, cards) => { g.S.hands[p] = [...cards]; };

test('palo: avanza N casillas y emboca en JAQUE; confirmar da la victoria', () => {
  const g = level({ hole: { x: 3, y: 0 } });
  hand(g, 0, ['palo3']);
  g.clickCard(0, 0);
  assert.equal(g.pending.kind, 'move');
  g.clickCell(3, 0);
  assert.equal(g.S.winner, 0);
  assert.equal(g.S.jaque, true);
  assert.ok(g.confirmWin());
  assert.equal(g.S.jaque, false);
  assert.ok(g.takeEvents().some(e => e.t === 'win'));
});

test('búnker: entrar con pasos pendientes los pierde; salir cuesta 1 (palo 1 no se puede jugar)', () => {
  const g = level({ tiles: [{ type: 'bunker', x: 1, y: 0 }] });
  hand(g, 0, ['palo3', 'palo1']);
  g.clickCard(0, 0); g.clickCell(3, 0);
  assert.deepEqual([g.S.balls[0].x, g.S.balls[0].y], [1, 0]);
  g.S.blackPlayed = 0;
  assert.equal(g.canPlay(0, 'palo1'), false);
});

test('portales: no cuentan como casilla y se sigue en la misma dirección', () => {
  const g = level({ tiles: [{ type: 'portal', x: 1, y: 0 }, { type: 'portal', x: 2, y: 3 }] });
  hand(g, 0, ['palo1']);
  g.clickCard(0, 0); g.clickCell(1, 0);
  assert.deepEqual([g.S.balls[0].x, g.S.balls[0].y], [3, 3]);
  assert.ok(g.takeEvents().some(e => e.t === 'teleport'));
});

test('bucle de choques entre portales: se detiene en vez de reventar la pila (bug del original)', () => {
  const g = Game.fromLevel({ cols: 4, rows: 5, hole: { x: 0, y: 4 }, ball: { x: 1, y: 0 }, parCells: [],
    tiles: [{ type: 'portal', x: 0, y: 0 }, { type: 'portal', x: 3, y: 0 }], extraBalls: [{ x: 2, y: 0 }], deckCounts: { palo1: 5 } }, { seed: 3 });
  g.clickCard(0, 0);
  assert.doesNotThrow(() => g.clickCell(2, 0));
  assert.equal(g.pending, null);
  assert.match(g.S.log.join('\n'), /se detiene/);
});

test('choque: el golpeado recibe los pasos restantes', () => {
  const g = level({ extraBalls: [{ x: 1, y: 0 }] });
  hand(g, 0, ['palo3']);
  g.clickCard(0, 0); g.clickCell(3, 0);
  assert.deepEqual(g.S.balls.map(b => [b.x, b.y]), [[0, 0], [4, 0]]);
});

test('dedo: un choque consume solo 1 paso y conservas el resto', () => {
  const g = level({ extraBalls: [{ x: 1, y: 0 }] });
  hand(g, 0, ['dedo']);
  g.clickCard(0, 0); g.chooseAmount(3);
  assert.equal(g.pending.kind, 'serpent');
  g.clickCell(1, 0); // choca con la señuelo
  assert.equal(g.pending.stepsLeft, 2);
  assert.deepEqual([g.S.balls[1].x, g.S.balls[1].y], [2, 0]);
  assert.equal(g.cancel(), false, 'el dedo gastado no se puede cancelar');
});

test('NO: rebobina la última carta; una loseta cancelada vuelve a descartes', () => {
  const g = Game.free({ players: 2, par: 2, cols: 5, rows: 6, counts: defaultCounts() }, { seed: 7 });
  hand(g, 0, ['bunker']); hand(g, 1, ['no']);
  g.clickCard(0, 0); g.clickCell(0, 0);
  assert.equal(g.S.tiles.length, 1);
  const discards = g.S.discard.length;
  assert.ok(g.canPlay(1, 'no'));
  g.clickCard(1, 0);
  assert.equal(g.S.tiles.length, 0);
  assert.equal(g.S.discard.filter(k => k === 'bunker').length, 1);
  assert.equal(g.S.discard.length, discards + 2); // el NO y el búnker
  assert.ok(g.takeEvents().some(e => e.t === 'rewind'));
});

test('JAQUE: solo naranjas; mover el hoyo anula la victoria y la pelota sale', () => {
  const g = Game.free({ players: 2, par: 2, cols: 5, rows: 6, counts: defaultCounts() }, { seed: 9 });
  const S = g.S, b0 = S.balls[0];
  S.hole.x = b0.x; S.hole.y = b0.y - 2;
  hand(g, 0, ['palo2']); hand(g, 1, ['oHoyoLeft', 'palo1']);
  g.clickCard(0, 0); g.clickCell(b0.x, b0.y - 2);
  assert.equal(S.jaque, true);
  assert.equal(g.canPlay(1, 'palo1'), false);
  assert.equal(g.canPlay(1, 'oHoyoLeft'), true);
  g.clickCard(1, 0);
  assert.equal(S.winner, null);
  assert.equal(S.jaque, false);
  assert.equal(S.balls[0].holed, false);
});

test('palo reactivo en JAQUE: saca del hoyo la pelota ganadora', () => {
  const g = Game.free({ players: 2, par: 2, cols: 5, rows: 6, counts: defaultCounts() }, { seed: 11 });
  const S = g.S, b0 = S.balls[0];
  S.hole.x = b0.x; S.hole.y = b0.y - 1;
  hand(g, 0, ['palo1']); hand(g, 1, ['oPalo1']);
  g.clickCard(0, 0); g.clickCell(S.hole.x, S.hole.y);
  assert.equal(S.jaque, true);
  g.clickCard(1, 0);
  g.clickCell(S.hole.x, S.hole.y);          // clic en el hoyo
  assert.equal(g.pending.extract, true);
  g.clickCell(S.hole.x + 1, S.hole.y);
  assert.equal(S.winner, null);
  assert.deepEqual([b0.x, b0.y, b0.holed], [S.hole.x + 1, S.hole.y, false]);
});

test('descartar: prohibido tras jugar; roba hasta 2 y pasa el turno', () => {
  const g = Game.free({ players: 2, par: 2, cols: 5, rows: 6, counts: defaultCounts() }, { seed: 13 });
  assert.ok(g.startDiscard());
  g.clickCard(0, 0); g.clickCard(0, 1);
  assert.ok(g.confirmDiscard());
  assert.equal(g.S.turn, 1);
  assert.equal(g.S.hands[0].length, 2);
  g.S.playedThisTurn = 1;
  assert.equal(g.startDiscard(), false);
  assert.ok(g.takeEvents().some(e => e.t === 'notice'));
});

test('mazo vacío: se rebaraja la pila de descartes', () => {
  const g = Game.free({ players: 1, par: 1, cols: 3, rows: 5, counts: { palo1: 2 } }, { seed: 5 });
  assert.equal(g.S.deck.length, 0);
  g.S.discard = ['palo2', 'palo3']; g.S.hands[0] = [];
  g.drawTo2(0);
  assert.equal(g.S.hands[0].length, 2);
  assert.match(g.S.log[0], /baraja/);
});

test('semilla: misma semilla ⇒ mismo reparto', () => {
  const a = Game.free({ players: 3, par: 3, cols: 7, rows: 9, counts: defaultCounts() }, { seed: 123 });
  const b = Game.free({ players: 3, par: 3, cols: 7, rows: 9, counts: defaultCounts() }, { seed: 123 });
  assert.deepEqual(a.S.deck, b.S.deck);
  assert.deepEqual(a.S.hands, b.S.hands);
});

test('niveles de historia: JSON válido y jugable', () => {
  const dir = new URL('../src/content/levels/story/', import.meta.url);
  const files = JSON.parse(fs.readFileSync(new URL('index.json', dir)));
  assert.equal(files.length, 4);
  for (const f of files) {
    const L = JSON.parse(fs.readFileSync(new URL(f, dir)));
    assert.equal(L.version, 1);
    for (const k of Object.keys(L.deckCounts)) assert.ok(CARD_KEYS.includes(k), `${f}: carta desconocida ${k}`);
    const g = Game.fromLevel(L, { seed: 1 });
    assert.equal(g.S.hands[0].length, 2);
  }
});

test('multijugador local: varias personas sin alterar el reparto ni los bots', () => {
  const cfg = { players: 4, cols: 7, rows: 9, par: 3, humanColor: '#f26d6d' };
  const one = Game.pve(cfg, { seed: 77 });
  const two = Game.pve({ ...cfg, humans: 2 }, { seed: 77 });
  assert.equal(one.S.humans, undefined);
  assert.equal(two.S.humans.length, 2);
  assert.ok(two.S.humans.includes(two.S.human));
  assert.deepEqual(two.S.deck, one.S.deck);      // mismo mazo y mismas manos
  assert.deepEqual(two.S.hands, one.S.hands);
  for (const h of two.S.humans) assert.equal(two.S.aiStyles[h], null);
  for (let i = 0; i < 4; i++) if (!two.S.humans.includes(i)) assert.equal(two.S.aiStyles[i], one.S.aiStyles[i]);
});

test('tope anti-bucle: la cadena de choques entre portales avisa con un evento', () => {
  const g = Game.free({ players: 2, par: 1, cols: 6, rows: 5, counts: { palo3: 4 } }, { seed: 2 });
  const S = g.S, y = 4;
  S.tiles = [{ type: 'portal', x: 0, y }, { type: 'portal', x: 3, y }];
  Object.assign(S.balls[0], { x: 1, y }); Object.assign(S.balls[1], { x: 2, y });
  S.turn = 0; S.hands[0] = ['palo3'];
  g.takeEvents();
  g.clickCard(0, 0);
  const tg = g.pending.targets.find(t => t.dir === 'right');
  g.clickCell(tg.x, tg.y);
  const evs = g.takeEvents();
  assert.equal(evs.filter(e => e.t === 'chainStop').length, 1);
  assert.match(S.log.join('\n'), /bucle/);
});
