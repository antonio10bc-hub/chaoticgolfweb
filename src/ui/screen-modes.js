// Modos de juego y reto diario:
//   · Reto diario  — (en el menú principal) tablero pequeño contra 2 bots, igual para todos cada día
//                    (semilla de la fecha): cada día cambian los rivales y su dificultad.
//                    Récord del día (victoria en menos turnos propios) y racha de días jugados.
//   · Pantalla de Modos: Partida rápida (contra bots o multijugador local), Contrarreloj y Desafíos.
//   · Contrarreloj — 5 hoyos generados de dificultad creciente, cada uno con su cuenta atrás:
//                    puntos por turnos y por el tiempo que sobra; si se acaba el tiempo, se acaba la serie.
//   · Desafíos     — partidas contra la máquina con reglas especiales.
// La serie del contrarreloj se guarda aparte de la partida, para poder dejarla entre hoyos.
import { app } from './app.js';
import { $, esc } from './dom.js';
import { mulberry32, randomSeed } from '../engine/rng.js';
import { startGame } from './controller.js';
import { aiStart, aiStop } from './ai-driver.js';
import { hideWin } from './win.js';
import { refreshGivePlayer } from './debug.js';
import { updateMenuBtn } from './hud.js';
import { t, getLang } from '../i18n/index.js';
import { saveGame, loadSave, clearSave } from './save.js';
import { recordStart, recordDailyPlayed, loadRecords, updateRecords, turnsLabel } from './records.js';
import { musicScene, sfx } from '../audio/sfx.js';
import { generateLevel, dateKey, seedOf } from '../content/levels/generate.js';
import { showScreen, confirmReplaceSave, MODE_NAV } from './screens.js';
import { startLevel } from './screen-story.js';
import { createVsGame, dressVsGame, openPveSetup, lastPve, cfgSub, repeatLastPve, STYLE_COLOR } from './screen-pve.js';
import { PERSONAS, personaById, faceSVG } from './persona.js';
import { confirmDialog } from './dialog.js';
import { resumeGame } from './resume.js';
import { stats } from './controller.js';

const locale = () => getLang() === 'es' ? 'es-ES' : 'en-GB';
const store = {
  get: k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
  set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sin storage */ } },
};
const RUSH_KEY = 'chaoticgolf_rush';
export const RUSH_HOLES = 5;
const RUSH_LIMITS = [60, 75, 90, 100, 110]; // segundos de cada hoyo (más grandes, más tiempo)

/* =============== reto diario =============== */
const dailyDate = () => dateKey();
const DAILY_DIFFS = ['easy', 'normal', 'hard'];
// rivales del día: dos personajes de personalidades distintas y una dificultad, sacados de la fecha
export function dailySetup(date = dailyDate()) {
  const r = mulberry32(seedOf('dailyBots:' + date));
  const diff = DAILY_DIFFS[Math.floor(r() * DAILY_DIFFS.length)];
  const first = PERSONAS[Math.floor(r() * PERSONAS.length)];
  const rest = PERSONAS.filter(p => p.style !== first.style);
  const second = rest[Math.floor(r() * rest.length)];
  return { diff, rivals: [first.id, second.id], seed: seedOf('daily:' + date) };
}
function startDailyGame(date = dailyDate()) {
  const d = dailySetup(date);
  const made = createVsGame({ humans: 1, opps: 2, size: 's', diff: d.diff }, { rivals: d.rivals, seed: d.seed });
  startGame(made.game, 'pve', { variant: 'daily', run: { date } });
  dressVsGame(made);
  refreshGivePlayer();
  updateMenuBtn();
  musicScene('game', { newGame: true });
  showScreen('game');
  saveGame();
  aiStart(900);
}
export async function startDaily() {
  if (!await confirmReplaceSave('daily')) return;
  const date = dailyDate();
  recordDailyPlayed(date); // jugar hoy ya cuenta para la racha
  recordStart('daily');
  startDailyGame(date);
}
export const streakLabel = n => n === 1 ? t('modes.daily.streak1') : t('modes.daily.streak', { n });
function prevDayKey(date) {
  const [y, m, d] = date.split('-').map(Number);
  return dateKey(new Date(y, m - 1, d - 1));
}
// tarjeta del reto diario del menú principal: miniatura, fecha, récord de hoy, racha y botón
export function renderDailyCard() {
  const R = loadRecords(), date = dailyDate(), today = R.daily.days[date];
  const streak = R.daily.last === date || R.daily.last === prevDayKey(date) ? R.daily.streak : 0;
  const saved = loadSave('daily');
  const narrow = window.matchMedia('(max-width: 420px)').matches; // en el móvil, fecha corta
  const when = new Date().toLocaleDateString(locale(), narrow ? { weekday: 'short', day: 'numeric', month: 'short' } : { weekday: 'long', day: 'numeric', month: 'long' });
  const status = today?.best ? t('modes.daily.bestToday', { turns: turnsLabel(today.best) }) : t('modes.daily.notYet');
  const { diff, rivals } = dailySetup(date), rv = rivals.map(personaById);
  const face = pr => `<span class="avatar hasFace" style="--pc:${STYLE_COLOR[pr.style]}">${faceSVG(-1, pr.style, 'idle')}</span>`;
  const vs = t('modes.daily.vs', { a: rv[0].name, b: rv[1].name, diff: t('pve.diff' + diff[0].toUpperCase() + diff.slice(1)) });
  $('dailyCard').innerHTML =
    `<span class="dPreview dRivals">${rv.map(face).join('')}</span>` +
    `<span class="dTxt"><small class="dWhen">${esc(when)}</small><b>${esc(t('modes.daily.title'))}</b><span class="dVs">${esc(vs)}</span>` +
    `<span class="dMeta"><span>${esc(status)}</span>${streak ? `<span class="dStreak"><svg class="i" aria-hidden="true"><use href="#i-flag"/></svg>${esc(streakLabel(streak))}</span>` : ''}</span></span>` +
    `<span class="dPlay">${esc(saved ? t('menu.continue') : today?.best ? t('modes.again') : t('modes.play'))}<svg class="i" aria-hidden="true"><use href="#i-arrow-r"/></svg></span>`;
  $('dailyCard').classList.toggle('done', !!today?.best);
  $('dailyCard').dataset.resume = saved ? '1' : '';
}
// ¿queda el reto de hoy por completar?
export const dailyPending = () => !loadRecords().daily.days[dailyDate()]?.best;

/* =============== contrarreloj =============== */
// puntos de un hoyo: menos turnos = más puntos, y 5 por cada segundo que sobra
export const rushScore = (turns, secsLeft) => {
  const base = Math.max(100, 1000 - 150 * (turns - 1));
  const bonus = Math.max(0, Math.round(secsLeft * 5));
  return { base, bonus, total: base + bonus };
};
function newRush() {
  const s = randomSeed();
  return { seeds: Array.from({ length: RUSH_HOLES }, (_, i) => (s + i * 7919) >>> 0), hole: 0, total: RUSH_HOLES, scores: [] };
}
export function startRushHole(run = store.get(RUSH_KEY)) {
  if (!run) run = newRush();
  store.set(RUSH_KEY, run);
  const lvl = generateLevel(run.seeds[run.hole], run.hole); // dificultad 0…4
  startLevel(lvl, 'story', null, { variant: 'rush', run: { ...run, elapsed: 0, limit: RUSH_LIMITS[run.hole] || 90 }, seed: run.seeds[run.hole] ^ 0x5bd1e995 });
}
export async function startRush(fresh) {
  if (!await confirmReplaceSave('rush')) return;
  if (fresh) store.set(RUSH_KEY, null);
  if (fresh || !store.get(RUSH_KEY)) recordStart('rush');
  startRushHole(fresh ? newRush() : store.get(RUSH_KEY) || newRush());
}
const rushLeft = r => Math.max(0, (r.limit || 90) - (r.elapsed || 0));
// al embocar en contrarreloj: puntos del hoyo, total y siguiente (o final)
export function rushHoleDone() {
  const run = app.run, turns = (stats?.turnos || 0) + 1;
  const sc = rushScore(turns, rushLeft(run));
  const scores = [...(run.scores || []), sc.total];
  const sum = scores.reduce((a, b) => a + b, 0);
  const last = run.hole + 1 >= run.total;
  let newBest = false;
  if (last) {
    store.set(RUSH_KEY, null);
    updateRecords(d => { d.rush.runs++; if (sum > d.rush.best) { newBest = true; d.rush.best = sum; } d.won.rush++; });
  } else store.set(RUSH_KEY, { seeds: run.seeds, hole: run.hole + 1, total: run.total, scores });
  return { sc, sum, last, newBest, turns, best: loadRecords().rush.best };
}
// se acabó el tiempo: la serie termina con lo sumado hasta ahora
function rushTimeUp() {
  const run = app.run, sum = (run.scores || []).reduce((a, b) => a + b, 0);
  store.set(RUSH_KEY, null);
  clearSave('rush');
  let newBest = false;
  updateRecords(d => { d.rush.runs++; if (sum > d.rush.best) { newBest = sum > 0; d.rush.best = sum; } });
  run.timeUp = true;
  aiStop();
  import('./win.js').then(m => m.showRushTimeUp({ sum, newBest, hole: run.hole + 1, best: loadRecords().rush.best }));
}

/* =============== desafíos =============== */
const ORANGE_DECK = { palo1: 0, palo2: 0, palo3: 0, dedo: 0, hoyoUp: 0, hoyoDown: 0, hoyoLeft: 0, hoyoRight: 0, bunker: 0, portal: 0,
  oPalo1: 10, oHoyoUp: 2, oHoyoDown: 2, oHoyoLeft: 2, oHoyoRight: 2, no: 0 };
export const CHALLENGES = [
  { id: 'onlyOrange', icon: 'i-bolt', cfg: { opps: 1, size: 's', diff: 'normal' }, extra: { counts: ORANGE_DECK, rules: { onlyOrange: true }, par: 1 } },
  { id: 'noPalo3', icon: 'i-club', cfg: { opps: 2, size: 'm', diff: 'normal' }, extra: { counts: 'noPalo3' } },
  { id: 'holeDrift', icon: 'i-hole', cfg: { opps: 2, size: 'm', diff: 'normal' }, extra: { rules: { holeDrift: true } } },
  { id: 'bunkers', icon: 'i-sand', cfg: { opps: 2, size: 'm', diff: 'normal' }, tiles: { bunker: 7 } },
  { id: 'portals', icon: 'i-spiral', cfg: { opps: 2, size: 'l', diff: 'normal' }, tiles: { portal: 2, bunker: 2 } },
  { id: 'crowd', icon: 'i-users', cfg: { opps: 5, size: 'l', diff: 'hard' } },
];
const challengeById = id => CHALLENGES.find(c => c.id === id);
function challengeExtra(ch) {
  const ex = { ...(ch.extra || {}) };
  if (ex.counts === 'noPalo3') ex.counts = { palo1: 6, palo2: 8, palo3: 0, dedo: 2, hoyoUp: 2, hoyoDown: 2, hoyoLeft: 2, hoyoRight: 2, bunker: 1, portal: 1,
    oPalo1: 2, oHoyoUp: 1, oHoyoDown: 1, oHoyoLeft: 1, oHoyoRight: 1, no: 2 };
  return ex;
}
// losetas de salida de un desafío, en casillas libres lejos de la salida y de la columna de PAR
function placeTiles(S, want, seed) {
  const r = mulberry32((seed ^ 0x7f4a7c15) >>> 0);
  const ballRow = S.balls[0].y, parX = S.parCells[0]?.x;
  const ok = (x, y) => y > 0 && y < ballRow - 1 && x !== parX && !S.tiles.some(t => t.x === x && t.y === y)
    && !(S.hole.x === x && S.hole.y === y) && !S.balls.some(b => b.x === x && b.y === y);
  for (const [type, n] of Object.entries(want)) for (let i = 0; i < n; i++) {
    for (let tries = 0; tries < 80; tries++) {
      const x = Math.floor(r() * S.cols), y = Math.floor(r() * S.rows);
      if (ok(x, y)) { S.tiles.push({ type, x, y }); break; }
    }
  }
}
export async function startChallenge(id) {
  const ch = challengeById(id);
  if (!ch || !await confirmReplaceSave('challenge')) return;
  const ex = challengeExtra(ch);
  const made = createVsGame({ humans: 1, ...ch.cfg }, { extra: ex });
  startGame(made.game, 'pve', { variant: 'challenge', run: { id } });
  dressVsGame(made);
  if (ch.tiles) placeTiles(app.game.S, ch.tiles, made.game.seed ?? 1);
  recordStart('challenge');
  refreshGivePlayer();
  updateMenuBtn();
  musicScene('game', { newGame: true });
  showScreen('game');
  saveGame();
  aiStart(900);
}
export function challengeDone(won) {
  const id = app.run?.id;
  if (won && id) updateRecords(d => { d.challenges[id] = true; });
  return { id, won };
}

/* =============== etiqueta del modo en la barra de la partida =============== */
const mmss = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
export function modeChipText() {
  const r = app.run;
  switch (app.variant) {
    case 'daily': return `${t('modes.daily.title')} · ${new Date().toLocaleDateString(locale(), { day: 'numeric', month: 'short' })}`;
    case 'rush': return `${t('modes.holeN', { n: r.hole + 1, total: r.total })} · ${t('modes.rush.pts', { n: (r.scores || []).reduce((a, b) => a + b, 0) })}`;
    case 'challenge': return t('challenges.' + r.id + '.name');
    case 'puzzle': return t('story.puzzleChip');
  }
  return '';
}

// reloj del contrarreloj (cuenta atrás): corre con la partida a la vista, sin pausa y sin terminar.
// Cuanto menos tiempo queda, más rojo se tiñe el tablero; en los últimos 10 s late y hace tic.
let lastTick = 0, lastSec = -1;
export function paintRushTimer() {
  const el = $('rushTimer'), r = app.run;
  const on = app.variant === 'rush' && !!r && app.screen === 'game';
  el.hidden = !on;
  const game = $('game');
  if (!on) { game.style.setProperty('--urgency', 0); game.classList.remove('urgent'); return; }
  const left = rushLeft(r), limit = r.limit || 90;
  el.querySelector('b').textContent = mmss(Math.ceil(left));
  el.style.setProperty('--left', (left / limit).toFixed(3));
  const urgency = Math.max(0, Math.min(1, 1 - left / (limit * .5))); // empieza a teñirse con la mitad del tiempo
  game.style.setProperty('--urgency', urgency.toFixed(3));
  const danger = left <= 10 && left > 0;
  el.classList.toggle('danger', danger);
  game.classList.toggle('urgent', danger);
}
setInterval(() => {
  const now = Date.now(), dt = lastTick ? (now - lastTick) / 1000 : 0;
  lastTick = now;
  const r = app.run;
  if (app.variant !== 'rush' || !r || r.timeUp || app.screen !== 'game' || app.paused || !app.game || app.game.S.winner !== null) { paintRushTimer(); return; }
  r.elapsed = (r.elapsed || 0) + dt;
  const left = rushLeft(r), sec = Math.ceil(left);
  if (left <= 10 && sec !== lastSec && sec > 0) sfx('tick');
  lastSec = sec;
  paintRushTimer();
  if (left <= 0) rushTimeUp();
}, 250);

/* =============== pantalla de Modos =============== */
export function openModes() {
  hideWin();
  aiStop();
  const R = loadRecords();
  const qsave = loadSave('pve'), rsave = loadSave('rush'), csave = loadSave('challenge');
  const rush = store.get(RUSH_KEY), last = lastPve();
  const btn = (act, label, main = true) => `<button class="${main ? 'btn-primary' : 'btn-light'} btn-sm" data-mode="${act}">${esc(label)}</button>`;
  const cont = (act, label = t('menu.continue')) => `<button class="btn-continue btn-sm" data-mode="${act}">${esc(label)}</button>`; // continuar: siempre en naranja
  const stat = (icon, txt) => `<span class="mdStat"><svg class="i" aria-hidden="true"><use href="#${icon}"/></svg>${esc(txt)}</span>`;
  const quickCard = `<article class="modeCard quick">
      <div class="mdHead"><span class="mdIco"><svg class="i" aria-hidden="true"><use href="#i-bolt"/></svg></span><div><h3>${esc(t('pve.title'))}</h3><small>${esc(t('modes.quick.kinds'))}</small></div></div>
      <p>${esc(t('modes.quick.sub'))}</p>
      ${last ? `<div class="mdStats">${stat('i-reset', t('modes.quick.last', { cfg: cfgSub(last) }))}</div>` : ''}
      <div class="mdBtns">${qsave ? cont('resume:pve') : ''}${btn('quick', t('modes.quick.setup'), !qsave)}${last ? btn('repeat', t('menu.repeat'), false) : ''}</div></article>`;
  const rushCard = `<article class="modeCard rush">
      <div class="mdHead"><span class="mdIco"><svg class="i" aria-hidden="true"><use href="#i-timer"/></svg></span><div><h3>${esc(t('modes.rush.title'))}</h3><small>${esc(t('modes.rush.holes', { n: RUSH_HOLES }))}</small></div></div>
      <p>${esc(t('modes.rush.sub'))}</p>
      <div class="mdStats">${stat('i-trophy', t('modes.rush.best', { n: R.rush.best || 0 }))}${rush ? stat('i-flag', t('modes.holeN', { n: rush.hole + 1, total: rush.total })) : ''}</div>
      <div class="mdBtns">${rsave ? cont('resume:rush') : rush ? cont('rush', t('modes.rush.continue', { n: rush.hole + 1 })) + btn('rushNew', t('modes.restartRun'), false) : btn('rushNew', t('modes.play'))}</div></article>`;
  const chCards = CHALLENGES.map(ch => {
    const done = R.challenges[ch.id];
    return `<article class="chCard${done ? ' done' : ''}"><span class="mdIco"><svg class="i" aria-hidden="true"><use href="#${ch.icon}"/></svg></span>` +
      `<div class="chTxt"><b>${esc(t('challenges.' + ch.id + '.name'))}</b><small>${esc(t('challenges.' + ch.id + '.desc'))}</small></div>` +
      (done ? `<span class="chDone"><svg class="i" aria-hidden="true"><use href="#i-check"/></svg></span>` : '') +
      (csave?.run?.id === ch.id ? cont('resume:challenge') : btn('ch:' + ch.id, t('modes.play'), !done)) + `</article>`;
  }).join('');
  const nDone = CHALLENGES.filter(c => R.challenges[c.id]).length;
  $('modesGrid').innerHTML =
    `<div class="mdRow">${quickCard}${rushCard}</div>` +
    `<section class="mdSection"><h3>${esc(t('modes.challengesH'))} <span class="lvlCount">${nDone}/${CHALLENGES.length}</span></h3><div class="chGrid">${chCards}</div></section>`;
  showScreen('modes');
}

// "Nueva partida": si hay una partida rápida guardada, se avisa y, al aceptar, se borra
async function newQuick() {
  if (loadSave('pve')) {
    if (!await confirmDialog(t('modes.quick.replace'), t('save.replaceOk'), true, t('save.title'))) return;
    clearSave('pve');
  }
  openPveSetup();
}

export function bindModes() {
  $('modesBtn').addEventListener('click', openModes);
  $('modesBack').addEventListener('click', () => showScreen('menu'));
  $('dailyCard').addEventListener('click', () => { if ($('dailyCard').dataset.resume) resumeGame('daily'); else startDaily(); });
  $('modesGrid').addEventListener('click', e => {
    const b = e.target.closest('[data-mode]');
    if (!b) return;
    const [act, arg] = b.dataset.mode.split(':');
    switch (act) {
      case 'resume': resumeGame(arg); break;
      case 'quick': newQuick(); break;
      case 'repeat': repeatLastPve(); break;
      case 'rush': startRush(false); break;
      case 'rushNew': startRush(true); break;
      case 'ch': startChallenge(arg); break;
    }
  });
  MODE_NAV.daily = { back: () => showScreen('menu'), restart: () => { clearSave('daily'); startDailyGame(); } };
  MODE_NAV.rush = { back: openModes, restart: () => { store.set(RUSH_KEY, null); recordStart('rush'); startRushHole(newRush()); } };
  MODE_NAV.challenge = { back: openModes, restart: () => startChallenge(app.run?.id) };
}
export { store as modeStore, RUSH_KEY };
