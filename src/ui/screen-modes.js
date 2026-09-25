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
import { CARDS } from '../content/cards/index.js';
import { $, esc } from './dom.js';
import { mulberry32, randomSeed } from '../engine/rng.js';
import { startGame } from './controller.js';
import { aiStart, aiStop } from './ai-driver.js';
import { hideWin } from './win.js';
import { updateMenuBtn, toast } from './hud.js';
import { t, getLang } from '../i18n/index.js';
import { saveGame, loadSave, clearSave } from './save.js';
import { recordStart, recordDailyPlayed, loadRecords, updateRecords, turnsLabel } from './records.js';
import { musicScene, sfx } from '../audio/sfx.js';
import { generateLevel, dateKey, seedOf } from '../content/levels/generate.js';
import { showScreen, confirmReplaceSave, MODE_NAV } from './screens.js';
import { startLevel, puzzlesSectionHTML, yoursSectionHTML, playLevelCard } from './screen-story.js';
import { openEditor } from './editor.js';
import { createVsGame, dressVsGame, openPveSetup, lastPve, cfgSub, repeatLastPve, STYLE_COLOR } from './screen-pve.js';
import { PERSONAS, personaById, faceSVG } from './persona.js';
import { DECKS } from '../content/decks.js';
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
  return { diff, rivals: [first.id, second.id], seed: seedOf('daily:' + date) };
}
// arranca una partida contra la máquina de un modo (reto diario, desafíos, semanal)
function startVsGame({ cfg, extra = {}, tiles = null, variant, run, seed, rivals = [] }) {
  const made = createVsGame({ humans: 1, ...cfg }, { extra, rivals, seed });
  startGame(made.game, 'pve', { variant, run });
  dressVsGame(made);
  if (tiles) placeTiles(app.game.S, tiles, made.game.seed ?? 1);
  updateMenuBtn();
  musicScene('game', { newGame: true });
  showScreen('game');
  saveGame();
  aiStart(900);
}
function startDailyGame(date = dailyDate()) {
  const d = dailySetup(date);
  startVsGame({ cfg: { opps: 2, size: 's', diff: d.diff }, rivals: d.rivals, seed: d.seed, variant: 'daily', run: { date } });
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
    `<span class="dTxt"><small class="dWhen">${esc(when)}</small><span class="dHead"><b>${esc(t('modes.daily.title'))}</b>` +
    (today?.best ? `<span class="dDone" title="${esc(t('modes.daily.done'))}"><svg class="i" aria-hidden="true"><use href="#i-check"/></svg></span>` : '') +
    `</span><span class="dVs">${esc(vs)}</span>` +
    `<span class="dMeta"><span>${esc(status)}</span>${streak ? `<span class="dStreak"><svg class="i" aria-hidden="true"><use href="#i-flag"/></svg>${esc(streakLabel(streak))}</span>` : ''}</span></span>` +
    `<span class="dPlay">${esc(saved ? t('menu.continue') : today?.best ? t('modes.again') : t('modes.play'))}<svg class="i" aria-hidden="true"><use href="#i-arrow-r"/></svg></span>`;
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
const ORANGE_DECK = { palo1: 0, palo2: 0, palo3: 0, dedo: 0, hoyoUp: 0, hoyoDown: 0, hoyoLeft: 0, hoyoRight: 0, bunker: 0, portal: 0,
  oPalo1: 10, oHoyoUp: 2, oHoyoDown: 2, oHoyoLeft: 2, oHoyoRight: 2, no: 0 };
export const CHALLENGES = [
  { id: 'onlyOrange', icon: 'i-bolt', cfg: { opps: 1, size: 's', diff: 'normal' }, extra: { counts: ORANGE_DECK, rules: { onlyOrange: true }, par: 1 } },
  { id: 'noPalo3', icon: 'i-club', cfg: { opps: 2, size: 'm', diff: 'normal' }, extra: { counts: 'noPalo3' } },
  { id: 'holeDrift', icon: 'i-hole', cfg: { opps: 2, size: 'm', diff: 'normal' }, extra: { rules: { holeDrift: true } } },
  { id: 'bunkers', icon: 'i-sand', cfg: { opps: 2, size: 'm', diff: 'normal' }, tiles: { bunker: 14 } },
  // atajos: 3 parejas de portales de colores (cada uno conecta con el de su color); sin cartas de portal
  { id: 'portals', icon: 'i-spiral', cfg: { opps: 2, size: 'l', diff: 'normal' }, extra: { counts: 'noPortals' }, tiles: { portalPairs: 3, bunker: 2 } },
  { id: 'crowd', icon: 'i-users', cfg: { opps: 6, size: 'l', diff: 'hard' } }, // 7 en la mesa: tú y 6 bots
];
const challengeById = id => CHALLENGES.find(c => c.id === id);
function challengeExtra(ch) {
  const ex = { ...(ch.extra || {}) };
  const base = { palo1: 6, palo2: 8, palo3: 0, dedo: 2, hoyoUp: 2, hoyoDown: 2, hoyoLeft: 2, hoyoRight: 2, bunker: 1, portal: 1,
    oPalo1: 2, oHoyoUp: 1, oHoyoDown: 1, oHoyoLeft: 1, oHoyoRight: 1, no: 2 };
  const DECKS = {
    noPalo3: base,
    longDrive: { ...base, palo1: 0, palo2: 4, palo3: 10 },       // solo tiros largos
    fingers: { ...base, palo1: 4, palo2: 4, palo3: 2, dedo: 8 },  // el dedo manda
    noPortals: Object.fromEntries(Object.entries(CARDS).map(([k, d]) => [k, k === 'portal' ? 0 : d.copies])), // atajos
  };
  if (typeof ex.counts === 'string') ex.counts = DECKS[ex.counts];
  return ex;
}
// losetas de salida de un desafío, en casillas libres lejos de la salida y de la columna de PAR
function placeTiles(S, want, seed) {
  const r = mulberry32((seed ^ 0x7f4a7c15) >>> 0);
  const ballRow = S.balls[0].y, parX = S.parCells[0]?.x;
  const ok = (x, y) => y > 0 && y < ballRow - 1 && x !== parX && !S.tiles.some(t => t.x === x && t.y === y)
    && !(S.hole.x === x && S.hole.y === y) && !S.balls.some(b => b.x === x && b.y === y);
  const put = tile => {
    for (let tries = 0; tries < 80; tries++) {
      const x = Math.floor(r() * S.cols), y = Math.floor(r() * S.rows);
      if (ok(x, y)) { S.tiles.push({ ...tile, x, y }); return; }
    }
  };
  for (const [type, n] of Object.entries(want)) for (let i = 0; i < n; i++) {
    if (type === 'portalPairs') { put({ type: 'portal', pair: i + 1 }); put({ type: 'portal', pair: i + 1 }); } // pareja A, B, C…
    else put({ type });
  }
}
export async function startChallenge(id) {
  const ch = challengeById(id);
  if (!ch || !await modeIntro('challenge') || !await confirmReplaceSave('challenge')) return;
  recordStart('challenge');
  startVsGame({ cfg: ch.cfg, extra: challengeExtra(ch), tiles: ch.tiles, variant: 'challenge', run: { id } });
}

/* =============== desafío semanal =============== */
// cada semana (lunes a domingo) toca una de estas reglas; tablero, mazo y rivales iguales para todos
export const WEEKLY = [
  { id: 'tinyChaos', icon: 'i-users', cfg: { opps: 3, size: 's', diff: 'hard' } },
  { id: 'portalMaze', icon: 'i-spiral', cfg: { opps: 2, size: 'm', diff: 'normal' }, extra: { rules: { holeDrift: true } }, tiles: { portal: 2 } },
  { id: 'sandReflex', icon: 'i-sand', cfg: { opps: 1, size: 's', diff: 'normal' }, extra: { counts: ORANGE_DECK, rules: { onlyOrange: true }, par: 1 }, tiles: { bunker: 3 } },
  { id: 'longDrive', icon: 'i-club', cfg: { opps: 2, size: 'l', diff: 'normal' }, extra: { counts: 'longDrive' } },
  { id: 'duel', icon: 'i-trophy', cfg: { opps: 1, size: 'l', diff: 'hard' } },
  { id: 'bunkerCrowd', icon: 'i-sand', cfg: { opps: 4, size: 'l', diff: 'normal' }, tiles: { bunker: 5 } },
  { id: 'driftDuel', icon: 'i-hole', cfg: { opps: 1, size: 's', diff: 'hard' }, extra: { rules: { holeDrift: true } } },
  { id: 'fingerFest', icon: 'i-hand', cfg: { opps: 2, size: 'm', diff: 'normal' }, extra: { counts: 'fingers' } },
];
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
  while (rivals.length < rule.cfg.opps && pool.length) {
    const fresh = pool.filter(p => !styles.has(p.style));
    const from = fresh.length ? fresh : pool, pick = from[Math.floor(r() * from.length)];
    rivals.push(pick.id); styles.add(pick.style); pool.splice(pool.indexOf(pick), 1);
  }
  return { rule, rivals, seed: seedOf('weeklyGame:' + week) };
}
function startWeeklyGame(week = weekKey()) {
  const { rule, rivals, seed } = weeklySetup(week);
  startVsGame({ cfg: rule.cfg, extra: challengeExtra(rule), tiles: rule.tiles, variant: 'weekly', run: { id: rule.id, week }, seed, rivals });
}
export async function startWeekly() {
  if (!await modeIntro('weekly') || !await confirmReplaceSave('weekly')) return;
  recordStart('weekly');
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
    case 'daily': return `${t('modes.daily.title')} · ${new Date().toLocaleDateString(locale(), { day: 'numeric', month: 'short' })}`;
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
};
const deckArt = dk => `<svg class="dkArt" viewBox="0 0 60 60" aria-hidden="true" style="color:${dk.color}">` +
  `<rect x="14" y="8" width="34" height="46" rx="6" fill="${dk.color}" opacity=".35" transform="rotate(-12 31 31)"/>` +
  `<rect x="14" y="8" width="34" height="46" rx="6" fill="${dk.color}" opacity=".6" transform="rotate(-5 31 31)"/>` +
  `<rect x="13" y="7" width="34" height="46" rx="6" fill="${dk.color}"/><rect x="16.5" y="10.5" width="27" height="39" rx="4" fill="none" stroke="rgba(241,241,220,.45)" stroke-width="1.4"/>` +
  `<g transform="translate(0 0)">${EMBLEM[dk.emblem]}</g></svg>`;

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

  /* ---- partidas rápidas: una tarjeta por baraja ---- */
  const deckCard = dk => {
    const st = R.decks[dk.id] || { p: 0, w: 0 }, last = !dk.locked && lastPve(dk.id);
    const saved = !dk.locked && qsave && (qsave.pveCfg?.deck || 'classic') === dk.id;
    const pct = st.p ? Math.round(100 * st.w / st.p) + '%' : '—';
    const btns = dk.locked
      ? `<span class="dkSoon"><svg class="i" aria-hidden="true"><use href="#i-lock"/></svg>${esc(t('decks.soon'))}</span>`
      : (saved ? cont('resume:pve') : '') + btn('quick:' + dk.id, t('modes.quick.setup'), !saved) + (last ? btn('repeat:' + dk.id, t('menu.repeat'), false) : '');
    return `<article class="deckCard${dk.locked ? ' locked' : ''}" style="--dk:${dk.color}" aria-disabled="${!!dk.locked}">` +
      `<div class="dkPic">${deckArt(dk)}${dk.locked ? `<span class="dkLock"><svg class="i" aria-hidden="true"><use href="#i-lock"/></svg></span>` : ''}</div>` +
      `<div class="dkMain"><h3>${esc(t('decks.' + dk.id + '.name'))}</h3>` +
      `<p>${esc(t('decks.' + dk.id + '.desc'))}</p>` +
      (last ? `<div class="mdStats">${stat('i-reset', t('modes.quick.last', { cfg: cfgSub(last) }))}</div>` : '') + `</div>` +
      `<dl class="dkStats"><div><dt>${esc(t('decks.played'))}</dt><dd>${st.p}</dd></div><div><dt>${esc(t('decks.won'))}</dt><dd>${st.w}</dd></div>` +
      `<div><dt>${esc(t('decks.pct'))}</dt><dd>${pct}</dd></div></dl>` +
      `<div class="dkBtns">${btns}</div></article>`;
  };
  const quickPanel = `<p class="mdLead">${esc(t('decks.lead'))}</p><div class="deckList">${DECKS.map(deckCard).join('')}</div>`;

  /* ---- juegos especiales ---- */
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
  const wk = weekKey(), { rule } = weeklySetup(wk), wbest = R.weekly.weeks[wk]?.best, left = weekDaysLeft();
  const weeklyCard = `<article class="chCard weekly${wbest ? ' done' : ''}"><span class="mdIco"><svg class="i" aria-hidden="true"><use href="#${rule.icon}"/></svg></span>` +
    `<div class="chTxt"><small class="wkTag">${esc(t('modes.weekly.title'))} · ${esc(t(left === 1 ? 'modes.weekly.lastDay' : 'modes.weekly.daysLeft', { n: left }))}</small>` +
    `<b>${esc(t('weekly.' + rule.id + '.name'))}</b><small>${esc(t('weekly.' + rule.id + '.desc'))}</small>` +
    `<span class="wkBest">${esc(wbest ? t('modes.weekly.best', { turns: turnsLabel(wbest) }) : t('modes.weekly.noBest'))}</span></div>` +
    (wsave ? cont('resume:weekly') : btn('weekly', wbest ? t('modes.again') : t('modes.play'))) + `</article>`;
  const specialPanel = rushCard +
    `<section class="mdSection challenges"><h3>${esc(t('modes.challengesH'))} <span class="lvlCount">${nDone}/${CHALLENGES.length}</span></h3>${weeklyCard}<div class="chGrid">${chCards}</div></section>` +
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

// cambia de pestaña: el indicador y el contenido se deslizan; la pestaña que no se ve no ocupa sitio
let tabTimer = null;
function setModesTab(tab, { instant = false, focus = false } = {}) {
  const grid = $('modesGrid'), track = grid.querySelector('.mdTrack');
  if (!track || !TABS.includes(tab)) return;
  const changed = tab !== modesTab;
  modesTab = tab;
  try { localStorage.setItem(TAB_KEY, tab); } catch (e) { /* sin storage */ }
  document.body.dataset.modesTab = tab; // (el creador de niveles solo se ofrece en Juegos especiales)
  grid.dataset.tab = tab;
  grid.querySelectorAll('[data-mtab]').forEach(b => { const on = b.dataset.mtab === tab; b.setAttribute('aria-selected', on); b.tabIndex = on ? 0 : -1; });
  if (focus) grid.querySelector(`[data-mtab="${tab}"]`)?.focus();
  const panels = [...track.children];
  clearTimeout(tabTimer);
  panels.forEach(p => p.classList.remove('off')); // los dos a la vista mientras se desliza
  track.classList.toggle('instant', instant || REDUCED);
  track.style.transform = tab === 'special' ? 'translateX(calc(-100% - var(--mdGap)))' : 'none';
  if (changed && !instant && window.scrollY > 0) window.scrollTo({ top: 0, behavior: REDUCED ? 'auto' : 'smooth' });
  if (changed && !instant) sfx('select');
  tabTimer = setTimeout(() => panels.forEach(p => p.classList.toggle('off', p.dataset.panel !== tab)), instant || REDUCED ? 0 : 480);
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
export { store as modeStore, RUSH_KEY, tabOfGame };
