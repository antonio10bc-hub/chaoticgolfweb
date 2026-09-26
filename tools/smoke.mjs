// Prueba de humo en un navegador real (Chrome/Chromium instalado en el sistema):
// recorre menú, historia, partida rápida contra la máquina, creador y testing tool,
// falla si hay errores de consola / excepciones / peticiones fallidas, y guarda capturas.
//
//   npm run smoke                          (CHROME_PATH=/ruta/a/chrome si no lo encuentra)
//   npm run smoke -- --out /tmp/capturas --pve-seconds 60
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import { serve } from './serve.mjs';

const args = Object.fromEntries(process.argv.slice(2).join(' ').split('--').filter(Boolean).map(s => s.trim().split(/\s+/)));
const OUT = path.resolve(args.out || 'smoke-out');
const PVE_SECONDS = +(args['pve-seconds'] || 45);
const CHROME = process.env.CHROME_PATH || [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
].find(p => fs.existsSync(p));
if (!CHROME) { console.error('No encuentro Chrome: define CHROME_PATH'); process.exit(2); }
fs.mkdirSync(OUT, { recursive: true });

const PORT = 8099;
const server = await serve(PORT);
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 860 });
const problems = [];
page.on('console', m => { if (m.type() === 'error') problems.push('consola: ' + m.text()); });
page.on('pageerror', e => problems.push('excepción: ' + e.message));
page.on('requestfailed', r => problems.push('petición fallida: ' + r.url()));
page.on('response', r => { if (r.status() >= 400) problems.push(`HTTP ${r.status()}: ${r.url()}`); });

const sleep = ms => new Promise(r => setTimeout(r, ms));
const shot = async name => { await page.screenshot({ path: path.join(OUT, name + '.png') }); console.log('  📸', name); };
const click = async sel => { await page.waitForSelector(sel, { visible: true, timeout: 5000 }); await page.click(sel); };
// Menú / Reiniciar piden confirmación si hay una partida a medias
const confirmIfAsked = async () => { await sleep(150); if (await page.$('#dialog[open]')) { await page.click('#dialog[open] button[value="ok"]'); await sleep(150); } };
const state = () => page.evaluate(() => {
  const { app } = window.chaoticGolf, g = app.game;
  return { screen: app.screen, mode: app.mode, turn: g.S.turn, human: g.S.human, winner: g.S.winner, jaque: g.S.jaque,
    pending: g.pending?.kind || null, animating: app.animating, log: g.S.log.length, logTop: g.S.log[0], thinking: app.ai.thinkingOf };
});
// una jugada del humano: primera carta jugable y primera casilla/elección disponible
async function humanStep() {
  return page.evaluate(() => {
    const { app, ctl } = window.chaoticGolf, g = app.game;
    if (app.animating) return 'anim';
    const pd = g.pending;
    if (pd) {
      if (pd.kind === 'dedoAmount') { ctl.chooseAmount(pd.ball && g.inTrap(pd.ball) ? 2 : 1); return 'amount'; }
      if (pd.kind === 'pickHoled') { ctl.pickHoled(g.S.balls.find(b => b.holed).player); return 'pickHoled'; }
      const cell = document.querySelector('#board .cell.selectable, #board .cell.selectable-out');
      if (cell) { cell.click(); return 'cell'; }
      ctl.cancel(); return 'cancel';
    }
    const me = app.mode === 'pve' ? g.S.human : g.S.turn;
    const card = document.querySelector(`#hands .card[data-p="${me}"]:not(.unplayable)`);
    if (card && g.S.turn === me && g.S.blackPlayed < 2 && Math.random() < .85) { card.click(); return 'card'; }
    if (g.S.turn === me && !document.getElementById('endTurnBtn').disabled) { document.getElementById('endTurnBtn').click(); return 'end'; }
    return 'wait';
  });
}

try {
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => window.chaoticGolf?.app.game);
  console.log('menú'); await shot('01-menu');

  console.log('modo historia');
  await click('#storyBtn'); await sleep(500); await shot('02-historia');
  await click('.lvlCard[data-level="0"]'); await confirmIfAsked(); await sleep(400); await shot('03-nivel1');
  for (let i = 0; i < 80; i++) {
    const s = await state();
    if (s.winner !== null && !s.jaque) break;
    await humanStep(); await sleep(260);
  }
  await sleep(1200);
  const won = await page.evaluate(() => document.getElementById('winOverlay').classList.contains('visible'));
  console.log('  victoria en historia:', won);
  await shot('04-nivel1-fin');
  if (won) await click('#winBtns button[data-act="levels"]');

  console.log('partida rápida (PVE)');
  await page.evaluate(() => window.chaoticGolf.app.pveCfg = { color: 2, size: 'm', opps: 3 });
  await page.evaluate(() => document.getElementById('storyBack').click());
  await click('#modesBtn'); await sleep(300); await shot('05a-modos');
  await click('[data-mode="quick:classic"]'); await confirmIfAsked(); await sleep(300); await shot('05-pve-setup');
  await click('#pvePlay'); await confirmIfAsked(); await sleep(800); // sustituye la partida guardada (si la hay)
  const t0 = Date.now(); let aiTurns = 0, lastTurn = -1, shots = 0, humanActs = 0;
  while (Date.now() - t0 < PVE_SECONDS * 1000) {
    const s = await state();
    if (s.turn !== lastTurn) { if (s.turn !== s.human) aiTurns++; lastTurn = s.turn; }
    if (s.winner !== null && !s.jaque) break;
    if (s.turn === s.human && !s.animating && s.thinking === null) { await humanStep(); humanActs++; }
    if (Date.now() - t0 > shots * 15000) { await shot(`06-pve-${String(shots).padStart(2, '0')}`); shots++; }
    await sleep(300);
  }
  const fin = await state();
  console.log(`  turnos de la IA: ${aiTurns} · acciones humanas: ${humanActs} · líneas de log: ${fin.log} · ganador: ${fin.winner}`);
  if (aiTurns < 2) problems.push('la IA no ha jugado turnos en PVE');
  await shot('07-pve-fin');
  await page.evaluate(() => { document.getElementById('winOverlay').classList.remove('visible'); document.getElementById('menuBtn').click(); });
  await sleep(300); // Partida rápida vuelve a Modos
  if (await page.$('#dialog[open]')) problems.push('salir al menú no debe pedir confirmación');
  if (await page.evaluate(() => window.chaoticGolf.app.game)) problems.push('la partida sigue activa tras salir al menú');
  const contShown = !!await page.$('#modesGrid [data-mode="resume:pve"]');
  if (contShown !== (fin.winner === null || fin.jaque)) problems.push(`"Continuar partida" ${contShown ? 'visible sin partida guardada' : 'oculto con partida a medias'}`);
  await shot('07b-modos-continuar');
  await page.evaluate(() => document.getElementById('modesBack').click()); await sleep(200);

  console.log('ajustes y estadísticas');
  await click('#sndCfgBtn'); await sleep(300); // el botón redondo: ajustes y estadísticas en pestañas
  await click('#setBox [data-speed="fast"]'); await click('#setBox [data-course-opt="night"]'); await sleep(200);
  await shot('07c-ajustes');
  await click('[data-tab="stats"]'); await sleep(200); await shot('07d-estadisticas');
  await click('[data-set-act="close"]'); await sleep(200);
  if (await page.evaluate(() => document.documentElement.dataset.course !== 'night')) problems.push('el tema del campo no se aplica');

  console.log('multijugador local');
  await page.evaluate(() => { window.chaoticGolf.app.pveCfg = { color: 1, size: 's', opps: 0, humans: 2, diff: 'normal' }; });
  await click('#modesBtn'); await sleep(300); await click('[data-mode="quick:classic"]'); await confirmIfAsked(); await sleep(300);
  await click('#pvePlay'); await confirmIfAsked(); await sleep(700);
  if (!await page.$('#passScreen.visible')) problems.push('multijugador local: no aparece "pasa el dispositivo"');
  if (await page.evaluate(() => document.querySelectorAll('#hands .card:not(.back)').length)) problems.push('multijugador local: se ven cartas antes de pasar el dispositivo');
  await shot('07e-pasa-el-movil');
  await click('#passScreen [data-pass="ok"]'); await sleep(400);
  if (!await page.evaluate(() => document.querySelectorAll('#hands .card:not(.back)').length)) problems.push('multijugador local: no se ven las cartas propias');
  await shot('07f-local');
  await page.evaluate(() => document.getElementById('menuBtn').click()); await sleep(300);
  await page.evaluate(() => document.getElementById('modesBack').click()); await sleep(200);
  await page.evaluate(() => { document.documentElement.dataset.course = 'classic'; });

  console.log('creador de niveles');
  await page.evaluate(() => { document.querySelectorAll('.screen, #winOverlay').forEach(() => {}); });
  await click('#modesBtn'); await sleep(300); // el creador vive en Modos de juego → Juegos especiales
  await click('[data-mtab="special"]'); await sleep(700);
  await click('#editorBtn'); await sleep(300);
  await click('#edTools [data-tool="bunker"]');
  await click('#edBoard .cell[data-x="1"][data-y="1"]');
  await click('#edTools [data-tool="portal"]');
  await click('#edBoard .cell[data-x="5"][data-y="2"]');
  await click('#edBoard .cell[data-x="1"][data-y="6"]');
  await page.type('#edName', 'Prueba humo');
  await click('#edSave'); await sleep(200);
  await shot('08-editor');
  await click('#edTest'); await sleep(500); await shot('09-editor-prueba');
  await click('#menuBtn'); await confirmIfAsked(); await sleep(300);
  await click('#edShare'); await sleep(500); await shot('10-compartir');
  await page.keyboard.press('Escape'); await sleep(200);
  await click('#edLibBtn'); await sleep(300); await shot('10b-mis-niveles');
  await page.keyboard.press('Escape'); await sleep(200);
  await click('#edMenu'); await sleep(300); // vuelve a Modos de juego
  if (await page.evaluate(() => window.chaoticGolf.app.screen) !== 'modes') problems.push('el creador no vuelve a Modos de juego');
  await click('#modesBack'); await sleep(200);

  console.log('teclado');
  await click('#storyBtn'); await sleep(300);
  await click('.lvlCard[data-level="0"]'); await confirmIfAsked(); await sleep(700);
  await shot('11-teclado');
  // teclado: foco en el tablero y flechas
  await page.focus('#board .cell[tabindex="0"]');
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowDown');
  const focused = await page.evaluate(() => document.activeElement?.getAttribute('aria-label'));
  console.log('  foco de teclado en:', focused);
  if (!focused) problems.push('la navegación por teclado del tablero no funciona');
} catch (e) {
  problems.push('prueba: ' + e.message);
  await shot('zz-error').catch(() => {});
} finally {
  await browser.close();
  server.close();
}

console.log(`\ncapturas en ${OUT}`);
if (problems.length) { console.log('❌ problemas:\n  ' + [...new Set(problems)].join('\n  ')); process.exit(1); }
console.log('✅ sin errores');
