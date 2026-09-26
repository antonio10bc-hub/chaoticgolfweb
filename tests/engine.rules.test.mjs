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

test('parejas de portales (Atajos): cada portal lleva al de su pareja, no a cualquiera', () => {
  const g = level({ tiles: [{ type: 'portal', x: 1, y: 0, pair: 1 }, { type: 'portal', x: 4, y: 4, pair: 2 },
    { type: 'portal', x: 2, y: 3, pair: 1 }, { type: 'portal', x: 0, y: 4, pair: 2 }] });
  hand(g, 0, ['palo1']);
  g.clickCard(0, 0); g.clickCell(1, 0); // entra por el A de (1,0) y sale por el A de (2,3), un paso más allá
  assert.deepEqual([g.S.balls[0].x, g.S.balls[0].y], [3, 3]);
});

test('bucle de choques entre portales: se detiene en vez de reventar la pila (bug del original)', () => {
  const g = Game.fromLevel({ cols: 4, rows: 5, hole: { x: 0, y: 4 }, ball: { x: 1, y: 0 }, parCells: [],
    tiles: [{ type: 'portal', x: 0, y: 0 }, { type: 'portal', x: 3, y: 0 }], extraBalls: [{ x: 2, y: 0 }], deckCounts: { palo1: 5 } }, { seed: 3 });
  g.clickCard(0, 0);
  assert.doesNotThrow(() => g.clickCell(2, 0));
  assert.equal(g.pending, null);
  assert.match(g.S.log.join('\n'), /se detiene/);
});

test('caída sobre un portal: al volver a su casilla la pelota lo cruza y sale 1 más allá en la dirección de la caída', () => {
  const g = level({ ball: { x: 1, y: 1 } });
  g.S.balls[0].y = 0; // se ha movido; su casilla de salida (1,1) tiene ahora un portal
  g.S.tiles.push({ type: 'portal', x: 1, y: 1 }, { type: 'portal', x: 3, y: 3 });
  hand(g, 0, ['palo1']);
  g.clickCard(0, 0);
  g.clickCell(1, 0); // hacia arriba, fuera del tablero
  assert.deepEqual([g.S.balls[0].x, g.S.balls[0].y], [3, 2]);
  const ev = g.takeEvents().map(e => e.t);
  assert.ok(ev.indexOf('fall') < ev.lastIndexOf('teleport'));
});

test('caída sobre un portal: si la salida está fuera del tablero, se queda en el otro portal', () => {
  const g = level({ ball: { x: 1, y: 1 } });
  g.S.balls[0].y = 0;
  g.S.tiles.push({ type: 'portal', x: 1, y: 1 }, { type: 'portal', x: 3, y: 0 });
  hand(g, 0, ['palo1']);
  g.clickCard(0, 0); g.clickCell(1, 0);
  assert.deepEqual([g.S.balls[0].x, g.S.balls[0].y], [3, 0]);
});

/* ---------- baraja de agua: río y lago ---------- */
// nivel 5×7: pelota abajo en (0,6), hoyo arriba a la derecha
const water = (tiles, opts = {}) => level({ cols: 5, rows: 7, hole: { x: 4, y: 0 }, ball: { x: 0, y: 6 }, tiles, ...opts });

test('río: para el movimiento y arrastra hacia abajo hasta la casilla justo debajo del final', () => {
  const g = water([{ type: 'river', x: 0, y: 3 }, { type: 'river', x: 0, y: 4 }]);
  g.S.balls[0].y = 6; hand(g, 0, ['palo3']);
  g.clickCard(0, 0); g.clickCell(0, 3); // sube 3: entra en el río en (0,4) y pierde el resto
  assert.deepEqual([g.S.balls[0].x, g.S.balls[0].y], [0, 5]);
  assert.ok(g.takeEvents().some(e => e.t === 'drift'));
});

test('río: si a la salida hay otra pelota, la empuja 1 abajo y ocupa su sitio', () => {
  const g = water([{ type: 'river', x: 1, y: 2 }], { extraBalls: [{ x: 1, y: 3 }] });
  g.S.balls[0].x = 0; g.S.balls[0].y = 2; hand(g, 0, ['palo1']);
  g.clickCard(0, 0); g.clickCell(1, 2);
  assert.deepEqual(g.S.balls.map(b => [b.x, b.y]), [[1, 3], [1, 4]]);
});

test('río: si desemboca fuera del tablero, la pelota se cae y vuelve a su salida', () => {
  const g = water([{ type: 'river', x: 2, y: 6 }]);
  g.S.balls[0].x = 1; g.S.balls[0].y = 6; hand(g, 0, ['palo1']);
  g.clickCard(0, 0); g.clickCell(2, 6);
  assert.deepEqual([g.S.balls[0].x, g.S.balls[0].y], [0, 6]);
});

test('lago: caer dentro es como caerse del tablero; si en la salida hay agua, a la libre más cercana', () => {
  const g = water([{ type: 'lake', x: 0, y: 4 }]);
  g.S.balls[0].y = 5; hand(g, 0, ['palo1']);
  g.clickCard(0, 0); g.clickCell(0, 4);
  assert.deepEqual([g.S.balls[0].x, g.S.balls[0].y], [0, 6]);
  assert.ok(g.takeEvents().some(e => e.t === 'splash'));
  const h = water([{ type: 'lake', x: 0, y: 4 }, { type: 'lake', x: 0, y: 6 }]);
  h.S.balls[0].y = 5; hand(h, 0, ['palo1']);
  h.clickCard(0, 0); h.clickCell(0, 4);
  const b = h.S.balls[0];
  assert.ok(!h.tileAt(b.x, b.y) && Math.abs(b.x) + Math.abs(b.y - 6) === 1);
});

test('río en la salida: la corriente la lleva hasta debajo del río', () => {
  const g = water([{ type: 'river', x: 0, y: 5 }, { type: 'lake', x: 1, y: 2 }]);
  g.S.balls[0].x = 1; g.S.balls[0].y = 3; g.S.balls[0].spawnX = 0; g.S.balls[0].spawnY = 5;
  hand(g, 0, ['palo1']);
  g.clickCard(0, 0); g.clickCell(1, 2); // al lago → vuelve a (0,5), que es río → baja a (0,6)
  assert.deepEqual([g.S.balls[0].x, g.S.balls[0].y], [0, 6]);
});

test('el hoyo también: el río lo arrastra y del lago vuelve a su casilla inicial', () => {
  const g = water([{ type: 'river', x: 2, y: 1 }]);
  g.S.hole = { x: 2, y: 0, initX: 2, initY: 0 };
  g.moveHole('down', 2);
  assert.deepEqual([g.S.hole.x, g.S.hole.y], [2, 2]);
  const h = water([{ type: 'lake', x: 3, y: 0 }]);
  h.moveHole('left', 1);
  assert.deepEqual([h.S.hole.x, h.S.hole.y], [4, 0]);
});

test('colocar agua: el río crece en su columna por los extremos; el lago, pegado por un lado; máx. 5', () => {
  const g = water([{ type: 'river', x: 2, y: 3 }, { type: 'lake', x: 0, y: 1 }]);
  assert.ok(g.canPlaceTile('river', 2, 2) && g.canPlaceTile('river', 2, 4));
  assert.ok(!g.canPlaceTile('river', 3, 3) && !g.canPlaceTile('river', 2, 5));
  assert.ok(g.canPlaceTile('lake', 1, 1) && g.canPlaceTile('lake', 0, 2));
  assert.ok(!g.canPlaceTile('lake', 1, 2));
  for (const y of [0, 1, 2, 4]) g.S.tiles.push({ type: 'river', x: 3, y });
  const r = water([0, 1, 2, 3, 4].map(y => ({ type: 'river', x: 2, y })));
  assert.equal(r.anyPlaceFor('river'), false);
});

/* ---------- baraja de minigolf y Ultimate ---------- */
const mg = (tiles, opts = {}) => level({ cols: 7, rows: 7, hole: { x: 6, y: 0 }, ball: { x: 1, y: 3 }, tiles, ...opts });
const at = g => [g.S.balls[0].x, g.S.balls[0].y];

test('bloque: la pelota rebota y vuelve por donde venía, sin gastar paso', () => {
  const g = mg([{ type: 'block', x: 3, y: 3 }]);
  hand(g, 0, ['palo3']);
  g.clickCard(0, 0); g.clickCell(4, 3); // 1 paso a (2,3), rebota, 2 pasos atrás: (1,3), (0,3)
  assert.deepEqual(at(g), [0, 3]);
});

test('esquina: la cara inclinada desvía 90° sin gastar paso; por la espalda rebota', () => {
  const g = mg([{ type: 'corner', x: 1, y: 1, rot: 0 }]); // ángulo recto arriba-izquierda: abierta abajo y a la derecha
  hand(g, 0, ['palo3']);
  g.clickCard(0, 0); g.clickCell(1, 0); // sube: (1,2), esquina → derecha: (2,1), (3,1)
  assert.deepEqual(at(g), [3, 1]);
  const h = mg([{ type: 'corner', x: 3, y: 3, rot: 0 }]);
  hand(h, 0, ['palo2']);
  h.clickCard(0, 0); h.clickCell(3, 3); // derecha: (2,3) y choca con la espalda → vuelve a (1,3)
  assert.deepEqual(at(h), [1, 3]);
});

test('túnel: sale por uno de sus 4 lados al azar y no gasta paso', () => {
  const seen = new Set();
  for (let seed = 1; seed <= 30; seed++) {
    const g = Game.fromLevel({ cols: 7, rows: 7, hole: { x: 6, y: 0 }, ball: { x: 1, y: 3 }, parCells: [], tiles: [{ type: 'tunnel', x: 2, y: 3 }], deckCounts: { palo1: 4 } }, { seed });
    g.S.hands[0] = ['palo2']; g.clickCard(0, 0); g.clickCell(3, 3);
    const b = g.S.balls[0]; seen.add(b.x + ',' + b.y);
    assert.ok(!(b.x === 2 && b.y === 3)); // nunca se queda dentro
  }
  assert.ok(seen.size >= 3, 'sale por varios lados: ' + [...seen]);
});

test('lanzadera: se para, vuela 3 hacia su flecha y la flecha gira cada turno', () => {
  const g = mg([{ type: 'launcher', x: 2, y: 3, rot: 0 }], { cols: 7, rows: 9, ball: { x: 1, y: 8 }, hole: { x: 6, y: 0 } });
  g.S.balls[0].x = 1; g.S.balls[0].y = 8; g.S.tiles[0].y = 8;
  hand(g, 0, ['palo3']);
  g.clickCard(0, 0); g.clickCell(4, 8); // entra en la lanzadera (2,8) y vuela 3 hacia arriba → (2,5)
  assert.deepEqual(at(g), [2, 5]);
  const rot = g.S.tiles[0].rot; g.endTurn();
  assert.equal(g.S.tiles[0].rot, (rot + 1) % 4);
});

test('lanzaderas enfrentadas: un solo rebote, sin ping-pong, y nadie se queda encima', () => {
  const g = mg([{ type: 'launcher', x: 1, y: 3, rot: 1 }, { type: 'launcher', x: 4, y: 3, rot: 3 }], { cols: 8 });
  g.S.balls[0].x = 0; g.S.balls[0].y = 3;
  hand(g, 0, ['palo1']);
  g.clickCard(0, 0); g.clickCell(1, 3); // A → B → (vuelve a A: ya usada) → casilla libre junto a A
  const b = g.S.balls[0], on = g.S.tiles.find(t => t.x === b.x && t.y === b.y);
  assert.equal(on, undefined);
  assert.equal(g.S.log.filter(l => /volando|flies/.test(l)).length, 2);
});

test('palo iridiscente: tras saltar una lanzadera sigue avanzando (y la pelota golpeada hereda el impulso)', () => {
  const g = mg([{ type: 'launcher', x: 3, y: 3, rot: 1 }], { cols: 12, extraBalls: [{ x: 9, y: 3 }] });
  hand(g, 0, ['paloIri']);
  g.clickCard(0, 0); g.clickCell(2, 3); // (2,3) → lanzadera (3,3) → vuela a (6,3) → sigue → choca en (8,3)
  assert.deepEqual(g.S.balls.map(b => [b.x, b.y]), [[8, 3], [9, 3]]); // la otra sale disparada, se cae y vuelve a su sitio
  assert.ok(g.S.logK.some(l => l[0] === 'ballLaunch') && g.S.logK.some(l => l[0] === 'collision'));
});

// un río en (3,1..3) cuya desembocadura (3,4) tapa una pieza; la pelota entra por (3,1)
const riverInto = mouth => {
  const g = mg([1, 2, 3].map(y => ({ type: 'river', x: 3, y })).concat(mouth), { cols: 7, rows: 9, ball: { x: 1, y: 1 } });
  hand(g, 0, ['palo2']);
  g.clickCard(0, 0); g.clickCell(3, 1);
  return g;
};
test('río que desemboca en una esquina, un portal o un túnel: la corriente la lleva a través', () => {
  assert.deepEqual(at(riverInto([{ type: 'corner', x: 3, y: 4, rot: 3 }])), [4, 4]); // la esquina la desvía a la derecha
  assert.deepEqual(at(riverInto([{ type: 'portal', x: 3, y: 4, pair: 1 }, { type: 'portal', x: 0, y: 6, pair: 1 }])), [0, 7]); // sale por el otro portal
  for (let i = 0; i < 6; i++) { // túnel: sale por un lado al azar, siempre a una casilla libre y sin agua
    const g = riverInto([{ type: 'tunnel', x: 3, y: 4 }]), [x, y] = at(g);
    assert.equal(g.S.tiles.find(t => t.x === x && t.y === y), undefined);
  }
});
test('río que desemboca en un bloque: rebota y acaba en una casilla libre cercana', () => {
  for (const mouth of [{ type: 'block', x: 3, y: 4 }, { type: 'corner', x: 3, y: 4, rot: 0 }]) { // (la espalda de la esquina también)
    const g = riverInto([mouth]), [x, y] = at(g);
    assert.ok(g.S.logK.some(l => l[0] === 'riverBlocked'));
    assert.equal(g.S.tiles.find(t => t.x === x && t.y === y), undefined);
    assert.equal(Math.abs(x - 3) + Math.abs(y - 3), 1); // junto al final del río
  }
});

test('río que desemboca en la lanzadera que lanza a ese río: sin bucle', () => {
  const river = [2, 3, 4, 5, 6].map(y => ({ type: 'river', x: 3, y }));
  const g = mg([...river, { type: 'launcher', x: 3, y: 7, rot: 0 }], { rows: 9, ball: { x: 1, y: 7 } });
  hand(g, 0, ['palo2']);
  g.clickCard(0, 0); g.clickCell(3, 7); // lanzadera → río (3,2) → baja hasta la lanzadera (ya usada) → libre
  const b = g.S.balls[0], on = g.S.tiles.find(t => t.x === b.x && t.y === b.y);
  assert.equal(on, undefined);
  assert.equal(g.S.log.filter(l => /volando|flies/.test(l)).length, 1);
});

test('palo iridiscente: rebota y sigue hasta chocar con una pelota (que hace lo mismo) o caerse', () => {
  const keys = g => g.S.logK.map(l => l[0]);
  const g = mg([{ type: 'block', x: 6, y: 3 }], { extraBalls: [{ x: 3, y: 3 }] });
  hand(g, 0, ['paloIri']);
  g.clickCard(0, 0); g.clickCell(2, 3);
  // A choca con B; B rebota en el bloque, vuelve y choca con A, que sale por la izquierda y vuelve a su salida
  assert.deepEqual(g.S.balls.map(b => [b.x, b.y]), [[1, 3], [3, 3]]);
  assert.deepEqual(keys(g).filter(k => k !== 'ballMoved').slice(0, 4), ['ballFell', 'collision', 'ballBounce', 'collision']);
  const c = mg([{ type: 'corner', x: 4, y: 3, rot: 2 }], { extraBalls: [{ x: 4, y: 0 }] });
  hand(c, 0, ['paloIri']);
  c.clickCard(0, 0); c.clickCell(2, 3);
  assert.deepEqual(at(c), [4, 1]); // la esquina la desvía hacia arriba y sigue hasta la otra pelota
  const h = mg([{ type: 'block', x: 4, y: 3 }]);
  hand(h, 0, ['paloIri']);
  h.clickCard(0, 0); h.clickCell(2, 3);
  assert.ok(keys(h).includes('ballBounce') && keys(h).includes('ballFell')); // rebota y, sin nada más, se cae
  const l = mg([{ type: 'block', x: 0, y: 3 }, { type: 'block', x: 4, y: 3 }]);
  hand(l, 0, ['paloIri']);
  l.clickCard(0, 0); l.clickCell(2, 3);
  assert.ok(keys(l).includes('iriLoop')); // entre dos bloques, el bucle se corta
  assert.equal(at(l)[1], 3);
});

test('palos de 4 y 5 existen, pero con 0 copias fuera de sus barajas', () => {
  assert.equal(defaultCounts().palo4, 0); assert.equal(defaultCounts().palo5, 0); assert.equal(defaultCounts().paloIri, 0);
  const g = mg([]);
  hand(g, 0, ['palo5']);
  g.clickCard(0, 0); g.clickCell(6, 3);
  assert.deepEqual(at(g), [6, 3]);
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
  assert.equal(files.length, 8);
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

test('puzles: cada uno se resuelve en un solo turno con su mano fija', async () => {
  const { enumeratePlays } = await import('../src/ai/bot.js');
  const dir = new URL('../src/content/levels/puzzles/', import.meta.url);
  const files = JSON.parse(fs.readFileSync(new URL('index.json', dir)));
  assert.ok(files.length >= 6);
  const solvable = g => g.S.winner !== null || enumeratePlays(g, 0).some(pl => solvable(pl.result));
  for (const f of files) {
    const L = JSON.parse(fs.readFileSync(new URL(f, dir)));
    const g = Game.fromLevel(L, { seed: 1 });
    assert.deepEqual(g.S.hands[0], L.hand, `${f}: la mano debe ser la del puzle`);
    assert.ok(solvable(g), `${f}: sin solución en un turno`);
  }
});

test('regla especial: el hoyo se desplaza solo al empezar cada turno', () => {
  const g = Game.pve({ players: 2, cols: 7, rows: 9, par: 3, humanColor: '#f26d6d', rules: { holeDrift: true } }, { seed: 5 });
  const h0 = { ...g.S.hole };
  g.endTurn();
  const h1 = g.S.hole;
  assert.equal(Math.abs(h1.x - h0.x) + Math.abs(h1.y - h0.y) <= 1 || g.S.log.some(l => /hoyo/i.test(l)), true);
  assert.match(g.S.log.join('\n'), /se desplaza solo/);
});

test('niveles generados: deterministas y con mano inicial', async () => {
  const { generateLevel, seedOf } = await import('../src/content/levels/generate.js');
  const a = generateLevel(seedOf('2026-09-24'), 2), b = generateLevel(seedOf('2026-09-24'), 2);
  assert.deepEqual(a, b);
  const g1 = Game.fromLevel(a, { seed: 7 }), g2 = Game.fromLevel(b, { seed: 7 });
  assert.deepEqual(g1.S.deck, g2.S.deck);
  assert.equal(g1.S.hands[0].length, 2);
});
