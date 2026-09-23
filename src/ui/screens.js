// Pantallas (menú, partida, editor, historia, configuración PVE) y navegación entre ellas.
import { app } from './app.js';
import { $, $$, esc } from './dom.js';
import { Game, PLAYER_COLORS } from '../engine/game.js';
import { ART } from '../art.js';
import { loadLevels, loadProgress } from '../storage.js';
import { startGame, fitBoard, render } from './controller.js';
import { hideWin } from './win.js';
import { aiKick, aiStop } from './ai-driver.js';
import { readDebugSettings, refreshGivePlayer } from './debug.js';
import { fitEditorBoard, edRender, ED } from './editor.js';
import { updateMenuBtn, toast } from './hud.js';
import { t } from '../i18n/index.js';

// ¿el usuario navega con teclado? (entonces al cambiar de pantalla se enfoca su primer control)
let usingKeyboard = false;
window.addEventListener('keydown', e => { if (e.key === 'Tab' || e.key.startsWith('Arrow') || e.key === 'Enter') usingKeyboard = true; }, true);
window.addEventListener('pointerdown', () => { usingKeyboard = false; }, true);

const DISPLAY = { menu: 'flex', game: 'block', editor: 'block', story: 'flex', pve: 'flex' };

export function showScreen(s) {
  app.screen = s;
  for (const id of Object.keys(DISPLAY)) $(id + 'Screen').style.display = id === s ? DISPLAY[id] : 'none';
  $('logPanel').style.display = s === 'game' ? 'flex' : 'none';   // el historial solo vive en la partida
  if (s === 'game' && app.game) { fitBoard(); render(); }        // recalcular tamaños al hacerse visible
  if (s === 'editor' && ED.level) { fitEditorBoard(); edRender(); }
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
}
// nivel de historia por índice global: primero los integrados, luego los del creador
export const storyLevelAt = i => i < app.storyLevels.length ? app.storyLevels[i] : loadLevels()[i - app.storyLevels.length];

export function openStory() {
  hideWin();
  aiStop();
  const prog = loadProgress();
  const userLevels = loadLevels();
  const btn = (i, name) =>
    `<button class="lvlBtn ${prog[i] ? 'done' : ''}" style="animation-delay:${i * 55}ms" data-level="${i}"` +
    ` title="${esc(name || t('story.level', { n: i + 1 }))}" aria-label="${esc(t('story.levelAria', { n: i + 1, name: name || '' }))}${prog[i] ? ` · ${esc(t('story.done'))}` : ''}">` +
    `${i + 1}${prog[i] ? '<span class="check" aria-hidden="true">✔</span>' : ''}</button>`;
  // dos apartados bien diferenciados: niveles integrados primero, los del creador después
  $('lvlGrid').innerHTML =
    `<div class="lvlSection"><h3>${t('story.builtIn')}</h3><div class="lvlRow">${app.storyLevels.map((L, i) => btn(i, L.name)).join('')}</div></div>` +
    `<div class="lvlSection"><h3>${t('story.yours')}</h3><div class="lvlRow">${userLevels.length
      ? userLevels.map((L, j) => btn(app.storyLevels.length + j, L.name)).join('')
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
export function leaveToMenu() { // salir al menú desde el popup final: hay que apagar el overlay primero
  hideWin();
  aiStop(); // la IA se detiene al salir de la partida
  showScreen('menu');
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
  setTimeout(aiKick, 900); // si abre la máquina, que juegue
}

/* ---------- arte del menú ---------- */
export function applyArtExtras() {
  if (ART['menu.bg']) {
    $('menuScene').style.display = 'none';
    $('menuScreen').style.background = `url(${ART['menu.bg']}) center / cover no-repeat`;
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
  $('pveBtn').addEventListener('click', openPveSetup);
  $('testToolBtn').addEventListener('click', openTestingTool);
  $('pvePlay').addEventListener('click', startPveMatch);
  $('pveBack').addEventListener('click', () => showScreen('menu'));
  $('storyBack').addEventListener('click', () => showScreen('menu'));
  $('lvlGrid').addEventListener('click', e => {
    const b = e.target.closest('[data-level]');
    if (!b) return;
    const i = +b.dataset.level, L = storyLevelAt(i);
    if (L) startLevel(L, 'story', i);
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
    aiStop(); // la IA se detiene al salir de la partida
    if (app.mode === 'test') showScreen('editor');
    else if (app.mode === 'story') openStory();
    else showScreen('menu');
  });
  $('resetBtn').addEventListener('click', () => { // empezar de cero: el nivel actual o la partida en curso
    if (app.mode === 'pve' && app.lastPveCfg) { app.pveCfg = { ...app.lastPveCfg }; startPveMatch(); }
    else if (app.mode === 'story' || app.mode === 'test') replayLevel();
    else newFreeGame();
    toast(t('hud.restarted'));
  });
}
