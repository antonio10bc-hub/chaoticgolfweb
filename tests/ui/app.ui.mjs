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
    { chaoticgolf_tutorial: { intro: true, cards: Object.fromEntries(['palo1', 'palo2', 'palo3', 'dedo', 'hoyo', 'oHoyo', 'oPalo1', 'no', 'bunker', 'portal'].map(k => [k, 1])) },
      chaoticgolf_intros: { daily: true, rush: true, challenge: true, weekly: true }, ...seed });
  await page.reload({ waitUntil: 'networkidle0' });
  await page.waitForFunction(() => window.chaoticGolf?.app.game && document.getElementById('loadScreen')?.classList.contains('done') !== false);
  await sleep(700);
}
const app = fn => page.evaluate(fn);
const click = sel => page.evaluate(s => document.querySelector(s).click(), sel);
// Partida rápida vive en Modos de juego
const openQuick = async () => { await click('#modesBtn'); await sleep(300); await click('[data-mode="quick:classic"]'); await confirmIfAsked(); await sleep(300); };
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

it('primera vez en un modo: la presentación sale una sola vez', async () => {
  await fresh({ chaoticgolf_intros: {} });
  await click('#modesBtn'); await sleep(300);
  await click('[data-mode="rushNew"]'); await sleep(400);
  assert.ok(await page.$('#dialog[open] .intro.rush'));
  await page.click('#dialog[open] button[value="ok"]'); await sleep(900);
  assert.equal(await app(() => window.chaoticGolf.app.variant), 'rush');
  await click('#menuBtn'); await sleep(400);
  await app(() => { localStorage.removeItem('chaoticgolf_save_rush'); localStorage.removeItem('chaoticgolf_rush'); });
  await click('#modesBack'); await sleep(300); await click('#modesBtn'); await sleep(300);
  await click('[data-mode="rushNew"]'); await sleep(600);
  assert.equal(await page.$('#dialog[open] .intro'), null); // ya vista: arranca directamente
  assert.equal(await app(() => window.chaoticGolf.app.screen), 'game');
});

it('desafío semanal: misma regla, semilla y rivales en dos cargas', async () => {
  await fresh();
  const take = async () => {
    await click('#modesBtn'); await sleep(300);
    await click('[data-mode="weekly"]'); await confirmIfAsked(); await sleep(500);
    const r = await app(() => { const { app } = window.chaoticGolf; return JSON.stringify({ v: app.variant, id: app.run.id, week: app.run.week, seed: app.game.seed, personas: app.game.S.personas }); });
    await click('#menuBtn'); await sleep(300);
    await app(() => localStorage.removeItem('chaoticgolf_save_weekly'));
    return r;
  };
  const a = await take();
  assert.equal(JSON.parse(a).v, 'weekly');
  await page.reload({ waitUntil: 'networkidle0' }); await sleep(800);
  assert.equal(await take(), a);
});

it('reto diario: texto para compartir con un cuadrado por turno', async () => {
  await fresh();
  await click('#dailyCard'); await confirmIfAsked(); await sleep(400);
  const txt = await app(async () => {
    const m = await import('/src/ui/screen-modes.js'), { app } = window.chaoticGolf;
    return m.dailyShareText({ won: true, turns: 4, S: app.game.S, date: app.run.date,
      st: { dists: [5, 3, 3, 4, 2], route: [[0, 0, 'o'], [0, 1, 'm'], [0, 1, 'h'], [1, 1, 't'], [1, -1, 'f']] } });
  });
  assert.match(txt, /^Chaotic Golf/);
  assert.ok(txt.includes('🟩🟨🟥🟩⛳'));
  assert.ok(txt.includes('💥 1 · 🌀 1 · 🕳️ 1'));
});

it('menú vivo: con el reto de hoy completado, la bola rueda al hoyo una sola vez', async () => {
  const d = new Date(), k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const z = { story: 0, puzzle: 0, daily: 0, rush: 0, pve: 0, local: 0, challenge: 0, weekly: 0 };
  await fresh({ chaoticgolf_stats: { version: 1, played: z, won: z, totals: {}, levels: {}, puzzles: {}, pve: {}, daily: { days: { [k]: { best: 3, strokes: 5 } }, streak: 1, bestStreak: 1, last: k }, rush: {}, challenges: {} } });
  await sleep(2600);
  assert.equal(await app(() => document.getElementById('menuBall').style.opacity), '0');
  assert.equal(await app(() => localStorage.getItem('chaoticgolf_menuBall')), k);
});

it('guardado: tras una jugada aparece el aviso "Guardado"', async () => {
  await fresh();
  await click('#storyBtn'); await sleep(300);
  await click('.lvlCard[data-level="0"]'); await sleep(900);
  await app(() => { const { app, ctl } = window.chaoticGolf; app.game.S.hands[0] = ['palo1', 'palo1']; ctl.render(); ctl.clickCard(0, 0); const t = app.game.pending.targets.find(t => !t.out); ctl.clickCell(t.x, t.y); });
  await sleep(200);
  assert.ok(await app(() => document.getElementById('saveTick').classList.contains('show')));
});

it('modos de juego: dos pestañas (una a la vez) y 4 barajas con estadísticas', async () => {
  await fresh();
  await click('#modesBtn'); await sleep(400);
  const vis = () => app(() => [...document.querySelectorAll('.mdPanel')].filter(p => !p.classList.contains('off')).map(p => p.dataset.panel).join());
  assert.equal(await vis(), 'quick');
  assert.equal(await app(() => document.querySelectorAll('.deckCard').length), 4);
  assert.equal(await app(() => document.querySelectorAll('.deckCard.locked').length), 0);
  assert.ok(await page.$('[data-mode="quick:water"]')); // la de agua ya se juega
  await click('[data-mtab="special"]'); await sleep(700);
  assert.equal(await vis(), 'special');
  assert.ok(await page.$('.mdPanel[data-panel="special"] [data-mode="rushNew"]'));
  // se recuerda la pestaña
  await click('#modesBack'); await sleep(300); await click('#modesBtn'); await sleep(400);
  assert.equal(await vis(), 'special');
  // una partida rápida cuenta en su baraja
  await click('[data-mtab="quick"]'); await sleep(600);
  await click('[data-mode="quick:classic"]'); await confirmIfAsked(); await sleep(300);
  await click('#pvePlay'); await confirmIfAsked(); await sleep(500);
  assert.equal(await app(() => JSON.parse(localStorage.getItem('chaoticgolf_stats')).decks.classic.p), 1);
});

it('final de partida: "Compartir" genera la imagen de la jugada final', async () => {
  await fresh();
  await click('#storyBtn'); await sleep(300);
  await click('.lvlCard[data-level="0"]'); await sleep(900);
  await app(() => { const { app, ctl } = window.chaoticGolf, S = app.game.S, b = S.balls[0];
    b.x = S.hole.x; b.y = S.hole.y + 1; S.hands[0] = ['palo1', 'palo1']; ctl.render();
    ctl.clickCard(0, 0); const t = app.game.pending.targets.find(t => t.dir === 'up'); ctl.clickCell(t.x, t.y); });
  await page.waitForSelector('#winOverlay.visible', { timeout: 10000 }); await sleep(500);
  await click('#winBtns [data-act="share"]'); await sleep(1500);
  const img = await app(() => { const i = document.querySelector('.sharePreview'); return i && i.complete ? [i.naturalWidth, i.naturalHeight] : null; });
  assert.deepEqual(img, [1080, 1350]);
  assert.ok(await page.$('[data-share="download"]'));
  await page.keyboard.press('Escape'); await sleep(200);
});

it('baraja de agua: sin búnkeres ni portales, con río y lago, y fondo de lago', async () => {
  await fresh();
  await click('#modesBtn'); await sleep(400); await click('[data-mtab="quick"]'); await sleep(600);
  await click('[data-mode="quick:water"]'); await confirmIfAsked(); await sleep(300);
  await click('#pvePlay'); await confirmIfAsked(); await sleep(700);
  const r = await app(() => { const S = window.chaoticGolf.app.game.S, all = [...S.deck, ...S.hands.flat()];
    return { scene: document.getElementById('gameScreen').dataset.scene, bunker: all.filter(k => k === 'bunker' || k === 'portal').length,
      water: all.filter(k => k === 'river' || k === 'lake').length }; });
  assert.deepEqual(r, { scene: 'lake', bunker: 0, water: 10 });
});

it('menú: el botón de Lo básico dice cuántos llevas y, con todos, un tic', async () => {
  await fresh({ chaoticgolf_progress: { 0: true, 1: true, 2: true } });
  assert.equal(await app(() => document.getElementById('storyProg').textContent), '3/8');
  await fresh({ chaoticgolf_progress: Object.fromEntries([0, 1, 2, 3, 4, 5, 6, 7].map(i => [i, true])) });
  assert.ok(await app(() => document.getElementById('storyProg').classList.contains('all')));
});

it('Lo básico: salirse del tablero tiene su aviso en cualquier nivel', async () => {
  await fresh();
  await click('#storyBtn'); await sleep(300);
  await click('.lvlCard[data-level="0"]'); await sleep(900);
  await app(() => { const { app, ctl } = window.chaoticGolf, S = app.game.S, b = S.balls[0];
    S.hands[0] = ['palo3', 'palo1']; ctl.render(); ctl.clickCard(0, 0); const t = app.game.pending.targets.find(t => t.out); ctl.clickCell(t.x, t.y); });
  await sleep(300);
  assert.match(await app(() => document.getElementById('storyTip').textContent), /tablero/i);
});

it('baraja nueva: la primera vez presenta sus cartas con un tablero de ejemplo animado', async () => {
  await fresh();
  await click('#modesBtn'); await sleep(400); await click('[data-mtab="quick"]'); await sleep(600);
  await click('[data-mode="quick:water"]'); await confirmIfAsked(); await sleep(300);
  await click('#pvePlay'); await sleep(500);
  assert.equal(await app(() => document.querySelectorAll('#dialog[open] .dmCard .dmBoard animate').length > 0), true);
  assert.equal(await app(() => document.querySelectorAll('#dialog[open] .dmCard').length), 2);
  await page.click('#dialog[open] button[value="ok"]'); await sleep(700);
  assert.equal(await app(() => window.chaoticGolf.app.screen), 'game');
  // la segunda vez ya no
  await click('#menuBtn'); await sleep(400);
  await app(() => localStorage.removeItem('chaoticgolf_save_pve'));
  await click('[data-mode="quick:water"]'); await sleep(300); await click('#pvePlay'); await sleep(500);
  assert.equal(await page.$('#dialog[open] .deckIntro'), null);
});

it('baraja de minigolf: campo 8 columnas más ancho, piezas de madera y presentación de 4 cartas', async () => {
  await fresh();
  await click('#modesBtn'); await sleep(400); await click('[data-mtab="quick"]'); await sleep(600);
  await app(() => { window.chaoticGolf.app.pveCfg.size = 'm'; });
  await click('[data-mode="quick:minigolf"]'); await confirmIfAsked(); await sleep(300);
  await click('#pvePlay'); await sleep(600);
  assert.equal(await app(() => document.querySelectorAll('#dialog[open] .dmCard').length), 4);
  await page.click('#dialog[open] button[value="ok"]'); await sleep(900);
  const r = await app(() => { const S = window.chaoticGolf.app.game.S, all = [...S.deck, ...S.hands.flat()];
    return { cols: S.cols, rows: S.rows, scene: document.getElementById('gameScreen').dataset.scene, wood: all.filter(k => ['block', 'corner', 'tunnel', 'launcher'].includes(k)).length }; });
  assert.deepEqual(r, { cols: 15, rows: 9, scene: 'mini', wood: 13 });
});

it('Ultimate: reúne las cartas de todas las barajas', async () => {
  await fresh({ chaoticgolf_deckIntros: { ultimate: true } });
  await click('#modesBtn'); await sleep(400); await click('[data-mtab="quick"]'); await sleep(600);
  await click('[data-mode="quick:ultimate"]'); await confirmIfAsked(); await sleep(300);
  await click('#pvePlay'); await sleep(900);
  const kinds = await app(() => { const S = window.chaoticGolf.app.game.S; return [...new Set([...S.deck, ...S.hands.flat()])]; });
  for (const k of ['bunker', 'portal', 'river', 'lake', 'block', 'corner', 'tunnel', 'launcher', 'palo10', 'paloIri']) assert.ok(kinds.includes(k), k);
});

it('puzles: terminar el turno sin embocar muestra "otra vez"', async () => {
  await fresh();
  await click('#modesBtn'); await sleep(300); // los puzles viven en Modos de juego
  assert.equal(await app(() => document.querySelectorAll('#lvlGrid [data-puzzle]').length), 0);
  await click('#modesGrid [data-puzzle="0"]'); await sleep(900);
  assert.equal(await app(() => window.chaoticGolf.app.variant), 'puzzle');
  await click('#endTurnBtn');
  await page.waitForSelector('#winOverlay.visible', { timeout: 5000 });
  assert.match(await app(() => document.getElementById('winMsg').textContent), /otra vez/i);
});

it('creador: se pinta arrastrando, se guarda, se comparte con un código y quien lo recibe lo guarda', async () => {
  await fresh();
  await click('#modesBtn'); await sleep(300);
  await click('[data-mtab="special"]'); await sleep(500);
  await click('#editorBtn'); await sleep(500);
  const at = (x, y) => page.evaluate((x, y) => { const r = document.querySelector(`#edBoard .cell[data-x="${x}"][data-y="${y}"]`).getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }, x, y);
  await click('#edTools [data-tool="lake"]');
  const [a, b] = await at(0, 0), [c, d] = await at(2, 0);
  await page.mouse.move(a, b); await page.mouse.down(); await page.mouse.move(c, d, { steps: 6 }); await page.mouse.up(); await sleep(100);
  await click('#edTools [data-tool="corner"]');
  const [e, f] = await at(5, 3);
  await page.mouse.click(e, f); await sleep(60); await page.mouse.click(e, f); await sleep(60); // pone y gira
  const L = await app(() => JSON.parse(localStorage.getItem('chaoticgolf_editor')).level);
  assert.deepEqual(L.tiles.filter(t => t.type === 'lake').map(t => t.x), [0, 1, 2]);
  assert.deepEqual(L.tiles.find(t => t.type === 'corner'), { type: 'corner', x: 5, y: 3, rot: 1 });
  await page.keyboard.down('Control'); await page.keyboard.press('KeyZ'); await page.keyboard.up('Control'); await sleep(80); // deshace el giro
  assert.equal(await app(() => JSON.parse(localStorage.getItem('chaoticgolf_editor')).level.tiles.find(t => t.type === 'corner').rot), undefined);
  await page.focus('#edName'); await page.keyboard.type('Compartido'); await page.keyboard.press('Enter');
  await click('#edShare'); await sleep(500); // guarda y abre el diálogo con el código
  const code = await app(() => document.getElementById('lvCode').value);
  assert.match(code, /^CG[01]/);
  assert.equal(await app(() => JSON.parse(localStorage.getItem('chaoticgolf_levels')).levels.length), 1);
  await page.keyboard.press('Escape'); await sleep(200);
  // otra persona (sin niveles) abre el enlace y lo guarda
  await app(() => localStorage.removeItem('chaoticgolf_levels'));
  await page.goto(URL + '#nivel=' + code, { waitUntil: 'networkidle0' });
  await page.waitForSelector('#dialog[open] button[value="save"]'); await sleep(200);
  await page.click('#dialog[open] button[value="save"]'); await sleep(300);
  const got = await app(() => JSON.parse(localStorage.getItem('chaoticgolf_levels')).levels);
  assert.equal(got.length, 1);
  assert.equal(got[0].name, 'Compartido');
  assert.equal(got[0].origin, 'received');
  // lo vuelve a abrir: ya lo tiene → se avisa, y puede guardar otra copia igualmente
  await page.goto(URL + '#nivel=' + code, { waitUntil: 'networkidle0' });
  await page.waitForSelector('#dialog[open] button[value="copy"]'); await sleep(200);
  assert.match(await app(() => document.querySelector('#dialog h3').textContent), /ya tienes este nivel/i);
  assert.equal(await page.$('#dialog[open] button[value="play"]'), null);
  await page.click('#dialog[open] button[value="copy"]'); await sleep(300);
  assert.equal(await app(() => JSON.parse(localStorage.getItem('chaoticgolf_levels')).levels.length), 2);
  await app(() => { const s = JSON.parse(localStorage.getItem('chaoticgolf_levels')); s.levels.pop(); localStorage.setItem('chaoticgolf_levels', JSON.stringify(s)); });
  // en Tus niveles se elimina sin diálogo y se puede deshacer
  await click('#modesBtn'); await sleep(300);
  await click('[data-mtab="special"]'); await sleep(500);
  await click('[data-lvdel="0"]'); await sleep(200);
  assert.equal(await app(() => JSON.parse(localStorage.getItem('chaoticgolf_levels')).levels.length), 0);
  await click('#toast .toastAct'); await sleep(300);
  assert.equal(await app(() => JSON.parse(localStorage.getItem('chaoticgolf_levels')).levels.length), 1);
});

it('enlace con el juego ya abierto: el nivel sale en esa pestaña y la nueva se cierra', async () => {
  await fresh();
  const code = await app(async () => { const m = await import('/src/content/levels/share.js'); return m.encodeLevel(window.chaoticGolf.app.storyLevels[1]); });
  // la pestaña nueva, abierta desde fuera (como un enlace pulsado en otra app)
  const cdp = await browser.target().createCDPSession();
  const { targetId } = await cdp.send('Target.createTarget', { url: URL + '#nivel=' + code });
  const gone = async () => !(await cdp.send('Target.getTargets')).targetInfos.some(t => t.targetId === targetId);
  for (let i = 0; i < 40 && !(await gone()); i++) await sleep(150);
  assert.ok(await gone(), 'la pestaña del enlace se cierra');
  await page.waitForSelector('#dialog[open] button[value="save"]', { timeout: 3000 });
  await page.click('#dialog[open] button[value="save"]'); await sleep(300);
  assert.equal(await app(() => JSON.parse(localStorage.getItem('chaoticgolf_levels')).levels.length), 1);
  // sin otra pestaña del juego abierta, el enlace se abre donde se pulsa
  const p2 = await browser.newPage();
  await page.close(); page = p2;
  page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
  await page.setViewport({ width: 1280, height: 860 }); await page.emulateTimezone('Europe/Madrid');
  await page.goto(URL + '#nivel=' + code, { waitUntil: 'networkidle0' });
  await page.waitForSelector('#dialog[open] button[value="copy"]', { timeout: 3000 }); // (y ya lo tiene)
});

it('probar nivel: con trampas (cartas a mano, deshacer y mover piezas con la rueda del ratón)', async () => {
  await fresh();
  await app(() => import('/src/ui/editor.js').then(m => m.openEditor())); await sleep(500);
  assert.equal(await page.$('#edLab'), null); // un solo botón: Probar nivel
  await click('#edTest'); await sleep(800);
  assert.equal(await app(() => window.chaoticGolf.app.mode), 'test');
  assert.equal(await app(() => document.getElementById('labPanel').hidden), false);
  const n0 = await app(() => window.chaoticGolf.app.game.S.hands[0].length);
  await click('#labPanel [data-give="paloIri"]'); await sleep(200);
  assert.equal(await app(() => window.chaoticGolf.app.game.S.hands[0].at(-1)), 'paloIri');
  await click('#labPanel [data-lab="undo"]'); await sleep(200);
  assert.equal(await app(() => window.chaoticGolf.app.game.S.hands[0].length), n0);
  // rueda del ratón: se elige la pelota y se suelta en una casilla libre
  const cell = (x, y) => page.evaluate((x, y) => { const r = document.querySelector(`#board .cell[data-x="${x}"][data-y="${y}"]`).getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }, x, y);
  const b0 = await app(() => { const b = window.chaoticGolf.app.game.S.balls[0]; return [b.x, b.y]; });
  const [bx, by] = await cell(...b0);
  await page.mouse.click(bx, by, { button: 'middle' }); await sleep(200);
  assert.ok(await app(() => document.querySelectorAll('#board .cell.godTarget').length > 5));
  const [tx, ty] = await cell(0, 0);
  await page.mouse.click(tx, ty, { button: 'middle' }); await sleep(300);
  assert.deepEqual(await app(() => { const b = window.chaoticGolf.app.game.S.balls[0]; return [b.x, b.y]; }), [0, 0]);
  await click('#menuBtn'); await sleep(300);
  assert.equal(await app(() => window.chaoticGolf.app.screen), 'editor');
});

it('desafíos: todos arrancan con sus piezas dentro del tablero, sin solaparse ni tapar salidas, hoyo o PAR', async () => {
  await fresh();
  const ids = await app(() => import('/src/content/challenges.js').then(m => m.CHALLENGES.map(c => c.id)));
  assert.ok(ids.length >= 18);
  for (const id of ids) {
    await app(() => localStorage.removeItem('chaoticgolf_save_challenge'));
    await page.evaluate(id => import('/src/ui/screen-modes.js').then(m => m.startChallenge(id)), id); await sleep(400);
    const bad = await app(() => {
      const S = window.chaoticGolf.app.game.S, seen = new Set(), out = [];
      for (const t of S.tiles) {
        const k = t.x + ',' + t.y;
        if (t.x < 0 || t.y < 0 || t.x >= S.cols || t.y >= S.rows) out.push('fuera ' + k);
        if (seen.has(k)) out.push('repetida ' + k);
        seen.add(k);
        if (S.balls.some(b => b.x === t.x && b.y === t.y) || (S.hole.x === t.x && S.hole.y === t.y) || (t.type !== 'bunker' && S.parCells.some(p => p.x === t.x && p.y === t.y))) out.push('tapa ' + k);
      }
      return out;
    });
    assert.deepEqual(bad, [], id);
    await click('#menuBtn'); await sleep(200);
  }
});

/* ---------- interfaz táctil (móvil y tableta): html.phone por dispositivo, no por ancho ---------- */
const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const PHONE = { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
// una página aparte emulando un móvil (la principal sigue siendo la del ordenador)
async function phonePage(vp = PHONE) {
  const p = await browser.newPage();
  p.on('pageerror', e => errors.push(e.message));
  p.on('dialog', d => d.accept());
  await p.setUserAgent(IPHONE_UA); await p.setViewport(vp);
  await p.goto(URL, { waitUntil: 'networkidle0' });
  await p.evaluate(() => { localStorage.clear();
    localStorage.setItem('chaoticgolf_tutorial', JSON.stringify({ intro: true, cards: Object.fromEntries(['palo1', 'palo2', 'palo3', 'dedo', 'hoyo', 'oHoyo', 'oPalo1', 'no', 'bunker', 'portal'].map(k => [k, 1])) }));
    localStorage.setItem('chaoticgolf_deckIntro', JSON.stringify({ classic: 1, water: 1, mini: 1, ultimate: 1 })); });
  await p.reload({ waitUntil: 'networkidle0' });
  await p.waitForFunction(() => window.chaoticGolf?.app.game); await sleep(500);
  return p;
}
async function phoneQuick(p, cfg = {}, deck = 'classic') {
  await p.evaluate(async (cfg, deck) => { const { app } = window.chaoticGolf; const m = await import('/src/ui/screen-pve.js');
    app.pveCfg = { ...app.pveCfg, size: 'm', opps: 2, diff: 'normal', ...cfg, deck }; m.openPveSetup(deck); m.startPveMatch(); }, cfg, deck);
  await sleep(500); await p.evaluate(() => document.querySelectorAll('#dialog[open]').forEach(d => d.close())); await sleep(700);
  // turno de la persona, sin nada en marcha
  await p.waitForFunction(() => { const { app } = window.chaoticGolf, S = app.game.S; return S.turn === S.human && !app.animating && !app.ai.acting && !app.game.pending; }, { timeout: 60000 });
}
const rect = (p, sel) => p.evaluate(s => { const r = document.querySelector(s).getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; }, sel);
const overlap = (a, b) => a.l < b.r - 1 && b.l < a.r - 1 && a.t < b.b - 1 && b.t < a.b - 1;

it('táctil: solo el dispositivo decide (ventana estrecha de ordenador = diseño de siempre; móvil = interfaz táctil)', async () => {
  await fresh();
  await page.setViewport({ width: 400, height: 800 }); await sleep(300);
  assert.equal(await app(() => document.documentElement.classList.contains('phone')), false);
  await page.setViewport({ width: 1280, height: 860 });
  const p = await phonePage();
  assert.equal(await p.evaluate(() => document.documentElement.classList.contains('phone')), true);
  assert.match(await p.evaluate(() => document.querySelector('meta[name="viewport"]').content), /viewport-fit=cover/);
  // Ajustes → Interfaz: Ordenador la quita en el mismo momento
  await p.evaluate(() => import('/src/ui/prefs.js').then(m => m.setPref('ui', 'desktop')));
  assert.equal(await p.evaluate(() => document.documentElement.classList.contains('phone')), false);
  await p.evaluate(() => import('/src/ui/prefs.js').then(m => m.setPref('ui', 'auto')));
  assert.equal(await p.evaluate(() => document.documentElement.classList.contains('phone')), true);
  await p.close();
});

it('táctil en vertical: tablero entero y a lo ancho, sin solapes, y rivales que no juegan con menos opacidad', async () => {
  const p = await phonePage();
  await phoneQuick(p);
  const board = await rect(p, '#boardWrap'), bar = await rect(p, '#gameBar'), seats = await rect(p, '#seats'), dock = await rect(p, '#dockRow');
  assert.ok(board.l >= 0 && board.r <= 390 && board.t >= 0 && board.b <= 844, 'el tablero cabe en pantalla');
  assert.ok(board.w > 390 * .9, 'el tablero ocupa casi todo el ancho: ' + board.w);
  for (const [n, r] of [['barra', bar], ['rivales', seats], ['mano', dock]]) assert.ok(!overlap(board, r), 'el tablero no pisa ' + n);
  assert.ok(!overlap(await rect(p, '#pauseBtn'), await rect(p, '#turnPill')), 'menú y píldora no se pisan');
  // ¿el tablero entero dentro de su marco? (última casilla visible)
  const last = await rect(p, '#board .cell:last-child');
  assert.ok(last.b <= board.b + 1 && last.r <= board.r + 1, 'la última casilla se ve');
  assert.ok(last.w >= 40, 'casillas cómodas para el dedo: ' + last.w);
  // en la barra solo el menú (pausa): lo demás está dentro
  assert.equal(await p.evaluate(() => getComputedStyle(document.getElementById('menuBtn')).display), 'none');
  // turno de un bot: su ficha entera, la otra y tu mano apagadas
  await p.evaluate(() => window.chaoticGolf.ctl.endTurn());
  await p.waitForFunction(() => document.querySelector('.seat.active'), { timeout: 8000 });
  const op = await p.evaluate(() => [...document.querySelectorAll('.seat')].map(s => [s.classList.contains('active'), +getComputedStyle(s).opacity]));
  assert.ok(op.some(([a, o]) => a && o > .95) && op.some(([a, o]) => !a && o < .7), JSON.stringify(op));
  // tu mano se aparta y pierde opacidad, salvo las naranjas (se pueden jugar fuera de turno)
  await p.evaluate(() => { const { app, ctl } = window.chaoticGolf, S = app.game.S; S.hands[S.human] = ['palo2', 'no']; ctl.render(); });
  await sleep(400);
  const dim = await p.evaluate(() => ({ black: +getComputedStyle(document.querySelector('#hands .card[data-key="palo2"]')).opacity,
    orange: +getComputedStyle(document.querySelector('#hands .card[data-key="no"]')).opacity, btns: +getComputedStyle(document.getElementById('turnActions')).opacity }));
  assert.ok(dim.black < .7 && dim.btns < .7, 'negras y botones apagados: ' + JSON.stringify(dim));
  assert.ok(await p.evaluate(() => !document.querySelector('#hands .card[data-key="no"]').classList.contains('unplayable')) ? dim.orange > .95 : true, 'naranja entera: ' + JSON.stringify(dim));
  await p.close();
});

it('táctil: cartas de efecto inmediato con dos toques, mantener pulsado explica y el menú de pausa lo tiene todo', async () => {
  const p = await phonePage();
  await phoneQuick(p);
  await p.evaluate(() => { const { app, ctl } = window.chaoticGolf, S = app.game.S; S.hands[S.human] = ['hoyoUp', 'palo3']; ctl.render(); });
  const hole0 = await p.evaluate(() => ({ ...window.chaoticGolf.app.game.S.hole }));
  await p.evaluate(() => document.querySelector('#hands .card[data-key="hoyoUp"]').click()); await sleep(250);
  assert.equal(await p.evaluate(() => window.chaoticGolf.app.armed?.key), 'hoyoUp', 'primer toque: elegida');
  assert.deepEqual(await p.evaluate(() => ({ ...window.chaoticGolf.app.game.S.hole })), hole0, 'aún no se ha jugado');
  assert.ok(await p.$('#actionBar [data-act="playArmed"]'), 'aviso con "Jugar"');
  assert.ok(await p.evaluate(() => document.getElementById('previewSvg')?.classList.contains('visible')), 'se ve qué hará');
  await p.evaluate(() => document.querySelector('#hands .card[data-key="hoyoUp"]').click()); await sleep(900);
  assert.notDeepEqual(await p.evaluate(() => ({ ...window.chaoticGolf.app.game.S.hole })), hole0, 'segundo toque: jugada');
  // mantener pulsado: explicación, sin elegir la carta
  await p.waitForFunction(() => !window.chaoticGolf.app.animating);
  const c = await (await p.$('#hands .card[data-key="palo3"]')).boundingBox();
  await p.touchscreen.touchStart(c.x + c.width / 2, c.y + c.height / 2); await sleep(650); await p.touchscreen.touchEnd(); await sleep(200);
  assert.ok(await p.evaluate(() => document.getElementById('cardTip').classList.contains('visible')), 'explicación a la vista');
  assert.equal(await p.evaluate(() => window.chaoticGolf.app.game.pending), null, 'mantener pulsado no la juega');
  // menú de pausa: reglas, ajustes, historial y reiniciar
  await p.evaluate(() => document.getElementById('pauseBtn').click()); await sleep(250);
  for (const a of ['resume', 'rules', 'settings', 'log', 'restart', 'menu'])
    assert.ok(await p.evaluate(a => { const b = document.querySelector(`#pauseOverlay [data-pause="${a}"]`); return !!b && b.getBoundingClientRect().width > 0; }, a), a);
  await p.close();
});

it('táctil: con casillas pequeñas (Ultimate) la cámara se acerca al elegir destino y se aleja al acabar', async () => {
  const p = await phonePage();
  await phoneQuick(p, { opps: 3 }, 'ultimate');
  assert.ok(await p.evaluate(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--cell-w')) < 30), 'Ultimate entero: casillas pequeñas');
  await p.evaluate(() => { const { app, ctl } = window.chaoticGolf, S = app.game.S; S.hands[S.human][0] = 'palo3'; ctl.render(); ctl.clickCard(S.human, 0); });
  await sleep(500);
  assert.match(await p.evaluate(() => document.getElementById('boardZoom').style.transform), /scale/, 'se acerca');
  await p.evaluate(() => window.chaoticGolf.ctl.cancel()); await sleep(500);
  assert.equal(await p.evaluate(() => document.getElementById('boardZoom').style.transform), '', 'vuelve a verse entero');
  await p.close();
});

it('táctil en horizontal: tablero a todo el alto entre la columna de rivales y la de la mano', async () => {
  const p = await phonePage({ width: 844, height: 390, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await phoneQuick(p, { opps: 3 });
  const board = await rect(p, '#boardWrap'), seats = await rect(p, '#seats'), dock = await rect(p, '#dockRow'), bar = await rect(p, '#gameBar');
  assert.ok(board.h > 390 * .9, 'a todo el alto: ' + board.h);
  assert.ok(seats.r <= board.l && bar.r <= board.l && dock.l >= board.r, 'rivales y barra a la izquierda, mano a la derecha');
  assert.ok(dock.b <= 390 + 1, 'la mano cabe');
  await p.close();
});

it('final de partida: cabe sin desplazarse (móvil pequeño y ordenador bajo), también con "¿por qué he perdido?"', async () => {
  for (const vp of [{ width: 375, height: 667, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, { width: 844, height: 390, deviceScaleFactor: 2, isMobile: true, hasTouch: true }]) {
    const p = await phonePage(vp);
    await phoneQuick(p);
    // una partida larga (recorrido, choques, cartas…) y la pierde un bot contra ti
    await p.evaluate(() => { const { app, ctl } = window.chaoticGolf, S = app.game.S, me = S.human, b = S.balls.find(x => x.player === me);
      const route = [[b.x, b.y, 'o']]; let y = b.y; for (let i = 0; i < 12; i++) { y = Math.max(1, y - 1); route.push([b.x, y, i === 4 ? 'h' : i === 7 ? 'H' : 'm']); }
      ctl.setStats({ golpes: 14, hundidas: 1, colisiones: 5, portales: 2, caidas: 1, turnos: 7, longest: { n: 7, p: me }, hitsOnMe: { [(me + 1) % S.nPlayers]: 3 }, cardsUsed: { palo3: 4 }, route });
      const w = S.balls.find(x => x.player !== me);
      for (const o of S.balls) if (o !== w && o.x === S.hole.x && o.y === S.hole.y + 1) o.x = (o.x + 2) % S.cols;
      w.x = S.hole.x; w.y = S.hole.y + 1; S.turn = w.player; S.hands[w.player][0] = 'palo1';
      app.ai.acting = true; ctl.clickCard(w.player, 0); ctl.clickCell(S.hole.x, S.hole.y); app.ai.acting = false; });
    await sleep(2500);
    await p.evaluate(() => { if (!document.getElementById('winOverlay').classList.contains('visible')) window.chaoticGolf.ctl.confirmWin(); });
    await sleep(900);
    const fits = () => p.evaluate(() => { const o = document.getElementById('winOverlay'); return o.classList.contains('visible') && o.scrollHeight <= o.clientHeight + 1; });
    assert.ok(await fits(), 'el final cabe ' + vp.width + '×' + vp.height);
    await p.evaluate(() => document.querySelector('[data-act="why"]')?.click()); await sleep(300);
    assert.ok(await fits(), 'con "¿por qué he perdido?" abierto, también ' + vp.width + '×' + vp.height);
    await p.close();
  }
});

it('tu pelota: el botón del menú abre la ventana; una pelota ganada se pone y se ve en la partida rápida y en el tablero', async () => {
  await fresh({ chaoticgolf_stats: { version: 1, played: {}, won: {}, totals: {}, levels: {}, puzzles: {}, pve: {}, daily: { days: {}, streak: 0, bestStreak: 9 },
    rush: { best: 0, runs: 0 }, challenges: {}, weekly: { weeks: {} }, rivals: {}, history: {}, cards: {}, decks: { classic: { p: 5, w: 4 } }, chStats: {} } });
  assert.equal(await app(() => getComputedStyle(document.getElementById('profileBtn')).display !== 'none'), true, 'botón en el menú');
  assert.equal(await app(() => !document.querySelector('#profileBtn .pfDot').hidden), true, 'punto: hay pelotas nuevas');
  await click('#profileBtn'); await sleep(400);
  assert.ok(await app(() => document.getElementById('profileOverlay').classList.contains('visible')));
  assert.equal(await app(() => document.querySelectorAll('.pfCard').length), 8);
  assert.equal(await app(() => document.querySelectorAll('.pfCard .pfNew').length), 2, 'fuego y clásica, nuevas');
  // un nivel sin ganar se ve, pero no se puede poner; uno ganado, sí
  await click('[data-pfv="fire:2"]'); await sleep(200);
  assert.equal(await app(() => !!document.querySelector('[data-pf="equip"]')), false);
  await click('[data-pfv="fire:1"]'); await sleep(200);
  await click('[data-pf="equip"]'); await sleep(300);
  assert.deepEqual(await app(() => JSON.parse(localStorage.getItem('chaoticgolf_profile')).skin), { id: 'fire', lvl: 1 });
  await click('[data-pf="close"]'); await sleep(200);
  assert.equal(await app(() => document.querySelector('#profileBtn .pfDot').hidden), true, 'vistas: sin punto');
  // partida rápida: la pelota puesta, elegida bajo el color; y en el tablero, tu pelota la lleva
  await openQuick();
  assert.ok(await app(() => document.querySelector('#pveSkins .pveSkin.sel[data-pskin="fire:1"]')));
  await click('#pveSkins [data-pskin="classic:1"]'); await sleep(200);
  await click('#pvePlay'); await sleep(900);
  const cls = await app(() => { const S = window.chaoticGolf.app.game.S; return document.querySelector(`#pieces .piece[data-id="b${S.human}"] .circ`).className; });
  assert.match(cls, /sk-classic sl1/);
  const other = await app(() => { const S = window.chaoticGolf.app.game.S; return document.querySelector(`#pieces .piece[data-id="b${(S.human + 1) % S.nPlayers}"] .circ`).className; });
  assert.doesNotMatch(other, /sk-/, 'los bots, con la normal');
});
