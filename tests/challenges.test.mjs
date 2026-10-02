// Desafíos y desafío semanal: campos diseñados (con su variación) bien colocados y jugables hasta el final.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, PLAYER_COLORS } from '../src/engine/game.js';
import { mulberry32 } from '../src/engine/rng.js';
import { simulateGame } from '../src/ai/autoplay.js';
import { CHALLENGES, WEEKLY, CH_GROUPS, challengeCfg, challengeTiles, setupChallenge } from '../src/content/challenges.js';
import { TILES } from '../src/content/tiles/index.js';

const make = (ch, seed) => {
  const { cfg, extra } = challengeCfg(ch);
  const g = Game.pve({ players: cfg.opps + 1, humans: 1, aiLevel: cfg.diff, ...extra, humanColor: PLAYER_COLORS[0] }, { seed });
  setupChallenge(g.S, ch, seed, Game.designed); // (como en el juego: su agua no cuenta para el máximo; su tren)
  return g;
};

test('desafíos: todos en un grupo de dificultad y con nombre propio', () => {
  assert.ok(CHALLENGES.length >= 18);
  for (const ch of CHALLENGES) assert.ok(CH_GROUPS.includes(ch.group), ch.id);
  assert.equal(new Set(CHALLENGES.map(c => c.id)).size, CHALLENGES.length);
  assert.equal(new Set(WEEKLY.map(c => c.id)).size, WEEKLY.length);
});

test('desafíos y semanal: las piezas caen dentro, sin solaparse ni tapar hoyo, salidas o PAR (salvo búnkeres a propósito)', () => {
  for (const ch of [...CHALLENGES, ...WEEKLY]) for (const seed of [1, 2, 3, 7, 99]) { // (con y sin reflejo)
    const S = make(ch, seed).S, seen = new Set();
    for (const t of S.tiles) {
      const k = t.x + ',' + t.y, where = `${ch.id} (semilla ${seed}): ${t.type} en ${k}`;
      assert.ok(TILES[t.type], where);
      assert.ok(t.x >= 0 && t.y >= 0 && t.x < S.cols && t.y < S.rows, 'fuera: ' + where);
      assert.ok(!seen.has(k), 'repetida: ' + where); seen.add(k);
      assert.ok(!S.balls.some(b => b.x === t.x && b.y === t.y) && !(S.hole.x === t.x && S.hole.y === t.y), 'tapa: ' + where);
      if (S.parCells.some(p => p.x === t.x && p.y === t.y)) assert.equal(t.type, 'bunker', 'en el PAR: ' + where);
    }
    if (ch.layout) assert.ok(S.tiles.length > 0, ch.id);
  }
});

test('desafíos y semanal: entre bots, cada uno se juega hasta que alguien gana', () => {
  const rand = mulberry32(5);
  for (const ch of [...CHALLENGES, ...WEEKLY]) {
    let won = 0;
    for (let i = 0; i < 3; i++) {
      const g = make(ch, 100 + i);
      g.S.human = -1; g.S.aiStyles = g.S.aiStyles.map(s => s || 'trick');
      simulateGame(g, { rand, maxTurns: 400 });
      if (g.S.winner !== null) won++;
    }
    assert.ok(won >= 2, `${ch.id}: ${won}/3 partidas terminadas`);
  }
});

test('reto diario: tablero pequeño (5×5, como mucho +2), una sola mecánica cada día y nunca la misma dos días seguidos', async () => {
  const { dailyChallenge, DAILY_FEATURES } = await import('../src/content/challenges.js');
  const SEASON_TILES = { spring: ['plant'], summer: ['fire'], autumn: ['leaf', 'puddle'], winter: ['ice'] };
  const TYPE = { portal: 'portal', launcher: 'launcher', bunker: 'bunker', river: 'river', tunnel: 'tunnel', block: 'block', lake: 'lake', corner: 'corner', iri: null };
  const dates = Array.from({ length: 60 }, (_, i) => { const d = new Date(2026, 8, 1 + i); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; });
  let prev = null; const seen = new Set();
  for (const date of dates) {
    const seed = [...date].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
    const ch = dailyChallenge(date, seed);
    assert.notEqual(ch.feature, prev, `${date}: la misma mecánica que ayer`); prev = ch.feature; seen.add(ch.feature);
    assert.ok(ch.board.cols >= 5 && ch.board.rows >= 5 && ch.board.cols + ch.board.rows <= 12, `${date}: ${ch.board.cols}×${ch.board.rows}`);
    const g = make({ ...ch, diff: 'normal' }, seed), S = g.S;
    const types = new Set(S.tiles.map(t => t.type));
    if (ch.feature === 'season') assert.ok([...types].every(t => SEASON_TILES[ch.season.now].includes(t)) && S.season?.now === ch.season.now, `${date}: solo lo de ${ch.season.now}`);
    else if (TYPE[ch.feature]) assert.deepEqual([...types], [TYPE[ch.feature]], `${date}: solo ${ch.feature}`); else assert.equal(S.tiles.length, 0);
    for (const t of S.tiles) assert.ok(!S.balls.some(b => b.x === t.x && b.y === t.y) && !(S.hole.x === t.x && S.hole.y === t.y), `${date}: tapa`);
    assert.equal(S.deck.filter(k => k === 'bunker' || k === 'portal').length, 0, `${date}: sin cartas de colocar`);
  }
  assert.equal(seen.size, DAILY_FEATURES.length); // en 60 días salen todas
});

test('reto diario: cada mecánica se juega hasta el final entre bots', async () => {
  const { dailyChallenge } = await import('../src/content/challenges.js');
  const rand = mulberry32(8);
  for (let day = 0; day < 9; day++) {
    const date = `2026-10-${String(1 + day).padStart(2, '0')}`, ch = dailyChallenge(date, 1000 + day);
    let won = 0;
    for (let i = 0; i < 3; i++) {
      const g = make({ ...ch, diff: 'normal' }, 500 + i);
      g.S.human = -1; g.S.aiStyles = g.S.aiStyles.map(s => s || 'trick');
      simulateGame(g, { rand, maxTurns: 300 });
      if (g.S.winner !== null) won++;
    }
    assert.ok(won >= 2, `${ch.feature}: ${won}/3`);
  }
});

test('desafíos del tren (uno por dificultad): circuito cerrado con 4 paradas, sin pisar hoyo, salidas ni piezas, y sin PAR', async () => {
  const { validPath } = await import('../src/engine/train.js');
  const trains = CHALLENGES.filter(c => c.track);
  assert.deepEqual(CH_GROUPS.map(g => trains.filter(c => c.group === g).length), [1, 1, 1]);
  for (const ch of trains) for (const seed of [1, 2, 3, 7, 99]) {
    const S = make(ch, seed).S, tr = S.train, where = `${ch.id} (semilla ${seed})`;
    assert.ok(tr && validPath(tr.path, S.cols, S.rows), 'vuelta válida: ' + where);
    assert.equal(new Set(tr.stations).size, 4, where);
    assert.ok(tr.stations.includes(tr.pos), 'la locomotora en una parada: ' + where);
    const on = (x, y) => tr.path.some(p => p[0] === x && p[1] === y);
    assert.ok(!on(S.hole.x, S.hole.y) && !S.balls.some(b => on(b.x, b.y)), 'no pisa hoyo ni salidas: ' + where);
    assert.ok(!S.tiles.some(t => on(t.x, t.y)), 'ninguna pieza en la vía: ' + where);
    assert.equal(S.parCells.length, 0, 'sin PAR (la vía cruza su columna): ' + where);
    // para llegar al hoyo hay que cruzar la vía (la salida y el hoyo, a distinto lado de un tramo)
    const cross = S.balls.every(b => { const lo = Math.min(b.y, S.hole.y), hi = Math.max(b.y, S.hole.y);
      return tr.path.some(([x, y]) => y > lo && y < hi); });
    assert.ok(cross, 'la vía, entre las salidas y el hoyo: ' + where);
  }
});

test('reto diario del tren: entra en la rueda el 2 de octubre sin cambiar los días de antes; versión mínima (2 paradas, 1 vagón)', async () => {
  const { dailyChallenge } = await import('../src/content/challenges.js');
  const OLD = ['portal', 'launcher', 'bunker', 'river', 'tunnel', 'block', 'lake', 'corner', 'iri'];
  const day = d => Math.round((Date.UTC(...d.split('-').map((v, i) => i === 1 ? v - 1 : +v)) - Date.UTC(2026, 0, 1)) / 864e5);
  for (const d of ['2026-09-20', '2026-09-30', '2026-10-01']) assert.equal(dailyChallenge(d, 1).feature, OLD[day(d) % 9], d + ': como siempre');
  const trainDay = ['2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11']
    .find(d => dailyChallenge(d, 1).feature === 'train');
  assert.ok(trainDay, 'sale en los primeros 10 días');
  for (const seed of [1, 2, 3, 4]) {
    const ch = dailyChallenge(trainDay, seed), g = make({ ...ch, diff: 'normal' }, seed), S = g.S, tr = S.train;
    assert.equal(tr.stations.length, 2, '2 paradas');
    assert.equal(tr.maxCars, 1);
    S.hands[S.turn] = ['vagon', 'vagon']; S.blackPlayed = 0;
    assert.ok(g.canAddWagon()); g.addWagon();
    assert.equal(g.canAddWagon(), false, 'como mucho 1 vagón');
    assert.ok(S.balls.every(b => b.y > Math.min(...tr.path.map(p => p[1]))) && S.hole.y < Math.min(...tr.path.map(p => p[1])), 'la vía, entre las salidas y el hoyo');
  }
});

test('estaciones: un desafío por dificultad con su estación (y su bola de nieve en invierno), sin pisar salidas ni hoyo', () => {
  const seasons = CHALLENGES.filter(c => c.season);
  assert.deepEqual(CH_GROUPS.map(g => seasons.filter(c => c.group === g).length), [1, 1, 1]);
  for (const ch of seasons) for (const seed of [1, 2, 3, 7, 99]) {
    const g = make(ch, seed), S = g.S, where = `${ch.id} (semilla ${seed})`;
    assert.equal(S.season.now, ch.season.now, where);
    const sn = S.season.snow;
    if (ch.season.snow) assert.ok(sn && !g.isSpawnCell(sn.x, sn.y) && !g.isHole(sn.x, sn.y) && !S.tiles.some(t => t.x === sn.x && t.y === sn.y), 'bola de nieve libre: ' + where);
    for (const t of S.tiles) assert.ok(!g.isSpawnCell(t.x, t.y) && !g.isHole(t.x, t.y), 'nada en salidas ni en el hoyo: ' + where);
  }
});

test('reto diario de las estaciones: entra en la rueda el 3 de octubre sin cambiar los días de antes y se turnan las cuatro', async () => {
  const { dailyChallenge } = await import('../src/content/challenges.js');
  const day = i => new Date(Date.UTC(2026, 9, 3 + i)).toISOString().slice(0, 10);
  // hasta el 7 de octubre, lo mismo que antes de existir (la rueda del tren sigue donde iba)
  const BEFORE = { '2026-10-02': 'tunnel', '2026-10-03': 'block', '2026-10-04': 'lake', '2026-10-05': 'corner', '2026-10-06': 'iri', '2026-10-07': 'train' };
  for (const [d, f] of Object.entries(BEFORE)) assert.equal(dailyChallenge(d, 1).feature, f, d);
  const seasons = Array.from({ length: 50 }, (_, i) => dailyChallenge(day(i), 3)).filter(c => c.feature === 'season').map(c => c.season.now);
  assert.deepEqual(seasons.slice(0, 4), ['spring', 'summer', 'autumn', 'winter'], 'cada vez, la siguiente');
  for (let i = 0; i < 50; i++) { const ch = dailyChallenge(day(i), 5); if (ch.feature !== 'season') continue;
    const g = make({ ...ch, diff: 'normal' }, 5);
    assert.equal(g.S.season.now, ch.season.now);
    assert.equal(!!g.S.season.snow, ch.season.now === 'winter', 'la bola de nieve, en invierno');
    assert.equal(g.S.deck.filter(k => k === 'estacion').length, 0, 'sin cambio de estación');
  }
});
