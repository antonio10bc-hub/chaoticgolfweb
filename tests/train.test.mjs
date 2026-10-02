// Baraja del tren: el circuito, la locomotora (empuja, se para contra la madera, gana sola), los vagones y sus cartas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/engine/game.js';
import { makeCircuit, validPath, stepsToNext } from '../src/engine/train.js';
import { mulberry32 } from '../src/engine/rng.js';
import { DECKS, deckById, deckSize, deckHasTrain } from '../src/content/decks.js';
import { defaultCounts } from '../src/content/cards/index.js';
import { packLevel, unpackLevel } from '../src/content/levels/share.js';

// un circuito que bordea un tablero de 6×5 (0-5 arriba, 6-9 a la derecha, 10-14 abajo, 15-17 a la izquierda)
const RING = [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [5, 1], [5, 2], [5, 3], [5, 4], [4, 4], [3, 4], [2, 4], [1, 4], [0, 4], [0, 3], [0, 2], [0, 1]];
function level(opts = {}, train = {}) {
  const g = Game.fromLevel({ cols: 6, rows: 5, hole: { x: 3, y: 2 }, ball: { x: 2, y: 2 }, parCells: [], tiles: [], deckCounts: { palo1: 6 },
    train: { path: RING, stations: [2, 7, 12, 16], pos: 16, cars: 0, ...train }, ...opts }, { seed: 1 });
  g.takeEvents();
  return g;
}
const at = (b, x, y) => b.x === x && b.y === y;

test('circuito: vuelta cerrada válida, sin pasar por salidas ni hoyo, con 4 paradas en orden y separadas', () => {
  for (const [C, R] of [[9, 7], [11, 11], [13, 13], [19, 13]]) for (let s = 1; s <= 60; s++) {
    const avoid = [[Math.floor(C / 2), 1], [Math.floor(C / 2), R - 3]];
    const c = makeCircuit(C, R, mulberry32(s), avoid);
    assert.ok(c, `${C}×${R} semilla ${s}`);
    assert.ok(validPath(c.path, C, R), 'casillas vecinas, distintas y sin tramos que se toquen');
    assert.ok(!c.path.some(([x, y]) => avoid.some(([ax, ay]) => ax === x && ay === y)), 'no pisa salidas ni hoyo');
    assert.equal(c.stations.length, 4);
    const L = c.path.length;
    for (let i = 0; i < 4; i++) assert.ok((c.stations[(i + 1) % 4] - c.stations[i] + L) % L >= 3, 'paradas separadas y en orden');
  }
  // las formas cambian de una partida a otra (casi nunca dos iguales), con tramos rectos largos: sin serpentear
  const shapes = Array.from({ length: 30 }, (_, s) => makeCircuit(11, 11, mulberry32(s + 1), []).path);
  assert.ok(new Set(shapes.map(p => JSON.stringify(p))).size >= 27, 'formas distintas');
  for (const p of shapes) { // (curvas: casillas donde la vía cambia de dirección; como mucho una de cada tres)
    const L = p.length, turns = p.filter((c, i) => { const a = p[(i - 1 + L) % L], b = p[(i + 1) % L]; return a[0] !== b[0] && a[1] !== b[1]; }).length;
    assert.ok(turns <= L / 3, `demasiadas curvas: ${turns}/${L}`);
  }
});

test('partida rápida del tren: circuito en Game.pve con su RNG aparte (el mazo sale igual) y en Ultimate también', () => {
  const dk = deckById('train'), counts = dk.counts(defaultCounts());
  const cfg = { players: 3, ...deckSize(dk, { cols: 7, rows: 9, par: 3 }), counts, humanColor: '#f26d6d' };
  const a = Game.pve({ ...cfg, train: true }, { seed: 9 }), b = Game.pve(cfg, { seed: 9 });
  assert.ok(a.S.train && !b.S.train);
  assert.deepEqual(a.S.deck, b.S.deck, 'el circuito no gasta el azar de la partida');
  assert.ok(a.S.train.stations.includes(a.S.train.pos), 'la locomotora empieza en una parada');
  assert.ok(!a.S.balls.some(bl => a.trackIndex(bl.x, bl.y) >= 0) && a.trackIndex(a.S.hole.x, a.S.hole.y) < 0, 'sin obstaculizar a nadie');
  assert.ok(deckHasTrain(deckById('ultimate')), 'Ultimate tiene el tren');
  const ult = deckById('ultimate').counts(defaultCounts());
  for (const k of ['trenVuelta', 'oTren1', 'vagon']) assert.ok(ult[k] > 0, 'Ultimate suma ' + k);
  assert.equal(DECKS[DECKS.length - 1].id, 'ultimate', 'Ultimate, siempre la última');
  assert.ok(DECKS.findIndex(d => d.id === 'train') < DECKS.findIndex(d => d.id === 'ultimate'), 'el tren, antes de Ultimate');
  for (const k of ['trenVuelta', 'oTren1', 'vagon']) assert.equal(defaultCounts()[k], 0, 'fuera de su baraja no hay ' + k);
});

test('maqueta de la baraja del tren: salidas abajo y hoyo arriba (en columnas al azar) y la vuelta en medio, a lo ancho', () => {
  const dk = deckById('train'), counts = dk.counts(defaultCounts());
  for (const sz of [{ cols: 5, rows: 5, par: 2 }, { cols: 7, rows: 9, par: 3 }, { cols: 9, rows: 11, par: 4 }]) for (let seed = 1; seed <= 40; seed++) {
    const g = Game.pve({ players: 3, ...deckSize(dk, sz), counts, train: true, trainLayout: true, humanColor: '#f26d6d' }, { seed }), S = g.S, tr = S.train;
    assert.ok(tr, 'con tren');
    const ys = tr.path.map(p => p[1]), xs = tr.path.map(p => p[0]), by = S.balls[0].y;
    assert.ok(S.balls.every(b => b.y === by && b.spawnY === by) && S.hole.y < Math.min(...ys) && by > Math.max(...ys), 'pelotas · vía · hoyo');
    assert.ok(Math.max(...xs) - Math.min(...xs) >= S.cols - 1 - 2 * Math.max(1, Math.floor(S.cols * .2)), 'repartida a lo ancho');
    assert.equal(S.parCells.length, 0, 'sin columna de PAR');
    // por cada columna, la vuelta tiene dos lados entre las salidas y el hoyo: hay que cruzarla (y su césped)
    const inside = tr.path.filter(([x]) => x === S.hole.x).length;
    if (inside) assert.ok(inside >= 2, 'dos tramos que cruzar');
  }
  const holes = new Set(Array.from({ length: 30 }, (_, s) => Game.pve({ players: 2, ...deckSize(dk, { cols: 7, rows: 9, par: 3 }), counts, train: true, trainLayout: true, humanColor: '#f26d6d' }, { seed: s + 1 }).S.hole.x));
  assert.ok(holes.size >= 4, 'el hoyo, en columnas distintas');
});

test('al acabar el turno la locomotora va sola a la siguiente parada', () => {
  const g = level({}, { pos: 16 });
  g.S.hands[0] = ['palo1'];
  g.endTurn();
  assert.equal(g.S.train.pos, 2, 'de la parada de las 9 a la de las 12');
  const ev = g.takeEvents();
  assert.equal(ev.filter(e => e.t === 'train').length, 4);
  assert.equal(stepsToNext(g.S.train), 5);
});

test('empuje: la pelota de delante (y la fila pegada a ella) avanza con la locomotora; en la curva sale despedida', () => {
  const g = level({ ball: { x: 2, y: 0 }, extraBalls: [{ x: 3, y: 0 }], hole: { x: 3, y: 2 } }, { pos: 0 });
  g.trainRun({ stops: 1 }); // de la casilla 0 a la parada de las 12 (2): empuja a las dos una casilla
  const [me, ob] = g.S.balls;
  assert.ok(at(me, 3, 0) && at(ob, 4, 0), 'las dos, una casilla: ' + JSON.stringify([me, ob]));
  g.trainRun({ stops: 1 }); // por la recta hasta la esquina: la de delante se cae por la derecha
  assert.equal(ob.x === 5 && ob.y === 0, false, 'la de delante ya no está en la recta');
  assert.ok(g.takeEvents().some(e => e.t === 'fall'), 'se ha caído del tablero');
});

test('contra la madera el tren espera; la locomotora es maciza como un bloque y el vagón atrapa como un búnker', () => {
  const g = level({ tiles: [{ type: 'block', x: 2, y: 0 }] }, { pos: 0 });
  assert.equal(g.trainRun({ stops: 1 }), 1, 'avanza hasta la madera y se para');
  assert.equal(g.S.train.pos, 1);
  // una pelota que va hacia la locomotora rebota
  const h = level({ ball: { x: 2, y: 2 } }, { pos: 2 }); // (la locomotora en (2,0))
  h.S.hands[0] = ['palo2'];
  h.clickCard(0, 0); h.clickCell(2, 0);
  assert.ok(!at(h.S.balls[0], 2, 0), 'no se queda encima de la locomotora');
  assert.ok(h.takeEvents().some(e => e.t === 'bump'), 'rebota');
  // vagón: atrapa y se lleva lo que tiene encima
  const w = level({ ball: { x: 1, y: 0 } }, { pos: 2 });
  w.S.hands[0] = ['vagon'];
  assert.ok(w.canPlay(0, 'vagon'));
  w.clickCard(0, 0);
  assert.equal(w.S.train.cars, 1);
  assert.ok(w.inTrap(w.S.balls[0]), 'la pelota, en la arena del vagón');
  w.trainRun({ stops: 1 });
  assert.equal(w.S.train.pos, 7);
  assert.deepEqual([w.S.balls[0].x, w.S.balls[0].y], w.trainCell(1), 'viaja con el vagón');
  w.S.train.cars = 3;
  assert.equal(w.canAddWagon(), false, 'como mucho 3 vagones');
});

test('si el tren solo (al acabar el turno) mete una pelota en el hoyo, gana el tren y pierde todo el mundo', () => {
  const g = level({ ball: { x: 1, y: 0 }, hole: { x: 2, y: 0 } }, { pos: 16 });
  // la locomotora sube por la izquierda, gira en la esquina y, al ir a la derecha, empuja la pelota al hoyo
  g.S.hands[0] = ['palo1'];
  assert.equal(g.trainThreat(), true, 'se ve venir');
  g.endTurn();
  assert.equal(g.S.trainWin, true);
  assert.equal(g.S.winner, -1);
  assert.deepEqual(g.S.winners, []);
  assert.equal(g.S.jaque, false, 'sin JAQUE: se acaba');
  assert.ok(g.takeEvents().some(e => e.t === 'win'));
});

test('con una carta, la pelota que mete el tren cuenta para su dueño (JAQUE) y el tren se para ahí', () => {
  const g = level({ ball: { x: 5, y: 1 }, hole: { x: 5, y: 3 } }, { pos: 0 });
  g.S.hands[0] = ['trenVuelta'];
  g.clickCard(0, 0);
  assert.equal(g.S.winner, 0);
  assert.equal(g.S.jaque, true);
  assert.ok(!g.S.trainWin);
  assert.equal(g.S.train.pos, 7, 'se para donde ha embocado, sin terminar la vuelta');
});

test('el tren empuja el hoyo; durante un JAQUE, el naranja de 1 parada lo anula', () => {
  const g = level({ ball: { x: 3, y: 3 }, hole: { x: 3, y: 2 } }, { pos: 12 });
  // JAQUE: la pelota entra en el hoyo, que está en la vía (lo ponemos ahí)
  g.S.hole.x = 0; g.S.hole.y = 3; g.S.balls[0].x = 0; g.S.balls[0].y = 3; g.S.balls[0].holed = true;
  g.S.winner = 0; g.S.winners = [0]; g.S.jaque = true;
  g.S.hands[0] = ['oTren1'];
  assert.ok(g.canPlay(0, 'oTren1'), 'naranja: también en un JAQUE');
  g.clickCard(0, 0);
  assert.equal(g.S.winner, null, 'JAQUE anulado');
  assert.ok(!g.S.balls[0].holed, 'la pelota sale del hoyo');
  assert.ok(!(g.S.hole.x === 0 && g.S.hole.y === 3), 'el hoyo, empujado');
});

test('nada encima de las vías; NO deshace lo que hizo el tren; el tren se guarda y se clona', () => {
  const g = level({ ball: { x: 2, y: 2 } }, { pos: 16 });
  assert.equal(g.canPlaceTile('bunker', 3, 0), false, 'vía');
  assert.equal(g.canPlaceTile('bunker', 3, 3), true, 'césped');
  g.S.hands[0] = ['oTren1', 'no'];
  g.clickCard(0, 0);
  assert.equal(g.S.train.pos, 2);
  g.clickCard(0, 0); // NO
  assert.equal(g.S.train.pos, 16, 'el tren vuelve a donde estaba');
  const r = Game.restore(JSON.parse(JSON.stringify(g.serialize())));
  assert.deepEqual(r.S.train, g.S.train);
  assert.equal(r.tileAt(0, 2).type, 'loco');
  assert.equal(g.clone({ lite: true }).tileAt(0, 2).type, 'loco');
});

test('compartir un nivel con tren: el circuito va en el código; uno inválido o piezas "virtuales" no se aceptan', () => {
  const L = { version: 1, name: 't', cols: 6, rows: 5, hole: { x: 3, y: 2 }, ball: { x: 2, y: 2 }, parCells: [], tiles: [], deckCounts: { trenVuelta: 3 },
    train: { path: RING, stations: [2, 7, 12, 16], pos: 16, cars: 2 } };
  const back = unpackLevel(JSON.parse(JSON.stringify(packLevel(L))));
  assert.deepEqual(back.train, L.train);
  const bad = packLevel(L); bad.tr.p[0] = 9; // (una casilla fuera de la vuelta)
  assert.equal(unpackLevel(bad).train, undefined);
  const virt = packLevel({ ...L, tiles: [{ type: 'loco', x: 2, y: 3 }] });
  assert.equal(unpackLevel(virt).tiles.length, 0, 'la locomotora no es una pieza que se pueda poner');
});
