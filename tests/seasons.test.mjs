// Baraja de las estaciones: viento, plantas, fuego, hojas y lluvia, hielo, la bola de nieve y el cambio de estación.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/engine/game.js';
import { windRoute, SEASONS, nextSeason, FIRE_MAX, START_LEAVES } from '../src/engine/seasons.js';
import { mulberry32 } from '../src/engine/rng.js';
import { DECKS, deckById, deckSize } from '../src/content/decks.js';
import { defaultCounts } from '../src/content/cards/index.js';
import { simulateGame } from '../src/ai/autoplay.js';
import { packLevel, unpackLevel } from '../src/content/levels/share.js';

// nivel de 7×7 con la pelota en (1,5) (su salida) y el hoyo en (5,1)
function level(now, { tiles = [], ball = { x: 1, y: 5 }, hole = { x: 5, y: 1 }, snow = null, hand = ['palo3'], extraBalls = [] } = {}) {
  const g = Game.fromLevel({ cols: 7, rows: 7, hole, ball, parCells: [], tiles, deckCounts: { palo1: 6 }, hand, extraBalls, season: { now, snow } }, { seed: 1 });
  g.takeEvents();
  return g;
}
const shoot = (g, dir, card = 'palo3', p = 0) => {
  g.S.hands[p] = [card];
  assert.ok(g.clickCard(p, 0), 'carta jugable');
  const tg = g.pending.targets.find(q => q.dir === dir);
  assert.ok(g.clickCell(tg.x, tg.y));
};
const at = (o, x, y) => o.x === x && o.y === y;

test('la baraja: una tarjeta, sin búnkeres ni portales, con sus cartas (fuera del Ultimate fijo de Caos total; en el combinador, sí)', () => {
  const dk = deckById('seasons'), c = dk.counts(defaultCounts());
  assert.equal(c.bunker, 0); assert.equal(c.portal, 0);
  assert.deepEqual([c.estacion, c.incendio, c.oNieve], [4, 1, 3]);
  assert.equal(c.charco, undefined, 'sin carta de charco / hielo / planta: llegan solos');
  for (const k of ['estacion', 'incendio', 'oNieve']) assert.equal(defaultCounts()[k], 0, 'fuera de su baraja no hay ' + k);
  const ult = deckById('ultimate').counts(defaultCounts());
  for (const k of ['estacion', 'incendio', 'oNieve']) assert.ok(!ult[k], 'el Ultimate fijo no lleva ' + k);
  assert.equal(DECKS[DECKS.length - 1].id, 'ultimate');
  assert.equal(DECKS[DECKS.findIndex(d => d.id === 'seasons') + 1].id, 'multiverse', 'la siguiente baraja, detrás');
});

test('partida rápida: estación al azar (con su RNG: el mazo sale igual) y lo que trae al llegar', () => {
  const dk = deckById('seasons'), counts = dk.counts(defaultCounts());
  const cfg = { players: 3, ...deckSize(dk, { cols: 7, rows: 9, par: 3 }), counts, humanColor: '#f26d6d' };
  const seen = new Set();
  for (let seed = 1; seed <= 40; seed++) {
    const a = Game.pve({ ...cfg, seasons: true }, { seed }), b = Game.pve(cfg, { seed });
    assert.deepEqual(a.S.deck, b.S.deck, 'las estaciones no gastan el azar del mazo');
    const S = a.S, now = S.season.now;
    seen.add(now);
    if (now === 'autumn') assert.equal(S.tiles.filter(t => t.type === 'leaf').length, START_LEAVES, '6 hojas secas');
    if (now === 'winter') assert.ok(S.season.snow, 'bola de nieve');
    if (now === 'spring') assert.equal(S.season.wind, null, 'primer turno: en calma');
    for (const t of S.tiles) assert.ok(!a.isSpawnCell(t.x, t.y) && !a.isHoleHome(t.x, t.y), 'nada en salidas ni en la casilla del hoyo');
  }
  assert.equal(seen.size, 4, 'salen las cuatro');
});

test('ruta del viento: de borde a borde, casillas vecinas y sin repetir', () => {
  for (const [C, R] of [[9, 9], [7, 7], [11, 13]]) for (let s = 1; s <= 80; s++) {
    const p = windRoute(C, R, mulberry32(s));
    assert.ok(p && p.length >= Math.min(C, R));
    const [a, b] = [p[0], p[p.length - 1]];
    const edge = ([x, y]) => x === 0 || y === 0 || x === C - 1 || y === R - 1;
    assert.ok(edge(a) && edge(b), 'empieza y acaba en el borde');
    assert.ok(a[0] === 0 && b[0] === C - 1 || b[0] === 0 && a[0] === C - 1 || a[1] === 0 && b[1] === R - 1 || b[1] === 0 && a[1] === R - 1, 'de un lado al de enfrente');
    assert.equal(new Set(p.map(q => q.join())).size, p.length, 'sin repetir casilla');
    for (let i = 1; i < p.length; i++) assert.equal(Math.abs(p[i][0] - p[i - 1][0]) + Math.abs(p[i][1] - p[i - 1][1]), 1, 'vecinas');
  }
});

test('viento: ciclos de tres turnos (calma, aviso, sopla); echa del tablero lo que hay dentro y lo que cae en él', () => {
  const g = level('spring');
  assert.equal(g.S.season.wind, null, 'empieza en calma');
  g.endTurn();
  assert.ok(g.S.season.wind && !g.S.season.wind.on, 'segundo turno: aviso');
  const path = [[0, 3], [1, 3], [2, 3], [3, 3], [3, 4], [4, 4], [5, 4], [6, 4]];
  g.S.season.wind = { path, on: false };
  const b = g.S.balls[0];
  b.x = 2; b.y = 3; // dentro de la ruta durante el aviso: aún no pasa nada
  assert.deepEqual(g.windFate(b), { x: 1, y: 5 }, 'acabará en su salida');
  assert.deepEqual(g.windExit(), { x: 7, y: 4, dir: 'right' }, 'sale por el borde donde acaba la ruta');
  g.endTurn();
  assert.ok(g.S.season.wind.on, 'tercer turno: sopla');
  assert.ok(at(b, 1, 5), 'se la lleva por la ruta y fuera del tablero: a su salida');
  // lo que cae en la ruta mientras sopla también se va
  b.x = 1; b.y = 1;
  g.S.hands[0] = ['palo2']; g.clickCard(0, 0); g.clickCell(1, 3);
  assert.ok(at(b, 1, 5), 'otra vez fuera');
  g.endTurn();
  assert.equal(g.S.season.wind, null, 'se calma');
  g.endTurn();
  assert.ok(g.S.season.wind && !g.S.season.wind.on, 'y vuelve a avisar');
});

test('viento: también echa el hoyo, que vuelve a su casilla inicial (y se traga a quien esté en ella)', () => {
  const g = level('spring', { hole: { x: 5, y: 1 } });
  g.S.season.wind = { path: [[6, 0], [6, 1], [5, 1], [4, 1], [3, 1], [2, 1], [1, 1], [0, 1]], on: false };
  g.S.hole.x = 3; g.S.hole.y = 1;
  assert.deepEqual(g.windFate('hole'), { x: 5, y: 1 });
  g.endTurn();
  assert.ok(at(g.S.hole, 5, 1), 'a su casilla inicial');
  const h = level('spring', { hole: { x: 5, y: 1 }, ball: { x: 5, y: 3 } });
  h.S.season.wind = { path: [[0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2]], on: true };
  h.S.hole.x = 2; h.S.hole.y = 4; h.S.balls[0].x = 5; h.S.balls[0].y = 1; // (la pelota, sobre la casilla del hoyo)
  h.S.hands[0] = ['hoyoUp']; h.clickCard(0, 0); // el hoyo sube al viento, sale y vuelve… donde está la pelota
  assert.ok(h.S.balls[0].holed && h.S.jaque, 'se la traga: JAQUE');
});

test('planta carnívora: se come a quien se queda a su lado (o encima), no a quien pasa; tampoco en su salida', () => {
  const g = level('spring', { tiles: [{ type: 'plant', x: 3, y: 4 }] });
  const b = g.S.balls[0];
  shoot(g, 'right'); // (1,5) → (4,5): pasa junto a (3,5) y se para en (4,5), lejos de (3,4)? (4,5) dista 2: a salvo
  assert.ok(at(b, 4, 5));
  b.x = 1; b.y = 4; g.S.hands[0] = ['palo1']; g.clickCard(0, 0); g.clickCell(2, 4); // se para al lado
  assert.ok(at(b, 1, 5), 'comida: vuelve a su salida');
  // el hoyo, igual: vuelve a su casilla inicial
  const h = level('spring', { tiles: [{ type: 'plant', x: 5, y: 3 }], hand: [] });
  h.S.hands[0] = ['hoyoDown']; h.clickCard(0, 0);
  assert.ok(at(h.S.hole, 5, 1), 'el hoyo, comido, vuelve a su casilla');
  // con su salida ocupada vuelve a una casilla de al lado… y ahí, junto a otra planta, está a salvo (antes: bucle sin fin)
  const o = level('spring', { tiles: [{ type: 'plant', x: 3, y: 4 }, { type: 'plant', x: 0, y: 4 }], extraBalls: [{ x: 1, y: 5 }], ball: { x: 2, y: 5 } });
  const ob = o.S.balls[0]; ob.spawnX = 1; ob.spawnY = 5; ob.x = 3; ob.y = 2;
  o.S.hands[0] = ['palo1']; o.clickCard(0, 0); o.clickCell(3, 3);
  assert.ok(Math.abs(ob.x - 1) + Math.abs(ob.y - 5) <= 2 && !(ob.x === 3 && ob.y === 3), 'comida una vez y a salvo junto a su salida');
  // una planta que aparece al lado de una pelota quieta (el hielo que se vuelve planta) no se la come
  const q = level('winter', { ball: { x: 3, y: 3 }, tiles: [{ type: 'ice', x: 3, y: 2 }], hand: [] });
  q.S.hands[0] = ['estacion']; q.clickCard(0, 0);
  assert.ok(q.S.tiles.some(t => t.type === 'plant' && at(t, 3, 2)) && at(q.S.balls[0], 3, 3), 'quieta: no');
});

test('fuego: cruzarlo suma 2; quedarse dentro es como caerse; crece una casilla por turno hasta 5', () => {
  const g = level('summer', { tiles: [{ type: 'fire', x: 2, y: 5 }] });
  const b = g.S.balls[0];
  shoot(g, 'right', 'palo2'); // entra con 1 por dar: +2 → 3 más
  assert.ok(at(b, 5, 5), 'cruza y sigue 3 más');
  const f = level('summer', { tiles: [{ type: 'fire', x: 3, y: 5 }] });
  shoot(f, 'right', 'palo2'); // acaba justo dentro
  assert.ok(at(f.S.balls[0], 1, 5), 'quemada: a su salida');
  // el incendio de la carta crece hasta 5 casillas, solo en casillas vacías
  const s = level('summer', { hand: [] });
  s.S.hands[0] = ['incendio']; assert.ok(s.clickCard(0, 0)); s.clickCell(3, 2);
  for (let i = 0; i < 8; i++) s.endTurn();
  const fires = s.S.tiles.filter(t => t.type === 'fire');
  assert.equal(fires.length, FIRE_MAX);
  for (const t of fires) assert.ok(!s.isSpawnCell(t.x, t.y) && !s.isHoleHome(t.x, t.y) && !s.ballAt(t.x, t.y));
  // el hoyo también se quema
  const h = level('summer', { tiles: [{ type: 'fire', x: 5, y: 3 }], hand: [] });
  h.S.hands[0] = ['hoyoDown']; h.clickCard(0, 0);
  assert.ok(at(h.S.hole, 5, 1), 'el hoyo vuelve a su casilla');
  // con el dedo, entrar en el fuego (aunque queden pasos) es quemarse: a su salida, sin más pasos, y se acaba el turno
  const d = Game.fromLevel({ cols: 7, rows: 7, hole: { x: 5, y: 1 }, ball: { x: 1, y: 5 }, parCells: [], tiles: [{ type: 'fire', x: 2, y: 4 }], deckCounts: { palo1: 6 },
    season: { now: 'summer' } }, { seed: 1 });
  d.S.nPlayers = 2; d.S.hands.push([]); d.S.balls.push({ player: 1, x: 6, y: 6, spawnX: 6, spawnY: 6, holed: false });
  const db = d.S.balls[0]; db.x = 2; db.y = 5;
  d.S.hands[0] = ['dedo']; d.clickCard(0, 0); d.chooseAmount(3); d.serpentStep('up');
  assert.ok(at(db, 1, 5) && !d.pending, 'quemada: a su salida, sin los pasos que le quedaban');
  assert.equal(d.S.turn, 1, 'y se acaba su turno');
  // fuera del verano no se puede jugar
  const w = level('winter', { hand: ['incendio'] });
  assert.ok(!w.canPlay(0, 'incendio'));
});

test('otoño: la hoja resta 1 y se rompe; el charco resta 1 y se queda; caen hojas y llueve entre turnos', () => {
  const g = level('autumn', { tiles: [{ type: 'leaf', x: 2, y: 5 }, { type: 'puddle', x: 4, y: 5 }] });
  const b = g.S.balls[0];
  shoot(g, 'right'); // 3 pasos: hoja (-1) → se para en (3,5)
  assert.ok(at(b, 3, 5));
  assert.ok(!g.S.tiles.some(t => t.type === 'leaf'), 'la hoja se ha roto');
  shoot(g, 'right'); // charco en (4,5): -1 → 2 pasos en total
  assert.ok(at(b, 5, 5));
  assert.ok(g.S.tiles.some(t => t.type === 'puddle'), 'el charco se queda');
  const r = level('autumn', { hand: [] });
  for (let i = 0; i < 30; i++) r.endTurn();
  assert.ok(r.S.tiles.some(t => t.type === 'leaf'), 'caen hojas');
  assert.ok(r.S.tiles.some(t => t.rain), 'llueve');
});

test('hielo: suma 1 al tiro (también si se para encima)', () => {
  const g = level('winter', { tiles: [{ type: 'ice', x: 2, y: 5 }] });
  shoot(g, 'right', 'palo1');
  assert.ok(at(g.S.balls[0], 3, 5), 'resbala una más');
});

test('hielo con el dedo: al pisarlo resbala sola una casilla más hacia donde iba (sin gastar paso)', () => {
  // A (1,5) · B hielo (2,5) · C (3,5): con 1 paso del dedo de A a B, acaba en C
  const g = level('winter', { tiles: [{ type: 'ice', x: 2, y: 5 }], hand: ['dedo'] });
  const b = g.S.balls[0];
  g.clickCard(0, 0); g.chooseAmount(1); g.serpentStep('right');
  assert.ok(at(b, 3, 5) && !g.pending, 'en C, y el dedo se acaba');
  // con más pasos, sigue eligiendo después de resbalar
  const h = level('winter', { tiles: [{ type: 'ice', x: 2, y: 5 }], hand: ['dedo'] });
  h.clickCard(0, 0); h.chooseAmount(2); h.serpentStep('right');
  assert.ok(at(h.S.balls[0], 3, 5) && h.pending?.kind === 'serpent' && h.pending.stepsLeft === 1, 'le queda 1 paso');
  h.serpentStep('up');
  assert.ok(at(h.S.balls[0], 3, 4) && !h.pending);
  // si resbala fuera del tablero, vuelve a su salida y el dedo termina
  const o = level('winter', { tiles: [{ type: 'ice', x: 6, y: 2 }], ball: { x: 5, y: 2 }, hand: ['dedo'] });
  o.clickCard(0, 0); o.chooseAmount(2); o.serpentStep('right');
  assert.ok(at(o.S.balls[0], 5, 2) && !o.pending, 'fuera: a su salida');
});

test('bola de nieve: rueda 5 casillas (o hasta el borde), atrapa y se lleva lo que pilla; salir no cuesta nada', () => {
  const g = level('winter', { snow: { x: 0, y: 3 }, ball: { x: 3, y: 3 }, hand: [] });
  g.S.hands[0] = ['oNieve']; assert.ok(g.clickCard(0, 0));
  assert.equal(g.pending.kind, 'snowRoll');
  const tg = g.pending.targets.find(q => q.dir === 'right');
  assert.deepEqual([tg.x, tg.y], [5, 3], '5 casillas');
  assert.deepEqual([...g.pending.targets].find(q => q.dir === 'left'), undefined, 'contra el borde no hay hacia dónde');
  g.clickCell(5, 3);
  const b = g.S.balls[0];
  assert.ok(at(g.S.season.snow, 5, 3) && at(b, 5, 3), 'se la lleva');
  assert.ok(g.trapAt(5, 3) && !g.inTrap(b), 'atrapa, pero sin coste');
  assert.ok(g.canPlay(0, 'palo1'), 'con un palo 1 se sale');
  shoot(g, 'left', 'palo1');
  assert.ok(at(b, 4, 3), 'sale con 1, sin perderlo');
  // hasta el borde, si está más cerca
  g.S.season.snow = { x: 4, y: 3, dir: null };
  assert.deepEqual(g.snowEnd('right'), { x: 6, y: 3, dir: 'right' });
  // entre turnos no se mueve: solo con su carta
  const sn0 = { ...g.S.season.snow };
  for (let i = 0; i < 4; i++) g.endTurn();
  assert.ok(at(g.S.season.snow, sn0.x, sn0.y), 'quieta');
});

test('bola de nieve con el hoyo: la pelota que entra (o que pilla) se mete; en un JAQUE se lleva la ganadora', () => {
  const g = level('winter', { snow: { x: 0, y: 1 }, ball: { x: 3, y: 1 }, hole: { x: 1, y: 1 }, hand: [] });
  g.S.hands[0] = ['oNieve']; g.clickCard(0, 0);
  g.clickCell(...[g.pending.targets.find(q => q.dir === 'right')].map(q => [q.x, q.y])[0]);
  assert.ok(g.S.balls[0].holed && g.S.jaque, 'pilla el hoyo y luego la pelota: JAQUE');
  // JAQUE de J1: J2 rueda la bola por encima del hoyo y se lleva la pelota de J1
  const j = Game.fromLevel({ cols: 7, rows: 7, hole: { x: 3, y: 3 }, ball: { x: 3, y: 4 }, parCells: [], tiles: [], deckCounts: { palo1: 6 },
    season: { now: 'winter', snow: { x: 0, y: 3 } } }, { seed: 1 });
  j.S.nPlayers = 2; j.S.hands.push(['oNieve']);
  j.S.balls.push({ player: 1, x: 6, y: 6, spawnX: 6, spawnY: 6, holed: false });
  j.S.hands[0] = ['palo1']; j.clickCard(0, 0); j.clickCell(3, 3);
  assert.ok(j.S.jaque && j.S.winner === 0);
  assert.ok(j.clickCard(1, 0), 'naranja en el JAQUE');
  j.clickCell(...[j.pending.targets.find(q => q.dir === 'right')].map(q => [q.x, q.y])[0]);
  assert.equal(j.S.winner, null, 'JAQUE anulado');
  assert.ok(!j.S.balls[0].holed && at(j.S.balls[0], 5, 3) && at(j.S.hole, 3, 3), 'se lleva la pelota, no el hoyo');
});

test('cambio de estación: charco → hielo → planta → se seca; hojas, fuego, bola y viento se van con la suya', () => {
  const g = level('autumn', { tiles: [{ type: 'puddle', x: 2, y: 2 }, { type: 'leaf', x: 4, y: 4 }], hand: [] });
  const play = () => { g.S.hands[0] = ['estacion']; g.S.blackPlayed = 0; assert.ok(g.clickCard(0, 0)); };
  play();
  assert.equal(g.S.season.now, 'winter');
  assert.ok(g.S.tiles.some(t => t.type === 'ice' && at(t, 2, 2)), 'el charco se hiela');
  assert.ok(!g.S.tiles.some(t => t.type === 'leaf'), 'las hojas se van');
  assert.ok(g.S.season.snow, 'llega la bola de nieve');
  play();
  assert.equal(g.S.season.now, 'spring');
  assert.ok(g.S.tiles.some(t => t.type === 'plant' && at(t, 2, 2)), 'el hielo se vuelve planta');
  assert.ok(!g.S.season.snow && !g.S.season.wind, 'la bola se derrite; el viento, en calma el primer turno');
  play();
  assert.equal(g.S.season.now, 'summer');
  assert.ok(!g.S.tiles.some(t => t.type === 'plant') && !g.S.season.wind, 'la planta se seca y se calma el viento');
  g.S.hands[0] = ['incendio']; g.clickCard(0, 0); g.clickCell(3, 3);
  play();
  assert.equal(g.S.season.now, 'autumn');
  assert.ok(!g.S.tiles.some(t => t.type === 'fire'), 'el fuego se apaga');
  assert.equal(g.S.tiles.filter(t => t.type === 'leaf').length, START_LEAVES);
  assert.deepEqual(SEASONS.map(nextSeason), ['summer', 'autumn', 'winter', 'spring']);
  // la carta NO deshace también la estación
  g.S.hands[0] = ['estacion', 'no']; g.S.blackPlayed = 0; g.clickCard(0, 0);
  assert.equal(g.S.season.now, 'winter');
  g.clickCard(0, 0);
  assert.equal(g.S.season.now, 'autumn');
});

test('partidas entre bots: terminan, se usan las cartas y las mecánicas, y se guardan y continúan', () => {
  const dk = deckById('seasons'), counts = dk.counts(defaultCounts());
  const cfg = { players: 3, ...deckSize(dk, { cols: 7, rows: 9, par: 3 }), counts, humanColor: '#f26d6d', seasons: true, startWith: dk.newCards };
  let fin = 0, changes = 0;
  const rand = mulberry32(7);
  for (let seed = 1; seed <= 24; seed++) {
    const g = Game.pve(cfg, { seed });
    g.S.human = -1; g.S.aiStyles = g.S.aiStyles.map(s => s || 'trick');
    const r = simulateGame(g, { rand });
    if (r.finished) fin++;
    changes += r.cards.estacion || 0;
    const back = Game.restore(JSON.parse(JSON.stringify(g.serialize())));
    assert.deepEqual(back.S.season, g.S.season);
  }
  assert.ok(fin >= 22, `terminadas ${fin}/24`);
  assert.ok(changes > 10, 'se cambia de estación');
});

test('nivel con estación: se comparte por enlace (estación, bola de nieve y piezas)', () => {
  const L = { cols: 7, rows: 7, hole: { x: 5, y: 1 }, ball: { x: 1, y: 5 }, parCells: [], deckCounts: { palo1: 2 },
    tiles: [{ type: 'ice', x: 2, y: 2 }, { type: 'fire', x: 3, y: 3 }, { type: 'leaf', x: 4, y: 4 }], season: { now: 'winter', snow: { x: 0, y: 0 } } };
  const back = unpackLevel(JSON.parse(JSON.stringify(packLevel(L))));
  assert.equal(back.season.now, 'winter');
  assert.deepEqual(back.season.snow, { x: 0, y: 0 });
  assert.equal(back.tiles.length, 3);
});
