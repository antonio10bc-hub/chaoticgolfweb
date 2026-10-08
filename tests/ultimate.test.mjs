// Ultimate, el combinador: mazo, campo (y su PAR) de cada combinación de barajas, y el código para compartir el mismo reparto.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, PLAYER_COLORS } from '../src/engine/game.js';
import { ULT_DECKS, ALL_COMBO, comboIds, comboMask, comboCfg, comboSize, comboCode, parseComboCode, deckById, deckSize, PVE_SIZES } from '../src/content/decks.js';
import { simulateGame } from '../src/ai/autoplay.js';
import { mulberry32 } from '../src/engine/rng.js';

test('las 7 barajas se combinan; la máscara va y vuelve', () => {
  assert.deepEqual(ULT_DECKS, ['classic', 'water', 'minigolf', 'train', 'seasons', 'multiverse', 'gambling']);
  assert.equal(ALL_COMBO, 127);
  for (let m = 1; m <= ALL_COMBO; m++) assert.equal(comboMask(comboIds(m)), m);
});

test('el mazo: las cartas de las barajas activadas; sin la clásica, ni búnkeres ni portales; siempre el palo iridiscente', () => {
  const water = comboCfg(comboMask(['water'])).counts;
  assert.equal(water.bunker, 0); assert.equal(water.portal, 0); assert.ok(water.river > 0 && water.lake > 0);
  assert.equal(water.paloIri, 2); assert.equal(water.estacion, 0); assert.equal(water.agujeroNegro, 0);
  const cw = comboCfg(comboMask(['classic', 'water'])).counts;
  assert.equal(cw.bunker, 2); assert.ok(cw.river > 0);
  const all = comboCfg(ALL_COMBO);
  assert.ok(all.counts.estacion > 0 && all.counts.agujeroNegro === 1 && all.counts.trenVuelta > 0 && all.counts.block > 0);
  assert.ok(all.train && all.seasons && all.gambling && !all.trainLayout && all.counts.ruleta > 0 && all.counts.dado > 0);
  assert.ok(comboCfg(comboMask(['train'])).trainLayout, 'el tren solo: su disposición');
});

test('el campo crece con la combinación y, cuanto más grande, más largo el PAR', () => {
  assert.deepEqual(comboSize(comboMask(['minigolf'])), deckSize(deckById('minigolf'), PVE_SIZES.m), 'una baraja: su campo');
  assert.deepEqual(comboSize(ALL_COMBO), { cols: 19, rows: 13, par: 7 }, 'todas: el campo enorme de siempre');
  const sizes = [1, 2, 3, 4, 5, 6, 7].map(n => comboSize((1 << n) - 1));
  for (let i = 1; i < sizes.length; i++) assert.ok(sizes[i].cols * sizes[i].rows >= sizes[i - 1].cols * sizes[i - 1].rows && sizes[i].par >= sizes[i - 1].par);
  for (let m = 1; m <= ALL_COMBO; m++) { const s = comboSize(m); assert.ok(s.rows >= s.par + 3, 'el recorrido cabe'); }
  assert.equal(comboCfg(comboMask(['classic'])).counts.palo10, 0, 'el palo de 10, solo en campos grandes');
  assert.equal(PVE_SIZES.l.par, 5, 'el campo grande de la partida rápida: PAR 5');
});

test('compartir: el código lleva la combinación, los rivales, la dificultad y la semilla', () => {
  const e = { mask: 46, opps: 3, diff: 'hard', seed: 3987654321 };
  assert.deepEqual(parseComboCode(comboCode(e)), e);
  for (const bad of ['', 'u1.0.2.1.5', 'u1.3k.2.1.5', 'u1.1.9.1.5', 'u1.1.2.7.5', 'x1.1.2.1.5', 'u1.1.2.1']) assert.equal(parseComboCode(bad), null, bad);
});

test('la misma combinación con la misma semilla es la misma partida (mazo, salidas, rivales, campo)', () => {
  const c = comboCfg(ALL_COMBO), mk = seed => Game.pve({ players: 3, humanColor: PLAYER_COLORS[0], counts: c.counts, startWith: c.startWith, ...c.size, train: true, seasons: true, gambling: true }, { seed });
  const a = mk(777), b = mk(777);
  assert.deepEqual(a.S.deck, b.S.deck); assert.deepEqual(a.S.hands, b.S.hands); assert.deepEqual(a.S.train, b.S.train); assert.equal(a.S.season.now, b.S.season.now); assert.deepEqual(a.S.gamble, b.S.gamble);
});

test('bots: las combinaciones terminan sin errores (copias, tren, estaciones y agua juntos)', () => {
  const rand = mulberry32(3);
  for (const mask of [ALL_COMBO, comboMask(['gambling', 'multiverse']), comboMask(['gambling', 'train', 'seasons']), comboMask(['train', 'multiverse']), comboMask(['seasons', 'multiverse']), comboMask(['water', 'minigolf', 'multiverse'])]) {
    const c = comboCfg(mask);
    for (let i = 0; i < 3; i++) {
      const g = Game.pve({ players: 3, humanColor: PLAYER_COLORS[0], counts: c.counts, startWith: c.startWith, ...c.size, ...(c.train ? { train: true } : {}), ...(c.seasons ? { seasons: true } : {}), ...(c.gambling ? { gambling: true } : {}) }, { seed: 50 + i });
      g.S.human = -1; g.S.aiStyles = g.S.aiStyles.map(s => s || 'trick');
      simulateGame(g, { rand, maxTurns: 450 });
      const live = g.S.balls.filter(b => !b.holed);
      assert.ok(live.every(b => b.x >= 0 && b.y >= 0 && b.x < g.S.cols && b.y < g.S.rows));
      assert.equal(new Set(live.map(b => b.x + ',' + b.y)).size, live.length);
    }
  }
});
