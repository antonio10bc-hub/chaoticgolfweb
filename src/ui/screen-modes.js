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
import { track } from './analytics.js';
import { app } from './app.js';
import { $, esc } from './dom.js';
import { mulberry32, randomSeed } from '../engine/rng.js';
import { startGame } from './controller.js';
import { Game } from '../engine/game.js';
import { modeArt, sectionHead, groupHead } from './mode-art.js';
import { aiStart, aiStop } from './ai-driver.js';
import { hideWin } from './win.js';
import { updateMenuBtn, toast } from './hud.js';
import { t, getLang } from '../i18n/index.js';
import { saveGame, loadSave, clearSave } from './save.js';
import { recordStart, recordDailyPlayed, loadRecords, updateRecords, turnsLabel, dailyStreakInfo } from './records.js';
import { musicScene, sfx } from '../audio/sfx.js';
import { generateLevel, dateKey, weekKey, seedOf } from '../content/levels/generate.js';
import { showScreen, confirmReplaceSave, MODE_NAV } from './screens.js';
import { startLevel, puzzlesSectionHTML, yoursSectionHTML, playLevelCard } from './screen-story.js';
import { openEditor, edLibraryChanged } from './editor.js';
import { deleteWithUndo, addCodeDialog } from './my-levels.js';
import { createVsGame, dressVsGame, openPveSetup, lastPve, cfgSub, repeatLastPve, STYLE_COLOR } from './screen-pve.js';
import { PERSONAS, personaById, faceSVG } from './persona.js';
import { DECKS } from '../content/decks.js';
import { CHALLENGES, WEEKLY, CH_GROUPS, challengeById, challengeCfg, challengeTiles, setupChallenge, dailyChallenge, DAILY_FEATURES } from '../content/challenges.js';
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
  if (ch) setupChallenge(app.game.S, ch, made.game.seed ?? 1, Game.designed); // su campo diseñado (con la variación de esta partida; su agua no cuenta para el máximo; su tren)
  updateMenuBtn();
  musicScene('game', { newGame: true });
  showScreen('game');
  saveGame();
  aiStart(900);
}
// fondo del reto diario: el de la mecánica del día (también para partidas guardadas antes de existir)
export const dailyScene = feature => DAILY_FEATURES.find(f => f.id === feature)?.scene || '';
function startDailyGame(date = dailyDate()) {
  const d = dailySetup(date);
  const { extra } = challengeCfg(d.ch);
  startVsGame({ cfg: { opps: 2, diff: d.diff }, extra, ch: d.ch, rivals: d.rivals, seed: d.seed, variant: 'daily', run: { date, feature: d.ch.feature, scene: dailyScene(d.ch.feature) } });
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
  // línea de estado solo cuando hay algo que decir: partida a medias o la racha (en peligro, perdida o por empezar).
  // Con el reto de hoy jugado no hace falta (la llama encendida lo dice; tu mejor resultado queda en el tic)
  const status = saved ? t('save.title')
    : sk.atRisk ? t('modes.daily.risk')
    : sk.lost ? t('modes.daily.lost', { n: sk.lost })
    : sk.today ? ''
    : t('modes.daily.start');
  const face = pr => `<span class="avatar hasFace" style="--pc:${STYLE_COLOR[pr.style]}">${faceSVG(-1, pr.style, 'idle')}</span>`;
  const vs = t('modes.daily.vs', { a: rv[0].name, b: rv[1].name });
  const play = saved ? t('menu.continue') : today?.best ? t('modes.again') : t('modes.play');
  // la racha, junto al título (lejos de las caras de los rivales): encendida si hoy ya has jugado, apagada (y latiendo) si está en peligro
  const flameCls = (sk.today ? ' lit' : '') + (sk.atRisk ? ' risk' : '') + (sk.today && firstLitToday(date) ? ' ignite' : '');
  const flame = sk.n || sk.lost ? `<span class="dFlame${flameCls}" title="${esc(streakLabel(sk.n))}"><svg class="i" aria-hidden="true"><use href="#i-flame"/></svg><b>${sk.n}</b></span>` : '';
  // el tic de completado va sobre la miniatura: el texto no cambia de forma según el estado.
  // Cada línea es una sola fila; la mecánica pasa a su propia línea si no cabe junto al título
  $('dailyCard').innerHTML =
    `<span class="dPreview dRivals">${rv.map(face).join('')}` +
    (today?.best ? `<span class="dDone" title="${esc(t('modes.daily.done') + ' · ' + t('modes.daily.bestToday', { turns: turnsLabel(today.best) }))}"><svg class="i" aria-hidden="true"><use href="#i-check"/></svg></span>` : '') + `</span>` +
    `<span class="dTxt"><small class="dWhen">${esc(when)}</small><span class="dHead"><span class="dTitle"><b>${esc(t('modes.daily.title'))}</b>${flame}</span>` +
    `<span class="dFeat"><svg class="i" aria-hidden="true"><use href="#${ch.icon}"/></svg><span>${esc(t('dailyFeat.' + ch.feature))}</span></span></span>` + // (la mecánica del día)
    `<span class="dVs">${esc(vs)}</span>` +
    (status ? `<span class="dMeta${sk.atRisk && !saved ? ' risk' : ''}"><span>${esc(status)}</span></span>` : '') + `</span>` +
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
// enlace al reto diario: quien lo abre entra directamente en el reto de ese día (el de hoy, para él)
export const DAILY_HASHES = ['#reto', '#daily'];
export const dailyLink = () => location.origin + location.pathname + DAILY_HASHES[0];
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
    dailyLink(), // (abre el juego directamente en el reto de hoy: main.js)
  ].filter(Boolean).join('\n');
}
// en el móvil, la hoja de compartir del sistema; si no, al portapapeles
export async function shareText(text) {
  track('compartir', { que: 'resultado' });
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
    updateRecords(d => { d.rush.runs++; d.rush.done = (d.rush.done ?? Math.floor((d.won.rush || 0) / 6)) + 1; if (sum > d.rush.best) { newBest = true; d.rush.best = sum; } d.won.rush++; });
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
export { weekKey }; // (semana ISO: content/levels/generate.js)
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
// icono de cada baraja: una carta con su escena (clásica: el green; agua: la gota sobre las olas; minigolf: el molino
// de madera; Ultimate: el prisma que abre la luz en un arcoíris). Al pasar por la tarjeta se animan (features.css)
const CARD_CLIP = id => `<clipPath id="dk-${id}-c"><rect x="11" y="5" width="38" height="50" rx="7"/></clipPath>`;
const cardBase = (id, top, bottom) => `<defs><linearGradient id="dk-${id}-g" x1="0" y1="0" x2=".6" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient>${CARD_CLIP(id)}</defs>` +
  `<rect x="11" y="5" width="38" height="50" rx="7" fill="url(#dk-${id}-g)"/>`;
const frame = '<rect x="14" y="8" width="32" height="44" rx="5" fill="none" stroke="rgba(241,241,220,.55)" stroke-width="1.2"/>';
const FLAGP = (x, y) => `<ellipse cx="${x}" cy="${y}" rx="2.6" ry="1.4" fill="#242424"/><path d="M${x} ${y} V${y - 13}" stroke="#F1F1DC" stroke-width="1.4" stroke-linecap="round"/><path d="M${x + .4} ${y - 13} L${x + 7} ${y - 10.6} L${x + .4} ${y - 8.2} Z" fill="#E8873A"/>`;
const DECK_ART = {
  classic: () => cardBase('classic', '#6BAA60', '#3F7440') +
    `<g clip-path="url(#dk-classic-c)"><g stroke="rgba(255,255,255,.08)" stroke-width="5">${[0, 10, 20, 30, 40, 50].map(i => `<path d="M${i - 10} 60 L${i + 22} 0"/>`).join('')}</g>` +
    `<ellipse cx="30" cy="40" rx="15" ry="8.5" fill="#79A456"/><ellipse cx="30" cy="40" rx="12.5" ry="6.6" fill="#8DB05F"/></g>` +
    FLAGP(33, 40) + `<circle cx="24" cy="42" r="2.3" fill="#fff"/><circle cx="24.6" cy="42.8" r="2.3" fill="rgba(20,40,20,.18)" style="mix-blend-mode:multiply"/>` +
    `<path d="M20 15 L25 29" stroke="#F1F1DC" stroke-width="1.8" stroke-linecap="round"/><path d="M24 29 h4" stroke="#F1F1DC" stroke-width="2.4" stroke-linecap="round"/>` + frame,
  water: () => cardBase('water', '#4FC1D6', '#1F6F80') +
    `<g clip-path="url(#dk-water-c)"><g class="dkWave"><path d="M-10 43 q6 -3 12 0 t12 0 t12 0 t12 0 t12 0 t12 0 V60 H-10Z" fill="#2F8FA3"/>` +
    `<path d="M-16 47 q6 -3 12 0 t12 0 t12 0 t12 0 t12 0 t12 0 V60 H-16Z" fill="#1F6F80" opacity=".9"/></g>` +
    `<ellipse class="dkRipple" cx="30" cy="40" rx="9" ry="2.4" fill="none" stroke="rgba(241,251,255,.7)" stroke-width="1"/>` +
    `<g transform="translate(40 45)"><ellipse rx="5" ry="2.2" fill="#5E9A58"/><path d="M0 0 L5 -1 L4 1Z" fill="#1F6F80"/></g></g>` +
    `<path d="M30 12c5 7.5 9 12 9 17.5a9 9 0 0 1-18 0c0-5.5 4-10 9-17.5z" fill="#F1F1DC"/><path d="M30 14.5c4 6 7 10 7 14.5a7 7 0 0 1-3 5.8" fill="none" stroke="#9FDCEB" stroke-width="1.4" stroke-linecap="round"/>` +
    `<ellipse cx="26.5" cy="27" rx="2" ry="3.4" fill="#fff" transform="rotate(-18 26.5 27)"/>` + frame,
  mill: () => cardBase('mill', '#D8A46A', '#9C6A38') +
    `<g clip-path="url(#dk-mill-c)"><g stroke="rgba(92,58,28,.22)" stroke-width=".9" fill="none">${[9, 15, 21, 27, 33, 39].map(y => `<path d="M8 ${y} q12 3 22 0 t24 0"/>`).join('')}</g>` +
    `<rect x="11" y="42" width="38" height="14" fill="#5FA94F"/><rect x="11" y="42" width="38" height="2" fill="rgba(255,255,255,.18)"/></g>` +
    `<path d="M26 44 L27.5 26 H32.5 L34 44 Z" fill="#F1F1DC" stroke="#7A5230" stroke-width="1"/><path d="M28.6 44 v-5 a1.4 1.4 0 0 1 2.8 0 v5" fill="#7A5230"/>` +
    `<path d="M25.5 26.5 L30 21 L34.5 26.5 Z" fill="#B5473F"/>` +
    `<g class="dkSpin">${[0, 90, 180, 270].map(a => `<g transform="rotate(${a + 20} 30 24)"><rect x="28.6" y="10" width="2.8" height="13" rx="1" fill="#F1F1DC" stroke="#7A5230" stroke-width=".7"/><path d="M28.6 13h2.8M28.6 16.5h2.8M28.6 20h2.8" stroke="#7A5230" stroke-width=".6"/></g>`).join('')}<circle cx="30" cy="24" r="1.6" fill="#7A5230"/></g>` +
    `<circle cx="40" cy="47.5" r="2.2" fill="#fff"/><path d="M15 50 q8 -5 12 0" stroke="#F1F1DC" stroke-width="1.2" fill="none" opacity=".7"/>` + frame,
  // el tren: una locomotora de vapor de perfil sobre su vía, con su humo (al pasar por la tarjeta, el humo sube)
  train: () => cardBase('train', '#D9806A', '#7E2C24') +
    `<g clip-path="url(#dk-train-c)"><circle cx="40" cy="20" r="14" fill="rgba(255,226,170,.16)"/>` +
    `<path d="M8 47 H52" stroke="#4B5057" stroke-width="1.6"/><g stroke="#5A3A20" stroke-width="2.2">${[12, 18, 24, 30, 36, 42, 48].map(x => `<path d="M${x} 46.5v3.4"/>`).join('')}</g>` +
    `<path d="M8 50.5 H52" stroke="#4B5057" stroke-width="1.6"/></g>` +
    `<g class="dkSmoke" fill="#F1F1DC"><circle cx="22" cy="21" r="2.6"/><circle cx="25.5" cy="16" r="3.4" opacity=".85"/><circle cx="31" cy="11.5" r="4" opacity=".7"/></g>` +
    `<path d="M19 30 h5 l-.6 -6 h-3.8z" fill="#242424"/>` +
    `<rect x="16" y="29" width="20" height="11" rx="5.5" fill="#242424"/><path d="M22 29v11M29 29v11" stroke="#D9A441" stroke-width="1.2"/>` +
    `<circle cx="28" cy="27.6" r="2" fill="#D9A441"/>` +
    `<rect x="34" y="23" width="11" height="18" rx="2" fill="#B5483B"/><rect x="36.5" y="26" width="6" height="5.5" rx="1" fill="#FFE38A"/><rect x="33" y="21.6" width="13" height="2.6" rx="1.2" fill="#242424"/>` +
    `<path d="M16 37 L11.5 43 H17 Z" fill="#D9A441"/><circle cx="14.6" cy="32.5" r="1.8" fill="#FFE38A"/>` +
    `<g class="dkWheels"><circle cx="21" cy="43" r="3.4" fill="#242424"/><circle cx="29.5" cy="43" r="3.4" fill="#242424"/><circle cx="40" cy="42.6" r="3.8" fill="#242424"/>` +
    `<circle cx="21" cy="43" r="1.2" fill="#B5483B"/><circle cx="29.5" cy="43" r="1.2" fill="#B5483B"/><circle cx="40" cy="42.6" r="1.4" fill="#B5483B"/></g>` +
    `<path d="M21 43 H40" stroke="#8E8E96" stroke-width="1.1"/>` + frame,
  prism: () => cardBase('prism', '#4A3A86', '#241A4A') +
    `<defs><linearGradient id="dk-prism-r" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF8FC4"/><stop offset=".35" stop-color="#8FB6FF"/><stop offset=".65" stop-color="#7EE8C8"/><stop offset="1" stop-color="#FFE38A"/></linearGradient></defs>` +
    `<g clip-path="url(#dk-prism-c)"><circle cx="30" cy="30" r="20" fill="url(#dk-prism-r)" opacity=".16"/>` +
    `<path d="M8 36 L27 29" stroke="#fff" stroke-width="1.8" stroke-linecap="round" opacity=".9"/>` +
    `<g stroke-width="2.2" stroke-linecap="round">${['#FF6FA8', '#FFB347', '#FFE36B', '#7EE8C8', '#6FA8FF', '#B98CFF'].map((c, i) => `<path d="M33 ${28 + i * 1.1} L52 ${20 + i * 5}" stroke="${c}"/>`).join('')}</g></g>` +
    `<path d="M30 15 L40 36 H20 Z" fill="rgba(255,255,255,.22)" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/><path d="M30 15 L40 36 L30 31 Z" fill="rgba(255,255,255,.35)"/>` +
    `<g class="dkTw" fill="#fff"><path d="M19 13 l1 2.6 2.6 1 -2.6 1 -1 2.6 -1 -2.6 -2.6 -1 2.6 -1z"/><path d="M41 44 l.7 1.8 1.8.7 -1.8.7 -.7 1.8 -.7 -1.8 -1.8 -.7 1.8 -.7z" opacity=".8"/></g>` + frame,
};
const deckArt = dk => `<svg class="dkArt" viewBox="0 0 60 60" aria-hidden="true">${(DECK_ART[dk.emblem === 'club' ? 'classic' : dk.emblem === 'drop' ? 'water' : dk.emblem] || DECK_ART.classic)()}</svg>`;

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
      `<span><b>${p ? Math.round(100 * Math.min(w, p) / p) : 0}%</b></span></span>`; };

  /* ---- partidas rápidas: una tarjeta por baraja ---- */
  const deckCard = dk => {
    const st = R.decks[dk.id] || { p: 0, w: 0 }, last = !dk.locked && lastPve(dk.id);
    const saved = !dk.locked && qsave && (qsave.pveCfg?.deck || 'classic') === dk.id;
    const pct = (st.p ? Math.round(100 * st.w / st.p) : 0) + '%';
    const btns = dk.locked
      ? `<span class="dkSoon"><svg class="i" aria-hidden="true"><use href="#i-lock"/></svg>${esc(t('decks.soon'))}</span>`
      : (saved ? cont('resume:pve') : '') + btn('quick:' + dk.id, t('modes.quick.setup'), !saved) + (last ? btn('repeat:' + dk.id, t('menu.repeat'), false) : '') +
        (hasDeckIntro(dk.id) ? `<button class="btn-text btn-sm dkCards" data-mode="deckCards:${dk.id}"><svg class="i" aria-hidden="true"><use href="#i-help"/></svg>${esc(t('deckIntro.button'))}</button>` : '');
    return `<article class="deckCard${dk.locked ? ' locked' : ''}${dk.ultimate ? ' ultimate' : ''}" style="--dk:${dk.color}" aria-disabled="${!!dk.locked}">` +
      `<div class="dkPic">${deckArt(dk)}${dk.locked ? `<span class="dkLock"><svg class="i" aria-hidden="true"><use href="#i-lock"/></svg></span>` : ''}</div>` +
      // (Ultimate: las barajas que reúne, a la derecha de su nombre)
      `<div class="dkMain">${dk.ultimate ? `<div class="ultHead"><h3>${esc(t('decks.' + dk.id + '.name'))}</h3>` +
        `<div class="ultIncl"><span>${esc(t('decks.includes'))}</span>${DECKS.filter(d => !d.ultimate && !d.locked).map(d => `<i title="${esc(t('decks.' + d.id + '.name'))}">${deckArt(d)}</i>`).join('')}</div></div>`
        : `<h3>${esc(t('decks.' + dk.id + '.name'))}</h3>`}` +
      `<p>${esc(t('decks.' + dk.id + '.desc'))}</p>` +
      // Ultimate: las barajas que reúne (también las que se añadan)

      `</div>` +
      `<dl class="dkStats"><div><dt>${esc(t('decks.played'))}</dt><dd>${st.p}</dd></div><div><dt>${esc(t('decks.won'))}</dt><dd>${st.w}</dd></div>` +
      `<div><dt>${esc(t('decks.pct'))}</dt><dd>${pct}</dd></div></dl>` +
      // (la última partida, en la fila de los botones: la tarjeta no crece)
      `<div class="dkBtns">${btns}${last ? `<span class="mdStats dkLast">${stat('i-reset', t('modes.quick.last', { cfg: cfgSub(last) }))}</span>` : ''}</div>` +
      (dk.ultimate ? '<span class="ultSpark a" aria-hidden="true"></span><span class="ultSpark b" aria-hidden="true"></span><span class="ultSpark c" aria-hidden="true"></span><span class="ultSheen" aria-hidden="true"></span>' : '') +
      `</article>`;
  };
  const quickPanel = `<div class="deckList">${DECKS.map(deckCard).join('')}</div>`;

  /* ---- juegos especiales ---- */
  // una sola línea con lo importante (récord, hoyo a medias) y el botón a la derecha
  // contrarreloj: una tarjeta como las de las barajas (su cronómetro ilustrado, qué es, sus cifras y el botón)
  const rushBtns = rsave ? cont('resume:rush') : rush ? cont('rush', t('modes.rush.continue', { n: rush.hole + 1 })) + btn('rushNew', t('modes.restartRun'), false) : btn('rushNew', t('modes.play'));
  const rushCard = `<article class="deckCard rushCard" style="--dk:var(--mode-rush)">` +
    `<div class="dkPic">${modeArt('rush', 'dkArt')}</div>` +
    `<div class="dkMain"><h3>${esc(t('modes.rush.title'))}</h3><p>${esc(t('modes.rush.sub'))}</p>` +
    (rush ? `<div class="mdStats">${stat('i-timer', t('modes.holeN', { n: rush.hole + 1, total: rush.total }))}</div>` : '') + `</div>` +
    `<dl class="dkStats"><div><dt>${esc(t('modes.rush.statBest'))}</dt><dd>${R.rush.best || 0}</dd></div>` +
    `<div><dt>${esc(t('modes.rush.statDone'))}</dt><dd>${R.rush.done ?? Math.floor((R.won.rush || 0) / 6)}</dd></div>` +
    `<div><dt>${esc(t('decks.played'))}</dt><dd>${R.rush.runs || 0}</dd></div></dl>` +
    `<div class="dkBtns">${rushBtns}</div></article>`;
  // desafío: toda la tarjeta es el botón; a la derecha, jugar / continuar / superado y, si ya se ha jugado, victorias/partidas
  const chEnd = (saved, done, s) => `<span class="chEnd">${saved ? `<span class="chCont">${esc(t('menu.continue'))}</span>`
    : `<span class="chGo${done ? ' ok' : ''}"><svg class="i" aria-hidden="true"><use href="#${done ? 'i-check' : 'i-play'}"/></svg></span>`}` +
    (s?.p ? `<small class="chSt" title="${esc(t('modes.chStat', { w: s.w || 0, p: s.p }))}">${s.w || 0}/${s.p}</small>` : '') + `</span>`;
  const chCard = ch => {
    const done = R.challenges[ch.id], saved = csave?.run?.id === ch.id, name = t('challenges.' + ch.id + '.name'), desc = t('challenges.' + ch.id + '.desc');
    return `<button class="chCard g-${ch.group}${done ? ' done' : ''}${saved ? ' saved' : ''}" data-mode="${saved ? 'resume:challenge' : 'ch:' + ch.id}" aria-label="${esc(name + '. ' + desc)}">` +
      `<span class="mdIco"><svg class="i" aria-hidden="true"><use href="#${ch.icon}"/></svg></span>` +
      `<span class="chTxt"><b>${esc(name)}</b><small>${esc(desc)}</small></span>${chEnd(saved, done, R.chStats[ch.id])}</button>`;
  };
  const chGroups = CH_GROUPS.map(g => ({ g, list: CHALLENGES.filter(c => c.group === g) })).filter(x => x.list.length);
  const chCards = chGroups.map(({ g, list }) => groupHead(g, list.filter(c => R.challenges[c.id]).length, list.length) +
    `<div class="chGrid">${list.map(chCard).join('')}</div>`).join('');
  const nDone = CHALLENGES.filter(c => R.challenges[c.id]).length;
  const wk = weekKey(), { rule } = weeklySetup(wk), wbest = R.weekly.weeks[wk]?.best, left = weekDaysLeft();
  const wname = t('weekly.' + rule.id + '.name'), wdesc = t('weekly.' + rule.id + '.desc');
  const weeklyCard = `<button class="chCard weekly${wbest ? ' done' : ''}${wsave ? ' saved' : ''}" data-mode="${wsave ? 'resume:weekly' : 'weekly'}" aria-label="${esc(t('modes.weekly.title') + ': ' + wname + '. ' + wdesc)}">` +
    `<span class="wkArt">${modeArt('weekly')}</span>` +
    `<span class="chTxt"><small class="wkTag">${esc(t('modes.weekly.title'))} · ${esc(t(left === 1 ? 'modes.weekly.lastDay' : 'modes.weekly.daysLeft', { n: left }))}${wbest ? ' · ' + esc(t('modes.weekly.best', { turns: turnsLabel(wbest) })) : ''}</small>` +
    `<b>${esc(wname)}</b><small>${esc(wdesc)}</small></span>${chEnd(wsave, !!wbest, R.weekly.weeks[wk])}</button>`;
  const specialPanel = rushCard +
    `<section class="mdSection challenges">${sectionHead({ art: 'challenge', title: t('modes.challengesH'), done: nDone, total: CHALLENGES.length })}${weeklyCard}${chCards}</section>` +
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
  document.body.dataset.modesTab = tab;
  grid.dataset.tab = tab;
  grid.querySelectorAll('[data-mtab]').forEach(b => { const on = b.dataset.mtab === tab; b.setAttribute('aria-selected', on); b.tabIndex = on ? 0 : -1; });
  if (focus) grid.querySelector(`[data-mtab="${tab}"]`)?.focus();
  const panels = [...track.children], to = panels.find(p => p.dataset.panel === tab);
  const from = panels.find(p => !p.classList.contains('off') && p !== to);
  const seq = ++tabSeq;
  panels.forEach(p => { (p._anims || []).forEach(a => a.cancel()); p._anims = []; }); // (las nuestras: getAnimations() obligaría a recalcular estilos)
  const show = () => panels.forEach(p => p.classList.toggle('off', p !== to));
  if (instant || REDUCED || !from || !to.animate) { show(); return; }
  sfx('select');
  const out = from.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translateX(${-20 * dir}px)` }],
    { duration: 110, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' });
  from._anims.push(out);
  out.onfinish = () => {
    if (seq !== tabSeq) return;
    show();
    out.cancel();
    if (window.scrollY > 0) window.scrollTo({ top: 0, behavior: 'instant' });
    to._anims.push(to.animate([{ opacity: 0, transform: `translateX(${24 * dir}px)` }, { opacity: 1, transform: 'none' }],
      { duration: 240, easing: 'cubic-bezier(.2,.8,.2,1)' }));
    // las primeras tarjetas llegan escalonadas (sutil y corto: lo de abajo ya está en su sitio)
    const items = to.querySelectorAll(':scope > *, :scope .deckCard, :scope .chCard');
    [...items].slice(0, 6).forEach((el, k) => to._anims.push(el.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }],
      { duration: 220, delay: 20 + k * 20, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' })));
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
export async function newQuick(deck = 'classic') {
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
