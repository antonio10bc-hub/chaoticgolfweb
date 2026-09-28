// Pelotas personalizadas: qué nivel de cada una se ha ganado según las estadísticas (src/ui/skins.js)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SKINS, skinById, skinProgress } from '../src/ui/skins.js';
import { CHALLENGES } from '../src/content/challenges.js';

const rec = (over = {}) => ({ won: { rush: 0 }, daily: { bestStreak: 0 }, decks: {}, rush: { best: 0, runs: 0 }, challenges: {}, puzzles: {}, ...over });
const PUZ = [...Array(24).keys()].map(i => ({ group: ['warmup', 'mid', 'expert'][Math.floor(i / 8)] }));

test('8 pelotas con 3 niveles: racha, las cuatro barajas, contrarreloj, desafíos y puzles', () => {
  assert.deepEqual(SKINS.map(s => s.id), ['fire', 'classic', 'water', 'wood', 'prism', 'bolt', 'crown', 'puzzle']);
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

test('barajas: victorias con cada una (minigolf y Ultimate por su id) y series de contrarreloj', () => {
  const R = rec({ decks: { classic: { w: 16 }, minigolf: { w: 3 }, ultimate: { w: 50 } }, rush: { done: 5 } });
  assert.equal(skinProgress(skinById('classic'), R, PUZ).lvl, 2);
  assert.equal(skinProgress(skinById('water'), R, PUZ).lvl, 0);
  assert.equal(skinProgress(skinById('wood'), R, PUZ).lvl, 1);
  assert.equal(skinProgress(skinById('prism'), R, PUZ).lvl, 3);
  assert.equal(skinProgress(skinById('bolt'), R, PUZ).lvl, 2);
  // antes del contador de series: ~6 victorias por serie
  assert.equal(skinProgress(skinById('bolt'), rec({ won: { rush: 13 } }), PUZ).lvl, 1);
});

test('desafíos y puzles: un nivel por grupo completo, en orden (calentamiento, intermedio, experto)', () => {
  const warm = Object.fromEntries(CHALLENGES.filter(c => c.group === 'warmup').map(c => [c.id, true]));
  const mid = Object.fromEntries(CHALLENGES.filter(c => c.group === 'mid').map(c => [c.id, true]));
  assert.equal(skinProgress(skinById('crown'), rec({ challenges: warm }), PUZ).lvl, 1);
  assert.equal(skinProgress(skinById('crown'), rec({ challenges: mid }), PUZ).lvl, 0, 'sin el calentamiento no cuenta el intermedio');
  const p = skinProgress(skinById('crown'), rec({ challenges: { ...warm, ...mid } }), PUZ);
  assert.equal(p.lvl, 2); assert.equal(p.group, 'expert'); assert.equal(p.value, 0); assert.equal(p.target, 6);
  const all = Object.fromEntries([...Array(24).keys()].map(i => [i, true]));
  assert.equal(skinProgress(skinById('puzzle'), rec({ puzzles: all }), PUZ).lvl, 3);
  assert.equal(skinProgress(skinById('puzzle'), rec({ puzzles: { 0: true, 1: true } }), PUZ).value, 2);
});
