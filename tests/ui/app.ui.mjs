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
// la presentación de la mesa (quién eres, rivales y orden) sale al empezar cada partida contra la máquina: en los tests
// se pulsa "Empezar" sola en cuanto aparece, salvo en el suyo (window.keepLineup)
const autoLineup = () => setInterval(() => { if (!window.keepLineup) document.querySelector('#lineup.visible [data-lineup="go"]')?.click(); }, 60);

// página limpia (sin nada guardado); `seed` rellena localStorage antes de arrancar
async function fresh(seed = {}) {
  await page.bringToFront();
  await page.goto(URL, { waitUntil: 'networkidle0' });
  await page.evaluate(s => { localStorage.clear(); for (const [k, v] of Object.entries(s)) localStorage.setItem(k, JSON.stringify(v)); },
    { chaoticgolf_tutorial: { intro: true, orangeTip: true, cards: Object.fromEntries(['palo1', 'palo2', 'palo3', 'dedo', 'hoyo', 'oHoyo', 'oPalo1', 'no', 'bunker', 'portal'].map(k => [k, 1])) },
      chaoticgolf_intros: { daily: true, rush: true, rush2: true, rush3: true, challenge: true }, chaoticgolf_newDeckSeen: 'gambling', chaoticgolf_gift: 'open', chaoticgolf_crownsIntro: 1,
      chaoticgolf_vitrina: 1, ...seed }); // (TEMPORAL: sin los niveles vitrina en Tus niveles)
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
  // (sin frenar las pestañas en segundo plano: los tests abren y cierran páginas de móvil y la principal se quedaba
  // atrás, con los temporizadores frenados: los bots tardaban tanto que alguna espera se agotaba)
  browser = await puppeteer.launch({ executablePath: CHROME, headless: true,
    args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'] });
  page = await browser.newPage();
  await page.evaluateOnNewDocument(autoLineup);
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

it('presentación de la mesa: antes de empezar dice quién eres, quién empieza y el orden; hasta "Empezar" no juega nadie', async () => {
  await fresh({ chaoticgolf_profile: { name: 'Ana', color: 0 } });
  await app(() => { window.keepLineup = true; window.chaoticGolf.app.pveCfg = { color: 0, size: 'm', opps: 3, humans: 1, diff: 'normal' }; });
  await openQuick();
  await click('#pvePlay'); await sleep(300);
  // que empiece un bot (así se ve que la máquina espera)
  await app(() => { const { app, ctl } = window.chaoticGolf; const S = app.game.S; S.turn = (S.human + 1) % S.nPlayers; ctl.render(); });
  await app(async () => (await import('/src/ui/screen-pve.js')).startAfterLineup('x')); // (se vuelve a presentar con ese turno)
  await sleep(400);
  assert.ok(await page.$('#lineup.visible'));
  const info = await app(() => { const { app } = window.chaoticGolf, S = app.game.S;
    return { order: [...document.querySelectorAll('#lineup .luSeat b')].map(b => b.textContent), first: document.querySelector('#lineup .luSeat.first b').textContent,
      me: document.querySelector('#lineup .luSeat.me b').textContent, title: document.querySelector('#lineup h2').textContent,
      sub: document.querySelector('#lineup .luSub').textContent, turn: S.turn, n: S.nPlayers, human: S.human,
      names: Array.from({ length: S.nPlayers }, (_, i) => S.playerNames[i]) }; });
  assert.equal(info.order.length, 4);
  assert.deepEqual(info.order, Array.from({ length: info.n }, (_, i) => info.names[(info.turn + i) % info.n] || 'Ana'), 'en orden de turnos desde quien empieza');
  assert.equal(info.first, info.names[info.turn]);
  assert.equal(info.me, 'Ana');
  assert.equal(info.title, 'Eres Ana');
  assert.match(info.sub, new RegExp(info.names[info.turn]));
  // no se quita con Escape ni con un clic fuera, y la máquina no juega mientras tanto
  const n0 = await app(() => window.chaoticGolf.app.game.S.log.length);
  await page.keyboard.press('Escape'); await page.mouse.click(10, 10); await page.keyboard.press('p');
  await sleep(3500);
  assert.ok(await page.$('#lineup.visible'), 'sigue abierta');
  assert.equal(await app(() => window.chaoticGolf.app.game.S.log.length), n0, 'algo se ha jugado antes de Empezar');
  await click('#lineup [data-lineup="go"]');
  assert.ok(!await page.$('#lineup.visible'));
  await page.waitForFunction(n => window.chaoticGolf.app.game.S.log.length > n, { timeout: 15000 }, n0);
  await app(() => { window.keepLineup = false; });
});

it('presentación de la mesa: en multijugador local se pasa el dispositivo después de "Empezar"', async () => {
  await fresh();
  await app(() => { window.keepLineup = true; window.chaoticGolf.app.pveCfg = { color: 1, size: 's', opps: 1, humans: 2, diff: 'normal' }; });
  await openQuick();
  await click('#pvePlay'); await sleep(500);
  assert.ok(await page.$('#lineup.visible'));
  assert.ok(!await page.$('#passScreen.visible'), 'sin pasar el dispositivo hasta Empezar');
  assert.equal(await app(() => document.querySelectorAll('#lineup .luSeat').length), 3);
  assert.equal(await app(() => document.querySelectorAll('#lineup .luSeat.me').length), 0, 'con varias personas no hay un "tú"');
  await click('#lineup [data-lineup="go"]'); await sleep(300);
  const human = await app(() => { const S = window.chaoticGolf.app.game.S; return S.humans.includes(S.turn); });
  if (human) assert.ok(await page.$('#passScreen.visible'), 'tras Empezar se pasa el dispositivo a quien empieza');
  await app(() => { window.keepLineup = false; });
});

it('baraja del multiverso: el agujero negro parte la pelota en 4 (copias que se ven distintas), se elige cuál mover y la copia que se cae desaparece', async () => {
  await fresh({ chaoticgolf_deckIntros: { multiverse: true } });
  await app(async () => { const { app } = window.chaoticGolf, m = await import('/src/ui/screen-pve.js');
    app.pveCfg = { ...app.pveCfg, deck: 'multiverse', opps: 1, humans: 1, kind: 'bots', size: 'm' }; m.startPveMatch(); });
  await sleep(900);
  assert.equal(await app(() => document.getElementById('gameScreen').dataset.scene), 'space');
  // tu turno, un agujero negro 3 casillas por encima y un palo 3 hacia arriba
  await app(() => { const { app, ctl } = window.chaoticGolf, S = app.game.S, b = S.balls.find(x => x.player === S.human);
    app.ai.acting = false; S.turn = S.human; S.blackPlayed = 0; S.hole.x = 0; S.hole.y = 0;
    S.tiles.push({ type: 'blackhole', x: b.x, y: b.y - 3 }); S.hands[S.human] = ['palo3', 'palo1']; ctl.render();
    ctl.clickCard(S.human, 0); const tg = app.game.pending.targets.find(q => q.dir === 'up'); ctl.clickCell(tg.x, tg.y); });
  await page.waitForFunction(() => !window.chaoticGolf.app.animating && document.querySelectorAll('#pieces .piece.copyBall').length === 3, { timeout: 15000 });
  assert.equal(await app(() => [...document.querySelectorAll('#pieces .piece.copyBall')].filter(el => el.style.display !== 'none').length), 3, 'las 3 copias, a la vista');
  assert.ok(await app(() => document.querySelector('#pieces .piece.copyBall .ballStamp').textContent.endsWith('′')));
  // con copias, el palo pregunta cuál: una copia que esté en el borde de arriba y hacia fuera
  await app(() => { const { app, ctl } = window.chaoticGolf, S = app.game.S; app.ai.acting = false; S.turn = S.human;
    const c = S.balls.find(x => x.copy); c.y = 0; ctl.render(); ctl.clickCard(S.human, 0); });
  await sleep(200);
  assert.equal(await app(() => window.chaoticGolf.app.game.pending?.kind), 'pickOwn');
  assert.match(await app(() => document.getElementById('actionBar').textContent), /cuál de tus pelotas/);
  await app(() => { const { app, ctl } = window.chaoticGolf, S = app.game.S, c = S.balls.find(x => x.copy && x.y === 0);
    ctl.clickCell(c.x, c.y); const tg = app.game.pending.targets.find(q => q.dir === 'up'); ctl.clickCell(tg.x, tg.y); });
  await page.waitForFunction(() => !window.chaoticGolf.app.animating && document.querySelectorAll('#pieces .piece.copyBall').length === 2, { timeout: 15000 });
  assert.equal(await app(() => window.chaoticGolf.app.game.S.balls.filter(b => b.copy).length), 2, 'la copia que se cae, para siempre');
});

it('baraja del multiverso: el hoyo también se parte en el agujero negro y las cartas de hoyo preguntan cuál', async () => {
  await fresh({ chaoticgolf_deckIntros: { multiverse: true } });
  await app(async () => { const { app } = window.chaoticGolf, m = await import('/src/ui/screen-pve.js');
    app.pveCfg = { ...app.pveCfg, deck: 'multiverse', opps: 1, humans: 1, kind: 'bots', size: 'm' }; m.startPveMatch(); });
  await sleep(900);
  await app(() => { const { app, ctl } = window.chaoticGolf, S = app.game.S; app.ai.acting = false; S.turn = S.human; S.blackPlayed = 0;
    S.hole.x = 4; S.hole.y = 0; S.tiles.push({ type: 'blackhole', x: 4, y: 3 }); S.hands[S.human] = ['hoyoDown', 'hoyoLeft']; ctl.render(); ctl.clickCard(S.human, 0); });
  await page.waitForFunction(() => !window.chaoticGolf.app.animating && document.querySelectorAll('#pieces .piece.copyHole').length === 3, { timeout: 15000 });
  assert.equal(await app(() => [...document.querySelectorAll('#pieces .piece.copyHole')].filter(el => el.style.display !== 'none').length), 3);
  await app(() => { const { app, ctl } = window.chaoticGolf, S = app.game.S; app.ai.acting = false; S.turn = S.human; ctl.render(); ctl.clickCard(S.human, 0); });
  await sleep(200);
  assert.equal(await app(() => window.chaoticGolf.app.game.pending?.kind), 'pickHole');
  assert.match(await app(() => document.getElementById('actionBar').textContent), /qué hoyo mueves/);
  // y la gravedad no se puede usar encima del agujero negro
  assert.equal(await app(() => { const g = window.chaoticGolf.app.game; g.cancel(); g.S.hands[g.S.human] = ['gravedad']; g.clickCard(g.S.human, 0); return g.selectableAt(4, 3); }), null);
});

it('Ultimate: se combinan las barajas tocando sus iconos, el campo crece con ellas y el historial comparte la misma partida', async () => {
  const ctx = browser.defaultBrowserContext();
  await ctx.overridePermissions(URL.replace(/\/$/, ''), ['clipboard-read', 'clipboard-write', 'clipboard-sanitized-write']);
  await fresh({ chaoticgolf_deckIntros: { ultimate: true } });
  await click('#modesBtn'); await sleep(500);
  const size = () => app(() => document.querySelector('.ultSize').textContent);
  assert.equal(await app(() => document.querySelectorAll('.ultTog.on').length), 7, 'de inicio, todas');
  assert.equal(await size(), '19×13 · PAR 7');
  for (const id of ['classic', 'minigolf', 'train', 'seasons', 'multiverse', 'gambling']) { await click(`.ultTog[data-ult="${id}"]`); await sleep(120); }
  assert.deepEqual(await app(() => [...document.querySelectorAll('.ultTog.on')].map(b => b.dataset.ult)), ['water']);
  assert.equal(await size(), '7×9 · PAR 3', 'solo agua: su campo');
  await click('.ultTog[data-ult="water"]'); await sleep(150);
  assert.equal(await app(() => document.querySelectorAll('.ultTog.on').length), 1, 'siempre queda al menos una');
  await click('.ultTog[data-ult="train"]'); await sleep(150);
  await click('[data-mode="quick:ultimate"]'); await sleep(400);
  await click('#pvePlay'); await sleep(900);
  const g1 = await app(() => { const S = window.chaoticGolf.app.game.S; return { cols: S.cols, rows: S.rows, par: S.par, train: !!S.train, river: S.deck.includes('river'), bunker: S.deck.includes('bunker'), seed: window.chaoticGolf.app.game.seed }; });
  assert.deepEqual([g1.cols, g1.rows, g1.par, g1.train, g1.river, g1.bunker], [13, 11, 5, true, true, false], 'agua + tren');
  // el historial: esa combinación, y su enlace abre la misma partida
  await click('#menuBtn'); await sleep(500);
  await click('[data-mode="ultHist"]'); await sleep(300);
  assert.equal(await app(() => document.querySelectorAll('#dialog[open] .ultRow').length), 1);
  await click('#dialog[open] [data-share]'); await sleep(300);
  const link = await page.evaluate(() => navigator.clipboard.readText());
  assert.match(link, /#ultimate=u1\./);
  await click('#dialog[open] button[value="ok"]'); await sleep(200);
  await page.evaluate(() => localStorage.removeItem('chaoticgolf_save_pve'));
  await page.goto(link, { waitUntil: 'networkidle0' }); await sleep(1500);
  assert.deepEqual(await app(() => { const { app } = window.chaoticGolf; return [app.screen, app.game.seed, app.game.S.cols]; }), ['game', g1.seed, 13], 'la misma partida');
});

it('logros: ganar un nivel a la primera desbloquea "Primera victoria" y "Hoyo en uno"', async () => {
  await fresh();
  await click('#storyBtn'); await sleep(300);
  await click('.lvlCard[data-puzzle="0"]'); await sleep(900);
  await app(() => { const { app, ctl } = window.chaoticGolf; const S = app.game.S, b = S.balls[0]; S.hole.x = b.x; S.hole.y = b.y - 2; S.hands[0] = ['palo2']; ctl.render(); });
  await app(() => { const { app, ctl } = window.chaoticGolf; ctl.clickCard(0, 0); const t = app.game.pending.targets.find(t => t.dir === 'up'); ctl.clickCell(t.x, t.y); });
  await page.waitForSelector('#winOverlay.visible', { timeout: 10000 });
  const got = await app(() => JSON.parse(localStorage.getItem('chaoticgolf_achievements')));
  assert.ok(got.firstWin && got.holeInOne);
});

it('deshacer: en Lo básico devuelve la pelota a donde estaba', async () => {
  await fresh();
  await click('#storyBtn'); await sleep(300);
  await click('.lvlCard[data-puzzle="1"]'); await sleep(900);
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

it('contrarreloj: dos cazadores en el borde, lejos de ti; su turno no gasta tu tiempo y no pueden ganar', async () => {
  await fresh();
  await click('#modesBtn'); await sleep(300);
  await click('[data-mtab="special"]'); await sleep(300);
  await click('[data-mode="rushNew"]'); await confirmIfAsked(); await sleep(900);
  const s0 = await app(() => { const { app } = window.chaoticGolf, S = app.game.S;
    return { mode: app.mode, v: app.variant, n: S.nPlayers, hunters: S.hunters, turn: S.turn, me: S.balls[0], hs: S.hunters.map(p => S.balls[p]), cols: S.cols, rows: S.rows,
      seats: document.querySelectorAll('#seats .seat').length, limit: app.run.limit }; });
  assert.equal(s0.v, 'rush'); assert.equal(s0.mode, 'pve');
  assert.deepEqual(s0.hunters, [1, 2]); assert.equal(s0.turn, 0, 'empiezas tú');
  assert.equal(s0.seats, 2, 'los cazadores, en sus asientos');
  assert.ok(s0.limit <= 40, 'poco tiempo: ' + s0.limit);
  for (const h of s0.hs) {
    assert.ok(h.x === 0 || h.y === 0 || h.x === s0.cols - 1 || h.y === s0.rows - 1, 'en el borde');
    assert.ok(Math.abs(h.x - s0.me.x) + Math.abs(h.y - s0.me.y) >= 3, 'lejos de ti');
  }
  // tu turno se acaba: mientras juegan los cazadores, el reloj no corre
  await app(() => window.chaoticGolf.ctl.endTurn()); await sleep(300);
  const e0 = await app(() => window.chaoticGolf.app.run.elapsed);
  await sleep(1200);
  const e1 = await app(() => { const { app } = window.chaoticGolf; return app.game.S.turn === 0 ? null : app.run.elapsed; });
  if (e1 !== null) assert.equal(e1, e0, 'el reloj se para en el turno del cazador');
  await click('#menuBtn'); await confirmIfAsked(); await sleep(300);
});

it('desafíos de la semana: 5 tarjetas con los rivales de la semana; ganar uno da su corona (dorada, +1 arriba) y se comparte', async () => {
  await fresh();
  await click('#modesBtn'); await sleep(300); await click('[data-mtab="special"]'); await sleep(400);
  assert.equal(await app(() => document.querySelectorAll('.crCard').length), 5);
  assert.equal(await app(() => document.querySelectorAll('.crCard.won').length), 0);
  assert.equal(await app(() => document.querySelector('.crTotal b').textContent.trim()), '0');
  assert.equal(await app(() => document.querySelectorAll('.mdSection.crowns [data-crclock] .crT').length), 3, 'la cuenta atrás, en tres casillas');
  const id = await app(() => document.querySelector('.crCard').dataset.mode.split(':')[1]);
  await click('.crCard'); await confirmIfAsked(); await sleep(600);
  const run = await app(async () => { const { app } = window.chaoticGolf, cr = await import('/src/ui/crowns.js'), ch = await import('/src/content/challenges.js');
    return { v: app.variant, id: app.run.id, week: app.run.week, now: cr.thisWeek().wk, personas: app.game.S.personas.filter(Boolean), want: cr.weekRivals(app.run.week, ch.challengeById(app.run.id)) }; });
  assert.equal(run.v, 'challenge'); assert.equal(run.id, id); assert.equal(run.week, run.now);
  assert.deepEqual(run.personas, run.want, 'los rivales de la semana');
  // ganarlo: su corona
  const r = await app(async () => (await import('/src/ui/screen-modes.js')).challengeDone(true));
  assert.equal(r.crown.fresh, true); assert.equal(r.crown.n, 1); assert.ok(r.next && r.next !== id, 'el siguiente por ganar');
  assert.equal((await app(async () => (await import('/src/ui/screen-modes.js')).challengeDone(true))).crown.fresh, false, 'una vez por semana');
  await click('#menuBtn'); await confirmIfAsked(); await sleep(300);
  await app(() => localStorage.removeItem('chaoticgolf_save_challenge')); // (salir la guarda: aquí no ha terminado de verdad)
  await click('#modesBtn'); await sleep(1400);
  assert.equal(await page.evaluate(i => document.querySelector(`.crCard[data-mode="ch:${i}"]`)?.classList.contains('won'), id), true, 'la tarjeta, ganada');
  assert.equal(await app(() => document.querySelector('.crTotal b').textContent.trim()), '1');
  // compartir: la imagen con tus coronas
  await click('[data-mode="crShare"]'); await sleep(900);
  assert.ok(await app(() => document.querySelector('#dialog[open] .sharePreview')), 'la imagen para compartir');
  await app(() => document.getElementById('dialog').close());
});

it('desafíos de la semana: el aviso del cambio sale una vez, a quien ya jugaba, con las coronas regaladas', async () => {
  await fresh({ chaoticgolf_crownsIntro: null, chaoticgolf_stats: { version: 1, played: { challenge: 4 }, won: {}, challenges: { noPalo3: true, prism: true }, weekly: { weeks: { '2026-W30': { best: 3 } } } } });
  await app(() => localStorage.removeItem('chaoticgolf_crownsIntro'));
  await click('#modesBtn'); await sleep(300); await click('[data-mtab="special"]'); await sleep(500);
  assert.ok(await app(() => document.querySelector('#dialog[open] .crIntro')), 'el aviso');
  assert.match(await app(() => document.querySelector('.crIntro li.gift').textContent), /3/);
  await app(() => document.getElementById('dialog').close());
  assert.equal(await app(() => document.querySelector('.crTotal b').textContent.trim()), '3');
  await click('[data-mtab="quick"]'); await sleep(400); await click('[data-mtab="special"]'); await sleep(500);
  assert.equal(await app(() => !!document.querySelector('#dialog[open] .crIntro')), false, 'solo una vez');
});

it('reto diario y desafíos: la partida guardada de ayer (o de la semana pasada) caduca y sale el reto nuevo', async () => {
  await fresh();
  await click('#dailyCard'); await sleep(900);
  await app(async () => { const { app } = window.chaoticGolf; (await import('/src/ui/save.js')).saveGame(); });
  // la de hoy se puede continuar
  assert.ok(await app(async () => !!(await import('/src/ui/save.js')).loadSave('daily')), 'la de hoy sigue');
  // la misma partida, pero de ayer (y un desafío de otra semana)
  await app(() => { for (const [slot, f] of [['daily', r => ({ ...r, date: '2000-01-01' })], ['challenge', r => ({ ...r, week: '2000-W01' })]]) {
    const d = JSON.parse(localStorage.getItem('chaoticgolf_save_daily')); d.slot = slot; d.variant = slot; d.run = f(d.run); localStorage.setItem('chaoticgolf_save_' + slot, JSON.stringify(d)); } });
  for (const slot of ['daily', 'challenge']) {
    assert.equal(await page.evaluate(async s => (await import('/src/ui/save.js')).loadSave(s), slot), null, slot + ': caducada');
    assert.equal(await page.evaluate(s => localStorage.getItem('chaoticgolf_save_' + s), slot), null, slot + ': borrada');
  }
  // nada que continuar: ni en el menú ("Continuar partida") ni en la tarjeta del reto, que empieza el de hoy
  assert.equal(await app(async () => (await import('/src/ui/save.js')).latestSave()), null);
  assert.ok(await app(async () => (await import('/src/ui/screens.js')).confirmReplaceSave?.('daily') ?? true), 'empezar el de hoy sin preguntar');
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
  await click('.lvlCard[data-puzzle="0"]'); await sleep(900);
  await app(() => { const { app, ctl } = window.chaoticGolf; app.game.S.hands[0] = ['palo1', 'palo1']; ctl.render(); ctl.clickCard(0, 0); const t = app.game.pending.targets.find(t => !t.out); ctl.clickCell(t.x, t.y); });
  await sleep(200);
  assert.ok(await app(() => document.getElementById('saveTick').classList.contains('show')));
});

it('cartas naranjas: la primera vez que tienes una, un aviso naranja dice que se juegan en cualquier momento (una sola vez)', async () => {
  await fresh({ chaoticgolf_tutorial: { intro: true, cards: Object.fromEntries(['palo1', 'palo2', 'palo3', 'dedo', 'hoyo', 'oHoyo', 'oPalo1', 'no'].map(k => [k, 1])) } });
  await click('#storyBtn'); await sleep(300);
  await click('.lvlCard[data-puzzle="0"]'); await sleep(900);
  await app(() => { const { app, ctl } = window.chaoticGolf; app.game.S.hands[0] = ['palo1', 'no']; ctl.render(); });
  await sleep(1100);
  const tip = await app(() => { const c = document.getElementById('coach'); return { on: c.classList.contains('visible') && c.classList.contains('orange'), txt: c.textContent, target: c.dataset.target }; });
  assert.ok(tip.on && /cualquier momento/.test(tip.txt) && /no sea tu turno/.test(tip.txt), JSON.stringify(tip));
  assert.equal(tip.target, '#hands .card[data-p="0"][data-idx="1"]', 'señala la naranja');
  await click('#coach [data-coach="ok"]'); await sleep(200);
  assert.ok(!await app(() => document.getElementById('coach').classList.contains('visible')), 'se cierra');
  assert.equal(await app(() => JSON.parse(localStorage.getItem('chaoticgolf_tutorial')).orangeTip), true, 'recordado');
  await app(() => window.chaoticGolf.ctl.render()); await sleep(1100);
  assert.ok(!await app(() => document.getElementById('coach').classList.contains('visible')), 'una sola vez');
});

it('baraja del tren: vías, locomotora en una parada y, al acabar el turno, avanza sola a la siguiente', async () => {
  await fresh({ chaoticgolf_deckIntros: { train: true }, chaoticgolf_prefs: { speed: 'fast', botFast: true } });
  await app(async () => { const { app } = window.chaoticGolf; const m = await import('/src/ui/screen-pve.js'); app.pveCfg = { ...app.pveCfg, size: 'm', opps: 1, deck: 'train', humans: 1 }; m.openPveSetup('train'); m.startPveMatch(); });
  await sleep(500); await app(() => document.querySelectorAll('#dialog[open]').forEach(d => d.close()));
  await page.waitForFunction(() => { const { app } = window.chaoticGolf, S = app.game.S; return S.turn === S.human && !app.animating && !app.ai.acting; }, { timeout: 90000 });
  const st = await app(() => { const { app } = window.chaoticGolf, S = app.game.S, tr = S.train;
    return { tr: !!tr, onStop: tr.stations.includes(tr.pos), rails: !!document.querySelector('#trackSvg path'), loco: !!document.querySelector('#pieces .ploco'),
      scene: document.getElementById('gameScreen').dataset.scene, next: !!document.getElementById('trkNext'), hand: S.hands[S.human].some(k => ['trenVuelta', 'oTren1', 'vagon'].includes(k)) }; });
  assert.deepEqual(st, { tr: true, onStop: true, rails: true, loco: true, scene: 'rail', next: true, hand: true });
  // la locomotora en pantalla está en su casilla
  const pos0 = await app(() => window.chaoticGolf.app.game.S.train.pos);
  await app(() => { const { app, ctl } = window.chaoticGolf, S = app.game.S; S.hands[S.human] = ['palo1', 'palo1']; ctl.endTurn(); });
  await page.waitForFunction(p0 => window.chaoticGolf.app.game.S.train.pos !== p0, { timeout: 10000 }, pos0);
  await page.waitForFunction(() => !window.chaoticGolf.app.animating, { timeout: 20000 });
  const after = await app(() => { const { app } = window.chaoticGolf, S = app.game.S, tr = S.train, [x, y] = tr.path[tr.pos];
    const el = document.querySelector('#pieces .ploco'), m = /translate\(([-\d.]+)px, ([-\d.]+)px\)/.exec(el.style.transform);
    const c = document.querySelector(`#board .cell[data-x="${x}"][data-y="${y}"]`).getBoundingClientRect(), b = document.getElementById('board').getBoundingClientRect();
    return { onStop: tr.stations.includes(tr.pos), dx: Math.abs(+m[1] - (c.left - b.left)), dy: Math.abs(+m[2] - (c.top - b.top)) }; });
  assert.ok(after.onStop && after.dx < 4 && after.dy < 4, JSON.stringify(after));
});

it('gana el tren: primero se ve cómo mete la pelota y después el final, con la locomotora arriba', async () => {
  await fresh({ chaoticgolf_deckIntros: { train: true } });
  await app(async () => { const { app } = window.chaoticGolf; const m = await import('/src/ui/screen-pve.js'); app.pveCfg = { ...app.pveCfg, size: 'm', opps: 1, deck: 'train', humans: 1 }; m.openPveSetup('train'); m.startPveMatch(); });
  await sleep(500); await app(() => document.querySelectorAll('#dialog[open]').forEach(d => d.close()));
  await page.waitForFunction(() => { const { app } = window.chaoticGolf, S = app.game.S; return S.turn === S.human && !app.animating && !app.ai.acting; }, { timeout: 90000 });
  // una pelota en la vía, por delante de la locomotora, y el hoyo justo detrás en la dirección del tren
  assert.ok(await app(() => { const { app, ctl } = window.chaoticGolf, g = app.game, S = g.S, tr = S.train, L = tr.path.length;
    for (let k = 1; k < 5; k++) { const a = tr.path[(tr.pos + k) % L], b = tr.path[(tr.pos + k + 1) % L], hx = 2 * b[0] - a[0], hy = 2 * b[1] - a[1];
      if (hx < 0 || hy < 0 || hx >= S.cols || hy >= S.rows) continue;
      const bot = S.balls.find(o => o.player !== S.human); bot.x = b[0]; bot.y = b[1]; S.hole.x = hx; S.hole.y = hy;
      S.hands[S.human] = ['palo1']; ctl.render(); return g.trainThreat(); }
    return false; }), 'el tren lo va a meter');
  assert.ok(await app(() => document.querySelector('#actionBar .hint.trainDanger')), 'aviso en tu turno');
  await app(() => window.chaoticGolf.ctl.endTurn()); await sleep(400);
  assert.ok(await app(() => !document.getElementById('winOverlay').classList.contains('visible') && window.chaoticGolf.app.animating), 'aún no: se ve la jugada');
  await page.waitForFunction(() => document.getElementById('winOverlay').classList.contains('visible'), { timeout: 15000 });
  assert.ok(await app(() => !!document.querySelector('#winBall .twArt') && /tren/i.test(document.getElementById('winMsg').textContent)));
});

it('creador: vías casilla a casilla; no se prueba hasta cerrar el circuito y poner 4 paradas', async () => {
  await fresh();
  await app(async () => { (await import('/src/ui/editor.js')).openEditor(); }); await sleep(700);
  const cell = async (x, y) => { const b = await (await page.$(`#edBoard .cell[data-x="${x}"][data-y="${y}"]`)).boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2]; };
  const tap = async (x, y) => { const [px, py] = await cell(x, y); await page.mouse.click(px, py); await sleep(50); };
  const st = () => app(() => ({ test: document.getElementById('edTest').disabled, status: document.getElementById('edStatus').textContent }));
  await click('[data-tool="track"]');
  const ring = []; for (let x = 0; x <= 5; x++) ring.push([x, 0]); for (let y = 1; y <= 3; y++) ring.push([5, y]); for (let x = 4; x >= 0; x--) ring.push([x, 3]); for (let y = 2; y >= 1; y--) ring.push([0, y]);
  // arrastrando: un tramo (sin cerrar)
  let [px, py] = await cell(...ring[0]); await page.mouse.move(px, py); await page.mouse.down();
  for (const p of ring.slice(1, -1)) { [px, py] = await cell(...p); await page.mouse.move(px, py, { steps: 3 }); }
  await page.mouse.up(); await sleep(150);
  let s1 = await st();
  assert.ok(s1.test && /cerrar el circuito/.test(s1.status), JSON.stringify(s1));
  assert.ok(await app(() => document.querySelectorAll('#edBoard .edRailOpen').length === 2), 'en rojo, los dos extremos sueltos');
  await tap(0, 1); // cierra la vuelta
  s1 = await st(); assert.ok(s1.test && /4 paradas \(hay 0\)/.test(s1.status), JSON.stringify(s1));
  await click('[data-tool="station"]');
  for (const [x, y] of [[2, 0], [5, 2], [2, 3], [0, 2]]) await tap(x, y);
  s1 = await st(); assert.ok(!s1.test && /Listo para jugar/.test(s1.status), JSON.stringify(s1));
  await click('[data-tool="loco"]'); await tap(4, 0);
  await click('#edTest'); await sleep(900);
  assert.deepEqual(await app(() => { const S = window.chaoticGolf.app.game.S; return [window.chaoticGolf.app.mode, S.train?.path.length, S.train?.stations.length, S.train.path[S.train.pos]]; }), ['test', 16, 4, [4, 0]]);
});

it('baraja de las estaciones: el campo de la estación, su indicador, el viento y el cambio de estación a su tiempo', async () => {
  await fresh({ chaoticgolf_deckIntros: { seasons: true }, chaoticgolf_prefs: { speed: 'fast', botFast: true } });
  await app(async () => { const { app } = window.chaoticGolf; const m = await import('/src/ui/screen-pve.js'); app.pveCfg = { ...app.pveCfg, size: 'm', opps: 1, deck: 'seasons', humans: 1 }; m.openPveSetup('seasons'); m.startPveMatch(); });
  await sleep(900);
  const st = await app(() => { const { app } = window.chaoticGolf, S = app.game.S, scr = document.getElementById('gameScreen');
    return { now: S.season.now, shown: scr.dataset.season, scene: scr.dataset.scene, chip: document.querySelector('#seasonChip .seStep.on')?.dataset.s }; });
  assert.equal(st.scene, 'seasons');
  assert.equal(st.shown, st.now, 'el campo, en la estación de la partida');
  assert.equal(st.chip, st.now, 'el indicador resalta la de ahora');
  // primavera: la ruta del viento se dibuja; con la carta, pasa al verano… cuando llega la carta, no antes
  await app(() => { const { app, ctl } = window.chaoticGolf, g = app.game, S = g.S;
    S.tiles = []; S.season = { now: 'spring', wind: null, snow: null, fireId: 0 }; g.enterSeason('spring'); g.newWind(); g.takeEvents(); // (el aviso del viento)
    S.turn = S.human; S.blackPlayed = 0; S.hands[S.human] = ['estacion', 'palo1']; ctl.render(); });
  await sleep(300);
  assert.ok(await app(() => !!document.querySelector('#windSvg .wBand')), 'la ruta del viento');
  await app(() => { const { app, ctl } = window.chaoticGolf; ctl.clickCard(app.game.S.human, 0); });
  assert.equal(await app(() => [window.chaoticGolf.app.game.S.season.now, document.getElementById('gameScreen').dataset.season].join()), 'summer,spring', 'aún se ve la primavera');
  await page.waitForFunction(() => document.getElementById('gameScreen').dataset.season === 'summer', { timeout: 6000 });
  assert.ok(await app(() => !!document.querySelector('.seasonBanner')), 'el rótulo de la estación nueva');
  await page.waitForFunction(() => !window.chaoticGolf.app.animating, { timeout: 6000 });
  assert.ok(await app(() => !document.getElementById('windSvg')), 'el viento se calma en verano');
  assert.equal(await app(() => document.querySelector('#seasonChip .seStep.on').dataset.s), 'summer');
  // invierno: la bola de nieve es una pieza más
  await app(() => { const { app, ctl } = window.chaoticGolf, g = app.game, S = g.S;
    S.tiles = []; S.season = { now: 'winter', wind: null, snow: null, fireId: 0 }; g.enterSeason('winter'); g.takeEvents(); ctl.render(); });
  await sleep(300);
  assert.ok(await app(() => !!document.querySelector('#pieces .psnow')), 'la bola de nieve');
  // elegir la carta de la bola de nieve y cambiar de idea: Cancelar en la barra (o tocarla otra vez)
  await app(() => { const { app, ctl } = window.chaoticGolf, S = app.game.S; S.turn = S.human; S.hands[S.human] = ['oNieve', 'palo1']; ctl.render(); ctl.clickCard(S.human, 0); });
  await sleep(200);
  assert.equal(await app(() => window.chaoticGolf.app.game.pending?.kind), 'snowRoll');
  await click('#actionBar [data-act="cancel"]'); await sleep(200);
  assert.equal(await app(() => window.chaoticGolf.app.game.pending), null, 'cancelada con el botón');
  await app(() => { const { app, ctl } = window.chaoticGolf, S = app.game.S; ctl.clickCard(S.human, 0); });
  await sleep(150);
  await app(() => { const { app, ctl } = window.chaoticGolf, S = app.game.S; ctl.clickCard(S.human, 0); });
  await sleep(150);
  assert.equal(await app(() => window.chaoticGolf.app.game.pending), null, 'y tocándola otra vez');
  assert.deepEqual(await app(() => window.chaoticGolf.app.game.S.hands[window.chaoticGolf.app.game.S.human]), ['oNieve', 'palo1'], 'la carta sigue en la mano');
});

it('estadísticas del reto diario: la etiqueta junto a la racha abre la ventana (sin empezar el reto) con números, insignias y turnos', async () => {
  const today = await app(async () => (await import('/src/content/levels/generate.js')).dateKey());
  await fresh({ chaoticgolf_stats: { version: 1, played: {}, won: {}, totals: {}, levels: {}, puzzles: {}, pve: {},
    daily: { days: { [today]: { best: 5, strokes: 7 } }, streak: 8, bestStreak: 8, last: today, played: 10, won: 9, dist: { 4: 3, 5: 4, 6: 2 } },
    rush: { best: 0, runs: 0 }, challenges: {}, weekly: { weeks: {} }, rivals: {}, history: {}, cards: {}, decks: {}, chStats: {} } });
  assert.ok(await page.$('#dailyCard .dTags .dFlame + .dStats'), 'la etiqueta, a la derecha de la racha');
  await click('#dailyCard .dStats'); await sleep(400);
  assert.equal(await app(() => window.chaoticGolf.app.screen), 'menu', 'no empieza el reto');
  const d = await app(() => ({
    nums: [...document.querySelectorAll('#dialog[open] .dsNum b')].map(b => b.textContent),
    got: [...document.querySelectorAll('#dialog .dsBadge')].map(b => b.classList.contains('got')),
    today: document.querySelector('#dialog .dsCol.today small')?.textContent,
    share: !!document.querySelector('#dialog .dsShare'),
  }));
  assert.deepEqual(d, { nums: ['10', '90%', '8', '8'], got: [true, false, false], today: '5', share: true });
  const text = await app(async () => (await import('/src/ui/daily-stats.js')).statsShareText());
  assert.match(text, /10 · ✅ 90% · 🔥 8 · 🏆 8/); assert.match(text, /#reto$/);
  await click('#dialog [value="close"]'); await sleep(300);
  assert.ok(!await page.$('#dialog[open]'));
});

it('estadísticas: salen todas las barajas, todas las pelotas y el total real de desafíos y de Lo básico (lo nuevo aparece solo)', async () => {
  await fresh();
  await app(async () => (await import('/src/ui/settings.js')).openSettings('stats')); await sleep(400);
  const d = await app(async () => {
    const { DECKS } = await import('/src/content/decks.js'), { CHALLENGES } = await import('/src/content/challenges.js'), { SKINS } = await import('/src/ui/skins.js');
    const { TOTALS } = await import('/src/ui/records.js'), { app } = window.chaoticGolf, box = document.getElementById('setBox');
    return { decks: box.querySelectorAll('.hbars.decks .hbRow').length, decksWant: DECKS.filter(dk => !dk.locked).length,
      balls: box.querySelectorAll('.sbItem').length, ballsWant: SKINS.length,
      totals: [...box.querySelectorAll('.pgRow:not(.sub) .pgVal')].map(e => e.textContent),
      totalsWant: ['basics', 'advanced'].map(sec => app.basics.filter(L => L.section === sec).length).filter(Boolean).map(n => '0/' + n).concat('0/' + CHALLENGES.length),
      chips: box.querySelectorAll('.stTotals .st').length >= TOTALS.filter(x => !x.hidden).length };
  });
  assert.equal(d.decks, d.decksWant); assert.equal(d.balls, d.ballsWant); assert.deepEqual(d.totals, d.totalsWant); assert.ok(d.chips);
  await click('#setBox [data-set-act="dailyStats"]'); await sleep(400);
  assert.ok(await page.$('#dialog[open] .dsBox'), 'el reto diario, en su ventana');
  await click('#dialog [value="close"]'); await sleep(200);
  await app(async () => (await import('/src/ui/settings.js')).closeSettings());
});

it('regalo de early tester: el aviso abre la ventana, congela la racha (no se pierde) y en Ajustes se descongela', async () => {
  await fresh({ chaoticgolf_gift: null, chaoticgolf_stats: { version: 1, played: {}, won: {}, totals: {}, levels: {}, puzzles: {}, pve: {},
    daily: { days: {}, streak: 6, bestStreak: 6, last: '2020-01-01' }, rush: { best: 0, runs: 0 }, challenges: {}, weekly: { weeks: {} }, rivals: {}, history: {}, cards: {}, decks: {}, chStats: {} } });
  await sleep(900);
  assert.ok(await page.$('#giftPop'), 'el aviso del regalo');
  await click('#giftPop'); await sleep(500);
  assert.ok(await page.$('#dialog[open] .giftBox'));
  await click('#dialog[open] button[value="freeze"]'); await sleep(400);
  const st = await app(async () => { const r = await import('/src/ui/records.js'), g = await import('/src/content/levels/generate.js'); return r.dailyStreakInfo(g.dateKey()); });
  assert.equal(st.n, 6, 'congelada: sigue viva aunque hace mucho que no se juega');
  assert.ok(st.frozen && !st.atRisk);
  assert.ok(await app(() => !!document.querySelector('#dailyCard .dFlame.frozen')), 'la llama, congelada');
  await page.reload({ waitUntil: 'networkidle0' }); await sleep(1500);
  assert.ok(!await page.$('#giftPop'), 'abierto: ya no sale');
  await app(async () => (await import('/src/ui/settings.js')).openSettings('settings')); await sleep(300);
  await click('[data-set-act="unfreeze"]'); await sleep(200);
  const after = await app(async () => { const r = await import('/src/ui/records.js'), g = await import('/src/content/levels/generate.js'); return r.dailyStreakInfo(g.dateKey()); });
  assert.ok(!after.frozen && after.n === 6 && after.atRisk, 'descongelada: viva hoy, pero hay que jugar');
  assert.ok(await page.$('[data-set-act="freeze"]'), 'y se puede volver a congelar');
});

it('baraja nueva: se anuncia una vez a quien ya jugaba ("Jugar ahora" lleva a su partida rápida); a quien llega nuevo, no', async () => {
  await fresh({ chaoticgolf_newDeckSeen: null });
  await sleep(900);
  assert.ok(await app(() => !!document.querySelector('#dialog[open] .newDeck .ndArt')), 'el anuncio, con su ilustración');
  await click('#dialog[open] button[value="play"]'); await sleep(500);
  assert.deepEqual(await app(() => [window.chaoticGolf.app.screen, window.chaoticGolf.app.pveCfg.deck]), ['pve', 'gambling']);
  await page.reload({ waitUntil: 'networkidle0' }); await sleep(1800);
  assert.ok(!await app(() => !!document.querySelector('#dialog[open] .newDeck')), 'solo una vez');
  // primera visita: nada (todo es nuevo), y queda apuntada
  await page.evaluate(() => localStorage.clear()); await page.reload({ waitUntil: 'networkidle0' }); await sleep(1800);
  assert.ok(!await app(() => !!document.querySelector('#dialog[open] .newDeck')));
  assert.equal(await app(() => JSON.parse(localStorage.getItem('chaoticgolf_newDeckSeen'))), 'gambling');
});

it('modos de juego: dos pestañas (una a la vez) y 8 barajas con estadísticas (Ultimate, la última y la estrella)', async () => {
  await fresh();
  await click('#modesBtn'); await sleep(400);
  const vis = () => app(() => [...document.querySelectorAll('.mdPanel')].filter(p => !p.classList.contains('off')).map(p => p.dataset.panel).join());
  assert.equal(await vis(), 'quick');
  assert.equal(await app(() => document.querySelectorAll('.mdPanel[data-panel="quick"] .deckCard').length), 8); // (el contrarreloj usa el mismo estilo de tarjeta)
  // las barajas nuevas van detrás de la última y Ultimate siempre al final, con las barajas que reúne
  assert.deepEqual(await app(() => [...document.querySelectorAll('.mdPanel[data-panel="quick"] .deckCard [data-mode^="quick:"]')].map(b => b.dataset.mode.slice(6))),
    ['classic', 'water', 'minigolf', 'train', 'seasons', 'multiverse', 'gambling', 'ultimate']);
  // (Ultimate, aparte y más grande: la lista se desplaza hasta ella y se ve entera)
  await app(() => document.querySelector('.deckCard.ultimate').scrollIntoView({ block: 'end', behavior: 'instant' })); await sleep(400);
  assert.ok(await app(() => { const r = document.querySelector('.deckCard.ultimate').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight + 1; }), 'Ultimate se ve entera');
  assert.equal(await app(() => document.querySelectorAll('.deckCard.ultimate .ultTog').length), 7, 'Ultimate: un icono por baraja');
  assert.ok(await page.$('.mdPanel[data-panel="quick"] .ultSep + .deckCard.ultimate'), 'aparte, tras un separador');
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
  await click('.lvlCard[data-puzzle="0"]'); await sleep(900);
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

it('idioma: dos banderas en el menú (abajo a la derecha) cambian el idioma en vivo; ya no está en Ajustes', async () => {
  await fresh();
  const flags = await app(() => [...document.querySelectorAll('#langBtns .langBtn')].map(b => { const r = b.getBoundingClientRect(); return { l: b.dataset.lang, on: b.getAttribute('aria-pressed'), w: Math.round(r.width), right: Math.round(innerWidth - r.right), bottom: Math.round(innerHeight - r.bottom) }; }));
  assert.deepEqual(flags.map(f => [f.l, f.on]), [['es', 'true'], ['en', 'false']], JSON.stringify(flags));
  assert.ok(flags.every(f => f.w === 30 && f.right < 70 && f.bottom < 30), 'pequeñas, abajo a la derecha: ' + JSON.stringify(flags));
  await click('#langBtns [data-lang="en"]'); await sleep(250);
  assert.equal(await app(() => document.documentElement.lang), 'en');
  assert.equal(await app(() => document.querySelector('#langBtns [data-lang="en"]').getAttribute('aria-pressed')), 'true');
  assert.match(await app(() => document.getElementById('storyBtn').textContent), /basics/i);
  await click('#langBtns [data-lang="es"]'); await sleep(250);
  assert.match(await app(() => document.getElementById('storyBtn').textContent), /básico/i);
  // fuera del menú no se ven, y Ajustes ya no tiene idioma
  await click('#modesBtn'); await sleep(400);
  assert.equal(await app(() => getComputedStyle(document.getElementById('langBtns')).display), 'none');
  await click('#sndCfgBtn'); await sleep(300);
  assert.equal(await app(() => document.querySelectorAll('#setBox [data-lang], .setBox [data-lang]').length), 0);
});

it('menú: el botón de Lo básico dice cuántos llevas y, con todos, un tic', async () => {
  await fresh({ chaoticgolf_stats: { version: 1, basics: { 'clubs-1': true, 'clubs-2': true, 'clubs-3': true } } });
  // (solo lo más básico: palos y hoyo, los primeros 15; con 145 de golpe asustaba)
  const n = await app(() => window.chaoticGolf.app.basics.filter(L => L.deck === 'basic').length);
  assert.equal(n, 15);
  assert.equal(await app(() => document.getElementById('storyProg').textContent), '3/' + n);
  const ids = await app(() => window.chaoticGolf.app.basics.filter(L => L.deck === 'basic').map(L => L.id));
  await fresh({ chaoticgolf_stats: { version: 1, basics: Object.fromEntries(ids.map(id => [id, true])) } });
  assert.ok(await app(() => document.getElementById('storyProg').classList.contains('all')));
});

it('Lo básico: los puzles de un turno, por bloques con filas de 5; superar uno se guarda por su id', async () => {
  await fresh({ chaoticgolf_levelsEpoch: 2, chaoticgolf_stats: { version: 1, puzzles: { 0: true, 1: true } } }); // (antes: p01 y p02 resueltos)
  await click('#storyBtn'); await sleep(400);
  const d = await app(() => ({ rows: [...document.querySelectorAll('#lvlGrid .bkRow')].map(r => r.children.length),
    blocks: document.querySelectorAll('#lvlGrid .bkBlock').length, done: [...document.querySelectorAll('#lvlGrid .lvlCard.done')].map(c => +c.dataset.puzzle) }));
  assert.ok(d.rows.length >= 5 && d.rows.every(n => n === 5), JSON.stringify(d.rows));
  assert.ok(d.blocks >= 2);
  const from = await app(() => window.chaoticGolf.app.basics.flatMap((L, i) => ['p01', 'p02'].includes(L.from) ? [i] : []));
  assert.deepEqual(d.done, from, 'los puzles antiguos que siguen cuentan como superados');
  assert.equal(await app(() => document.querySelectorAll('#modesGrid [data-puzzle]').length), 0, 'ya no están en Modos de juego');
  await click('.lvlCard[data-puzzle="0"]'); await sleep(900);
  await app(() => { const { ctl, app } = window.chaoticGolf; ctl.clickCard(0, 0); const t = app.game.pending.targets.find(t => t.dir === 'up'); ctl.clickCell(t.x, t.y); });
  await page.waitForSelector('#winOverlay.visible', { timeout: 10000 });
  assert.equal(await app(() => JSON.parse(localStorage.getItem('chaoticgolf_stats')).basics['clubs-1']), true);
  assert.match(await app(() => document.getElementById('winMsg').textContent), /superado/i);
});

it('Lo básico: salirse del tablero tiene su aviso en cualquier nivel', async () => {
  await fresh();
  await click('#storyBtn'); await sleep(300);
  await click('.lvlCard[data-puzzle="0"]'); await sleep(900);
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

it('Lo básico: terminar el turno sin embocar muestra "otra vez"', async () => {
  await fresh();
  await click('#storyBtn'); await sleep(300);
  await click('#lvlGrid [data-puzzle="1"]'); await sleep(900);
  assert.equal(await app(() => window.chaoticGolf.app.variant), 'puzzle');
  await click('#endTurnBtn');
  await page.waitForSelector('#winOverlay.visible', { timeout: 5000 });
  assert.match(await app(() => document.getElementById('winMsg').textContent), /otra vez/i);
});

it('creador: se pinta arrastrando, se guarda, se comparte con un código y quien lo recibe lo guarda', async () => {
  await fresh();
  await click('#modesBtn'); await sleep(300);
  await click('[data-mtab="special"]'); await sleep(500);
  await click('.lvlSection.yours [data-mode="editor"]'); await sleep(500);
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
  const code = await app(async () => { const m = await import('/src/content/levels/share.js'); return m.encodeLevel(window.chaoticGolf.app.basics[1]); });
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
  await p2.evaluateOnNewDocument(autoLineup);
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
  await p.evaluateOnNewDocument(autoLineup);
  p.on('pageerror', e => errors.push(e.message));
  p.on('dialog', d => d.accept());
  await p.setUserAgent(IPHONE_UA); await p.setViewport(vp);
  await p.goto(URL, { waitUntil: 'networkidle0' });
  await p.evaluate(() => { localStorage.clear();
    localStorage.setItem('chaoticgolf_tutorial', JSON.stringify({ intro: true, orangeTip: true, cards: Object.fromEntries(['palo1', 'palo2', 'palo3', 'dedo', 'hoyo', 'oHoyo', 'oPalo1', 'no', 'bunker', 'portal'].map(k => [k, 1])) }));
    localStorage.setItem('chaoticgolf_deckIntro', JSON.stringify({ classic: 1, water: 1, mini: 1, ultimate: 1 }));
    localStorage.setItem('chaoticgolf_newDeckSeen', '"gambling"');
    localStorage.setItem('chaoticgolf_prefs', JSON.stringify({ speed: 'fast', botFast: true })); }); // (los bots, rápidos: en Ultimate las jugadas son largas)
  await p.reload({ waitUntil: 'networkidle0' });
  await p.waitForFunction(() => window.chaoticGolf?.app.game); await sleep(500);
  return p;
}
async function phoneQuick(p, cfg = {}, deck = 'classic') {
  await p.evaluate(async (cfg, deck) => { const { app } = window.chaoticGolf; const m = await import('/src/ui/screen-pve.js');
    app.pveCfg = { ...app.pveCfg, size: 'm', opps: 2, diff: 'normal', ...cfg, deck }; m.openPveSetup(deck); m.startPveMatch(); }, cfg, deck);
  await sleep(500); await p.evaluate(() => document.querySelectorAll('#dialog[open]').forEach(d => d.close())); await sleep(700);
  // turno de la persona, sin nada en marcha
  await p.waitForFunction(() => { const { app } = window.chaoticGolf, S = app.game.S; return S.turn === S.human && !app.animating && !app.ai.acting && !app.game.pending; }, { timeout: 120000 });
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
  assert.ok(!await p.$('#actionBar [data-act="playArmed"]'), 'sin botón "Jugar": se juega tocando la marca');
  assert.ok(await p.evaluate(() => document.getElementById('previewSvg')?.classList.contains('visible') && !!document.querySelector('#previewSvg .pvTarget')), 'se ve qué hará, con su marca');
  const tgt = await p.evaluate(() => window.chaoticGolf.app.armed.targets[0]);
  assert.ok(tgt && tgt.x === hole0.x && tgt.y < hole0.y, 'la marca: donde irá el hoyo ' + JSON.stringify([hole0, tgt]));
  // tocar la marca la juega (como el segundo toque del palo en su destino)
  const cellBox = async (x, y) => (await p.$(`#board .cell[data-x="${x}"][data-y="${y}"]`)).boundingBox();
  const tap = async b => { await p.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); await sleep(300); };
  await tap(await cellBox(tgt.x, tgt.y)); await sleep(700);
  assert.deepEqual(await p.evaluate(() => { const h = window.chaoticGolf.app.game.S.hole; return { x: h.x, y: h.y }; }), tgt, 'tocar la marca: jugada');
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
      S.hands.forEach((h, i) => { if (i !== w.player) S.hands[i] = h.map(() => 'palo2'); }); // (sin naranjas: nadie evita el JAQUE)
      w.x = S.hole.x; w.y = S.hole.y + 1; S.turn = w.player; S.hands[w.player][0] = 'palo1';
      app.ai.acting = true; ctl.clickCard(w.player, 0); ctl.clickCell(S.hole.x, S.hole.y); app.ai.acting = false; });
    await sleep(2500);
    await p.evaluate(() => { if (!document.getElementById('winOverlay').classList.contains('visible')) window.chaoticGolf.ctl.confirmWin(); });
    await sleep(900);
    const fits = () => p.evaluate(() => { const o = document.getElementById('winOverlay'); return o.classList.contains('visible') && o.scrollHeight <= o.clientHeight + 1; });
    const dbg = await p.evaluate(() => { const o = document.getElementById('winOverlay'); return { visible: o.classList.contains('visible'), sobra: o.scrollHeight - o.clientHeight, winner: window.chaoticGolf.app.game.S.winner }; });
    assert.ok(await fits(), 'el final cabe ' + vp.width + '×' + vp.height + ' ' + JSON.stringify(dbg));
    await p.evaluate(() => document.querySelector('[data-act="why"]')?.click()); await sleep(300);
    assert.ok(await fits(), 'con "¿por qué he perdido?" abierto, también ' + vp.width + '×' + vp.height);
    await p.close();
  }
});

it('tu pelota: el botón del menú abre la ventana; una pelota ganada se pone y se ve en la partida rápida y en el tablero', async () => {
  await fresh({ chaoticgolf_stats: { version: 1, played: {}, won: {}, totals: {}, levels: {}, puzzles: {}, pve: {}, daily: { days: {}, streak: 0, bestStreak: 9 },
    rush: { best: 0, runs: 0 }, challenges: {}, weekly: { weeks: {} }, rivals: {}, history: {}, cards: {}, decks: { classic: { p: 14, w: 12 } }, chStats: {} } });
  assert.equal(await app(() => getComputedStyle(document.getElementById('profileBtn')).display !== 'none'), true, 'botón en el menú');
  assert.equal(await app(() => !document.querySelector('#profileBtn .pfDot').hidden), true, 'punto: hay pelotas nuevas');
  await click('#profileBtn'); await sleep(400);
  assert.ok(await app(() => document.getElementById('profileOverlay').classList.contains('visible')));
  assert.equal(await app(() => document.querySelectorAll('.pfCard').length), 12); // (8 + la de vapor, del tren, la de las estaciones, la del multiverso y la del casino)
  assert.equal(await app(() => document.querySelectorAll('.pfCard .pfNew').length), 2, 'fuego y clásica, nuevas');
  // un nivel sin ganar se ve, pero no se puede poner; uno ganado, sí
  await click('[data-pfv="fire:2"]'); await sleep(200);
  assert.equal(await app(() => !!document.querySelector('[data-pf="equip"]')), false);
  // el punto rojo guía: en el nivel recién ganado de cada una y, al tocarlo, en "Ponérmela"
  assert.deepEqual(await app(() => [...document.querySelectorAll('.pfLv.fresh')].map(b => b.dataset.pfv).sort()), ['classic:1', 'fire:1']);
  await click('[data-pfv="fire:1"]'); await sleep(200);
  assert.ok(await app(() => document.querySelector('[data-pf="equip"] .pfNewDot')), 'punto en "Ponérmela"');
  assert.equal(await app(() => !!document.querySelector('[data-pfv="fire:1"].fresh')), false, 'visto: sin punto en su nivel');
  await click('[data-pf="equip"]'); await sleep(300);
  assert.deepEqual(await app(() => JSON.parse(localStorage.getItem('chaoticgolf_profile')).skin), { id: 'fire', lvl: 1 });
  assert.equal(await app(() => !!document.querySelector('.pfNewDot')), true, 'la clásica sigue nueva');
  await click('[data-pf="close"]'); await sleep(200);
  assert.equal(await app(() => document.querySelector('#profileBtn .pfDot').hidden), false, 'queda una por ver: el punto sigue');
  await click('#profileBtn'); await sleep(300);
  await click('[data-pfcard="classic"]'); await sleep(200);
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

it('móvil: con el menú desplazado, la partida empieza arriba (Safari: 100vh más alto que lo visible)', async () => {
  const p = await phonePage({ width: 375, height: 667, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  // lo que hace Safari con 100vh cuando la barra del navegador se esconde al desplazar: la página, más alta que la pantalla
  await p.addStyleTag({ content: 'body { min-height: 757px; } #game { height: 757px; height: 100dvh; }' });
  await p.evaluate(() => window.scrollTo(0, 90)); await sleep(150);
  await p.evaluate(() => { document.getElementById('storyBtn').click(); document.querySelector('.lvlCard[data-puzzle="0"]').click(); }); await sleep(1200);
  const m = await p.evaluate(() => ({ y: window.scrollY, doc: document.scrollingElement.scrollHeight, top: document.getElementById('gameBar').getBoundingClientRect().top }));
  assert.equal(m.y, 0, 'sin desplazar'); assert.ok(m.doc <= 668, 'la partida mide lo visible'); assert.ok(m.top >= 0, 'la barra de arriba se ve');
  await p.close();
});

it('reto diario: fondo de su mecánica y, al acabar, tu pelota (con la puesta) en lo alto del final', async () => {
  await fresh({ chaoticgolf_profile: { color: 1, skin: { id: 'fire', lvl: 1 }, skinAnn: { fire: 1 }, skinSeen: { fire: 1 } },
    chaoticgolf_stats: { version: 1, daily: { days: {}, bestStreak: 8 } } });
  const scenes = await app(async () => { const m = await import('/src/content/challenges.js'), sm = await import('/src/ui/screen-modes.js');
    return Object.fromEntries(m.DAILY_FEATURES.map(f => [f.id, sm.dailyScene(f.id)])); });
  assert.deepEqual(scenes, { portal: '', launcher: 'mini', bunker: '', river: 'lake', tunnel: 'mini', block: 'mini', lake: 'lake', corner: 'mini', iri: 'prism', train: 'rail', season: 'seasons', multiverse: 'space', gambling: 'casino' });
  await click('#dailyCard'); await sleep(900);
  assert.equal(await app(() => document.getElementById('gameScreen').dataset.scene), await app(() => { const s = { portal: '', launcher: 'mini', bunker: '', river: 'lake', tunnel: 'mini', block: 'mini', lake: 'lake', corner: 'mini', iri: 'prism', train: 'rail', season: 'seasons', multiverse: 'space', gambling: 'casino' }; return s[window.chaoticGolf.app.run.feature]; }));
  await page.waitForFunction(() => { const { app } = window.chaoticGolf, S = app.game.S; return S.turn === S.human && !app.animating && !app.ai.acting; }, { timeout: 40000 });
  await app(() => { const { app, ctl } = window.chaoticGolf, S = app.game.S, b = S.balls.find(x => x.player === S.human);
    for (const o of S.balls) if (o !== b && o.x === S.hole.x && o.y === S.hole.y + 1) o.x = (o.x + 2) % S.cols;
    S.tiles = S.tiles.filter(t => !(t.x === S.hole.x && t.y === S.hole.y + 1));
    b.x = S.hole.x; b.y = S.hole.y + 1; S.hands[S.human][0] = 'palo1'; ctl.render(); ctl.clickCard(S.human, 0); ctl.clickCell(S.hole.x, S.hole.y); });
  await sleep(2600); await app(() => { if (!document.getElementById('winOverlay').classList.contains('visible')) window.chaoticGolf.ctl.confirmWin(); });
  await sleep(600);
  assert.ok(await app(() => document.querySelector('#winBall .skCore.sk-fire.sl1')), 'tu pelota, con Fuego I');
  assert.equal(await app(() => getComputedStyle(document.getElementById('winIcon')).display), 'none', 'en lugar del icono');
});

it('reto diario: "Compartir" copia imagen y resultado con el enlace (sin hoja del sistema), dice "¡Copiado!" y el enlace abre el reto', async () => {
  const ctx = browser.defaultBrowserContext();
  await ctx.overridePermissions(URL.replace(/\/$/, ''), ['clipboard-read', 'clipboard-write', 'clipboard-sanitized-write']);
  await page.evaluateOnNewDocument(() => { navigator.canShare = () => true; navigator.share = async () => { window.__shared = true; }; });
  await fresh();
  await click('#dailyCard'); await sleep(900);
  await page.waitForFunction(() => { const { app } = window.chaoticGolf, S = app.game.S; return S.turn === S.human && !app.animating && !app.ai.acting; }, { timeout: 40000 });
  await app(() => { const { app, ctl } = window.chaoticGolf, S = app.game.S, b = S.balls.find(x => x.player === S.human);
    for (const o of S.balls) if (o !== b && o.x === S.hole.x && o.y === S.hole.y + 1) o.x = (o.x + 2) % S.cols;
    S.tiles = S.tiles.filter(t => !(t.x === S.hole.x && t.y === S.hole.y + 1));
    S.hands.forEach((h, i) => { if (i !== S.human) S.hands[i] = h.map(() => 'palo2'); }); // (sin naranjas: nadie evita el JAQUE)
    b.x = S.hole.x; b.y = S.hole.y + 1; S.hands[S.human][0] = 'palo1'; ctl.render(); ctl.clickCard(S.human, 0); ctl.clickCell(S.hole.x, S.hole.y); });
  await sleep(2600); await app(() => { if (!document.getElementById('winOverlay').classList.contains('visible')) window.chaoticGolf.ctl.confirmWin(); });
  await sleep(900);
  assert.equal(await app(() => document.querySelectorAll('#winBtns [data-act="shareNow"], #winBtns [data-act="share"]').length), 1, 'un solo botón');
  await page.click('#winBtns [data-act="shareNow"]'); await sleep(700);
  const r = await app(async () => { const [it] = await navigator.clipboard.read(); return { types: it.types, text: await (await it.getType('text/plain')).text(),
    btn: document.querySelector('#winBtns [data-act="shareNow"]').textContent, shared: !!window.__shared }; });
  assert.ok(r.types.includes('image/png') && r.types.includes('text/plain'), 'imagen y texto');
  assert.match(r.text.split('\n').pop(), /\/#reto$/, 'el enlace al reto');
  assert.equal(r.btn, '¡Copiado!'); assert.equal(r.shared, false, 'no abre la hoja del sistema');
  // el enlace: entra directamente en el reto de hoy
  await page.goto(URL + '#reto', { waitUntil: 'networkidle0' }); await sleep(1200);
  assert.deepEqual(await app(() => [window.chaoticGolf.app.screen, window.chaoticGolf.app.variant, location.hash]), ['game', 'daily', '']);
});

it('reto diario: el mismo reparto para todo el mundo, elijas el color que elijas (también el naranja)', async () => {
  const deal = async color => {
    await fresh({ chaoticgolf_profile: { color } });
    await click('#dailyCard'); await sleep(700);
    return app(() => { const S = window.chaoticGolf.app.game.S; return JSON.stringify([S.hands, S.deck, S.human, S.turn, S.tiles]); });
  };
  const red = await deal(0), orange = await deal(6);
  assert.equal(orange, red);
  assert.equal(await app(() => { const S = window.chaoticGolf.app.game.S; return S.colorMap[S.human]; }), '#e8833a', 'y con tu color');
});
