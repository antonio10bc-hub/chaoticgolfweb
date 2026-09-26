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
  assert.ok(CHALLENGES.length >= 17);
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
