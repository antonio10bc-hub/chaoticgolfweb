// Pantalla de Lo básico: niveles integrados, los del creador y los puzles de "gana en 1 turno".
// También arranca cualquier nivel en solitario (y el "probar" del editor).
import { app } from './app.js';
import { $, esc } from './dom.js';
import { Game } from '../engine/game.js';
import { loadLevels, loadProgress } from '../storage.js';
import { startGame } from './controller.js';
import { hideWin } from './win.js';
import { aiStop } from './ai-driver.js';
import { ED } from './editor.js';
import { t } from '../i18n/index.js';
import { saveGame, loadSave } from './save.js';
import { recordStart, levelBest, turnsLabel, loadRecords } from './records.js';
import { musicScene } from '../audio/sfx.js';
import { tutorialStart } from './tutorial.js';
import { loadProfile } from './profile.js';
import { showScreen, levelName, confirmReplaceSave, MODE_NAV, newFreeGame } from './screens.js';
import { applyOwnLook } from './screen-pve.js';
import { resumeGame } from './resume.js';

// nivel de Lo básico por índice global: primero los integrados, luego los del creador
export const storyLevelAt = i => i < app.storyLevels.length ? app.storyLevels[i] : loadLevels()[i - app.storyLevels.length];
export const puzzleAt = i => app.puzzleLevels[i] || null;

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
  const label = done ? `<svg class="i" aria-hidden="true"><use href="#i-check"/></svg>${t('story.completed')}` : next ? t('story.next') : t('story.play');
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
  const userLevels = loadLevels();
  const storySave = loadSave('story'), puzzleSave = loadSave('puzzle');
  const puzzlesDone = loadRecords().puzzles;
  // el siguiente nivel sugerido: el primero sin completar
  const total = app.storyLevels.length + userLevels.length;
  let next = -1;
  for (let i = 0; i < total; i++) if (!prog[i]) { next = i; break; }
  const nextPuzzle = app.puzzleLevels.findIndex((_, i) => !puzzlesDone[i]);
  const card = (i, L) => levelCard(i, L, { done: prog[i], next: i === next, best: levelBest(i),
    saved: storySave && storySave.levelIndex === i, attr: `data-level="${i}"` });
  const pcard = (i, L) => levelCard(i, L, { done: puzzlesDone[i], next: i === nextPuzzle,
    saved: puzzleSave && puzzleSave.levelIndex === i, attr: `data-puzzle="${i}"` });
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
  const pDone = app.puzzleLevels.filter((_, i) => puzzlesDone[i]).length;
  $('lvlGrid').innerHTML =
    `<div class="lvlSection"><h3>${t('story.builtIn')}</h3><div class="lvlRow">${app.storyLevels.map((L, i) => card(i, L)).join('')}</div></div>` +
    (app.puzzleLevels.length ? `<div class="lvlSection puzzles"><h3>${t('story.puzzlesH')} <span class="lvlCount">${pDone}/${app.puzzleLevels.length}</span></h3>` +
      `<p class="lvlSub">${esc(t('story.puzzlesSub'))}</p><div class="lvlRow">${app.puzzleLevels.map((L, i) => pcard(i, L)).join('')}</div></div>` : '') +
    `<div class="lvlSection"><h3>${t('story.yours')}</h3><div class="lvlRow">${userLevels.length
      ? userLevels.map((L, j) => card(app.storyLevels.length + j, L)).join('')
      : `<div class="noLevels">${t('story.none')}</div>`}</div></div>`;
  showScreen('story');
}

export function replayLevel() {
  hideWin();
  if (app.mode === 'test') startLevel(ED.level, 'test');
  else if (app.variant === 'puzzle') startLevel(puzzleAt(app.levelIndex), 'story', app.levelIndex, { variant: 'puzzle' });
  else if (app.mode === 'story') startLevel(storyLevelAt(app.levelIndex), 'story', app.levelIndex);
  else newFreeGame();
}
export function nextLevel() {
  const i = app.levelIndex + 1;
  if (app.variant === 'puzzle') { const P = puzzleAt(i); if (P) { hideWin(); startLevel(P, 'story', i, { variant: 'puzzle' }); } return; }
  const L = storyLevelAt(i);
  if (L) { hideWin(); startLevel(L, 'story', i); }
}
export const hasNextLevel = () => app.variant === 'puzzle' ? !!puzzleAt(app.levelIndex + 1) : app.levelIndex !== null && !!storyLevelAt(app.levelIndex + 1);

// miniatura del tablero de un nivel (casillas, PAR, losetas, hoyo, pelota y obstáculos)
export function levelPreviewSVG(L) {
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

export function bindStory() {
  $('storyBtn').addEventListener('click', openStory);
  $('storyBack').addEventListener('click', () => showScreen('menu'));
  $('storyContinue').addEventListener('click', e => { if (e.target.closest('[data-resume]')) resumeGame('story'); });
  $('lvlGrid').addEventListener('click', async e => {
    const b = e.target.closest('[data-level], [data-puzzle]');
    if (!b) return;
    const puzzle = b.dataset.puzzle !== undefined;
    const i = +(puzzle ? b.dataset.puzzle : b.dataset.level), L = puzzle ? puzzleAt(i) : storyLevelAt(i);
    if (!L) return;
    const slot = puzzle ? 'puzzle' : 'story';
    const sv = loadSave(slot);
    if (sv && sv.levelIndex === i) { resumeGame(slot); return; } // el nivel a medias: se continúa
    if (await confirmReplaceSave(slot)) startLevel(L, 'story', i, { variant: puzzle ? 'puzzle' : null });
  });
  // navegación y reinicio de estos modos
  MODE_NAV.story = { back: openStory, restart: replayLevel };
  MODE_NAV.puzzle = { back: openStory, restart: replayLevel };
  MODE_NAV.test = { back: () => showScreen('editor'), restart: replayLevel };
}
