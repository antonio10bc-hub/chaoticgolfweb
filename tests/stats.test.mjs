// Estadísticas al día: lo que se añade al juego (barajas, modos, pelotas, grupos, mecánicas) tiene que aparecer en la
// pestaña de Estadísticas. Esta sale de las listas del juego (stats-sections.js); aquí se comprueba que cada cosa tenga
// sus textos y que cada evento animado del motor esté decidido: o es un total (TOTALS) o no cuenta (NOT_COUNTED).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const store = new Map();
globalThis.localStorage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
const { TOTALS, NOT_COUNTED, REC_MODES, countTotals, recordEnd, loadRecords } = await import('../src/ui/records.js');
const { DECKS } = await import('../src/content/decks.js');
const { CH_GROUPS } = await import('../src/content/challenges.js');
const { SKINS } = await import('../src/ui/skins.js');
const LANGS = { es: (await import('../src/i18n/es.js')).default, en: (await import('../src/i18n/en.js')).default };
const has = (d, key) => key.split('.').reduce((o, k) => o?.[k], d) != null;
const missing = keys => Object.entries(LANGS).flatMap(([lang, d]) => keys.filter(k => !has(d, k)).map(k => `${lang}: ${k}`));

test('cada evento animado del controlador es un total o está en NOT_COUNTED (una mecánica nueva obliga a decidir)', () => {
  const src = fs.readFileSync(new URL('../src/ui/controller.js', import.meta.url), 'utf8');
  const anim = [...src.match(/const ANIM = new Set\(\[([\s\S]*?)\]\)/)[1].matchAll(/'([a-zA-Z]+)'/g)].map(m => m[1]);
  const counted = TOTALS.flatMap(x => x.on || []);
  const undecided = anim.filter(e => !counted.includes(e) && !NOT_COUNTED.includes(e));
  assert.deepEqual(undecided, [], 'eventos sin decidir: añádelos a TOTALS (con su texto stats.tot.*) o a NOT_COUNTED en records.js');
  assert.deepEqual(counted.filter(e => NOT_COUNTED.includes(e)), [], 'un evento no puede contar y no contar a la vez');
});

test('los totales cuentan lo suyo y se guardan con el resto', () => {
  const st = {};
  for (const ev of [{ t: 'sink', p: 'b0' }, { t: 'drift', p: 'b1' }, { t: 'drift', p: 'hole' }, { t: 'splash', p: 'b0' }, { t: 'burn', p: 'b2' },
    { t: 'absorb', p: 'b0' }, { t: 'meteor', x: 1, y: 1 }, { t: 'train', p: 'loco' }, { t: 'move', p: 'b0' }]) countTotals(st, ev);
  assert.deepEqual(st, { hundidas: 1, rio: 1, caidas: 2, tragadas: 1, meteoritos: 1, tren: 1 });
  store.clear();
  recordEnd('pve', { won: true, stats: { ...st, golpes: 3, turnos: 2 } });
  const R = loadRecords();
  for (const x of TOTALS) assert.equal(typeof R.totals[x.k], 'number', x.k);
  assert.equal(R.totals.tragadas, 1); assert.equal(R.totals.meteoritos, 1);
});

test('todo lo que sale en Estadísticas tiene su texto (es y en)', () => {
  const keys = [
    ...TOTALS.filter(x => !x.hidden).map(x => 'stats.tot.' + x.k),
    ...REC_MODES.map(m => 'stats.mode_' + m),
    ...DECKS.filter(dk => !dk.locked).map(dk => 'decks.' + dk.id + '.name'),
    ...DECKS.filter(dk => !dk.locked && !dk.ultimate).map(dk => 'ult.short.' + dk.id),
    ...SKINS.map(s => 'skins.' + s.id + '.name'),
    ...CH_GROUPS.map(g => 'modes.groups.' + g),
    ...['decksH', 'combos', 'more', 'progressH', 'specialH', 'rushBest', 'rushDone', 'rushRuns', 'weeksPlayed', 'weeksWon', 'weekBest', 'ballsH'].map(k => 'stats.' + k),
  ];
  assert.deepEqual(missing(keys), []);
});

test('cada total tiene un icono del sprite', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  for (const x of TOTALS.filter(x => !x.hidden)) assert.ok(html.includes(`<symbol id="${x.icon}"`), `${x.k}: falta el icono ${x.icon}`);
});
