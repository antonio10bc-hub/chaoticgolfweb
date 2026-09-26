// Pantalla de Lo básico: los niveles integrados. Los puzles de "gana en 1 turno" y los niveles del
// creador ("Tus niveles") se muestran en Modos de juego, con las mismas tarjetas (secciones de aquí).
// También arranca cualquier nivel en solitario (y el "probar" del editor).
import { app } from './app.js';
import { $, esc } from './dom.js';
import { Game } from '../engine/game.js';
import { loadLevels, loadProgress } from '../storage.js';
import { startGame } from './controller.js';
import { hideWin } from './win.js';
import { aiStop } from './ai-driver.js';
import { t } from '../i18n/index.js';
import { saveGame, loadSave } from './save.js';
import { recordStart, levelBest, turnsLabel, loadRecords } from './records.js';
import { musicScene } from '../audio/sfx.js';
import { tutorialStart } from './tutorial.js';
import { loadProfile } from './profile.js';
import { showScreen, levelName, confirmReplaceSave, MODE_NAV, newFreeGame } from './screens.js';
import { applyOwnLook } from './screen-pve.js';
import { resumeGame } from './resume.js';
import { openModes } from './screen-modes.js';

// nivel de Lo básico por índice global: primero los integrados, luego los del creador
export const storyLevelAt = i => i < app.storyLevels.length ? app.storyLevels[i] : loadLevels()[i - app.storyLevels.length];
export const puzzleAt = i => app.puzzleLevels[i] || null;
// ¿es un nivel del creador? (van a continuación de los integrados y viven en Modos de juego)
export const isUserLevelIdx = i => i != null && i >= app.storyLevels.length;
// ¿la partida en curso vuelve a Modos de juego? (puzles y niveles del creador)
export const levelFromModes = () => app.mode === 'story' && (app.variant === 'puzzle' || (!app.variant && isUserLevelIdx(app.levelIndex)));

// arranca un nivel en solitario. variant: null (Lo básico / editor) | 'puzzle' | 'rush'
export function startLevel(level, mode, idx = null, { variant = null, run = null, seed } = {}) {
  const builtIn = mode === 'story' && idx !== null && (variant === 'puzzle' || (!variant && idx < app.storyLevels.length));
  startGame(Game.fromLevel(level, seed != null ? { seed } : undefined), mode, { levelIndex: idx, level: { ...level, builtIn }, variant, run });
  applyOwnLook(app.game.S, [0], [loadProfile()]); // tu color y tu nombre también en los niveles
  musicScene('game', { newGame: true });
  showScreen('game');
  saveGame();
  if (mode === 'story' && variant !== 'rush') recordStart(variant || 'story'); // (el contrarreloj cuenta la serie, no cada hoyo)
  if (mode === 'story' && !variant) tutorialStart();
}

// tarjeta de nivel (miniatura, número, nombre y estado)
function levelCard(i, L, { done, next, best, saved, attr }) {
  const state = done ? 'done' : next ? 'next' : '';
  const label = done ? `<svg class="i" aria-hidden="true"><use href="#i-check"/></svg><span class="lsTxt">${t('story.completed')}</span>` : next ? t('story.next') : t('story.play');
  return `<button class="lvlCard ${state}${saved ? ' saved' : ''}" style="animation-delay:${i * 60}ms" ${attr}` +
    ` aria-label="${esc(t('story.levelAria', { n: i + 1, name: levelName(L) }))}${done ? ` · ${esc(t('story.done'))}` : ''}">` +
    `<span class="lvlNum">${i + 1}</span>` +
    `<span class="lvlPreview">${levelPreviewSVG(L)}</span>` +
    `<span class="lvlName">${esc(levelName(L) || t('story.untitled'))}</span>` +
    `<span class="lvlFoot"><span class="lvlState">${label}</span>` +
    (best ? `<span class="lvlBest" title="${esc(t('stats.bestTitle'))}"><svg class="i" aria-hidden="true"><use href="#i-trophy"/></svg>${esc(turnsLabel(best.turns))}</span>` : '') +
    `</span>${saved ? `<span class="lvlSaved">${esc(t('story.inProgress'))}</span>` : ''}</button>`;
}

export function openStory() {
  hideWin();
  aiStop();
  const prog = loadProgress();
  const saved = loadSave('story'), storySave = saved && !isUserLevelIdx(saved.levelIndex) ? saved : null;
  // el siguiente nivel sugerido: el primero sin completar
  const next = app.storyLevels.findIndex((_, i) => !prog[i]);
  const card = (i, L) => levelCard(i, L, { done: prog[i], next: i === next, best: levelBest(i),
    saved: storySave && storySave.levelIndex === i, attr: `data-level="${i}"` });
  // progreso de Lo básico: "3 de 4 completados" + barra
  const nb = app.storyLevels.length, done = app.storyLevels.filter((_, i) => prog[i]).length;
  $('storyProgress').innerHTML = nb ? `<div class="spText"><b>${esc(t('story.progress', { n: done, total: nb }))}</b>` +
    `${done === nb ? `<span class="spAll"><svg class="i" aria-hidden="true"><use href="#i-check"/></svg>${esc(t('story.allDone'))}</span>` : ''}</div>` +
    `<div class="spBar" role="progressbar" aria-valuemin="0" aria-valuemax="${nb}" aria-valuenow="${done}"><i style="width:${Math.round(100 * done / nb)}%"></i></div>` : '';
  // nivel a medias: se ofrece continuarlo en naranja, como en el menú
  $('storyContinue').innerHTML = storySave
    ? `<button class="mBtn continue" data-resume="story"><span class="cTxt"><span>${esc(t('menu.continue'))}</span>` +
      `<small>${esc(t('story.level', { n: (storySave.levelIndex ?? 0) + 1 }))}${storySave.level ? ' · ' + esc(levelName(storySave.level)) : ''}</small></span>` +
      `<svg class="i" aria-hidden="true"><use href="#i-arrow-r"/></svg></button>` : '';
  $('lvlGrid').innerHTML =
    `<div class="lvlSection"><h3>${t('story.builtIn')}</h3><div class="lvlRow">${app.storyLevels.map((L, i) => card(i, L)).join('')}</div></div>`;
  showScreen('story');
}

/* ---------- secciones de Modos de juego: puzles y tus niveles ---------- */
export function puzzlesSectionHTML() {
  if (!app.puzzleLevels.length) return '';
  const done = loadRecords().puzzles, sv = loadSave('puzzle');
  const next = app.puzzleLevels.findIndex((_, i) => !done[i]);
  const nDone = app.puzzleLevels.filter((_, i) => done[i]).length;
  return `<section class="lvlSection puzzles"><h3>${esc(t('story.puzzlesH'))} <span class="lvlCount">${nDone}/${app.puzzleLevels.length}</span></h3>` +
    `<p class="lvlSub">${esc(t('story.puzzlesSub'))}</p><div class="lvlRow">` +
    app.puzzleLevels.map((L, i) => levelCard(i, L, { done: done[i], next: i === next, saved: sv && sv.levelIndex === i, attr: `data-puzzle="${i}"` })).join('') +
    `</div></section>`;
}
// tus niveles (propios y recibidos): cada uno con editar y eliminar; arriba, crear y añadir un código
export function yoursSectionHTML() {
  const levels = loadLevels(), prog = loadProgress(), sv = loadSave('story'), base = app.storyLevels.length;
  const icon = id => `<svg class="i" aria-hidden="true"><use href="#${id}"/></svg>`;
  return `<section class="lvlSection yours"><h3>${esc(t('story.yours'))}${levels.length ? ` <span class="lvlCount">${levels.length}</span>` : ''}` +
    `<span class="lvlHeadActs"><button class="btn-light btn-sm btn-icon" data-mode="editor">${icon('i-plus')}${esc(t('story.create'))}</button>` +
    `<button class="btn-light btn-sm btn-icon" data-lvcode="1">${icon('i-copy')}${esc(t('lib.addCode'))}</button></span></h3><div class="lvlRow">` + (levels.length
    ? levels.map((L, j) => { const i = base + j, name = L.name || t('story.untitled');
      return `<div class="lvlWrap">` + levelCard(j, L, { done: prog[i], best: levelBest(i), saved: sv && sv.levelIndex === i, attr: `data-level="${i}"` }) +
        `<span class="lvlActs">${L.origin === 'received' ? `<span class="lvlTag">${esc(t('lib.received'))}</span>` : ''}` +
        `<button class="btn-light btn-sm btn-icon" data-lvedit="${j}" title="${esc(t('lib.edit'))}" aria-label="${esc(t('lib.editAria', { name }))}">${icon('i-wrench')}</button>` +
        `<button class="btn-light btn-sm btn-icon danger" data-lvdel="${j}" title="${esc(t('lib.delete'))}" aria-label="${esc(t('lib.deleteAria', { name }))}">${icon('i-trash')}</button></span></div>`; }).join('')
    : `<div class="noLevels">${esc(t('story.none'))}</div>`) +
    `</div></section>`;
}
// tarjeta de nivel pulsada (Lo básico o Modos): continúa el nivel a medias o lo empieza
export async function playLevelCard(b) {
  const puzzle = b.dataset.puzzle !== undefined;
  const i = +(puzzle ? b.dataset.puzzle : b.dataset.level), L = puzzle ? puzzleAt(i) : storyLevelAt(i);
  if (!L) return;
  const slot = puzzle ? 'puzzle' : 'story';
  const sv = loadSave(slot);
  if (sv && sv.levelIndex === i) { resumeGame(slot); return; } // el nivel a medias: se continúa
  if (await confirmReplaceSave(slot)) startLevel(L, 'story', i, { variant: puzzle ? 'puzzle' : null });
}

// botón del menú: cuántos niveles de Lo básico llevas ("3/8") o, con todos, un tic gris
export function paintStoryBtn() {
  const el = $('storyProg'), n = app.storyLevels.length;
  if (!el || !n) return;
  const prog = loadProgress(), done = app.storyLevels.filter((_, i) => prog[i]).length, all = done === n;
  el.classList.toggle('all', all);
  el.innerHTML = all ? `<svg class="i" aria-hidden="true"><use href="#i-check"/></svg>` : `${done}/${n}`;
  $('storyBtn').setAttribute('aria-label', `${t('menu.story')} · ${all ? t('story.allDone') : t('story.progress', { n: done, total: n })}`);
}

export function replayLevel() {
  hideWin();
  if (app.mode === 'test') startLevel(app.level, 'test', null, { variant: app.variant }); // (probar o laboratorio)
  else if (app.variant === 'puzzle') startLevel(puzzleAt(app.levelIndex), 'story', app.levelIndex, { variant: 'puzzle' });
  else if (app.mode === 'story') startLevel(storyLevelAt(app.levelIndex), 'story', app.levelIndex);
  else newFreeGame();
}
export function nextLevel() {
  const i = app.levelIndex + 1;
  if (app.variant === 'puzzle') { const P = puzzleAt(i); if (P) { hideWin(); startLevel(P, 'story', i, { variant: 'puzzle' }); } return; }
  const L = hasNextLevel() && storyLevelAt(i);
  if (L) { hideWin(); startLevel(L, 'story', i); }
}
// el siguiente de su grupo: tras el último de Lo básico no se salta a tus niveles
export const hasNextLevel = () => {
  const i = app.levelIndex;
  if (app.variant === 'puzzle') return !!puzzleAt(i + 1);
  if (i === null) return false;
  return isUserLevelIdx(i) ? !!storyLevelAt(i + 1) : i + 1 < app.storyLevels.length;
};

// miniatura del tablero de un nivel (casillas, PAR, losetas, hoyo, pelota y obstáculos)
const PREV_FILL = { bunker: '#ECE6CC', portal: '#2D4F7C', river: '#5BB6D6', lake: '#2E7E8C', block: '#7A5230', corner: '#7A5230', tunnel: '#7A5230', launcher: '#7A5230' };
export function levelPreviewSVG(L) {
  const s = 10, g = 2, W = L.cols * (s + g) - g, H = L.rows * (s + g) - g;
  const par = new Set((L.parCells || []).map(p => p.x + ',' + p.y));
  const tile = Object.fromEntries((L.tiles || []).map(tl => [tl.x + ',' + tl.y, tl.type]));
  let out = '';
  for (let y = 0; y < L.rows; y++) for (let x = 0; x < L.cols; x++) {
    const k = x + ',' + y, tp = tile[k];
    const fill = PREV_FILL[tp] || (par.has(k) ? '#8DB05F' : ((x + y) % 2 ? '#5C9854' : '#4F8A4B'));
    out += `<rect x="${x * (s + g)}" y="${y * (s + g)}" width="${s}" height="${s}" rx="2.5" fill="${fill}"/>`;
    if (tp === 'block' || tp === 'corner' || tp === 'tunnel' || tp === 'launcher') out += `<rect x="${x * (s + g) + 2}" y="${y * (s + g) + 2}" width="${s - 4}" height="${s - 4}" rx="1.5" fill="#C99257"/>`;
  }
  const c = (x, y) => [x * (s + g) + s / 2, y * (s + g) + s / 2];
  for (const eb of L.extraBalls || []) { const [cx, cy] = c(eb.x, eb.y); out += `<circle cx="${cx}" cy="${cy}" r="3.4" fill="#F1F1DC"/>`; }
  const [hx, hy] = c(L.hole.x, L.hole.y); out += `<circle cx="${hx}" cy="${hy}" r="4.2" fill="#242424"/><path d="M${hx} ${hy} v-7 l4.5 1.6 -4.5 1.6" fill="#E8873A" stroke="#F1F1DC" stroke-width=".8"/>`;
  const [bx, by] = c(L.ball.x, L.ball.y); out += `<circle cx="${bx + 1.2}" cy="${by + 1.2}" r="3.8" fill="rgba(20,40,20,.35)"/><circle cx="${bx}" cy="${by}" r="3.8" fill="#fff"/>`;
  return `<svg viewBox="-3 -3 ${W + 6} ${H + 6}" aria-hidden="true">${out}</svg>`;
}

export function bindStory() {
  $('storyBtn').addEventListener('click', openStory);
  $('storyBack').addEventListener('click', () => showScreen('menu'));
  $('storyContinue').addEventListener('click', e => { if (e.target.closest('[data-resume]')) resumeGame('story'); });
  $('lvlGrid').addEventListener('click', e => {
    const b = e.target.closest('[data-level], [data-puzzle]');
    if (b) playLevelCard(b);
  });
  // navegación y reinicio de estos modos (puzles y tus niveles vuelven a Modos de juego)
  MODE_NAV.story = { back: () => (isUserLevelIdx(app.levelIndex) ? openModes('special') : openStory()), restart: replayLevel };
  MODE_NAV.puzzle = { back: () => openModes('special'), restart: replayLevel };
  MODE_NAV.test = { back: () => showScreen('editor'), restart: replayLevel };
  MODE_NAV.lab = MODE_NAV.test; // laboratorio del creador
}
