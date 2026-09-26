// Modos de juego y reto diario:
//   · Reto diario  — (en el menú principal) tablero pequeño contra 2 bots, igual para todos cada día
//                    (semilla de la fecha): cada día cambian los rivales y su dificultad.
//                    Récord del día (victoria en menos turnos propios) y racha de días jugados.
//   · Pantalla de Modos: Partida rápida (contra bots o multijugador local), Contrarreloj y Desafíos.
//   · Contrarreloj — 5 hoyos generados de dificultad creciente, cada uno con su cuenta atrás:
//                    puntos por turnos y por el tiempo que sobra; si se acaba el tiempo, se acaba la serie.
//   · Desafíos     — partidas contra la máquina con reglas especiales.
//   · Desafío semanal — cada semana, una regla especial nueva (igual para todos) y su récord.
// También: el texto para compartir el resultado del reto diario y el aviso en el icono de la app.
// La serie del contrarreloj se guarda aparte de la partida, para poder dejarla entre hoyos.
import { app } from './app.js';
import { $, esc } from './dom.js';
import { mulberry32, randomSeed } from '../engine/rng.js';
import { startGame } from './controller.js';
import { aiStart, aiStop } from './ai-driver.js';
import { hideWin } from './win.js';
import { updateMenuBtn, toast } from './hud.js';
import { t, getLang } from '../i18n/index.js';
import { saveGame, loadSave, clearSave } from './save.js';
import { recordStart, recordDailyPlayed, loadRecords, updateRecords, turnsLabel, dailyStreakInfo, nextStreakGoal } from './records.js';
import { musicScene, sfx } from '../audio/sfx.js';
import { generateLevel, dateKey, seedOf } from '../content/levels/generate.js';
import { showScreen, confirmReplaceSave, MODE_NAV } from './screens.js';
import { startLevel, puzzlesSectionHTML, yoursSectionHTML, playLevelCard } from './screen-story.js';
import { openEditor, edLibraryChanged } from './editor.js';
import { deleteWithUndo, addCodeDialog } from './my-levels.js';
import { createVsGame, dressVsGame, openPveSetup, lastPve, cfgSub, repeatLastPve, STYLE_COLOR } from './screen-pve.js';
import { PERSONAS, personaById, faceSVG } from './persona.js';
import { DECKS } from '../content/decks.js';
import { CHALLENGES, WEEKLY, CH_GROUPS, challengeById, challengeCfg, challengeTiles, dailyChallenge } from '../content/challenges.js';
import { deckIntro, hasDeckIntro } from './deck-intro.js';
import { REDUCED } from '../fx/juice.js';
import { confirmDialog } from './dialog.js';
import { modeIntro } from './mode-intro.js';
import { syncMenuBall } from './menu-ball.js';
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
  const seed = seedOf('daily:' + date);
  return { diff, rivals: [first.id, second.id], seed, ch: dailyChallenge(date, seed) }; // (ch: la mecánica del día y su campo)
}
// arranca una partida contra la máquina de un modo (reto diario, desafíos, semanal)
function startVsGame({ cfg, extra = {}, ch = null, variant, run, seed, rivals = [] }) {
  const made = createVsGame({ humans: 1, ...cfg }, { extra, rivals, seed });
  startGame(made.game, 'pve', { variant, run });
  dressVsGame(made);
  if (ch) app.game.S.tiles.push(...challengeTiles(ch, app.game.S, made.game.seed ?? 1)); // su campo diseñado (con la variación de esta partida)
  updateMenuBtn();
  musicScene('game', { newGame: true });
  showScreen('game');
  saveGame();
  aiStart(900);
}
function startDailyGame(date = dailyDate()) {
  const d = dailySetup(date);
  const { extra } = challengeCfg(d.ch);
  startVsGame({ cfg: { opps: 2, diff: d.diff }, extra, ch: d.ch, rivals: d.rivals, seed: d.seed, variant: 'daily', run: { date, feature: d.ch.feature } });
}
export async function startDaily() {
  if (!await modeIntro('daily')) return;
  if (!await confirmReplaceSave('daily')) return;
  const date = dailyDate();
  recordDailyPlayed(date); // jugar hoy ya cuenta para la racha
  recordStart('daily');
  startDailyGame(date);
}
export const streakLabel = n => n === 1 ? t('modes.daily.streak1') : t('modes.daily.streak', { n });
// la llama se enciende (con animación) la primera vez que vuelves al menú tras jugar el reto de hoy
const FLAME_KEY = 'chaoticgolf_flameLit';
function firstLitToday(date) {
  try { if (localStorage.getItem(FLAME_KEY) === date) return false; localStorage.setItem(FLAME_KEY, date); } catch (e) { return false; }
  return true;
}
// tarjeta del reto diario del menú principal: rivales (con el tic y la racha), fecha, mecánica, estado y botón
export function renderDailyCard() {
  const R = loadRecords(), date = dailyDate(), today = R.daily.days[date];
  const sk = dailyStreakInfo(date, R);
  const saved = loadSave('daily');
  const narrow = window.matchMedia('(max-width: 420px)').matches; // en el móvil, fecha corta
  const { diff, rivals, ch } = dailySetup(date), rv = rivals.map(personaById);
  const diffTxt = t('pve.diff' + diff[0].toUpperCase() + diff.slice(1));
  const when = new Date().toLocaleDateString(locale(), narrow ? { weekday: 'short', day: 'numeric', month: 'short' } : { weekday: 'long', day: 'numeric', month: 'long' }) + ' · ' + diffTxt;
  // una sola línea de estado: la racha manda (en peligro o perdida); con el reto de hoy jugado, la próxima meta
  // (tu mejor resultado de hoy queda en el tic y en el resumen de la partida)
  const goal = nextStreakGoal(sk.n), toGoal = goal - sk.n;
  const status = saved ? t('save.title')
    : sk.atRisk ? t('modes.daily.risk')
    : sk.lost ? t('modes.daily.lost', { n: sk.lost })
    : sk.today ? (toGoal === 1 ? t('modes.daily.toGoal1', { m: goal }) : t('modes.daily.toGoal', { n: toGoal, m: goal }))
    : t('modes.daily.start');
  const face = pr => `<span class="avatar hasFace" style="--pc:${STYLE_COLOR[pr.style]}">${faceSVG(-1, pr.style, 'idle')}</span>`;
  const vs = t('modes.daily.vs', { a: rv[0].name, b: rv[1].name });
  const play = saved ? t('menu.continue') : today?.best ? t('modes.again') : t('modes.play');
  // la racha, en grande sobre la miniatura: encendida si hoy ya has jugado, apagada (y latiendo) si está en peligro
  const flameCls = (sk.today ? ' lit' : '') + (sk.atRisk ? ' risk' : '') + (sk.today && firstLitToday(date) ? ' ignite' : '');
  const flame = sk.n || sk.lost ? `<span class="dFlame${flameCls}" title="${esc(streakLabel(sk.n))}"><svg class="i" aria-hidden="true"><use href="#i-flame"/></svg><b>${sk.n}</b></span>` : '';
  // el tic de completado va sobre la miniatura: el texto no cambia de forma según el estado.
  // Cada línea es una sola fila; la mecánica pasa a su propia línea si no cabe junto al título
  $('dailyCard').innerHTML =
    `<span class="dPreview dRivals">${rv.map(face).join('')}` +
    (today?.best ? `<span class="dDone" title="${esc(t('modes.daily.done') + ' · ' + t('modes.daily.bestToday', { turns: turnsLabel(today.best) }))}"><svg class="i" aria-hidden="true"><use href="#i-check"/></svg></span>` : '') + flame + `</span>` +
    `<span class="dTxt"><small class="dWhen">${esc(when)}</small><span class="dHead"><b>${esc(t('modes.daily.title'))}</b>` +
    `<span class="dFeat"><svg class="i" aria-hidden="true"><use href="#${ch.icon}"/></svg><span>${esc(t('dailyFeat.' + ch.feature))}</span></span></span>` + // (la mecánica del día)
    `<span class="dVs">${esc(vs)}</span>` +
    `<span class="dMeta${sk.atRisk && !saved ? ' risk' : ''}"><span>${esc(status)}</span></span></span>` +
    `<span class="dPlay" title="${esc(play)}"><span class="dPlayLbl">${esc(play)}</span><svg class="i" aria-hidden="true"><use href="#${today?.best && !saved ? 'i-reset' : 'i-arrow-r'}"/></svg></span>`;
  $('dailyCard').classList.toggle('done', !!today?.best);
  $('dailyCard').dataset.resume = saved ? '1' : '';
  syncBadge();
  syncMenuBall(!!today?.best, date); // reto completado: la bola de la ilustración rueda al hoyo
}
// ¿queda el reto de hoy por completar?
export const dailyPending = () => !loadRecords().daily.days[dailyDate()]?.best;
// aviso en el icono de la app instalada (API de insignias): un punto mientras el reto de hoy esté pendiente
function syncBadge() {
  try {
    if (!('setAppBadge' in navigator)) return;
    (dailyPending() ? navigator.setAppBadge() : navigator.clearAppBadge()).catch(() => {});
  } catch (e) { /* sin soporte */ }
}

// resultado del reto diario para compartir, estilo Wordle: un cuadrado por turno tuyo
// (🟩 te acercas al hoyo, 🟨 igual, 🟥 te alejas) y ⛳ al embocar
export function dailyShareText({ won, turns, st, S, date }) {
  const d = st?.dists || [], sq = [];
  for (let i = 1; i < d.length && sq.length < 24; i++) sq.push(d[i] < d[i - 1] ? '🟩' : d[i] === d[i - 1] ? '🟨' : '🟥');
  if (won) sq.push('⛳');
  const r = st?.route || [], count = k => r.filter(p => k.includes(p[2])).length;
  const rivals = [...Array(S.nPlayers).keys()].filter(p => S.personas?.[p]).map(p => S.playerNames[p]);
  const { diff } = dailySetup(date);
  const R = loadRecords();
  const [y, m, dd] = date.split('-').map(Number);
  const day = new Date(y, m - 1, dd).toLocaleDateString(locale(), { day: 'numeric', month: 'short' });
  return [
    `Chaotic Golf · ${t('modes.daily.title')} · ${day}`,
    won ? `⛳ ${t('share.won', { turns: turnsLabel(turns) })}` : `❌ ${t('share.lost')}`,
    sq.join(''),
    `💥 ${count('hH')} · 🌀 ${count('t')} · 🕳️ ${count('f')}`,
    `🆚 ${rivals.join(t('share.and'))} · ${t('pve.diff' + diff[0].toUpperCase() + diff.slice(1))}`,
    `🔥 ${streakLabel(R.daily.streak || 1)}`,
    location.origin + location.pathname,
  ].filter(Boolean).join('\n');
}
// en el móvil, la hoja de compartir del sistema; si no, al portapapeles
export async function shareText(text) {
  const touch = window.matchMedia('(pointer: coarse)').matches;
  try {
    if (touch && navigator.share) { await navigator.share({ text }); return; }
  } catch (e) { if (e?.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(text); toast(t('share.copied')); }
  catch (e) { toast(t('share.failed'), 'warn'); }
}

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
  if (!await modeIntro('rush')) return;
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
// los desafíos y las reglas semanales (campos diseñados, mazos y reglas) viven en content/challenges.js
export async function startChallenge(id) {
  const ch = challengeById(id);
  if (!ch || !await modeIntro('challenge') || !await confirmReplaceSave('challenge')) return;
  recordStart('challenge', { challenge: id });
  const { cfg, extra } = challengeCfg(ch);
  startVsGame({ cfg, extra, ch, variant: 'challenge', run: { id, scene: ch.scene } });
}

/* =============== desafío semanal =============== */
// cada semana (lunes a domingo) toca una de estas reglas; tablero, mazo y rivales iguales para todos
// semana ISO "AAAA-Www"
export function weekKey(d = new Date()) {
  const u = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const wd = u.getUTCDay() || 7;
  u.setUTCDate(u.getUTCDate() + 4 - wd);
  const y = u.getUTCFullYear(), w = Math.ceil(((u - Date.UTC(y, 0, 1)) / 864e5 + 1) / 7);
  return `${y}-W${String(w).padStart(2, '0')}`;
}
const weekDaysLeft = () => 8 - (new Date().getDay() || 7); // incluido hoy
export function weeklySetup(week = weekKey()) {
  const r = mulberry32(seedOf('weeklyBots:' + week));
  const rule = WEEKLY[seedOf('weekly:' + week) % WEEKLY.length];
  // rivales: sin repetir y, mientras se pueda, de personalidades distintas
  const pool = [...PERSONAS], rivals = [], styles = new Set();
  while (rivals.length < rule.opps && pool.length) {
    const fresh = pool.filter(p => !styles.has(p.style));
    const from = fresh.length ? fresh : pool, pick = from[Math.floor(r() * from.length)];
    rivals.push(pick.id); styles.add(pick.style); pool.splice(pool.indexOf(pick), 1);
  }
  return { rule, rivals, seed: seedOf('weeklyGame:' + week) };
}
function startWeeklyGame(week = weekKey()) {
  const { rule, rivals, seed } = weeklySetup(week);
  const { cfg, extra } = challengeCfg(rule);
  startVsGame({ cfg, extra, ch: rule, variant: 'weekly', run: { id: rule.id, week, scene: rule.scene }, seed, rivals });
}
export async function startWeekly() {
  if (!await modeIntro('weekly') || !await confirmReplaceSave('weekly')) return;
  recordStart('weekly', { week: weekKey() });
  startWeeklyGame();
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
    case 'daily': return `${t('modes.daily.title')} · ${r?.feature ? t('dailyFeat.' + r.feature) : new Date().toLocaleDateString(locale(), { day: 'numeric', month: 'short' })}`;
    case 'rush': return `${t('modes.holeN', { n: r.hole + 1, total: r.total })} · ${t('modes.rush.pts', { n: (r.scores || []).reduce((a, b) => a + b, 0) })}`;
    case 'challenge': return t('challenges.' + r.id + '.name');
    case 'weekly': return `${t('modes.weekly.title')} · ${t('weekly.' + r.id + '.name')}`;
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
// Dos pestañas que se deslizan en horizontal (también con el dedo): Partidas rápidas (una tarjeta
// por baraja) y Juegos especiales (contrarreloj, desafíos, semanal, puzles y tus niveles).
// Solo se ve una a la vez; se recuerda la última.
const TAB_KEY = 'chaoticgolf_modesTab', TABS = ['quick', 'special'];
let modesTab = (() => { try { return TABS.includes(localStorage.getItem(TAB_KEY)) ? localStorage.getItem(TAB_KEY) : 'quick'; } catch (e) { return 'quick'; } })();
// pestaña de la partida en curso (para volver a su sitio)
const tabOfGame = () => app.mode === 'pve' && !app.variant ? 'quick' : 'special';

// emblema del mazo: tres cartas apiladas con el dorso del color de la baraja
const EMBLEM = {
  club: '<path d="M34 16 26 42" stroke="#F1F1DC" stroke-width="3.4" stroke-linecap="round"/><path d="M22 41h9" stroke="#F1F1DC" stroke-width="4" stroke-linecap="round"/><circle cx="37" cy="41" r="3.4" fill="#F1F1DC"/>',
  drop: '<path d="M30 14c6 9 11 15 11 21a11 11 0 0 1-22 0c0-6 5-12 11-21z" fill="#F1F1DC"/><path d="M25 35a5 5 0 0 0 5 5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" fill="none" opacity=".45"/>',
  mill: '<path d="M30 30 30 46M24 46h12" stroke="#F1F1DC" stroke-width="3" stroke-linecap="round"/><g fill="#F1F1DC"><path d="M30 30 22 18l5-2z"/><path d="M30 30 42 22l2 5z"/><path d="M30 30 38 42l-5 2z"/><path d="M30 30 18 38l-2-5z"/></g><circle cx="30" cy="30" r="3" fill="currentColor"/>',
  prism: '<path d="M30 13 44 40H16Z" fill="rgba(255,255,255,.9)"/><path d="M30 13 44 40 30 33Z" fill="rgba(255,255,255,.55)"/><path d="M8 30h12M40 30l12-5M40 32l12 2M40 35l12 8" stroke="#fff" stroke-width="2" stroke-linecap="round"/>',
};
const IRI_DEF = '<defs><linearGradient id="iriDeck" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF8FC4"/><stop offset=".35" stop-color="#8FB6FF"/><stop offset=".65" stop-color="#7EE8C8"/><stop offset="1" stop-color="#C39BFF"/></linearGradient></defs>';
const deckArt = dk0 => { const dk = dk0.ultimate ? { ...dk0, color: 'url(#iriDeck)' } : dk0; return `<svg class="dkArt" viewBox="0 0 60 60" aria-hidden="true" style="color:${dk0.color}">${dk0.ultimate ? IRI_DEF : ''}` +
  // una sola carta (sin cartas desplazadas por detrás)
  `<rect x="13" y="7" width="34" height="46" rx="6" fill="${dk.color}"/><rect x="16.5" y="10.5" width="27" height="39" rx="4" fill="none" stroke="rgba(241,241,220,.45)" stroke-width="1.4"/>` +
  `<g transform="translate(0 0)">${EMBLEM[dk.emblem]}</g></svg>`; };

export function openModes(tab) {
  hideWin();
  aiStop();
  if (TABS.includes(tab)) modesTab = tab;
  const R = loadRecords();
  const qsave = loadSave('pve'), rsave = loadSave('rush'), csave = loadSave('challenge'), wsave = loadSave('weekly');
  const rush = store.get(RUSH_KEY);
  const btn = (act, label, main = true, dis = false) => `<button class="${main ? 'btn-primary' : 'btn-light'} btn-sm" data-mode="${act}"${dis ? ' disabled' : ''}>${esc(label)}</button>`;
  const cont = (act, label = t('menu.continue')) => `<button class="btn-continue btn-sm" data-mode="${act}">${esc(label)}</button>`; // continuar: siempre en naranja
  const stat = (icon, txt) => `<span class="mdStat"><svg class="i" aria-hidden="true"><use href="#${icon}"/></svg>${esc(txt)}</span>`;
  // mini estadísticas (jugadas · victorias · %), como las de las barajas pero en una línea
  const mini = (s = {}) => { const p = s.p || 0, w = Math.min(s.w || 0, p || s.w || 0);
    return `<span class="miniSt"><span><b>${p}</b> ${esc(t('decks.played').toLowerCase())}</span><span><b>${w}</b> ${esc(t('decks.won').toLowerCase())}</span>` +
      `<span><b>${p ? Math.round(100 * Math.min(w, p) / p) + '%' : '—'}</b></span></span>`; };

  /* ---- partidas rápidas: una tarjeta por baraja ---- */
  const deckCard = dk => {
    const st = R.decks[dk.id] || { p: 0, w: 0 }, last = !dk.locked && lastPve(dk.id);
    const saved = !dk.locked && qsave && (qsave.pveCfg?.deck || 'classic') === dk.id;
    const pct = st.p ? Math.round(100 * st.w / st.p) + '%' : '—';
    const btns = dk.locked
      ? `<span class="dkSoon"><svg class="i" aria-hidden="true"><use href="#i-lock"/></svg>${esc(t('decks.soon'))}</span>`
      : (saved ? cont('resume:pve') : '') + btn('quick:' + dk.id, t('modes.quick.setup'), !saved) + (last ? btn('repeat:' + dk.id, t('menu.repeat'), false) : '') +
        (hasDeckIntro(dk.id) ? `<button class="btn-text btn-sm dkCards" data-mode="deckCards:${dk.id}"><svg class="i" aria-hidden="true"><use href="#i-help"/></svg>${esc(t('deckIntro.button'))}</button>` : '');
    return `<article class="deckCard${dk.locked ? ' locked' : ''}${dk.ultimate ? ' ultimate' : ''}" style="--dk:${dk.color}" aria-disabled="${!!dk.locked}">` +
      `<div class="dkPic">${deckArt(dk)}${dk.locked ? `<span class="dkLock"><svg class="i" aria-hidden="true"><use href="#i-lock"/></svg></span>` : ''}</div>` +
      `<div class="dkMain"><h3>${esc(t('decks.' + dk.id + '.name'))}</h3>` +
      `<p>${esc(t('decks.' + dk.id + '.desc'))}</p>` +
      (last ? `<div class="mdStats">${stat('i-reset', t('modes.quick.last', { cfg: cfgSub(last) }))}</div>` : '') + `</div>` +
      `<dl class="dkStats"><div><dt>${esc(t('decks.played'))}</dt><dd>${st.p}</dd></div><div><dt>${esc(t('decks.won'))}</dt><dd>${st.w}</dd></div>` +
      `<div><dt>${esc(t('decks.pct'))}</dt><dd>${pct}</dd></div></dl>` +
      `<div class="dkBtns">${btns}</div></article>`;
  };
  const quickPanel = `<div class="deckList">${DECKS.map(deckCard).join('')}</div>`;

  /* ---- juegos especiales ---- */
  // una sola línea con lo importante (récord, hoyo a medias) y el botón a la derecha
  const rushCard = `<article class="modeCard rush">
      <div class="mdHead"><span class="mdIco"><svg class="i" aria-hidden="true"><use href="#i-timer"/></svg></span><div><h3>${esc(t('modes.rush.title'))}</h3>` +
    `<small>${esc([t('modes.rush.holes', { n: RUSH_HOLES }), t('modes.rush.best', { n: R.rush.best || 0 }), rush ? t('modes.holeN', { n: rush.hole + 1, total: rush.total }) : ''].filter(Boolean).join(' · '))}</small></div></div>
      <div class="mdBtns">${rsave ? cont('resume:rush') : rush ? cont('rush', t('modes.rush.continue', { n: rush.hole + 1 })) + btn('rushNew', t('modes.restartRun'), false) : btn('rushNew', t('modes.play'))}</div></article>`;
  // desafío: toda la tarjeta es el botón; a la derecha, jugar / continuar / superado y, si ya se ha jugado, victorias/partidas
  const chEnd = (saved, done, s) => `<span class="chEnd">${saved ? `<span class="chCont">${esc(t('menu.continue'))}</span>`
    : `<span class="chGo${done ? ' ok' : ''}"><svg class="i" aria-hidden="true"><use href="#${done ? 'i-check' : 'i-play'}"/></svg></span>`}` +
    (s?.p ? `<small class="chSt" title="${esc(t('modes.chStat', { w: s.w || 0, p: s.p }))}">${s.w || 0}/${s.p}</small>` : '') + `</span>`;
  const chCard = ch => {
    const done = R.challenges[ch.id], saved = csave?.run?.id === ch.id, name = t('challenges.' + ch.id + '.name'), desc = t('challenges.' + ch.id + '.desc');
    return `<button class="chCard${done ? ' done' : ''}${saved ? ' saved' : ''}" data-mode="${saved ? 'resume:challenge' : 'ch:' + ch.id}" aria-label="${esc(name + '. ' + desc)}">` +
      `<span class="mdIco"><svg class="i" aria-hidden="true"><use href="#${ch.icon}"/></svg></span>` +
      `<span class="chTxt"><b>${esc(name)}</b><small>${esc(desc)}</small></span>${chEnd(saved, done, R.chStats[ch.id])}</button>`;
  };
  const chGroups = CH_GROUPS.map(g => ({ g, list: CHALLENGES.filter(c => c.group === g) })).filter(x => x.list.length);
  const chCards = chGroups.map(({ g, list }) => `<h4 class="lvlGroup">${esc(t('modes.groups.' + g))} <span>${list.filter(c => R.challenges[c.id]).length}/${list.length}</span></h4>` +
    `<div class="chGrid">${list.map(chCard).join('')}</div>`).join('');
  const nDone = CHALLENGES.filter(c => R.challenges[c.id]).length;
  const wk = weekKey(), { rule } = weeklySetup(wk), wbest = R.weekly.weeks[wk]?.best, left = weekDaysLeft();
  const wname = t('weekly.' + rule.id + '.name'), wdesc = t('weekly.' + rule.id + '.desc');
  const weeklyCard = `<button class="chCard weekly${wbest ? ' done' : ''}${wsave ? ' saved' : ''}" data-mode="${wsave ? 'resume:weekly' : 'weekly'}" aria-label="${esc(t('modes.weekly.title') + ': ' + wname + '. ' + wdesc)}">` +
    `<span class="mdIco"><svg class="i" aria-hidden="true"><use href="#${rule.icon}"/></svg></span>` +
    `<span class="chTxt"><small class="wkTag">${esc(t('modes.weekly.title'))} · ${esc(t(left === 1 ? 'modes.weekly.lastDay' : 'modes.weekly.daysLeft', { n: left }))}${wbest ? ' · ' + esc(t('modes.weekly.best', { turns: turnsLabel(wbest) })) : ''}</small>` +
    `<b>${esc(wname)}</b><small>${esc(wdesc)}</small></span>${chEnd(wsave, !!wbest, R.weekly.weeks[wk])}</button>`;
  const specialPanel = rushCard +
    `<section class="mdSection challenges"><h3>${esc(t('modes.challengesH'))} <span class="lvlCount">${nDone}/${CHALLENGES.length}</span></h3>${weeklyCard}${chCards}</section>` +
    puzzlesSectionHTML() + yoursSectionHTML();

  const tabBtn = id => `<button role="tab" id="mdTab-${id}" data-mtab="${id}" aria-controls="mdPanel-${id}" aria-selected="${modesTab === id}" tabindex="${modesTab === id ? 0 : -1}">` +
    `<svg class="i" aria-hidden="true"><use href="#${id === 'quick' ? 'i-bolt' : 'i-trophy'}"/></svg>${esc(t('modes.tabs.' + id))}</button>`;
  $('modesGrid').innerHTML =
    `<div class="mdTabs" role="tablist" aria-label="${esc(t('modes.title'))}"><span class="mdTabInd" aria-hidden="true"></span>${TABS.map(tabBtn).join('')}</div>` +
    `<div class="mdViewport"><div class="mdTrack">` +
    `<section class="mdPanel" id="mdPanel-quick" role="tabpanel" aria-labelledby="mdTab-quick" data-panel="quick">${quickPanel}</section>` +
    `<section class="mdPanel" id="mdPanel-special" role="tabpanel" aria-labelledby="mdTab-special" data-panel="special">${specialPanel}</section>` +
    `</div></div>`;
  setModesTab(modesTab, { instant: true });
  showScreen('modes');
}

// cambia de pestaña: el indicador se desliza; el contenido sale con un fundido corto hacia un lado
// y el nuevo entra desde el otro, con sus tarjetas escalonadas. Nunca se ven las dos a la vez
// (así el cambio de altura entre secciones queda oculto y no hay saltos).
let tabSeq = 0;
function setModesTab(tab, { instant = false, focus = false } = {}) {
  const grid = $('modesGrid'), track = grid.querySelector('.mdTrack');
  if (!track || !TABS.includes(tab)) return;
  const prev = modesTab, dir = TABS.indexOf(tab) >= TABS.indexOf(prev) ? 1 : -1;
  modesTab = tab;
  try { localStorage.setItem(TAB_KEY, tab); } catch (e) { /* sin storage */ }
  document.body.dataset.modesTab = tab; // (el creador de niveles solo se ofrece en Juegos especiales)
  grid.dataset.tab = tab;
  grid.querySelectorAll('[data-mtab]').forEach(b => { const on = b.dataset.mtab === tab; b.setAttribute('aria-selected', on); b.tabIndex = on ? 0 : -1; });
  if (focus) grid.querySelector(`[data-mtab="${tab}"]`)?.focus();
  const panels = [...track.children], to = panels.find(p => p.dataset.panel === tab);
  const from = panels.find(p => !p.classList.contains('off') && p !== to);
  const seq = ++tabSeq;
  panels.forEach(p => p.getAnimations().forEach(a => a.cancel()));
  const show = () => panels.forEach(p => p.classList.toggle('off', p !== to));
  if (instant || REDUCED || !from || !to.animate) { show(); return; }
  sfx('select');
  const out = from.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translateX(${-26 * dir}px)` }],
    { duration: 150, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' });
  out.onfinish = () => {
    if (seq !== tabSeq) return;
    show();
    out.cancel();
    if (window.scrollY > 0) window.scrollTo({ top: 0, behavior: 'instant' });
    to.animate([{ opacity: 0, transform: `translateX(${30 * dir}px)` }, { opacity: 1, transform: 'none' }],
      { duration: 340, easing: 'cubic-bezier(.2,.8,.2,1)' });
    // las tarjetas llegan escalonadas (sutil)
    const items = to.querySelectorAll(':scope > *, :scope .deckCard, :scope .chCard, :scope .lvlCard');
    [...items].slice(0, 14).forEach((el, k) => el.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }],
      { duration: 320, delay: 40 + k * 28, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' }));
  };
}

// deslizar con el dedo entre pestañas (solo gestos claramente horizontales)
function bindModesSwipe() {
  let x0 = null, y0 = 0, t0 = 0;
  const grid = $('modesGrid');
  grid.addEventListener('touchstart', e => {
    if (e.touches.length !== 1 || !e.target.closest('.mdViewport')) { x0 = null; return; }
    x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; t0 = Date.now();
  }, { passive: true });
  grid.addEventListener('touchend', e => {
    if (x0 == null) return;
    const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
    x0 = null;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.6 || Date.now() - t0 > 700) return;
    const i = TABS.indexOf(modesTab) + (dx < 0 ? 1 : -1);
    if (TABS[i]) setModesTab(TABS[i]);
  }, { passive: true });
}

// "Nueva partida": si hay una partida rápida guardada, se avisa y, al aceptar, se borra
async function newQuick(deck = 'classic') {
  if (loadSave('pve')) {
    if (!await confirmDialog(t('modes.quick.replace'), t('save.replaceOk'), true, t('save.title'))) return;
    clearSave('pve');
  }
  openPveSetup(deck);
}

export function bindModes() {
  $('modesBtn').addEventListener('click', () => openModes());
  bindModesSwipe();
  $('modesBack').addEventListener('click', () => showScreen('menu'));
  $('dailyCard').addEventListener('click', () => { if ($('dailyCard').dataset.resume) resumeGame('daily'); else startDaily(); });
  $('modesGrid').addEventListener('click', e => {
    const ya = e.target.closest('[data-lvedit], [data-lvdel], [data-lvcode]'); // tus niveles: editar, eliminar, añadir código
    if (ya) { yoursAction(ya); return; }
    const lv = e.target.closest('[data-level], [data-puzzle]'); // puzles y tus niveles
    if (lv) { playLevelCard(lv); return; }
    const tb = e.target.closest('[data-mtab]');
    if (tb) { setModesTab(tb.dataset.mtab); return; }
    const b = e.target.closest('[data-mode]');
    if (!b) return;
    const [act, arg] = b.dataset.mode.split(':');
    switch (act) {
      case 'resume': resumeGame(arg); break;
      case 'quick': newQuick(arg); break;
      case 'repeat': repeatLastPve(arg); break;
      case 'rush': startRush(false); break;
      case 'rushNew': startRush(true); break;
      case 'ch': startChallenge(arg); break;
      case 'weekly': startWeekly(); break;
      case 'deckCards': deckIntro(arg, { force: true, play: false }); break;
      case 'editor': openEditor(); break;
    }
  });
  MODE_NAV.daily = { back: () => showScreen('menu'), restart: () => { clearSave('daily'); startDailyGame(); } };
  // teclado: flechas entre pestañas
  $('modesGrid').addEventListener('keydown', e => {
    if (!e.target.closest('[data-mtab]') || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
    e.preventDefault();
    const i = TABS.indexOf(modesTab) + (e.key === 'ArrowRight' ? 1 : -1);
    if (TABS[i]) setModesTab(TABS[i], { focus: true });
  });
  MODE_NAV.rush = { back: () => openModes('special'), restart: () => { store.set(RUSH_KEY, null); recordStart('rush'); startRushHole(newRush()); } };
  MODE_NAV.challenge = { back: () => openModes('special'), restart: () => startChallenge(app.run?.id) };
  MODE_NAV.weekly = { back: () => openModes('special'), restart: () => { clearSave('weekly'); startWeeklyGame(app.run?.week); } };
}
async function yoursAction(b) {
  const d = b.dataset;
  if (d.lvedit != null) { openEditor({ idx: +d.lvedit }); return; }
  if (d.lvdel != null) { deleteWithUndo(+d.lvdel, info => { edLibraryChanged(info); if (app.screen === 'modes') openModes('special'); }); return; }
  if (d.lvcode != null && await addCodeDialog() != null) openModes('special');
}
export { store as modeStore, RUSH_KEY, tabOfGame };
