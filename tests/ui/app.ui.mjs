// Tests de interfaz en un navegador real (Chrome/Chromium del sistema, como la prueba de humo):
// guardado y continuar, pausa, multijugador local, logros, deshacer, reto diario y puzles.
//   npm run test:ui            (CHROME_PATH=/ruta/a/chrome si no lo encuentra)
// No van en `npm test` porque necesitan un navegador.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';
import { serve } from '../../tools/serve.mjs';

const CHROME = process.env.CHROME_PATH || [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
].find(p => fs.existsSync(p));
const PORT = 8098, URL = `http://localhost:${PORT}/`;
const sleep = ms => new Promise(r => setTimeout(r, ms));
let server, browser, page, errors = [];

// página limpia (sin nada guardado); `seed` rellena localStorage antes de arrancar
async function fresh(seed = {}) {
  await page.goto(URL, { waitUntil: 'networkidle0' });
  await page.evaluate(s => { localStorage.clear(); for (const [k, v] of Object.entries(s)) localStorage.setItem(k, JSON.stringify(v)); },
    { chaoticgolf_tutorial: { intro: true, cards: Object.fromEntries(['palo1', 'palo2', 'palo3', 'dedo', 'hoyo', 'oHoyo', 'oPalo1', 'no', 'bunker', 'portal'].map(k => [k, 1])) }, ...seed });
  await page.reload({ waitUntil: 'networkidle0' });
  await page.waitForFunction(() => window.chaoticGolf?.app.game && document.getElementById('loadScreen')?.classList.contains('done') !== false);
  await sleep(700);
}
const app = fn => page.evaluate(fn);
const click = sel => page.evaluate(s => document.querySelector(s).click(), sel);
// Partida rápida vive en Modos de juego
const openQuick = async () => { await click('#modesBtn'); await sleep(300); await click('[data-mode="quick"]'); await confirmIfAsked(); await sleep(300); };
const confirmIfAsked = async () => { await sleep(250); if (await page.$('#dialog[open]')) { await page.click('#dialog[open] button[value="ok"]'); await sleep(200); } };

before(async () => {
  if (!CHROME) return;
  server = await serve(PORT);
  browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
  page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 860 });
  await page.emulateTimezone('Europe/Madrid');
  page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', d => d.accept()); // el aviso de "salir con una jugada a medias" al recargar
});
after(async () => { await browser?.close(); server?.close(); });

const it = (name, fn) => test(name, { skip: !CHROME && 'sin Chrome' }, async () => { errors = []; await fn(); assert.deepEqual(errors, [], 'errores en la página'); });

it('guardado: salir al menú guarda y "Continuar partida" retoma el mismo estado', async () => {
  await fresh();
  await openQuick();
  await click('#pvePlay'); await sleep(900);
  const s0 = await app(() => JSON.stringify(window.chaoticGolf.app.game.serialize().S.balls));
  await click('#menuBtn'); await sleep(400); // Partida rápida vuelve a Modos, con su "Continuar" en naranja
  assert.ok(await page.$('#modesGrid .btn-continue[data-mode="resume:pve"]'));
  await page.reload({ waitUntil: 'networkidle0' }); await sleep(900);
  await click('#modesBtn'); await sleep(300);
  await click('[data-mode="resume:pve"]'); await sleep(600);
  assert.equal(await app(() => window.chaoticGolf.app.screen), 'game');
  assert.equal(await app(() => JSON.stringify(window.chaoticGolf.app.game.serialize().S.balls)), s0);
});

it('pausa: la máquina no juega mientras la partida está en pausa', async () => {
  await fresh();
  await app(() => { window.chaoticGolf.app.pveCfg = { color: 0, size: 'm', opps: 3, humans: 1, diff: 'normal' }; });
  await openQuick();
  await click('#pvePlay'); await sleep(200);
  // que empiece un bot
  await app(() => { const { app, ctl } = window.chaoticGolf; const S = app.game.S; S.turn = (S.human + 1) % S.nPlayers; ctl.render(); });
  await click('#pauseBtn'); await sleep(150);
  const n0 = await app(() => window.chaoticGolf.app.game.S.log.length);
  await app(() => window.chaoticGolf.ctl.render());
  await sleep(4500);
  assert.equal(await app(() => window.chaoticGolf.app.game.S.log.length), n0, 'algo se ha jugado en pausa');
  await click('#pauseOverlay [data-pause="resume"]');
  await page.waitForFunction(n => window.chaoticGolf.app.game.S.log.length > n, { timeout: 15000 }, n0);
});

it('multijugador local: no se ven cartas ajenas y se pasa el dispositivo', async () => {
  await fresh();
  await app(() => { window.chaoticGolf.app.pveCfg = { color: 1, size: 's', opps: 0, humans: 2, diff: 'normal' }; });
  await openQuick();
  await click('#pvePlay'); await sleep(600);
  assert.ok(await page.$('#passScreen.visible'));
  assert.equal(await app(() => document.querySelectorAll('#hands .card:not(.back)').length), 0);
  await click('#passScreen [data-pass="ok"]'); await sleep(300);
  assert.ok(await app(() => document.querySelectorAll('#hands .card:not(.back)').length) > 0);
  assert.ok(await app(() => document.querySelectorAll('#seats .card.back').length) > 0, 'la otra persona debe tener la mano tapada');
  await click('#endTurnBtn'); await sleep(500);
  assert.ok(await page.$('#passScreen.visible'), 'al acabar el turno se pasa el dispositivo');
});

it('logros: ganar un nivel a la primera desbloquea "Primera victoria" y "Hoyo en uno"', async () => {
  await fresh();
  await click('#storyBtn'); await sleep(300);
  await click('.lvlCard[data-level="0"]'); await sleep(900);
  await app(() => { const { app, ctl } = window.chaoticGolf; const S = app.game.S, b = S.balls[0]; S.hole.x = b.x; S.hole.y = b.y - 2; S.hands[0] = ['palo2']; ctl.render(); });
  await app(() => { const { app, ctl } = window.chaoticGolf; ctl.clickCard(0, 0); const t = app.game.pending.targets.find(t => t.dir === 'up'); ctl.clickCell(t.x, t.y); });
  await page.waitForSelector('#winOverlay.visible', { timeout: 10000 });
  const got = await app(() => JSON.parse(localStorage.getItem('chaoticgolf_achievements')));
  assert.ok(got.firstWin && got.holeInOne);
});

it('deshacer: en Lo básico devuelve la pelota a donde estaba', async () => {
  await fresh();
  await click('#storyBtn'); await sleep(300);
  await click('.lvlCard[data-level="1"]'); await sleep(900);
  const b0 = await app(() => JSON.stringify(window.chaoticGolf.app.game.S.balls[0]));
  await app(() => { const { app, ctl } = window.chaoticGolf; app.game.S.hands[0] = ['palo1', 'palo1']; ctl.render(); ctl.clickCard(0, 0); const t = app.game.pending.targets[0]; ctl.clickCell(t.x, t.y); });
  await page.waitForFunction(() => !document.getElementById('undoBtn').hidden, { timeout: 8000 });
  await click('#undoBtn'); await sleep(600);
  assert.equal(await app(() => JSON.stringify(window.chaoticGolf.app.game.S.balls[0])), b0);
});

it('reto diario: tablero pequeño contra 2 bots, igual (semilla, rivales, dificultad) en dos cargas', async () => {
  await fresh();
  const take = async () => {
    await click('#dailyCard'); await confirmIfAsked(); await sleep(400);
    const r = await app(() => { const { app } = window.chaoticGolf, S = app.game.S;
      return JSON.stringify({ mode: app.mode, variant: app.variant, seed: app.game.seed, n: S.nPlayers, cols: S.cols, rows: S.rows, human: S.human, personas: S.personas, lvl: S.aiLevel || 'normal' }); });
    const o = JSON.parse(r);
    assert.equal(o.mode, 'pve'); assert.equal(o.variant, 'daily'); assert.equal(o.n, 3); assert.equal(o.cols, 5);
    assert.equal(o.personas.filter(Boolean).length, 2);
    await click('#menuBtn'); await sleep(300);
    await app(() => localStorage.removeItem('chaoticgolf_save_daily'));
    return r;
  };
  const a = await take();
  await page.reload({ waitUntil: 'networkidle0' }); await sleep(800);
  assert.equal(await take(), a);
});

it('puzles: terminar el turno sin embocar muestra "otra vez"', async () => {
  await fresh();
  await click('#storyBtn'); await sleep(300);
  await click('[data-puzzle="0"]'); await sleep(900);
  assert.equal(await app(() => window.chaoticGolf.app.variant), 'puzzle');
  await click('#endTurnBtn');
  await page.waitForSelector('#winOverlay.visible', { timeout: 5000 });
  assert.match(await app(() => document.getElementById('winMsg').textContent), /otra vez/i);
});
