// Oráculo de reglas: repite sobre el motor las ~44.000 acciones grabadas del juego
// original (tools/gen-golden.mjs) y exige el mismo estado, hash a hash.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { Game } from '../src/engine/game.js';
import { mkRng, canonical, hash } from './helpers/canon.mjs';

const games = JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL('./fixtures/golden.json.gz', import.meta.url))));

export function makeGame(G) {
  const rand = mkRng(G.seed);
  for (let i = 0; i < G.skip; i++) rand(); // llamadas consumidas por el arranque de la página original
  const opts = { rand };
  if (G.setup.type === 'free') return Game.free(G.setup.cfg, opts);
  if (G.setup.type === 'level') return Game.fromLevel(G.setup.level, opts);
  return Game.pve(G.setup.cfg, opts);
}

export function apply(game, a) {
  switch (a[0]) {
    case 'card': return game.clickCard(a[1], a[2]);
    case 'cell': return game.clickCell(a[1], a[2]);
    case 'amount': return game.chooseAmount(a[1]);
    case 'pickHoled': return game.pickHoled(a[1]);
    case 'cancel': return game.cancel();
    case 'end': return game.endTurn();
    case 'discard': return game.startDiscard();
    case 'confirmDiscard': return game.confirmDiscard();
    case 'confirmWin': return game.confirmWin();
    case 'godToggle': return game.toggleGod();
    case 'undo': return game.undo();
    case 'give': return game.giveCard(a[1], a[2]);
    case 'draw': return game.debugDraw();
    case 'skip': return game.skipTurn();
    default: throw new Error('acción desconocida ' + a[0]);
  }
}

const state = g => hash(canonical(g.S, g.pending));

// Reglas añadidas después del juego original: si una partida se desvía justo en el paso en que
// se aplica una de ellas, se da por buena hasta ahí (cambio intencionado) y se deja de comparar.
//   · ballInitPortal — la pelota que vuelve tras caerse a una casilla con portal lo atraviesa
const NEW_RULES = ['log.ballInitPortal'];

test(`el motor reproduce el juego original (${games.length} partidas)`, () => {
  let actions = 0, diverged = 0;
  for (const [gi, G] of games.entries()) {
    const game = makeGame(G);
    let newRule = false;
    const log = game.log;
    game.log = function (key, params) { if (NEW_RULES.includes(key)) newRule = true; return log.call(this, key, params); };
    assert.equal(state(game), G.init, `partida ${gi} (${G.setup.type}): estado inicial distinto`);
    for (const [si, st] of G.steps.entries()) {
      newRule = false;
      apply(game, st.a);
      game.takeEvents();
      if (state(game) !== st.h && newRule) { diverged++; break; }
      if (state(game) !== st.h) {
        assert.fail(`partida ${gi} (${G.setup.type}) paso ${si} ${JSON.stringify(st.a)}\n` +
          `  log esperado: ${JSON.stringify(st.log)}\n  log obtenido: ${JSON.stringify(game.S.log.slice(0, Math.max(1, st.log.length)).reverse())}`);
      }
      actions++;
    }
  }
  assert.ok(actions > 10000);
  assert.ok(diverged <= games.length * .02, `demasiadas partidas desviadas por reglas nuevas: ${diverged}`);
});
