// La precarga de index.html (módulos y niveles del arranque) tiene que estar al día: si se añade un módulo o
// un nivel y no se regenera, el juego funciona igual pero ese archivo se pide tarde (npm run preload).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { preloadBlock, currentBlock } from '../tools/preload.mjs';

test('index.html precarga todos los módulos y niveles del arranque (npm run preload)', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.equal(currentBlock(html), preloadBlock(), 'la precarga no está al día: npm run preload');
});
