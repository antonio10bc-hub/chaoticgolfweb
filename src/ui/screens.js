// Pantallas (menú, partida, editor, historia, configuración PVE) y navegación entre ellas.
import { app } from './app.js';
import { $, $$, esc } from './dom.js';
import { Game, PLAYER_COLORS } from '../engine/game.js';
import { ART } from '../art.js';
import { loadLevels, loadProgress } from '../storage.js';
import { startGame, fitBoard, render } from './controller.js';
import { hideWin } from './win.js';
import { aiStart, aiStop } from './ai-driver.js';
import { readDebugSettings, refreshGivePlayer } from './debug.js';
import { fitEditorBoard, edRender, ED } from './editor.js';
import { updateMenuBtn, toast } from './hud.js';
import { t } from '../i18n/index.js';
import { confirmDialog } from './dialog.js';
import { saveGame, loadSave, applySaveExtras, clearSave } from './save.js';
import { getLang } from '../i18n/index.js';

// nombre de un nivel en el idioma activo (name_en, …) o el original
export const levelName = L => (L && (L['name_' + getLang()] || L.name)) || '';

// ¿el usuario navega con teclado? (entonces al cambiar de pantalla se enfoca su primer control)
let usingKeyboard = false;
window.addEventListener('keydown', e => { if (e.key === 'Tab' || e.key.startsWith('Arrow') || e.key === 'Enter') usingKeyboard = true; }, true);
window.addEventListener('pointerdown', () => { usingKeyboard = false; }, true);

const DISPLAY = { menu: 'flex', game: 'block', editor: 'block', story: 'flex', pve: 'flex' };

export function showScreen(s) {
  app.screen = s;
  document.body.dataset.screen = s; // los estilos recolocan controles globales (sonido) por pantalla
  for (const id of Object.keys(DISPLAY)) $(id + 'Screen').style.display = id === s ? DISPLAY[id] : 'none';
  $('logPanel').style.display = s === 'game' ? 'flex' : 'none';   // el historial solo vive en la partida
  if (s === 'game' && app.game) { fitBoard(); render(); }        // recalcular tamaños al hacerse visible
  if (s === 'editor' && ED.level) { fitEditorBoard(); edRender(); }
  if (s === 'menu') updateContinueBtn();
  if (!usingKeyboard) return; // con ratón no se mueve el foco (evita anillos de foco inesperados)
  const focusTarget = { menu: '.mBtn', story: '.lvlBtn', pve: '#pvePlay', editor: '#edTools button', game: '#hands .card[data-p]' }[s];
  requestAnimationFrame(() => document.querySelector(`#${s}Screen ${focusTarget}`)?.focus({ preventScroll: true }));
}

/* ---------- modo libre (testing tool) ---------- */
export function newFreeGame() {
  const cfg = readDebugSettings();
  startGame(Game.free(cfg, { seed: cfg.seed }), 'free');
  refreshGivePlayer();
  updateMenuBtn();
  fitBoard();
  render();
}
export function openTestingTool() {
  if (app.mode !== 'free' || !app.game) newFreeGame(); // vuelve al modo libre con los ajustes del debug
  updateMenuBtn();
  showScreen('game');
}

/* ---------- niveles (historia / probar desde el editor) ---------- */
export function startLevel(level, mode, idx = null) {
  const builtIn = mode === 'story' && idx !== null && idx < app.storyLevels.length;
  startGame(Game.fromLevel(level), mode, { levelIndex: idx, level: { ...level, builtIn } });
  refreshGivePlayer();
  showScreen('game');
  saveGame();
}
// nivel de historia por índice global: primero los integrados, luego los del creador
export const storyLevelAt = i => i < app.storyLevels.length ? app.storyLevels[i] : loadLevels()[i - app.storyLevels.length];

export function openStory() {
  hideWin();
  aiStop();
  const prog = loadProgress();
  const userLevels = loadLevels();
  // el siguiente nivel sugerido: el primero sin completar
  const total = app.storyLevels.length + userLevels.length;
  let next = -1;
  for (let i = 0; i < total; i++) if (!prog[i]) { next = i; break; }
  const btn = (i, L) => {
    const state = prog[i] ? 'done' : i === next ? 'next' : '';
    const label = prog[i] ? `<svg class="i" aria-hidden="true"><use href="#i-check"/></svg>${t('story.completed')}` : i === next ? t('story.next') : t('story.play');
    return `<button class="lvlCard ${state}" style="animation-delay:${i * 60}ms" data-level="${i}"` +
      ` aria-label="${esc(t('story.levelAria', { n: i + 1, name: levelName(L) }))}${prog[i] ? ` · ${esc(t('story.done'))}` : ''}">` +
      `<span class="lvlNum">${i + 1}</span>` +
      `<span class="lvlPreview">${levelPreviewSVG(L)}</span>` +
      `<span class="lvlName">${esc(levelName(L) || t('story.untitled'))}</span>` +
      `<span class="lvlState">${label}</span></button>`;
  };
  // dos apartados bien diferenciados: niveles integrados primero, los del creador después
  $('lvlGrid').innerHTML =
    `<div class="lvlSection"><h3>${t('story.builtIn')}</h3><div class="lvlRow">${app.storyLevels.map((L, i) => btn(i, L)).join('')}</div></div>` +
    `<div class="lvlSection"><h3>${t('story.yours')}</h3><div class="lvlRow">${userLevels.length
      ? userLevels.map((L, j) => btn(app.storyLevels.length + j, L)).join('')
      : `<div class="noLevels">${t('story.none')}</div>`}</div></div>`;
  showScreen('story');
}
export function replayLevel() {
  hideWin();
  if (app.mode === 'test') startLevel(ED.level, 'test');
  else if (app.mode === 'story') startLevel(storyLevelAt(app.levelIndex), 'story', app.levelIndex);
  else newFreeGame();
}
export function nextLevel() {
  const i = app.levelIndex + 1;
  const L = storyLevelAt(i);
  if (L) { hideWin(); startLevel(L, 'story', i); }
}
export function backToEditor() {
  hideWin();
  showScreen('editor');
}
export function leaveToMenu() { // salir al menú desde el popup final (partida ya terminada)
  discardGame();
  showScreen('menu');
}

/* ---------- salir / reiniciar / sustituir partida ---------- */
const gameInProgress = () => { const S = app.game?.S; return !!S && !(S.winner !== null && !S.jaque); };

// reiniciar pide confirmación si hay una partida a medias (se perderá). true = seguir adelante
async function confirmReset() {
  if (!gameInProgress()) return true;
  return confirmDialog(t('game.confirmReset'), t('game.resetShort'), true, t('game.confirmTitle'));
}

// empezar una partida nueva sustituye a la guardada: se avisa antes. true = seguir adelante
async function confirmReplaceSave() {
  if (!loadSave()) return true;
  return confirmDialog(t('save.confirmReplace'), t('save.replaceOk'), true, t('save.title'));
}

// detiene todo lo que corre en segundo plano (IA, temporizadores, cartas en pantalla)
function stopGameActivity() {
  aiStop();
  hideWin();
  document.querySelectorAll('.card.floating').forEach(el => el.remove());
  app.animQueue = []; app.animLead = 0;
}

// salir al menú con la partida a medias: queda guardada para "Continuar partida"
export function suspendGame() {
  saveGame();
  stopGameActivity();
  app.game = null;
}

// deja la partida realmente cerrada: sin IA, sin guardado y sin partida activa
export function discardGame() {
  stopGameActivity();
  clearSave();
  app.game = null;
}

// miniatura del tablero de un nivel (casillas, PAR, losetas, hoyo, pelota y obstáculos)
function levelPreviewSVG(L) {
  const s = 10, g = 2, W = L.cols * (s + g) - g, H = L.rows * (s + g) - g;
  const par = new Set((L.parCells || []).map(p => p.x + ',' + p.y));
  const tile = Object.fromEntries((L.tiles || []).map(tl => [tl.x + ',' + tl.y, tl.type]));
  let out = '';
  for (let y = 0; y < L.rows; y++) for (let x = 0; x < L.cols; x++) {
    const k = x + ',' + y, tp = tile[k];
    const fill = tp === 'bunker' ? '#ECE6CC' : tp === 'portal' ? '#2D4F7C' : par.has(k) ? '#8DB05F' : ((x + y) % 2 ? '#5C9854' : '#4F8A4B');
    out += `<rect x="${x * (s + g)}" y="${y * (s + g)}" width="${s}" height="${s}" rx="2.5" fill="${fill}"/>`;
  }
  const c = (x, y) => [x * (s + g) + s / 2, y * (s + g) + s / 2];
  for (const eb of L.extraBalls || []) { const [cx, cy] = c(eb.x, eb.y); out += `<circle cx="${cx}" cy="${cy}" r="3.4" fill="#F1F1DC"/>`; }
  const [hx, hy] = c(L.hole.x, L.hole.y); out += `<circle cx="${hx}" cy="${hy}" r="4.2" fill="#242424"/><path d="M${hx} ${hy} v-7 l4.5 1.6 -4.5 1.6" fill="#E8873A" stroke="#F1F1DC" stroke-width=".8"/>`;
  const [bx, by] = c(L.ball.x, L.ball.y); out += `<circle cx="${bx + 1.2}" cy="${by + 1.2}" r="3.8" fill="rgba(20,40,20,.35)"/><circle cx="${bx}" cy="${by}" r="3.8" fill="#fff"/>`;
  return `<svg viewBox="-3 -3 ${W + 6} ${H + 6}" aria-hidden="true">${out}</svg>`;
}

/* ---------- Partida Rápida: configuración de la partida contra la máquina ---------- */
const PVE_SIZES = {
  s: { cols: 5, rows: 5, par: 2 },
  m: { cols: 7, rows: 9, par: 3 },
  l: { cols: 9, rows: 11, par: 4 },
};
export const PVE_COLORS = [...PLAYER_COLORS, '#e8833a'];

export function openPveSetup() { buildPveSetup(); showScreen('pve'); }

function buildPveSetup() {
  const cfg = app.pveCfg;
  $('pveColors').innerHTML = PVE_COLORS.map((c, i) =>
    `<button class="pveColor${cfg.color === i ? ' sel' : ''}" style="background:${c}" data-color="${i}"` +
    ` title="${esc(t('pve.pickColor'))}" aria-label="${esc(t('pve.colorAria', { n: i + 1 }))}" aria-pressed="${cfg.color === i}"></button>`).join('');
  $$('#pveSizes .pveOpt').forEach(b => { b.classList.toggle('sel', cfg.size === b.dataset.size); b.setAttribute('aria-pressed', cfg.size === b.dataset.size); });
  $$('#pveOpps .pveOpt').forEach(b => { b.classList.toggle('sel', cfg.opps === +b.dataset.n); b.setAttribute('aria-pressed', cfg.opps === +b.dataset.n); });
}

export function startPveMatch() {
  const cfg = app.pveCfg, sz = PVE_SIZES[cfg.size];
  app.lastPveCfg = { ...cfg };
  startGame(Game.pve({ players: cfg.opps + 1, ...sz, humanColor: PVE_COLORS[cfg.color] }), 'pve');
  refreshGivePlayer();
  updateMenuBtn();
  showScreen('game');
  saveGame();
  aiStart(900); // si abre la máquina, que juegue (cancelable si se sale antes)
}

/* ---------- continuar la partida guardada ---------- */
export function updateContinueBtn() {
  const d = loadSave(), btn = $('continueBtn');
  btn.hidden = !d;
  document.querySelector('.mActions').classList.toggle('hasSave', !!d);
  if (!d) return;
  const sub = d.mode === 'story'
    ? `${t('story.title')} · ${t('story.level', { n: (d.levelIndex ?? 0) + 1 })}`
    : `${t('pve.title')} · ${d.game.S.nPlayers - 1} ${t('seat.bot')}${d.game.S.nPlayers > 2 ? 's' : ''}`;
  $('continueSub').textContent = sub;
}
export function resumeGame() {
  const d = loadSave();
  if (!d) return;
  startGame(Game.restore(d.game), d.mode, { levelIndex: d.levelIndex, level: d.level });
  applySaveExtras(d);
  refreshGivePlayer();
  updateMenuBtn();
  showScreen('game');
  toast(t('save.restored'));
  if (d.mode === 'pve') aiStart(700);
}

/* ---------- arte del menú ---------- */
export function applyArtExtras() {
  if (ART['menu.bg']) {
    $('menuScene').style.display = 'none';
    $('scene').style.background = `url(${ART['menu.bg']}) center / cover no-repeat`;
  }
  if (ART['menu.logo']) {
    const title = document.querySelector('.mTitle');
    title.innerHTML = `<img src="${ART['menu.logo']}" alt="Chaotic Golf" style="max-width:min(560px,86vw);height:auto">`;
    title.style.textShadow = 'none';
    title.style.webkitTextStroke = '0';
  }
}

/* ---------- listeners ---------- */
export function bindScreens() {
  $('storyBtn').addEventListener('click', openStory);
  $('continueBtn').addEventListener('click', resumeGame);
  $('pveBtn').addEventListener('click', openPveSetup);
  $('testToolBtn').addEventListener('click', openTestingTool);
  $('pvePlay').addEventListener('click', async () => { if (await confirmReplaceSave()) startPveMatch(); });
  $('pveBack').addEventListener('click', () => showScreen('menu'));
  $('storyBack').addEventListener('click', () => showScreen('menu'));
  $('lvlGrid').addEventListener('click', async e => {
    const b = e.target.closest('[data-level]');
    if (!b) return;
    const i = +b.dataset.level, L = storyLevelAt(i);
    if (L && await confirmReplaceSave()) startLevel(L, 'story', i);
  });
  $('pveScreen').addEventListener('click', e => {
    const c = e.target.closest('[data-color]'), s = e.target.closest('[data-size]'), n = e.target.closest('#pveOpps [data-n]');
    if (c) app.pveCfg.color = +c.dataset.color;
    else if (s) app.pveCfg.size = s.dataset.size;
    else if (n) app.pveCfg.opps = +n.dataset.n;
    else return;
    buildPveSetup();
  });
  $('menuBtn').addEventListener('click', () => {
    const mode = app.mode;
    suspendGame(); // se guarda (historia / partida rápida) y se retoma con "Continuar partida"
    if (mode === 'test') showScreen('editor');
    else if (mode === 'story') openStory();
    else showScreen('menu');
  });
  $('resetBtn').addEventListener('click', async () => { // empezar de cero: el nivel actual o la partida en curso
    if (!await confirmReset()) return;
    aiStop(); clearSave(); // la partida anterior deja de existir antes de crear la nueva
    document.querySelectorAll('.card.floating').forEach(el => el.remove());
    if (app.mode === 'pve' && app.lastPveCfg) { app.pveCfg = { ...app.lastPveCfg }; startPveMatch(); }
    else if (app.mode === 'story' || app.mode === 'test') replayLevel();
    else newFreeGame();
    toast(t('hud.restarted'));
  });
}
