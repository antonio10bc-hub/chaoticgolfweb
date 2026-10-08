// Baraja del Gambling: el suelo ajedrezado con la casilla dorada, las monedas (cara o cruz), el dado y la ruleta.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/engine/game.js';
import { WHEEL, COINS_PER_PLAYER, rollFaces } from '../src/engine/gambling.js';
import { DECKS, deckById, deckSize, PVE_SIZES } from '../src/content/decks.js';
import { CARDS, defaultCounts } from '../src/content/cards/index.js';
import { choosePlan, enumeratePlays } from '../src/ai/bot.js';

// nivel de 7×5 con la pelota en (1,2), su salida en (0,4) y el hoyo arriba a la derecha
function level({ tiles = [], ball = { x: 1, y: 2 }, spawn = { x: 0, y: 4 }, hole = { x: 6, y: 0 }, coins = [], gold = null, extraBalls = [], seed = 1 } = {}) {
  const g = Game.fromLevel({ cols: 7, rows: 5, hole, ball, parCells: [], tiles, deckCounts: { palo1: 6 }, hand: ['palo1'], extraBalls, gamble: { gold, coins } }, { seed });
  g.S.balls[0].spawnX = spawn.x; g.S.balls[0].spawnY = spawn.y;
  g.takeEvents();
  return g;
}
const DICE = (x, y, t = 2, n = 3, e = 1) => ({ type: 'dice', id: 1, x, y, t, n, e });
const play = (g, card, p = 0) => { g.S.hands[p] = [card]; assert.ok(g.clickCard(p, 0), 'carta jugable: ' + card); };
const shoot = (g, dir, card = 'palo3', p = 0) => {
  play(g, card, p);
  const tg = g.pending.targets.find(q => q.dir === dir);
  assert.ok(g.clickCell(tg.x, tg.y));
};
const at = (g, p = 0) => { const b = g.S.balls.find(q => q.player === p); return [b.x, b.y]; };
// una semilla con la que la primera moneda sale cara (o cruz)
function seedFor(side) {
  for (let seed = 1; seed < 200; seed++) {
    const g = level({ coins: [{ x: 2, y: 2 }], seed });
    shoot(g, 'right', 'palo2');
    if (g.takeEvents().some(e => e.t === 'coinFlip' && e.side === side)) return seed;
  }
  throw new Error('sin semilla');
}

test('la baraja: sin búnkeres ni portales, 2 dados y 2 ruletas (y en Ultimate)', () => {
  const dk = deckById('gambling'), c = dk.counts(defaultCounts());
  assert.equal(c.bunker, 0); assert.equal(c.portal, 0);
  assert.deepEqual([c.dado, c.ruleta], [2, 2]);
  assert.equal(CARDS.dado.color, 'black'); assert.equal(CARDS.ruleta.color, 'orange');
  for (const k of dk.newCards) assert.equal(defaultCounts()[k], 0, 'fuera de su baraja no hay ' + k);
  assert.ok(!dk.noUltimate);
  assert.equal(DECKS[DECKS.length - 1].id, 'ultimate', 'Ultimate, siempre la última');
});

test('al empezar: 3 monedas por jugador en casillas vacías y una casilla dorada lejos de las salidas', () => {
  const dk = deckById('gambling'), sz = deckSize(dk, PVE_SIZES.m);
  for (const players of [2, 3, 4]) for (let seed = 1; seed <= 25; seed++) {
    const g = Game.pve({ players, ...sz, humanColor: '#f26d6d', counts: dk.counts(defaultCounts()), startWith: dk.newCards, gambling: true }, { seed }), S = g.S;
    assert.equal(S.gamble.coins.length, COINS_PER_PLAYER * players);
    const keys = S.gamble.coins.map(c => c.x + ',' + c.y);
    assert.equal(new Set(keys).size, keys.length, 'cada moneda en su casilla');
    const { gold } = S.gamble;
    assert.ok(gold && !keys.includes(gold.x + ',' + gold.y), 'la dorada, sin moneda');
    for (const c of [...S.gamble.coins, gold]) {
      assert.ok(!g.ballAt(c.x, c.y) && !g.isHole(c.x, c.y) && !g.parAt(c.x, c.y), 'en una casilla vacía');
      assert.ok(!(c.x === S.hole.initX && c.y === S.hole.initY));
    }
    for (const b of S.balls) assert.ok(Math.abs(gold.x - b.spawnX) + Math.abs(gold.y - b.spawnY) >= 3, 'la dorada, lejos de las salidas');
    assert.ok(gold.x > 0 && gold.x < S.cols - 1, 'ni en los bordes de los lados');
    // misma semilla, mismo campo; y el mazo sale igual que sin casino
    assert.deepEqual(Game.pve({ players, ...sz, humanColor: '#f26d6d', counts: dk.counts(defaultCounts()), gambling: true }, { seed }).S.deck,
      Game.pve({ players, ...sz, humanColor: '#f26d6d', counts: dk.counts(defaultCounts()) }, { seed }).S.deck);
  }
});

test('suelo ajedrezado: rojo si x + y es par, negro si es impar; la dorada no es de ningún color', () => {
  const g = level({ gold: { x: 3, y: 1 } });
  assert.equal(g.cellColor(0, 0), 'red'); assert.equal(g.cellColor(1, 0), 'black'); assert.equal(g.cellColor(2, 2), 'red');
  assert.equal(g.cellColor(3, 1), 'gold');
});

test('moneda, cara: al acabar la jugada se vuelve a elegir, como si se jugara otra vez la carta (sin gastar ninguna)', () => {
  const g = level({ coins: [{ x: 2, y: 2 }], seed: seedFor('heads') });
  shoot(g, 'right', 'palo2');
  assert.deepEqual(at(g), [3, 2]);
  const pd = g.pending;
  assert.ok(pd?.bonus && pd.kind === 'move' && pd.n === 2 && pd.p === 0, 'un palo 2 de regalo');
  assert.deepEqual(pd.targets.map(q => q.dir).sort(), ['down', 'left', 'right', 'up']);
  const hand = [...g.S.hands[0]];
  const tg = pd.targets.find(q => q.dir === 'up');
  assert.ok(g.clickCell(tg.x, tg.y));
  assert.deepEqual(at(g), [3, 0]);
  assert.deepEqual(g.S.hands[0], hand, 'no gasta carta');
  assert.equal(g.S.gamble.coins.length, 1, 'la moneda sigue en el tablero…');
  assert.notDeepEqual([g.S.gamble.coins[0].x, g.S.gamble.coins[0].y], [2, 2], '…en otra casilla');
  const ev = g.takeEvents().map(e => e.t);
  assert.ok(ev.indexOf('coinPick') < ev.indexOf('coinFlip') && ev.includes('coinDrop'));
});

test('moneda, cara: se puede renunciar (cancelar) y la jugada se da por acabada', () => {
  const g = level({ coins: [{ x: 2, y: 2 }], seed: seedFor('heads') });
  shoot(g, 'right', 'palo2');
  assert.ok(g.pending?.bonus);
  assert.ok(g.cancel());
  assert.equal(g.pending, null); assert.deepEqual(at(g), [3, 2]);
});

test('moneda, cruz: vuelve a su salida (como si se cayera del tablero)', () => {
  const g = level({ coins: [{ x: 2, y: 2 }], seed: seedFor('tails') });
  shoot(g, 'right', 'palo2');
  assert.deepEqual(at(g), [0, 4]);
  assert.ok(g.takeEvents().some(e => e.t === 'goHome' && e.why === 'coin'));
});

test('moneda con el dedo: con cara, otra vez el dedo (cuántos pasos y el camino)', () => {
  const g = level({ coins: [{ x: 2, y: 2 }], seed: seedFor('heads') });
  play(g, 'dedo'); g.chooseAmount(2); g.serpentStep('right'); g.serpentStep('up');
  assert.deepEqual(at(g), [2, 1]);
  assert.ok(g.pending?.bonus && g.pending.kind === 'dedoAmount');
  g.chooseAmount(1); g.serpentStep('up');
  assert.deepEqual(at(g), [2, 0]); assert.equal(g.pending, null);
});

test('moneda del hoyo: el hoyo también las recoge; cara, quien lo movió lo mueve otra vez; cruz, a su casilla inicial', () => {
  const pick = side => { for (let seed = 1; seed < 300; seed++) {
    const g = level({ coins: [{ x: 6, y: 1 }], seed });
    play(g, 'hoyoDown');
    if (g.takeEvents().some(e => e.t === 'coinFlip' && e.p === 'hole' && e.side === side)) return seed;
  } };
  let g = level({ coins: [{ x: 6, y: 1 }], seed: pick('heads') });
  play(g, 'hoyoDown');
  assert.ok(g.pending?.bonus && g.pending.kind === 'holeMove' && g.pending.p === 0 && g.pending.dist === 2);
  const tg = g.pending.targets.find(q => q.dir === 'left');
  assert.ok(g.selectableAt(tg.x, tg.y));
  g.clickCell(tg.x, tg.y);
  assert.deepEqual([g.S.hole.x, g.S.hole.y], [4, 2]);
  g = level({ coins: [{ x: 6, y: 1 }], seed: pick('tails') });
  play(g, 'hoyoDown');
  assert.deepEqual([g.S.hole.x, g.S.hole.y], [6, 0], 'cruz: a su casilla inicial');
});

test('moneda: la golpeada que pasa por encima también se la lleva; y la que acaba en el hoyo no la lanza', () => {
  let g = level({ coins: [{ x: 4, y: 2 }], extraBalls: [], seed: seedFor('heads') });
  g.S.balls.push({ player: 1, x: 2, y: 2, spawnX: 2, spawnY: 4, holed: false }); g.S.hands.push([]); g.S.nPlayers = 2;
  shoot(g, 'right', 'palo3'); // (choca enseguida: la golpeada recibe los 3 pasos)
  assert.ok(g.takeEvents().some(e => e.t === 'coinPick' && e.p === 'b1'));
  g = level({ coins: [{ x: 5, y: 0 }], ball: { x: 3, y: 0 }, seed: 2 });
  shoot(g, 'right', 'palo3');
  assert.ok(g.S.winner === 0 && g.S.balls[0].holed);
  assert.ok(!g.takeEvents().some(e => e.t === 'coinFlip'), 'dentro del hoyo no se lanza');
});

test('dado: rebota tantas casillas como marca (no las que le quedaban) y rueda una hacia el otro lado con otra cara', () => {
  const g = level({ tiles: [DICE(4, 2, 2, 3, 1)] });
  shoot(g, 'right', 'palo3'); // (llega con 1 paso y marca 2: rebota 2)
  assert.deepEqual(at(g), [1, 2]);
  const d = g.S.tiles[0];
  assert.deepEqual([d.x, d.y], [5, 2], 'ha rodado hacia la derecha');
  assert.deepEqual([d.t, d.n, d.e], [6, 3, 2], 'tumbado hacia el este: arriba queda la cara del oeste (7 − 1)');
  assert.ok(g.takeEvents().some(e => e.t === 'bump' && e.dice === 2));
});

test('dado: rebotar más casillas de las que hay te saca del tablero; contra el borde da la vuelta en su sitio', () => {
  let g = level({ tiles: [DICE(3, 2, 5)] });
  shoot(g, 'right', 'palo3');
  assert.deepEqual(at(g), [0, 4], 'se ha caído: a su salida');
  g = level({ tiles: [DICE(6, 2, 1, 2, 3)], ball: { x: 4, y: 2 } });
  shoot(g, 'right', 'palo3');
  const d = g.S.tiles[0];
  assert.deepEqual([d.x, d.y, d.t], [6, 2, 4], 'no puede rodar: se queda y cambia de cara');
  assert.deepEqual(at(g), [4, 2], 'de (5,2) rebota 1');
});

test('dado: entre dos dados la pelota no rebota para siempre', () => {
  const g = level({ tiles: [{ type: 'dice', id: 1, x: 0, y: 2, t: 6, n: 2, e: 3 }, { type: 'dice', id: 2, x: 6, y: 2, t: 6, n: 2, e: 3 }], ball: { x: 3, y: 2 } });
  g.S.tiles.forEach(d => { d.x = d.id === 1 ? 0 : 6; }); // (pegados al borde: no pueden rodar fuera)
  shoot(g, 'right', 'palo3');
  assert.equal(g.pending, null);
  assert.ok(g.takeEvents().filter(e => e.t === 'diceRoll').length <= 8);
});

test('dado: las caras siguen siendo las de un dado (opuestas suman 7) por mucho que ruede', () => {
  let d = { t: 1, n: 2, e: 3 };
  for (const dir of ['up', 'right', 'down', 'down', 'left', 'up', 'right', 'right']) {
    d = rollFaces(d, dir);
    assert.equal(new Set([d.t, d.n, d.e, 7 - d.t, 7 - d.n, 7 - d.e]).size, 6);
  }
  assert.deepEqual(rollFaces(rollFaces({ t: 1, n: 2, e: 3 }, 'up'), 'down'), { t: 1, n: 2, e: 3 }, 'ida y vuelta, la misma cara');
});

test('dado: el dedo contra un dado rebota en línea recta y se acaba; el hoyo también rebota', () => {
  let g = level({ tiles: [DICE(2, 2, 1)] });
  play(g, 'dedo'); g.chooseAmount(3); g.serpentStep('right');
  assert.equal(g.pending, null, 'el dedo se acaba');
  assert.deepEqual(at(g), [0, 2]);
  g = level({ tiles: [DICE(6, 2, 2)], hole: { x: 6, y: 0 } });
  play(g, 'hoyoDown');
  assert.deepEqual([g.S.hole.x, g.S.hole.y], [6, 0], 'baja 1, choca y rebota 2… hasta donde estaba');
});

test('dado: se pone en una casilla vacía (nunca encima de una moneda ni de la casilla dorada)', () => {
  const g = level({ coins: [{ x: 3, y: 3 }], gold: { x: 4, y: 3 } });
  play(g, 'dado');
  assert.ok(!g.selectableAt(3, 3) && !g.selectableAt(4, 3) && !g.selectableAt(1, 2) && g.selectableAt(3, 1));
  g.clickCell(3, 1);
  const d = g.S.tiles.find(q => q.type === 'dice');
  assert.ok(d && d.t >= 1 && d.t <= 6 && d.n !== d.t && d.n !== 7 - d.t);
});

test('ruleta: rojo o negro, las pelotas en casillas de ese color vuelven a su salida', () => {
  const g = level({ ball: { x: 3, y: 2 } }); // (3+2: negra)
  g.S.balls.push({ player: 1, x: 2, y: 2, spawnX: 2, spawnY: 4, holed: false }); g.S.hands.push([]); g.S.nPlayers = 2; // (roja)
  g._forceSpin = WHEEL.indexOf('red');
  play(g, 'ruleta');
  assert.deepEqual(at(g), [3, 2], 'la de la negra no se mueve');
  assert.deepEqual(at(g, 1), [2, 4], 'la de la roja, a su salida');
  g._forceSpin = WHEEL.indexOf('black');
  play(g, 'ruleta');
  assert.deepEqual(at(g), [0, 4]);
});

test('ruleta, dorado: la pelota de la casilla dorada gana directamente (sin JAQUE); sin nadie, no pasa nada', () => {
  let g = level({ ball: { x: 3, y: 1 }, gold: { x: 3, y: 1 } });
  g._forceSpin = WHEEL.indexOf('gold');
  play(g, 'ruleta');
  assert.equal(g.S.winner, 0); assert.equal(g.S.jaque, false); assert.ok(g.S.goldWin);
  const ev = g.takeEvents().map(e => e.t);
  assert.ok(ev.includes('goldWin') && ev.includes('win'));
  assert.ok(!g.canPlay(0, 'no'), 'ya no se puede reaccionar');
  g = level({ gold: { x: 3, y: 1 } });
  g._forceSpin = WHEEL.indexOf('gold');
  play(g, 'ruleta');
  assert.equal(g.S.winner, null);
  assert.deepEqual(at(g), [1, 2]);
});

test('ruleta en el JAQUE: es naranja; las pelotas que están dentro del hoyo no salen, pero el dorado se lo lleva', () => {
  const g = level({ ball: { x: 5, y: 0 }, gold: { x: 1, y: 1 } });
  g.S.balls.push({ player: 1, x: 1, y: 1, spawnX: 1, spawnY: 4, holed: false }); g.S.hands.push([]); g.S.nPlayers = 2;
  shoot(g, 'right', 'palo1');
  assert.ok(g.S.jaque && g.S.winner === 0);
  g._forceSpin = WHEEL.indexOf('red');
  play(g, 'ruleta', 1);
  assert.ok(g.S.jaque && g.S.winner === 0, 'la de dentro del hoyo sigue ganando');
  g._forceSpin = WHEEL.indexOf('gold');
  play(g, 'ruleta', 1);
  assert.deepEqual(g.S.winners, [1]); assert.ok(g.S.goldWin && !g.S.jaque);
});

test('la carta NO deshace la jugada (y las monedas vuelven a su sitio)', () => {
  const g = level({ coins: [{ x: 2, y: 2 }], seed: seedFor('tails') });
  shoot(g, 'right', 'palo2');
  assert.notDeepEqual(g.S.gamble.coins, [{ x: 2, y: 2 }]);
  play(g, 'no');
  assert.deepEqual(at(g), [1, 2]); assert.deepEqual(g.S.gamble.coins, [{ x: 2, y: 2 }]);
});

test('ruleta, dorado con el hoyo en la casilla dorada: gana el hoyo y pierde todo el mundo', () => {
  const g = level({ hole: { x: 3, y: 1 }, gold: { x: 3, y: 1 } });
  g._forceSpin = WHEEL.indexOf('gold');
  play(g, 'ruleta');
  assert.equal(g.S.winner, -1); assert.deepEqual(g.S.winners, []); assert.ok(g.S.holeWin && !g.S.jaque);
  assert.ok(g.takeEvents().some(e => e.t === 'win'));
});

test('dado: al acabar cada turno cambia de número', () => {
  const g = level({ tiles: [DICE(4, 3, 2, 3, 1)] });
  g.S.balls.push({ player: 1, x: 2, y: 4, spawnX: 2, spawnY: 4, holed: false }); g.S.hands.push(['palo1', 'palo1']); g.S.nPlayers = 2;
  for (let k = 0; k < 6; k++) {
    const before = g.S.tiles[0].t;
    g.endTurn();
    const d = g.S.tiles[0];
    assert.notEqual(d.t, before); assert.deepEqual([d.x, d.y], [4, 3], 'en su sitio');
    assert.ok(g.takeEvents().some(e => e.t === 'diceTurn'));
  }
});

test('IA: elige bien su tirada extra (cara): mete la pelota si puede', async () => {
  const { chooseBonus } = await import('../src/ai/bot.js');
  const g = level({ ball: { x: 6, y: 3 }, hole: { x: 6, y: 1 } });
  g.pending = { kind: 'move', p: 0, n: 2, ball: g.S.balls[0], targets: g.straightTargets(g.S.balls[0], 2), bonus: true };
  const b = chooseBonus(g, 0, () => .5);
  assert.deepEqual(b.actions, [['cell', 6, 1]]);
});

test('IA: valora la ruleta por sus tres resultados; en la casilla dorada con la ruleta en la mano, la gira', () => {
  const g = level({ ball: { x: 3, y: 1 }, gold: { x: 3, y: 1 } });
  g.S.hands[0] = ['ruleta', 'palo1'];
  const pl = enumeratePlays(g, 0).find(q => q.key === 'ruleta');
  assert.equal(pl.odds.length, 3);
  assert.ok(Math.abs(pl.odds.reduce((s, o) => s + o.p, 0) - 1) < 1e-9);
  assert.equal(choosePlan(g, 0, () => .5)?.key, 'ruleta');
});

test('partidas de bots con la baraja: terminan y usan sus cartas y sus monedas', async () => {
  const { simulateGame } = await import('../src/ai/autoplay.js');
  const dk = deckById('gambling'), sz = deckSize(dk, PVE_SIZES.m);
  let ended = 0, coins = 0, spins = 0, dice = 0;
  for (let seed = 1; seed <= 12; seed++) {
    const g = Game.pve({ players: 3, ...sz, humanColor: '#f26d6d', counts: dk.counts(defaultCounts()), startWith: dk.newCards, gambling: true }, { seed });
    let s = seed;
    const r = simulateGame(g, { maxTurns: 300, rand: () => (s = (s * 16807) % 2147483647) / 2147483647 });
    if (r.finished) ended++;
    assert.equal(g.S.gamble.coins.length, 9, 'las monedas no se gastan: cambian de casilla');
    coins += g.S.logK.filter(k => k[0] === 'coinPick' || k[0] === 'holeCoinPick').length; spins += r.cards.ruleta || 0; dice += r.cards.dado || 0;
  }
  assert.equal(ended, 12);
  assert.ok(coins > 0 && spins > 0 && dice > 0, `monedas ${coins}, ruletas ${spins}, dados ${dice}`);
});
