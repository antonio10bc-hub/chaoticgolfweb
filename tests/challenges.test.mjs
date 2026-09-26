// Desafíos y desafío semanal: campos diseñados (con su variación) bien colocados y jugables hasta el final.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, PLAYER_COLORS } from '../src/engine/game.js';
import { mulberry32 } from '../src/engine/rng.js';
import { simulateGame } from '../src/ai/autoplay.js';
import { CHALLENGES, WEEKLY, CH_GROUPS, challengeCfg, challengeTiles } from '../src/content/challenges.js';
import { TILES } from '../src/content/tiles/index.js';

const make = (ch, seed) => {
  const { cfg, extra } = challengeCfg(ch);
  const g = Game.pve({ players: cfg.opps + 1, humans: 1, aiLevel: cfg.diff, ...extra, humanColor: PLAYER_COLORS[0] }, { seed });
  g.S.tiles.push(...challengeTiles(ch, g.S, seed));
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
    if (TYPE[ch.feature]) assert.deepEqual([...types], [TYPE[ch.feature]], `${date}: solo ${ch.feature}`); else assert.equal(S.tiles.length, 0);
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
