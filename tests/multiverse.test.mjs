// Baraja del multiverso: agujero negro (y sus copias), gravedad y lluvia de meteoritos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, ownerOf, COPY_BASE, playerTag } from '../src/engine/game.js';
import { MAX_BALLS } from '../src/engine/multiverse.js';
import { DECKS, deckById } from '../src/content/decks.js';
import { defaultCounts } from '../src/content/cards/index.js';

// nivel de 7×7 con la pelota en (0,3) (su salida) y el hoyo arriba a la derecha
function level({ tiles = [], ball = { x: 0, y: 3 }, hole = { x: 6, y: 0 }, extraBalls = [], seed = 1 } = {}) {
  const g = Game.fromLevel({ cols: 7, rows: 7, hole, ball, parCells: [], tiles, deckCounts: { palo1: 6 }, hand: ['palo1'], extraBalls }, { seed });
  g.takeEvents();
  return g;
}
const BH = (x, y) => ({ type: 'blackhole', x, y });
const play = (g, card, p = 0) => { g.S.hands[p] = [card]; assert.ok(g.clickCard(p, 0), 'carta jugable: ' + card); };
const shoot = (g, dir, card = 'palo3', p = 0) => {
  play(g, card, p);
  const tg = g.pending.targets.find(q => q.dir === dir);
  assert.ok(g.clickCell(tg.x, tg.y));
};
const balls = g => g.S.balls.filter(b => !b.decoy).map(b => [b.x, b.y, !!b.copy]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);

test('la baraja: sin búnkeres ni portales, con sus cartas (fuera del Ultimate fijo de Caos total)', () => {
  const dk = deckById('multiverse'), c = dk.counts(defaultCounts());
  assert.equal(c.bunker, 0); assert.equal(c.portal, 0);
  assert.deepEqual([c.agujeroNegro, c.gravedad, c.oGravedad, c.meteoritos], [1, 2, 1, 3]);
  for (const k of dk.newCards) assert.equal(defaultCounts()[k], 0, 'fuera de su baraja no hay ' + k);
  const ult = deckById('ultimate').counts(defaultCounts());
  for (const k of dk.newCards) assert.ok(!ult[k], 'Ultimate no lleva ' + k);
  assert.equal(DECKS[DECKS.length - 2].id, 'multiverse', 'la baraja nueva, detrás de la anterior');
});

test('agujero negro: se pone en una casilla vacía y se queda en el tablero', () => {
  const g = level();
  play(g, 'agujeroNegro');
  assert.equal(g.pending.kind, 'placeTile');
  assert.ok(!g.clickCell(0, 3), 'no encima de una pelota');
  assert.ok(g.clickCell(3, 3));
  assert.deepEqual(g.S.tiles, [BH(3, 3)]);
  assert.ok(!g.S.discard.includes('agujeroNegro'), 'se queda en la mesa');
});

test('agujero negro: al pasar a su lado se traga la pelota y salen 4 con los pasos que le quedaban', () => {
  const g = level({ tiles: [BH(3, 3)] });
  shoot(g, 'right', 'palo3'); // (1,3) → (2,3) pegada al agujero: le queda 1 paso
  assert.deepEqual(balls(g), [[2, 3, true], [3, 2, true], [3, 4, true], [4, 3, false]], 'la original sigue recto; las copias, a los lados y atrás');
  const evs = g.takeEvents().map(e => e.t);
  assert.ok(evs.includes('absorb') && evs.filter(e => e === 'clone').length === 3);
  const copies = g.S.balls.filter(b => b.copy);
  assert.ok(copies.every(c => c.player >= COPY_BASE && ownerOf(c.player) === 0), 'las copias son del jugador');
  assert.equal(playerTag(copies[0].player), playerTag(0) + '′');
  assert.equal(new Set(g.S.balls.map(b => b.player)).size, 4, 'cada una con su número');
});

test('agujero negro: si se para a su lado sin pasos, salen a 1 casilla; con más pasos, más lejos', () => {
  const g = level({ tiles: [BH(3, 3)] });
  shoot(g, 'right', 'palo2'); // (1,3), (2,3): llega sin pasos
  assert.deepEqual(balls(g), [[2, 3, true], [3, 2, true], [3, 4, true], [4, 3, false]]);
  const g2 = level({ tiles: [BH(3, 3)], ball: { x: 0, y: 3 } });
  g2.S.hands[0] = ['palo5']; // (palo largo de minigolf: 5 pasos, quedan 3)
  assert.ok(g2.clickCard(0, 0)); g2.clickCell(g2.pending.targets.find(q => q.dir === 'right').x, 3);
  assert.deepEqual(balls(g2), [[0, 3, true], [3, 0, true], [3, 6, true], [6, 3, false]]);
});

test('copias: si se salen del tablero desaparecen para siempre; la original vuelve a su salida', () => {
  const g = level({ tiles: [BH(3, 1)], ball: { x: 0, y: 1 } });
  shoot(g, 'right', 'palo3'); // le queda 1: la copia de arriba sale por (3,0), la de abajo a (3,2)…
  const n0 = g.S.balls.length;
  const up = g.S.balls.find(b => b.copy && b.x === 3 && b.y === 0);
  assert.ok(up);
  g.S.turn = 0; g.S.blackPlayed = 0;
  play(g, 'palo1');
  assert.equal(g.pending.kind, 'pickOwn', 'con copias, primero se elige cuál');
  assert.ok(g.clickCell(up.x, up.y));
  const tg = g.pending.targets.find(q => q.dir === 'up');
  assert.ok(tg.out, 'hacia fuera');
  g.clickCell(tg.x, tg.y);
  assert.equal(g.S.balls.length, n0 - 1, 'la copia que se cae se va');
  assert.ok(g.takeEvents().some(e => e.t === 'vanish'));
  // la original, en cambio, vuelve a su salida
  const g2 = level({ ball: { x: 0, y: 3 } });
  g2.S.balls[0].x = 6; g2.S.balls[0].y = 3;
  shoot(g2, 'right', 'palo1');
  assert.deepEqual([g2.S.balls[0].x, g2.S.balls[0].y], [0, 3]);
});

test('copias: si una entra en el hoyo, gana su jugador', () => {
  const g = level({ tiles: [BH(3, 3)], hole: { x: 3, y: 1 } });
  shoot(g, 'right', 'palo3'); // la copia de arriba sale 1 casilla: (3,2); con otro palo 1 hacia arriba, al hoyo
  const up = g.S.balls.find(b => b.copy && b.x === 3 && b.y === 2);
  assert.ok(up);
  g.S.blackPlayed = 0;
  play(g, 'palo1');
  g.clickCell(up.x, up.y);
  const tg = g.pending.targets.find(q => q.dir === 'up');
  g.clickCell(tg.x, tg.y);
  assert.ok(up.holed);
  assert.deepEqual(g.S.winners, [0]);
  assert.ok(g.S.jaque);
});

test('copias: el dedo también pregunta cuál y se puede cancelar', () => {
  const g = level({ tiles: [BH(3, 3)] });
  shoot(g, 'right', 'palo3');
  g.S.blackPlayed = 0;
  play(g, 'dedo');
  assert.equal(g.pending.kind, 'pickOwn');
  assert.ok(!g.clickCell(5, 5), 'una casilla vacía no vale');
  const c = g.S.balls.find(b => b.copy);
  assert.equal(g.selectableAt(c.x, c.y), 'sel');
  assert.ok(g.clickCell(c.x, c.y));
  assert.equal(g.pending.kind, 'dedoAmount');
  assert.equal(g.pending.ball, c);
});

test('agujero negro: las copias también se multiplican, con un tope de pelotas por jugador', () => {
  const g = level({ tiles: [BH(3, 3), BH(3, 6)], ball: { x: 0, y: 3 } });
  shoot(g, 'right', 'palo3');
  const down = g.S.balls.find(b => b.copy && b.x === 3 && b.y === 4);
  assert.ok(down);
  g.S.blackPlayed = 0;
  play(g, 'palo1');
  g.clickCell(down.x, down.y);
  const tg = g.pending.targets.find(q => q.dir === 'down');
  g.clickCell(tg.x, tg.y); // (3,5): pegada al agujero de abajo
  assert.ok(g.S.balls.length <= MAX_BALLS && g.S.balls.length > 4, 'se ha vuelto a partir (sin pasar del tope)');
  assert.ok(g.S.balls.every(b => ownerOf(b.player) === 0));
});

test('gravedad: la pelota y el hoyo van hacia el centro; el hoyo llega y se la traga', () => {
  const g = level({ ball: { x: 3, y: 1 }, hole: { x: 5, y: 3 } });
  play(g, 'gravedad');
  assert.equal(g.pending.kind, 'gravity');
  assert.equal(g.selectableAt(3, 3), 'sel');
  assert.ok(g.clickCell(3, 3));
  assert.deepEqual([g.S.hole.x, g.S.hole.y], [3, 3]);
  assert.ok(g.S.balls[0].holed, 'el hoyo se la traga');
  assert.deepEqual(g.S.winners, [0]);
});

test('gravedad: dos pelotas que llegan a la vez chocan y se quedan donde estaban', () => {
  const g = level({ ball: { x: 1, y: 3 }, extraBalls: [{ x: 5, y: 3 }] });
  play(g, 'gravedad');
  g.clickCell(3, 3);
  assert.deepEqual(g.S.balls.map(b => [b.x, b.y]), [[1, 3], [5, 3]]);
  assert.equal(g.takeEvents().filter(e => e.t === 'clash').length, 2);
});

test('gravedad: con el centro ocupado se paran al lado; la de detrás se acerca también', () => {
  const g = level({ ball: { x: 3, y: 5 }, extraBalls: [{ x: 3, y: 3 }, { x: 3, y: 4 }] });
  // brazo de abajo: (3,4) y (3,5); el centro (3,3) está ocupado: nadie se mueve en ese brazo
  play(g, 'gravedad');
  g.clickCell(3, 3);
  assert.deepEqual(g.S.balls.map(b => [b.x, b.y]), [[3, 5], [3, 3], [3, 4]]);
  const g2 = level({ ball: { x: 5, y: 3 }, extraBalls: [{ x: 3, y: 3 }] });
  play(g2, 'gravedad');
  g2.clickCell(3, 3);
  assert.deepEqual([g2.S.balls[0].x, g2.S.balls[0].y], [4, 3], 'se para pegada al centro');
});

test('gravedad naranja: en el hoyo, la pelota de al lado entra (y vale en el JAQUE de otro)', () => {
  const g = level({ ball: { x: 2, y: 2 }, hole: { x: 2, y: 1 } });
  play(g, 'oGravedad');
  assert.equal(g.pending.r, 1);
  g.clickCell(2, 1);
  assert.ok(g.S.balls[0].holed);
  assert.deepEqual(g.S.winners, [0]);
  // con la cruz de 1, lo que está a 2 no se mueve
  const g2 = level({ ball: { x: 2, y: 3 }, hole: { x: 2, y: 1 } });
  play(g2, 'oGravedad');
  g2.clickCell(2, 1);
  assert.deepEqual([g2.S.balls[0].x, g2.S.balls[0].y], [2, 3]);
});

test('meteoritos: caen en la mitad de las casillas; la copia alcanzada se va y la original vuelve a su salida', () => {
  const g = level({ tiles: [BH(3, 3)] });
  shoot(g, 'right', 'palo3');
  g.takeEvents();
  g.S.blackPlayed = 0;
  const before = g.S.balls.map(b => ({ id: b.player, x: b.x, y: b.y, copy: !!b.copy }));
  play(g, 'meteoritos');
  const evs = g.takeEvents(), hits = evs.filter(e => e.t === 'meteor');
  assert.equal(hits.length, Math.round(49 / 2));
  assert.equal(new Set(hits.map(e => e.x + ',' + e.y)).size, hits.length, 'cada una, una vez');
  for (const b0 of before) {
    const hit = hits.find(e => e.x === b0.x && e.y === b0.y), now = g.S.balls.find(b => b.player === b0.id);
    if (!hit) continue;
    if (b0.copy) assert.ok(!now, 'la copia alcanzada desaparece');
    else assert.deepEqual([now.x, now.y], [now.spawnX, now.spawnY], 'la original, a su salida');
  }
  assert.ok(g.S.discard.includes('meteoritos'));
});

test('guardar y continuar con copias en el tablero (y la carta NO las deshace)', () => {
  const g = level({ tiles: [BH(3, 3)] });
  shoot(g, 'right', 'palo3');
  const g2 = Game.restore(JSON.parse(JSON.stringify(g.serialize())));
  assert.deepEqual(balls(g2), balls(g));
  g2.S.blackPlayed = 0;
  play(g2, 'palo1');
  assert.equal(g2.pending.kind, 'pickOwn');
  const g3 = Game.restore(JSON.parse(JSON.stringify(g2.serialize())));
  assert.equal(g3.pending.kind, 'pickOwn', 'también a medio elegir');
  // NO: vuelve al tablero de antes del palo (una sola pelota)
  const g4 = level({ tiles: [BH(3, 3)] });
  g4.S.hands[0] = ['palo3', 'no'];
  g4.clickCard(0, 0); g4.clickCell(3, 3);
  g4.S.hands[0] = ['no']; g4.clickCard(0, 0);
  assert.equal(g4.S.balls.length, 1);
});

test('bots: las partidas con la baraja terminan (copias, gravedad y meteoritos incluidos)', async () => {
  const { simulateGame } = await import('../src/ai/autoplay.js');
  const { PLAYER_COLORS } = await import('../src/engine/game.js');
  const { mulberry32 } = await import('../src/engine/rng.js');
  const dk = deckById('multiverse'), rand = mulberry32(5);
  let copies = 0;
  for (let i = 0; i < 12; i++) {
    const g = Game.pve({ players: 3, cols: 9, rows: 9, par: 3, humanColor: PLAYER_COLORS[0], counts: dk.counts(defaultCounts()), startWith: dk.newCards }, { seed: 100 + i });
    g.S.human = -1; g.S.aiStyles = g.S.aiStyles.map(s => s || 'trick');
    const emit = g.emit.bind(g); g.emit = g.anim = ev => { if (ev.t === 'clone') copies++; emit(ev); };
    const r = simulateGame(g, { rand });
    assert.ok(r.finished, 'partida ' + i + ' terminada');
    assert.ok(g.S.balls.every(b => b.x >= 0 && b.y >= 0 && b.x < g.S.cols && b.y < g.S.rows), 'ninguna pelota fuera');
    const cells = g.S.balls.filter(b => !b.holed).map(b => b.x + ',' + b.y);
    assert.equal(new Set(cells).size, cells.length, 'nunca dos pelotas en la misma casilla');
  }
  assert.ok(copies > 0, 'los bots usan los agujeros negros');
});

test('meteoritos: cada lluvia deja una roca en una casilla vacía (nunca en una salida) que hace de muro', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const g = level({ seed });
    play(g, 'meteoritos');
    const rocks = g.S.tiles.filter(tl => tl.type === 'meteorite');
    assert.equal(rocks.length, 1, 'una roca por lluvia');
    const r = rocks[0], evs = g.takeEvents();
    assert.ok(evs.some(e => e.t === 'meteorRock' && e.x === r.x && e.y === r.y));
    assert.ok(evs.some(e => e.t === 'meteor' && e.x === r.x && e.y === r.y), 'donde ha caído uno');
    assert.ok(!(r.x === 0 && r.y === 3) && !(r.x === 6 && r.y === 0), 'ni en la salida ni en la casilla inicial del hoyo');
    assert.ok(!g.S.balls.some(b => b.x === r.x && b.y === r.y));
  }
  // y rebota como el bloque
  const g = level({ tiles: [{ type: 'meteorite', x: 3, y: 3 }] });
  shoot(g, 'right', 'palo3'); // (1,3), (2,3), choca con la roca y vuelve a (1,3)
  assert.deepEqual([g.S.balls[0].x, g.S.balls[0].y], [1, 3]);
  assert.ok(g.takeEvents().some(e => e.t === 'bump'));
});

test('gravedad: lo que no puede moverse (otra pelota delante o un muro) se queda y lo dice', () => {
  const g = level({ ball: { x: 3, y: 5 }, tiles: [{ type: 'meteorite', x: 3, y: 4 }] });
  play(g, 'gravedad');
  g.clickCell(3, 3);
  assert.deepEqual([g.S.balls[0].x, g.S.balls[0].y], [3, 5], 'la roca no la deja pasar');
  assert.ok(g.takeEvents().some(e => e.t === 'gstuck' && e.p === 'b0' && e.dir === 'up'));
  const g2 = level({ ball: { x: 1, y: 3 }, hole: { x: 6, y: 0 } });
  play(g2, 'gravedad');
  g2.clickCell(3, 3);
  const evs = g2.takeEvents();
  assert.ok(evs.some(e => e.t === 'gpull' && e.p === 'b0'), 'lo que se mueve, atraído');
  assert.deepEqual([g2.S.balls[0].x, g2.S.balls[0].y], [3, 3]);
});

test('agujero negro: una sola carta en la baraja (como mucho uno por partida)', () => {
  assert.equal(deckById('multiverse').counts(defaultCounts()).agujeroNegro, 1);
});

test('el hoyo también se multiplica al pasar junto al agujero negro; una pelota en cualquiera de ellos gana', () => {
  const g = level({ tiles: [BH(3, 3)], hole: { x: 3, y: 0 }, ball: { x: 0, y: 6 } });
  play(g, 'hoyoDown'); // (3,1), (3,2) pegado al agujero: le quedan 0 → salen 4 hoyos a 1 casilla
  const holes = g.allHoles().map(h => [h.x, h.y]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  assert.deepEqual(holes, [[2, 3], [3, 2], [3, 4], [4, 3]], 'el de siempre sigue (abajo) y 3 copias');
  assert.deepEqual([g.S.hole.x, g.S.hole.y], [3, 4]);
  assert.equal(g.S.holeCopies.length, 3);
  assert.ok(g.S.holeCopies.every(c => c.copy && /^hole\d+$/.test(c.id)));
  const evs = g.takeEvents();
  assert.ok(evs.some(e => e.t === 'absorb' && e.p === 'hole') && evs.filter(e => e.t === 'clone' && e.p.startsWith('hole')).length === 3);
  // una pelota que entra en una copia gana
  g.S.balls[0].x = 0; g.S.balls[0].y = 3; g.S.blackPlayed = 0;
  shoot(g, 'right', 'palo2'); // (1,3), (2,3): copia del hoyo
  assert.ok(g.S.balls[0].holed);
  assert.deepEqual(g.S.winners, [0]);
});

test('copias del hoyo: las cartas de hoyo preguntan cuál; la copia que se sale del tablero desaparece', () => {
  const g = level({ tiles: [BH(3, 3)], hole: { x: 3, y: 0 }, ball: { x: 0, y: 6 } });
  play(g, 'hoyoDown');
  g.S.blackPlayed = 0;
  play(g, 'hoyoLeft');
  assert.equal(g.pending.kind, 'pickHole');
  assert.ok(!g.clickCell(0, 0), 'una casilla sin hoyo no vale');
  const c = g.S.holeCopies.find(h => h.x === 2 && h.y === 3);
  assert.equal(g.selectableAt(2, 3), 'sel');
  assert.ok(g.clickCell(2, 3)); // (2,3) → (1,3), (0,3)
  assert.deepEqual([c.x, c.y], [0, 3]);
  g.S.blackPlayed = 0;
  play(g, 'hoyoLeft');
  g.clickCell(0, 3); // fuera del tablero: se va
  assert.ok(!g.S.holeCopies.includes(c));
  assert.ok(g.takeEvents().some(e => e.t === 'vanish' && e.p === c.id));
  // guardar y continuar con copias del hoyo
  const g2 = Game.restore(JSON.parse(JSON.stringify(g.serialize())));
  assert.equal(g2.S.holeCopies.length, 2);
  assert.ok(g2.isHole(g2.S.holeCopies[0].x, g2.S.holeCopies[0].y));
});

test('gravedad: no se puede usar encima de un agujero negro; sí atrae copias del hoyo', () => {
  const g = level({ tiles: [BH(3, 3)] });
  play(g, 'gravedad');
  assert.equal(g.selectableAt(3, 3), null);
  assert.ok(!g.clickCell(3, 3));
  assert.equal(g.pending.kind, 'gravity', 'sigue esperando otra casilla');
  const g2 = level({ tiles: [BH(3, 3)], hole: { x: 3, y: 0 }, ball: { x: 0, y: 6 } });
  play(g2, 'hoyoDown');
  const c = g2.S.holeCopies.find(h => h.x === 4 && h.y === 3);
  g2.S.blackPlayed = 0;
  play(g2, 'gravedad');
  g2.clickCell(6, 3); // la copia de (4,3) va hacia (6,3)
  assert.deepEqual([c.x, c.y], [6, 3]);
});

test('meteoritos: también destruyen las copias del hoyo que alcanzan (al hoyo de siempre, nada)', () => {
  let checked = 0;
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const g = level({ tiles: [BH(3, 3)], hole: { x: 3, y: 0 }, ball: { x: 0, y: 6 }, seed });
    play(g, 'hoyoDown');
    const before = g.S.holeCopies.map(h => ({ h, x: h.x, y: h.y })), main = [g.S.hole.x, g.S.hole.y];
    g.takeEvents(); g.S.blackPlayed = 0;
    play(g, 'meteoritos');
    const hits = g.takeEvents().filter(e => e.t === 'meteor');
    for (const c of before) {
      const hit = hits.some(e => e.x === c.x && e.y === c.y);
      assert.equal(g.S.holeCopies.includes(c.h), !hit, 'la copia alcanzada se va; la que no, se queda');
      if (hit) checked++;
    }
    assert.deepEqual([g.S.hole.x, g.S.hole.y], main, 'el hoyo de siempre no se mueve');
  }
  assert.ok(checked > 0, 'algún meteorito ha dado a una copia');
});

test('dedo: si la pelota que mueve desaparece por una cadena de choques, el dedo se acaba (sin quedarse colgado)', () => {
  // la copia que mueve el dedo choca con otra pelota en el borde de arriba: esa pasa junto al agujero negro y una de
  // sus copias vuelve hacia atrás… pase lo que pase, el dedo nunca se queda con una pelota que ya no está
  for (let seed = 1; seed <= 30; seed++) {
    const g = level({ seed, tiles: [BH(3, 1)], ball: { x: 3, y: 4 }, extraBalls: [{ x: 3, y: 3 }] });
    g.S.hands[0] = ['dedo']; g.clickCard(0, 0); g.chooseAmount(3);
    for (let k = 0; k < 6 && g.pending?.kind === 'serpent'; k++) {
      const tg = g.serpentTargets()[seed % 4] || g.serpentTargets()[0];
      g.clickCell(tg.x, tg.y);
      if (g.pending) assert.ok(g.S.balls.includes(g.pending.ball), 'la pelota del dedo sigue en el tablero');
    }
  }
});
