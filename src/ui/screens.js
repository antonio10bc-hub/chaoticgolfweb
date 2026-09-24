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
import { saveGame, loadSave, latestSave, applySaveExtras, clearSave } from './save.js';
import { getLang } from '../i18n/index.js';
import { recordStart, levelBest, turnsLabel } from './records.js';
import { musicScene } from '../audio/sfx.js';
import { REDUCED } from '../fx/juice.js';
import { humansOf } from './players.js';
import { tutorialStart, tutorialStop } from './tutorial.js';
import { loadProfile, saveProfile, cleanName, MAX_NAME } from './profile.js';
import { syncWakeLock } from './wake.js';
import { historyScreen } from './back.js';
import { clearPause } from './pause.js';

// nombre de un nivel en el idioma activo (name_en, …) o el original
export const levelName = L => (L && (L['name_' + getLang()] || L.name)) || '';

// ¿el usuario navega con teclado? (entonces al cambiar de pantalla se enfoca su primer control)
let usingKeyboard = false;
window.addEventListener('keydown', e => { if (e.key === 'Tab' || e.key.startsWith('Arrow') || e.key === 'Enter') usingKeyboard = true; }, true);
window.addEventListener('pointerdown', () => { usingKeyboard = false; }, true);

const DISPLAY = { menu: 'flex', game: 'block', editor: 'block', story: 'flex', pve: 'flex' };

export function showScreen(s) {
  const prev = app.screen;
  app.screen = s;
  // transición: la pantalla que entra aparece con un fundido suave (salvo movimiento reducido)
  const el = $(s + 'Screen');
  if (prev !== s && el && !REDUCED) { el.classList.remove('screenIn'); void el.offsetWidth; el.classList.add('screenIn'); }
  musicScene(s === 'game' ? 'game' : 'menu'); // la música acompaña: menú ↔ partida con fundido cruzado
  if (s !== 'game') tutorialStop();
  document.body.dataset.screen = s; // los estilos recolocan controles globales (sonido) por pantalla
  for (const id of Object.keys(DISPLAY)) $(id + 'Screen').style.display = id === s ? DISPLAY[id] : 'none';
  $('logPanel').style.display = s === 'game' ? 'flex' : 'none';   // el historial solo vive en la partida
  if (s === 'game' && app.game) { fitBoard(); render(); }        // recalcular tamaños al hacerse visible
  if (s === 'editor' && ED.level) { fitEditorBoard(); edRender(); }
  if (s === 'menu') { updateContinueBtn(); updateRepeatBtn(); }
  syncWakeLock();     // en partida, la pantalla no se apaga (móvil)
  historyScreen(s);   // botón / gesto de atrás del sistema
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
  applyOwnLook(app.game.S, [0], [loadProfile()]); // tu color y tu nombre también en los niveles
  refreshGivePlayer();
  musicScene('game', { newGame: true });
  showScreen('game');
  saveGame();
  if (mode === 'story') { recordStart('story'); tutorialStart(); }
}
// nivel de historia por índice global: primero los integrados, luego los del creador
export const storyLevelAt = i => i < app.storyLevels.length ? app.storyLevels[i] : loadLevels()[i - app.storyLevels.length];

export function openStory() {
  hideWin();
  aiStop();
  const prog = loadProgress();
  const userLevels = loadLevels();
  const storySave = loadSave('story');
  // el siguiente nivel sugerido: el primero sin completar
  const total = app.storyLevels.length + userLevels.length;
  let next = -1;
  for (let i = 0; i < total; i++) if (!prog[i]) { next = i; break; }
  const btn = (i, L) => {
    const state = prog[i] ? 'done' : i === next ? 'next' : '';
    const label = prog[i] ? `<svg class="i" aria-hidden="true"><use href="#i-check"/></svg>${t('story.completed')}` : i === next ? t('story.next') : t('story.play');
    const best = levelBest(i);
    const saved = storySave && storySave.levelIndex === i;
    return `<button class="lvlCard ${state}${saved ? ' saved' : ''}" style="animation-delay:${i * 60}ms" data-level="${i}"` +
      ` aria-label="${esc(t('story.levelAria', { n: i + 1, name: levelName(L) }))}${prog[i] ? ` · ${esc(t('story.done'))}` : ''}">` +
      `<span class="lvlNum">${i + 1}</span>` +
      `<span class="lvlPreview">${levelPreviewSVG(L)}</span>` +
      `<span class="lvlName">${esc(levelName(L) || t('story.untitled'))}</span>` +
      `<span class="lvlFoot"><span class="lvlState">${label}</span>` +
      (best ? `<span class="lvlBest" title="${esc(t('stats.bestTitle'))}"><svg class="i" aria-hidden="true"><use href="#i-trophy"/></svg>${esc(turnsLabel(best.turns))}</span>` : '') +
      `</span>${saved ? `<span class="lvlSaved">${esc(t('story.inProgress'))}</span>` : ''}</button>`;
  };
  // progreso de Lo básico: "3 de 4 completados" + barra
  const nb = app.storyLevels.length, done = app.storyLevels.filter((_, i) => prog[i]).length;
  $('storyProgress').innerHTML = nb ? `<div class="spText"><b>${esc(t('story.progress', { n: done, total: nb }))}</b>` +
    `${done === nb ? `<span class="spAll"><svg class="i" aria-hidden="true"><use href="#i-check"/></svg>${esc(t('story.allDone'))}</span>` : ''}</div>` +
    `<div class="spBar" role="progressbar" aria-valuemin="0" aria-valuemax="${nb}" aria-valuenow="${done}"><i style="width:${Math.round(100 * done / nb)}%"></i></div>` : '';
  // dos apartados bien diferenciados: niveles integrados primero, los del creador después
  // nivel a medias: se ofrece continuarlo en naranja, como en el menú
  $('storyContinue').innerHTML = storySave
    ? `<button class="mBtn continue" data-resume="story"><span class="cTxt"><span>${esc(t('menu.continue'))}</span>` +
      `<small>${esc(t('story.level', { n: (storySave.levelIndex ?? 0) + 1 }))}${storySave.level ? ' · ' + esc(levelName(storySave.level)) : ''}</small></span>` +
      `<svg class="i" aria-hidden="true"><use href="#i-arrow-r"/></svg></button>` : '';
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
async function confirmReplaceSave(mode) {
  if (!loadSave(mode)) return true;
  return confirmDialog(t('save.confirmReplace'), t('save.replaceOk'), true, t('save.title'));
}

// detiene todo lo que corre en segundo plano (IA, temporizadores, cartas en pantalla)
function stopGameActivity() {
  aiStop();
  clearPause();
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
  if (app.game) clearSave(app.mode);
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

export function openPveSetup() { app.pveCfg.color = loadProfile().color; buildPveSetup(); showScreen('pve'); }

// límites de la mesa: de 2 a 6 jugadores; con una sola persona, al menos 1 bot
function clampPve(cfg) {
  cfg.humans = Math.min(4, Math.max(1, cfg.humans || 1));
  cfg.opps = Math.max(cfg.humans > 1 ? 0 : 1, Math.min(6 - cfg.humans, cfg.opps ?? 2));
  if (!['easy', 'normal', 'hard'].includes(cfg.diff)) cfg.diff = 'normal';
}
function buildPveSetup() {
  const cfg = app.pveCfg;
  clampPve(cfg);
  $$('#pveHumans .pveOpt').forEach(b => { const on = cfg.humans === +b.dataset.h; b.classList.toggle('sel', on); b.setAttribute('aria-pressed', on); });
  $$('#pveDiff .pveOpt').forEach(b => { const on = cfg.diff === b.dataset.diff; b.classList.toggle('sel', on); b.setAttribute('aria-pressed', on); });
  $$('#pveOpps .pveOpt').forEach(b => {
    const n = +b.dataset.n;
    b.disabled = (n === 0 && cfg.humans === 1) || n + cfg.humans > 6;
  });
  $('pveDiffRow').hidden = cfg.opps === 0;
  $('pveColorH').textContent = t(cfg.humans > 1 ? 'pve.colorFirst' : 'pve.color');
  $('pveCard').classList.toggle('local', cfg.humans > 1);
  $('pveCard').querySelector('.sub').textContent = t(cfg.humans > 1 ? (cfg.opps ? 'pve.subLocalBots' : 'pve.subLocal') : 'pve.sub');
  const d = loadSave('pve');
  $('pveContinue').hidden = !d;
  if (d) $('pveContinueSub').textContent = saveSub(d);
  // nombres (y, con varias personas, el color de cada una): se recuerdan en el perfil
  const prof = loadProfile();
  $('pveColors').hidden = cfg.humans > 1;
  $('pvePeople').innerHTML = cfg.humans === 1
    ? `<input class="pveName" data-person="me" maxlength="${MAX_NAME}" value="${esc(prof.name)}" placeholder="${esc(t('pve.namePh'))}" aria-label="${esc(t('pve.nameAria'))}">`
    : prof.people.slice(0, cfg.humans).map((pp, i) =>
      `<div class="pvePerson"><button class="pveDot" data-cycle="${i}" style="background:${PVE_COLORS[pp.color % PVE_COLORS.length]}" title="${esc(t('pve.cycleColor'))}" aria-label="${esc(t('pve.cycleColor'))}"></button>` +
      `<input class="pveName" data-person="${i}" maxlength="${MAX_NAME}" value="${esc(pp.name)}" placeholder="${esc(t('player.name', { n: i + 1 }))}" aria-label="${esc(t('pve.nameAriaN', { n: i + 1 }))}"></div>`).join('');
  $('pveColors').innerHTML = PVE_COLORS.map((c, i) =>
    `<button class="pveColor${cfg.color === i ? ' sel' : ''}" style="background:${c}" data-color="${i}"` +
    ` title="${esc(t('pve.pickColor'))}" aria-label="${esc(t('pve.colorAria', { n: i + 1 }))}" aria-pressed="${cfg.color === i}"></button>`).join('');
  $$('#pveSizes .pveOpt').forEach(b => { b.classList.toggle('sel', cfg.size === b.dataset.size); b.setAttribute('aria-pressed', cfg.size === b.dataset.size); });
  $$('#pveOpps .pveOpt').forEach(b => { b.classList.toggle('sel', cfg.opps === +b.dataset.n); b.setAttribute('aria-pressed', cfg.opps === +b.dataset.n); });
}

// nombres y colores propios sobre los asientos de las personas (cosmético: el motor no los usa).
// Los bots que coincidan de color con una persona reciben otro libre.
function applyOwnLook(S, seats, people) {
  const n = S.nPlayers;
  S.colorMap = S.colorMap ? [...S.colorMap] : Array.from({ length: n }, (_, i) => PLAYER_COLORS[i % PLAYER_COLORS.length]);
  S.playerNames = Array(n).fill(null);
  const taken = new Set();
  seats.forEach((seat, i) => {
    const pp = people[i]; if (!pp) return;
    let ci = pp.color % PVE_COLORS.length;
    while (taken.has(PVE_COLORS[ci])) ci = (ci + 1) % PVE_COLORS.length;
    S.colorMap[seat] = PVE_COLORS[ci]; taken.add(PVE_COLORS[ci]);
    S.playerNames[seat] = cleanName(pp.name) || null;
  });
  for (let p = 0; p < n; p++) {
    if (seats.includes(p)) continue;
    if (taken.has(S.colorMap[p])) S.colorMap[p] = PVE_COLORS.find(c => !taken.has(c) && !S.colorMap.includes(c)) || S.colorMap[p];
    taken.add(S.colorMap[p]);
  }
}

/* ---------- "Repetir la última" (partida rápida con la misma configuración) ---------- */
const LAST_PVE = 'chaoticgolf_lastpve';
function lastPve() { try { const c = JSON.parse(localStorage.getItem(LAST_PVE)); return c && PVE_SIZES[c.size] ? c : null; } catch (e) { return null; } }
function cfgSub(c) {
  const sz = PVE_SIZES[c.size], parts = [`${sz.cols}×${sz.rows}`];
  if (c.humans > 1) parts.push(t('pve.peopleN', { n: c.humans }));
  if (c.opps) parts.push(t(c.opps > 1 ? 'pve.botsN' : 'pve.botN', { n: c.opps }), t('pve.diff' + c.diff[0].toUpperCase() + c.diff.slice(1)));
  return parts.join(' · ');
}
export function updateRepeatBtn() {
  const c = lastPve();
  $('repeatBtn').hidden = !c;
  if (c) $('repeatSub').textContent = cfgSub(c);
}
export async function repeatLastPve() {
  const c = lastPve();
  if (!c || !await confirmReplaceSave('pve')) return;
  app.pveCfg = { ...app.pveCfg, ...c };
  startPveMatch();
}

export function startPveMatch() {
  const cfg = app.pveCfg;
  clampPve(cfg);
  const sz = PVE_SIZES[cfg.size];
  app.lastPveCfg = { ...cfg };
  const prof = loadProfile();
  const people = cfg.humans > 1 ? prof.people.slice(0, cfg.humans) : [{ name: prof.name, color: cfg.color }];
  startGame(Game.pve({ players: cfg.opps + cfg.humans, humans: cfg.humans, aiLevel: cfg.diff, ...sz, humanColor: PVE_COLORS[people[0].color % PVE_COLORS.length] }), 'pve');
  applyOwnLook(app.game.S, humansOf(), people);
  try { localStorage.setItem(LAST_PVE, JSON.stringify(app.lastPveCfg)); } catch (e) { /* sin storage */ }
  // con una persona, el dispositivo es suyo; con varias, se pasa antes de enseñar ninguna mano
  app.viewer = cfg.humans > 1 ? null : app.game.S.human;
  refreshGivePlayer();
  updateMenuBtn();
  musicScene('game', { newGame: true });
  showScreen('game');
  saveGame();
  recordStart(cfg.humans > 1 ? 'local' : 'pve');
  aiStart(900); // si abre la máquina, que juegue (cancelable si se sale antes)
}

/* ---------- continuar la partida guardada ---------- */
// subtítulo de un guardado: "Modo Historia · Nivel 3" / "Partida rápida · 2 bots" / "Multijugador local · 3 personas"
function saveSub(d) {
  if (d.mode === 'story') return `${t('story.title')} · ${t('story.level', { n: (d.levelIndex ?? 0) + 1 })}`;
  const S = d.game.S, nh = (S.humans || [S.human]).length, nb = S.nPlayers - nh;
  if (nh > 1) return `${t('pve.localTitle')} · ${t('pve.peopleN', { n: nh })}${nb ? ' + ' + t(nb > 1 ? 'pve.botsN' : 'pve.botN', { n: nb }) : ''}`;
  return `${t('pve.title')} · ${t(nb > 1 ? 'pve.botsN' : 'pve.botN', { n: nb })}`;
}
export function updateContinueBtn() {
  const d = latestSave(), btn = $('continueBtn');
  btn.hidden = !d;
  document.querySelector('.mActions').classList.toggle('hasSave', !!d);
  if (!d) return;
  btn.dataset.resume = d.mode;
  $('continueSub').textContent = saveSub(d);
}
export function resumeGame(mode) {
  const d = typeof mode === 'string' ? loadSave(mode) : latestSave();
  if (!d) return;
  startGame(Game.restore(d.game), d.mode, { levelIndex: d.levelIndex, level: d.level });
  applySaveExtras(d);
  // multijugador local: por privacidad, al volver se pasa el dispositivo antes de enseñar manos
  app.viewer = humansOf().length > 1 ? null : d.game.S.human;
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
  $('continueBtn').addEventListener('click', () => resumeGame());
  $('pveContinue').addEventListener('click', () => resumeGame('pve'));
  $('repeatBtn').addEventListener('click', repeatLastPve);
  // nombres del perfil: se guardan al escribir
  $('pveScreen').addEventListener('input', e => {
    const inp = e.target.closest('.pveName');
    if (!inp) return;
    const prof = loadProfile();
    if (inp.dataset.person === 'me') prof.name = inp.value.slice(0, MAX_NAME);
    else prof.people[+inp.dataset.person].name = inp.value.slice(0, MAX_NAME);
    saveProfile(prof);
  });
  $('storyContinue').addEventListener('click', e => { if (e.target.closest('[data-resume]')) resumeGame('story'); });
  $('pveBtn').addEventListener('click', openPveSetup);
  $('testToolBtn').addEventListener('click', openTestingTool);
  $('pvePlay').addEventListener('click', async () => { if (await confirmReplaceSave('pve')) startPveMatch(); });
  $('pveBack').addEventListener('click', () => showScreen('menu'));
  $('storyBack').addEventListener('click', () => showScreen('menu'));
  $('lvlGrid').addEventListener('click', async e => {
    const b = e.target.closest('[data-level]');
    if (!b) return;
    const i = +b.dataset.level, L = storyLevelAt(i);
    if (!L) return;
    const sv = loadSave('story');
    if (sv && sv.levelIndex === i) { resumeGame('story'); return; } // el nivel a medias: se continúa
    if (await confirmReplaceSave('story')) startLevel(L, 'story', i);
  });
  $('pveScreen').addEventListener('click', e => {
    const c = e.target.closest('[data-color]'), s = e.target.closest('[data-size]'), n = e.target.closest('#pveOpps [data-n]');
    const h = e.target.closest('#pveHumans [data-h]'), d = e.target.closest('#pveDiff [data-diff]');
    const cy = e.target.closest('[data-cycle]');
    if (cy) { // multijugador local: cada persona cambia su color (sin repetir el de otra)
      const prof = loadProfile(), i = +cy.dataset.cycle, used = prof.people.slice(0, app.pveCfg.humans).map((pp, j) => j !== i && pp.color % PVE_COLORS.length);
      let ci = prof.people[i].color;
      do ci = (ci + 1) % PVE_COLORS.length; while (used.includes(ci));
      prof.people[i].color = ci; saveProfile(prof); buildPveSetup(); return;
    }
    if (c) { app.pveCfg.color = +c.dataset.color; const prof = loadProfile(); prof.color = app.pveCfg.color; saveProfile(prof); }
    else if (s) app.pveCfg.size = s.dataset.size;
    else if (n && !n.disabled) app.pveCfg.opps = +n.dataset.n;
    else if (h) { app.pveCfg.humans = +h.dataset.h; if (app.pveCfg.humans > 1 && app.pveCfg.opps > 6 - app.pveCfg.humans) app.pveCfg.opps = 6 - app.pveCfg.humans; }
    else if (d) app.pveCfg.diff = d.dataset.diff;
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
