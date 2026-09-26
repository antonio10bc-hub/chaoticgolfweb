// Código para compartir niveles del creador: ida y vuelta, enlaces y códigos rotos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeLevel, decodeLevel, extractCode, levelLink, levelKey, unpackLevel } from '../src/content/levels/share.js';
import { CARD_KEYS } from '../src/content/cards/index.js';

const LEVEL = {
  version: 1, name: 'Río y esquinas ñ', cols: 9, rows: 11,
  hole: { x: 4, y: 1 }, ball: { x: 4, y: 9 },
  parCells: [{ x: 4, y: 2, n: 3 }, { x: 4, y: 3, n: 2 }, { x: 4, y: 4, n: 1 }],
  tiles: [{ type: 'corner', x: 2, y: 5, rot: 3 }, { type: 'portal', x: 0, y: 0, pair: 2 }, { type: 'portal', x: 8, y: 10, pair: 2 },
    { type: 'river', x: 6, y: 3 }, { type: 'river', x: 6, y: 4 }, { type: 'launcher', x: 1, y: 8 }],
  extraBalls: [{ x: 5, y: 6 }],
  deckCounts: Object.fromEntries(CARD_KEYS.map(k => [k, k === 'palo2' ? 3 : k === 'paloIri' ? 1 : 0])),
  hand: ['paloIri', 'palo2'],
};

test('compartir: el código devuelve exactamente el mismo nivel', async () => {
  const code = await encodeLevel(LEVEL);
  assert.match(code, /^CG1[A-Za-z0-9_-]+$/);
  assert.deepEqual(await decodeLevel(code), LEVEL);
  assert.equal(levelKey(await decodeLevel(code)), levelKey(LEVEL));
});

test('compartir: acepta el enlace entero y el código con espacios', async () => {
  const code = await encodeLevel(LEVEL);
  const link = levelLink(code, 'https://ejemplo.dev/golf/');
  assert.equal(link, 'https://ejemplo.dev/golf/#nivel=' + code);
  assert.equal(extractCode(link), code);
  const spaced = code.slice(0, 10) + '\n ' + code.slice(10);
  assert.deepEqual(await decodeLevel(spaced), LEVEL);
});

test('compartir: un código roto o manipulado no se acepta', async () => {
  assert.equal(await decodeLevel('hola'), null);
  assert.equal(await decodeLevel('CG1abcdef'), null);
  assert.equal(unpackLevel({ c: 99, r: 9, h: [0, 0], b: [1, 1] }), null);        // demasiado grande
  assert.equal(unpackLevel({ c: 7, r: 9, h: [2, 2], b: [2, 2] }), null);         // pelota en el hoyo
  const L = unpackLevel({ c: 7, r: 9, h: [3, 0], b: [3, 8], t: [['nada', 1, 1], ['block', 40, 1], ['block', 2, 2], ['bunker', 2, 2]], d: { palo1: 2, trampa: 5 } });
  assert.deepEqual(L.tiles, [{ type: 'block', x: 2, y: 2 }]); // piezas que no existen, fuera o repetidas: fuera
  assert.equal(L.deckCounts.palo1, 2);
  assert.equal(L.deckCounts.trampa, undefined);
});
