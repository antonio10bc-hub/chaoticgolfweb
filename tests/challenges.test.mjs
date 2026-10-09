// Desafíos: campos diseñados (con su variación) bien colocados y jugables hasta el final, y los 5 de cada semana.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, PLAYER_COLORS } from '../src/engine/game.js';
import { mulberry32 } from '../src/engine/rng.js';
import { simulateGame } from '../src/ai/autoplay.js';
import { CHALLENGES, CH_GROUPS, challengeCfg, setupChallenge, weekChallenges, weekMonday, challengeDecks, weekEndsAt, WEEK_SLOTS, CH_EPOCH } from '../src/content/challenges.js';
import { DECKS } from '../src/content/decks.js';
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
  for (const ch of CHALLENGES) for (const d of challengeDecks(ch)) assert.ok(DECKS.some(x => x.id === d), `${ch.id}: baraja ${d}`);
});

// la semana ISO del lunes n semanas después de la primera
const weekN = n => { const u = new Date(weekMonday(CH_EPOCH).getTime() + (n * 7 + 3) * 864e5), y = u.getUTCFullYear();
  return `${y}-W${String(Math.ceil(((u - Date.UTC(y, 0, 1)) / 864e5 + 1) / 7)).padStart(2, '0')}`; };
test('desafíos de la semana: 2 de calentamiento, 2 intermedios y 1 experto, cada uno de una baraja distinta, y todos van saliendo', () => {
  const seen = {}, last = {};
  for (let n = 0; n < 104; n++) {
    const wk = weekN(n), list = weekChallenges(wk);
    assert.deepEqual(list.map(c => c.group), WEEK_SLOTS, wk);
    const decks = list.flatMap(challengeDecks);
    assert.equal(new Set(decks).size, decks.length, `${wk}: baraja repetida (${list.map(c => c.id)})`);
    assert.ok(new Set(decks).size >= 5, wk);
    for (const c of list) { assert.ok(last[c.id] == null || n - last[c.id] >= 3, `${wk}: ${c.id} repite demasiado pronto`); last[c.id] = n; seen[c.id] = (seen[c.id] || 0) + 1; }
  }
  for (const c of CHALLENGES) assert.ok(seen[c.id] >= 4, `${c.id}: sale ${seen[c.id] || 0} veces en dos años`);
});
test('desafíos de la semana: siempre los mismos para la misma semana (también calculados en otro orden) y antes de la primera, los de la primera', () => {
  const a = weekChallenges(weekN(30)).map(c => c.id), b = weekChallenges(weekN(5)).map(c => c.id);
  assert.deepEqual(weekChallenges(weekN(30)).map(c => c.id), a);
  assert.deepEqual(weekChallenges(weekN(5)).map(c => c.id), b);
  assert.deepEqual(weekChallenges('2026-W01').map(c => c.id), weekChallenges(CH_EPOCH).map(c => c.id));
  // la semana acaba el lunes siguiente a las 00:00
  const end = weekEndsAt(new Date(2026, 9, 9, 15)); // (viernes)
  assert.equal(end.getDay(), 1); assert.equal(end.getDate(), 12); assert.equal(end.getHours(), 0);
  assert.equal(weekEndsAt(new Date(2026, 9, 12, 0, 5)).getDate(), 19, 'el lunes ya cuenta la semana nueva');
});

test('desafíos: las piezas caen dentro, sin solaparse ni tapar hoyo, salidas o PAR (salvo búnkeres a propósito)', () => {
  for (const ch of CHALLENGES) for (const seed of [1, 2, 3, 7, 99]) { // (con y sin reflejo)
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

test('desafíos: entre bots, cada uno se juega hasta que alguien gana', () => {
  const rand = mulberry32(5);
  for (const ch of CHALLENGES) {
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
    if (ch.feature === 'gambling') assert.deepEqual([...types], ch.sub === 'dice' ? ['dice'] : [], `${date}: solo lo del casino (${ch.sub})`);
    else if (ch.feature === 'multiverse') assert.deepEqual([...types], [{ blackhole: 'blackhole', gravity: 'meteorite', meteors: 'meteorite' }[ch.sub]], `${date}: solo lo del multiverso (${ch.sub})`);
    else if (ch.feature === 'season') assert.ok([...types].every(t => SEASON_TILES[ch.season.now].includes(t)) && S.season?.now === ch.season.now, `${date}: solo lo de ${ch.season.now}`);
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

test('desafíos del tren (alguno en cada dificultad): circuito cerrado con 4 paradas, sin pisar hoyo, salidas ni piezas, y sin PAR', async () => {
  const { validPath } = await import('../src/engine/train.js');
  const trains = CHALLENGES.filter(c => c.track);
  assert.ok(CH_GROUPS.every(g => trains.some(c => c.group === g)));
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

test('estaciones: alguno en cada dificultad con su estación (y su bola de nieve en invierno), sin pisar salidas ni hoyo', () => {
  const seasons = CHALLENGES.filter(c => c.season);
  assert.ok(CH_GROUPS.every(g => seasons.some(c => c.group === g)));
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

test('coronas: una por cada desafío superado y semana del antiguo semanal ganada; luego, una por desafío y semana', async () => {
  const mem = {};
  globalThis.localStorage = { getItem: k => mem[k] ?? null, setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } };
  const { loadRecords, winCrown, crownsOf } = await import('../src/ui/records.js');
  mem.chaoticgolf_stats = JSON.stringify({ version: 1, challenges: { noPalo3: true, prism: true, pinball: false }, weekly: { weeks: { '2026-W38': { best: 4 }, '2026-W39': { best: null } } } });
  const R = loadRecords();
  assert.deepEqual([R.crowns.n, R.crowns.legacy], [3, 3], '2 desafíos + 1 semana ganada');
  assert.deepEqual(winCrown('2026-W41', 'crossing'), { fresh: true, n: 4 });
  assert.deepEqual(winCrown('2026-W41', 'crossing'), { fresh: false, n: 4 }, 'la misma semana, no repite');
  assert.deepEqual(winCrown('2026-W45', 'crossing'), { fresh: true, n: 5 }, 'otra semana, sí');
  assert.deepEqual(crownsOf('2026-W41'), ['crossing']);
  assert.equal(loadRecords().crowns.legacy, 3, 'las regaladas se recuerdan (para el aviso)');
});
