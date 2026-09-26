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
  // en Tus niveles se elimina sin diálogo y se puede deshacer
  await click('#modesBtn'); await sleep(300);
  await click('[data-mtab="special"]'); await sleep(500);
  await click('[data-lvdel="0"]'); await sleep(200);
  assert.equal(await app(() => JSON.parse(localStorage.getItem('chaoticgolf_levels')).levels.length), 0);
  await click('#toast .toastAct'); await sleep(300);
  assert.equal(await app(() => JSON.parse(localStorage.getItem('chaoticgolf_levels')).levels.length), 1);
});

it('laboratorio: añade cualquier carta a la mano y deshace', async () => {
  await fresh();
  await app(() => import('/src/ui/editor.js').then(m => m.openEditor())); await sleep(500);
  await click('#edLab'); await sleep(800);
  assert.equal(await app(() => window.chaoticGolf.app.variant), 'lab');
  const n0 = await app(() => window.chaoticGolf.app.game.S.hands[0].length);
  await click('#labPanel [data-give="paloIri"]'); await sleep(200);
  assert.equal(await app(() => window.chaoticGolf.app.game.S.hands[0].at(-1)), 'paloIri');
  await click('#labPanel [data-lab="undo"]'); await sleep(200);
  assert.equal(await app(() => window.chaoticGolf.app.game.S.hands[0].length), n0);
  await click('#menuBtn'); await sleep(300);
  assert.equal(await app(() => window.chaoticGolf.app.screen), 'editor');
});

it('desafíos: todos arrancan con sus piezas dentro del tablero, sin solaparse ni tapar salidas, hoyo o PAR', async () => {
  await fresh();
  const ids = await app(() => import('/src/ui/screen-modes.js').then(m => m.CHALLENGES.map(c => c.id)));
  assert.ok(ids.length >= 14);
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
        if (S.balls.some(b => b.x === t.x && b.y === t.y) || (S.hole.x === t.x && S.hole.y === t.y) || S.parCells.some(p => p.x === t.x && p.y === t.y)) out.push('tapa ' + k);
      }
      return out;
    });
    assert.deepEqual(bad, [], id);
    await click('#menuBtn'); await sleep(200);
  }
});
