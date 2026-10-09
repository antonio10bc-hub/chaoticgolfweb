// Pelotas personalizadas: qué nivel de cada una se ha ganado según las estadísticas (src/ui/skins.js)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SKINS, skinById, skinProgress } from '../src/ui/skins.js';

const rec = (over = {}) => ({ won: { rush: 0 }, daily: { bestStreak: 0 }, decks: {}, rush: { best: 0, runs: 0 }, challenges: {}, basics: {}, ...over });
// Lo básico: 10 de las barajas de siempre, 10 de las nuevas y 5 de Lo no tan básico
const PUZ = [...Array(25).keys()].map(i => ({ id: 'l' + i, section: i < 20 ? 'basics' : 'advanced', deck: i < 10 ? 'classic' : 'train' }));

test('12 pelotas con 3 niveles: racha, las barajas, Ultimate, contrarreloj, desafíos y Lo básico', () => {
  assert.deepEqual(SKINS.map(s => s.id), ['fire', 'classic', 'water', 'wood', 'steam', 'seasons', 'cosmos', 'fortune', 'prism', 'bolt', 'crown', 'puzzle']);
  for (const s of SKINS) if (s.at) assert.equal(s.at.length, 3, s.id);
  assert.deepEqual(skinById('fire').at, [7, 30, 365]);
});

test('racha: el nivel es la mejor racha alcanzada (7 · 30 · 365) y lo que falta hasta el siguiente', () => {
  const f = skinById('fire');
  assert.equal(skinProgress(f, rec({ daily: { bestStreak: 6 } }), PUZ).lvl, 0);
  const p = skinProgress(f, rec({ daily: { bestStreak: 34 } }), PUZ);
  assert.equal(p.lvl, 2); assert.equal(p.target, 365); assert.equal(p.value, 34);
  assert.equal(skinProgress(f, rec({ daily: { bestStreak: 400 } }), PUZ).target, null);
});

test('barajas: victorias con cada una (minigolf y Ultimate por su id) y oros del contrarreloj', () => {
  const golds = n => Object.fromEntries(Array.from({ length: n }, (_, i) => ['2026-W' + (10 + i), { best: 4100, medal: 'gold' }]));
  const R = rec({ decks: { classic: { w: 50 }, minigolf: { w: 10 }, train: { w: 60 }, ultimate: { w: 100 } }, rush: { done: 30, weeks: { ...golds(5), '2026-W40': { best: 3000, medal: 'silver' } } } });
  assert.equal(skinProgress(skinById('classic'), R, PUZ).lvl, 2);
  assert.equal(skinProgress(skinById('water'), R, PUZ).lvl, 0);
  assert.equal(skinProgress(skinById('wood'), R, PUZ).lvl, 1);
  assert.equal(skinProgress(skinById('steam'), R, PUZ).lvl, 2);
  assert.equal(skinProgress(skinById('seasons'), rec({ decks: { seasons: { w: 12 } } }), PUZ).lvl, 1);
  assert.equal(skinProgress(skinById('cosmos'), rec({ decks: { multiverse: { w: 55 } } }), PUZ).lvl, 2);
  assert.equal(skinProgress(skinById('fortune'), rec({ decks: { gambling: { w: 12 } } }), PUZ).lvl, 1);
  assert.equal(skinProgress(skinById('prism'), R, PUZ).lvl, 3);
  assert.equal(skinProgress(skinById('bolt'), R, PUZ).lvl, 2, '5 oros (la plata no cuenta)');
  assert.equal(skinProgress(skinById('bolt'), rec({ rush: { done: 40, weeks: {} } }), PUZ).lvl, 0, 'las series completas ya no cuentan');
  assert.equal(skinProgress(skinById('bolt'), rec({ rush: { weeks: golds(1) } }), PUZ).lvl, 1);
  assert.equal(skinProgress(skinById('bolt'), rec({ rush: { weeks: golds(15) } }), PUZ).lvl, 3);
});

test('Corona: por coronas (10 · 50 · 150) y Lo básico (por partes): un nivel por parte completa, en orden', () => {
  const crown = n => skinProgress(skinById('crown'), rec({ crowns: { n, weeks: {} } }), PUZ);
  assert.equal(crown(0).lvl, 0); assert.equal(crown(9).lvl, 0); assert.equal(crown(10).lvl, 1);
  const p = crown(30);
  assert.equal(p.lvl, 1); assert.equal(p.value, 30); assert.equal(p.target, 50);
  assert.equal(crown(149).lvl, 2); assert.equal(crown(150).lvl, 3);
  const done = n => Object.fromEntries(PUZ.slice(0, n).map(L => [L.id, true]));
  assert.equal(skinProgress(skinById('puzzle'), rec({ basics: done(25) }), PUZ).lvl, 3);
  assert.equal(skinProgress(skinById('puzzle'), rec({ basics: done(10) }), PUZ).lvl, 1, 'las barajas de siempre');
  const p2 = skinProgress(skinById('puzzle'), rec({ basics: done(12) }), PUZ);
  assert.equal(p2.lvl, 1); assert.equal(p2.value, 2); assert.equal(p2.target, 10);
  assert.equal(skinProgress(skinById('puzzle'), rec({ basics: { l20: true } }), PUZ).lvl, 0, 'sin lo anterior no cuenta');
});
