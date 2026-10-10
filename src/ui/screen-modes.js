// Modos de juego y reto diario:
//   · Reto diario  — (en el menú principal) tablero pequeño contra 2 bots, igual para todos cada día
//                    (semilla de la fecha): cada día cambian los rivales y su dificultad.
//                    Récord del día (victoria en menos turnos propios) y racha de días jugados.
//   · Pantalla de Modos: Partida rápida (contra bots o multijugador local), Contrarreloj y Desafíos.
//   · Contrarreloj — 5 hoyos generados de dificultad creciente, cada uno con su cuenta atrás:
//                    puntos por turnos y por el tiempo que sobra; si se acaba el tiempo, se acaba la serie.
//   · Desafíos     — cada semana, 5 partidas contra la máquina con reglas especiales; cada una ganada, una corona
//                    (crowns.js).
// También: el texto para compartir el resultado del reto diario y el aviso en el icono de la app.
// La serie del contrarreloj se guarda aparte de la partida, para poder dejarla entre hoyos.
import { track } from './analytics.js';
import { app } from './app.js';
import { $, esc } from './dom.js';
import { mulberry32 } from '../engine/rng.js';
import { startGame } from './controller.js';
import { Game } from '../engine/game.js';
import { modeArt } from './mode-art.js';
import { aiStop } from './ai-driver.js';
import { hideWin } from './win.js';
import { updateMenuBtn, toast } from './hud.js';
import { t, getLang } from '../i18n/index.js';
import { saveGame, loadSave, clearSave } from './save.js';
import { recordStart, recordDailyPlayed, loadRecords, updateRecords, turnsLabel, dailyStreakInfo, winCrown, crownsOf, recordRushWeek } from './records.js';
import { musicScene, sfx } from '../audio/sfx.js';
import { generateLevel, placeHunters, dateKey, weekKey, seedOf } from '../content/levels/generate.js';
import { showScreen, confirmReplaceSave, MODE_NAV } from './screens.js';
import { yoursSectionHTML, playLevelCard } from './screen-story.js';
import { openEditor, edLibraryChanged } from './editor.js';
import { deleteWithUndo, addCodeDialog } from './my-levels.js';
import { createVsGame, dressVsGame, openPveSetup, lastPve, cfgSub, repeatLastPve, STYLE_COLOR, startAfterLineup, startPveMatch, applyOwnLook } from './screen-pve.js';
import { PERSONAS, personaById, faceSVG, HUNTER_NAMES } from './persona.js';
import { HUNTER_COLOR } from '../art.js';
import { isBot } from './players.js';
import { loadProfile } from './profile.js';
import { DECKS, ULT_DECKS, deckById as deckOfId } from '../content/decks.js';
import { currentCombo, setCombo, toggleDeck, comboLabel, comboHistory, openComboHistory } from './ultimate.js';
import { SEASON_ICON } from './season-art.js';
import { BH_GARGANTUA } from '../content/tiles/blackhole.js';
import { WHEEL } from '../engine/gambling.js';
import { challengeById, challengeCfg, setupChallenge, dailyChallenge, DAILY_FEATURES } from '../content/challenges.js';
import { rushSectionHTML, shareRush } from './rush-week.js';
import { crownsSectionHTML, thisWeek, weekRivals, startCrownClock, shareCrowns, maybeCrownsIntro, animateCrownTotal } from './crowns.js';
import { deckIntro, hasDeckIntro } from './deck-intro.js';
import { REDUCED } from '../fx/juice.js';
import { confirmDialog } from './dialog.js';
import { modeIntro } from './mode-intro.js';
import { syncMenuBall } from './menu-ball.js';
import { resumeGame } from './resume.js';
import { stats } from './controller.js';
import { openDailyStats } from './daily-stats.js';

const locale = () => getLang() === 'es' ? 'es-ES' : 'en-GB';
const store = {
  get: k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
  set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sin storage */ } },
};
const RUSH_KEY = 'chaoticgolf_rush';
export const RUSH_HOLES = 5;
// segundos de cada hoyo (más grandes, más tiempo). Solo corre en tu turno: los turnos de los cazadores no lo gastan
const RUSH_LIMITS = [40, 45, 50, 55, 60];
export const RUSH_HUNTERS = 2; // cazadores en cada hoyo (src/ai/bot.js, estilo 'hunter')

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
  startAfterLineup(modeChipText(), variant); // (quién eres, rivales y orden; al pulsar Empezar, juega la máquina)
}
// fondo del reto diario: el de la mecánica del día (también para partidas guardadas antes de existir)
// el nombre de la mecánica del día (la de las estaciones, con la que toca: «Estaciones: Invierno»)
// (y la del multiverso, con lo que le toca: «Multiverso: Gravedad»)
// (y la del casino: «Casino: Dado»)
const SUB_KEY = { multiverse: 'mv', gambling: 'gb' };
const dailyFeatName = (feature, season, sub) => t('dailyFeat.' + feature) + (season ? ': ' + t('seasons.' + season + '.title') : sub ? ': ' + t(`dailyFeat.${SUB_KEY[feature]}.${sub}`) : '');
export const dailyScene = feature => DAILY_FEATURES.find(f => f.id === feature)?.scene || '';
function startDailyGame(date = dailyDate()) {
  const d = dailySetup(date);
  const { extra } = challengeCfg(d.ch);
  startVsGame({ cfg: { opps: 2, diff: d.diff }, extra, ch: d.ch, rivals: d.rivals, seed: d.seed, variant: 'daily', run: { date, feature: d.ch.feature, season: d.ch.season?.now, sub: d.ch.sub, scene: dailyScene(d.ch.feature) } });
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
    : sk.frozen && sk.n && !sk.today ? t('modes.daily.frozen')
    : sk.atRisk ? t('modes.daily.risk')
    : sk.lost ? t('modes.daily.lost', { n: sk.lost })
    : sk.today ? ''
    : t('modes.daily.start');
  const face = pr => `<span class="avatar hasFace" style="--pc:${STYLE_COLOR[pr.style]}">${faceSVG(-1, pr.style, 'idle')}</span>`;
  const vs = t('modes.daily.vs', { a: rv[0].name, b: rv[1].name });
  const play = saved ? t('menu.continue') : today?.best ? t('modes.again') : t('modes.play');
  // la racha, junto al título (lejos de las caras de los rivales): encendida si hoy ya has jugado, apagada (y latiendo) si está en peligro
  const flameCls = (sk.today ? ' lit' : '') + (sk.atRisk ? ' risk' : '') + (sk.frozen ? ' frozen' : '') + (sk.today && firstLitToday(date) ? ' ignite' : '');
  const flame = sk.n || sk.lost ? `<span class="dFlame${flameCls}" title="${esc(streakLabel(sk.n) + (sk.frozen ? ' · ' + t('modes.daily.frozen') : ''))}"><svg class="i" aria-hidden="true"><use href="#i-flame"/></svg><b>${sk.n}</b></span>` : '';
  // y a su derecha, las estadísticas (abre su ventana: daily-stats.js)
  const statsTag = `<span class="dStats" role="button" title="${esc(t('dstats.aria'))}" aria-label="${esc(t('dstats.aria'))}"><svg class="i" aria-hidden="true"><use href="#i-stats"/></svg></span>`;
  // el tic de completado va sobre la miniatura: el texto no cambia de forma según el estado.
  // Cada línea es una sola fila; la mecánica pasa a su propia línea si no cabe junto al título
  $('dailyCard').innerHTML =
    `<span class="dPreview dRivals">${rv.map(face).join('')}` +
    (today?.best ? `<span class="dDone" title="${esc(t('modes.daily.done') + ' · ' + t('modes.daily.bestToday', { turns: turnsLabel(today.best) }))}"><svg class="i" aria-hidden="true"><use href="#i-check"/></svg></span>` : '') + `</span>` +
    `<span class="dTxt"><small class="dWhen">${esc(when)}</small><span class="dHead"><span class="dTitle"><b>${esc(t('modes.daily.title'))}</b><span class="dTags">${flame}${statsTag}</span></span>` +
    `<span class="dFeat"><svg class="i" aria-hidden="true"><use href="#${ch.icon}"/></svg><span>${esc(dailyFeatName(ch.feature, ch.season?.now, ch.sub))}</span></span></span>` + // (la mecánica del día)
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
// la serie de la semana: la misma para todo el mundo (sus hoyos, sus cazadores y, con decide en ai-driver.js, lo que hacen)
export function newRush(week = weekKey()) {
  const s = seedOf('rushWeek:' + week);
  return { week, seeds: Array.from({ length: RUSH_HOLES }, (_, i) => (s + i * 7919) >>> 0), hole: 0, total: RUSH_HOLES, scores: [] };
}
// la serie a medias, si es de esta semana (la de la semana pasada ya no vale)
export function rushRun() {
  const r = store.get(RUSH_KEY);
  if (r && r.week !== weekKey()) { store.set(RUSH_KEY, null); return null; }
  return r;
}
// cada hoyo: un campo generado (dificultad 0…4) y dos cazadores en el borde que solo quieren golpearte (si entran en el
// hoyo, salen de la partida). Es una partida contra la máquina (la IA mueve a los cazadores); empiezas tú
export function startRushHole(run = rushRun()) {
  if (!run || run.week !== weekKey()) run = newRush();
  store.set(RUSH_KEY, run);
  const seed = run.seeds[run.hole], lvl = generateLevel(seed, run.hole);
  lvl.hunters = placeHunters(lvl, seed, RUSH_HUNTERS);
  const game = Game.fromLevel(lvl, { seed: seed ^ 0x5bd1e995 });
  startGame(game, 'pve', { level: lvl, variant: 'rush', run: { ...run, elapsed: 0, limit: RUSH_LIMITS[run.hole] || 60 } });
  dressHunters(game.S, seed);
  updateMenuBtn();
  musicScene('game', { newGame: true });
  showScreen('game');
  saveGame();
}
// tu color y tu nombre; los cazadores, negros y con nombre de matón (sacado de la semilla del hoyo)
function dressHunters(S, seed) {
  applyOwnLook(S, [0], [loadProfile()]);
  for (const p of S.hunters || []) S.colorMap[p] = HUNTER_COLOR;
  const r = mulberry32((seed ^ 0x3c6ef372) >>> 0), names = [...HUNTER_NAMES];
  for (const p of S.hunters || []) S.playerNames[p] = names.splice(Math.floor(r() * names.length), 1)[0];
  app.viewer = 0;
}
export async function startRush(fresh) {
  if (!await modeIntro('rush')) return;
  if (!await confirmReplaceSave('rush')) return;
  if (fresh) store.set(RUSH_KEY, null);
  if (fresh || !rushRun()) recordStart('rush');
  startRushHole(fresh ? newRush() : rushRun() || newRush());
}
const rushLeft = r => Math.max(0, (r.limit || 90) - (r.elapsed || 0));
// al embocar en contrarreloj: puntos del hoyo, total y siguiente (o final)
export function rushHoleDone() {
  const run = app.run, turns = ((app.mode === 'pve' ? stats?.misTurnos : stats?.turnos) || 0) + 1; // (tus turnos: los de los cazadores no cuentan)
  const sc = rushScore(turns, rushLeft(run));
  const scores = [...(run.scores || []), sc.total];
  const sum = scores.reduce((a, b) => a + b, 0);
  const last = run.hole + 1 >= run.total;
  let newBest = false, week = null;
  if (last) {
    store.set(RUSH_KEY, null);
    updateRecords(d => { d.rush.runs++; d.rush.done = (d.rush.done ?? Math.floor((d.won.rush || 0) / 6)) + 1; if (sum > d.rush.best) { newBest = true; d.rush.best = sum; } d.won.rush++; });
    week = recordRushWeek(run.week || weekKey(), sum); // (su medalla de la semana)
  } else store.set(RUSH_KEY, { week: run.week, seeds: run.seeds, hole: run.hole + 1, total: run.total, scores });
  return { sc, sum, last, newBest, turns, best: loadRecords().rush.best, week };
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
// los desafíos (campos diseñados, mazos y reglas) viven en content/challenges.js; los 5 de cada semana, con sus coronas, en
// crowns.js. Se juegan con los rivales de la semana (los mismos para todos) y una semilla nueva cada vez
export async function startChallenge(id) {
  const ch = challengeById(id);
  if (!ch || !await modeIntro('challenge') || !await confirmReplaceSave('challenge')) return;
  const { wk } = thisWeek();
  recordStart('challenge', { challenge: id });
  const { cfg, extra } = challengeCfg(ch);
  startVsGame({ cfg, extra, ch, variant: 'challenge', run: { id, week: wk, scene: ch.scene }, rivals: weekRivals(wk, ch) });
}
// al terminar: ganarlo da su corona de esta semana (una vez). Devuelve si es nueva, el total y el siguiente por ganar
export function challengeDone(won) {
  const id = app.run?.id, wk = app.run?.week || weekKey();
  const c = won && id ? winCrown(wk, id) : null;
  const { wk: now, list } = thisWeek(), got = crownsOf(now);
  return { id, won, crown: c, next: list.find(ch => !got.includes(ch.id) && ch.id !== id)?.id || null };
}

/* =============== etiqueta del modo en la barra de la partida =============== */
const mmss = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
export function modeChipText() {
  const r = app.run;
  switch (app.variant) {
    case 'daily': return `${t('modes.daily.title')} · ${r?.feature ? dailyFeatName(r.feature, r.season, r.sub) : new Date().toLocaleDateString(locale(), { day: 'numeric', month: 'short' })}`;
    case 'rush': return `${t('modes.holeN', { n: r.hole + 1, total: r.total })} · ${t('modes.rush.pts', { n: (r.scores || []).reduce((a, b) => a + b, 0) })}`;
    case 'challenge': return t('challenges.' + r.id + '.name');
    case 'puzzle': return t('story.puzzleChip');
  }
  return '';
}

// reloj del contrarreloj (cuenta atrás): corre con la partida a la vista, sin pausa y sin terminar, y solo en tu turno
// (mientras juegan o reaccionan los cazadores se para).
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
  if (isBot(app.game.S.turn) || app.ai.acting) { paintRushTimer(); return; } // (turno de un cazador: tu tiempo no corre)
  r.elapsed = (r.elapsed || 0) + dt;
  const left = rushLeft(r), sec = Math.ceil(left);
  if (left <= 10 && sec !== lastSec && sec > 0) sfx('tick');
  lastSec = sec;
  paintRushTimer();
  if (left <= 0) rushTimeUp();
}, 250);

/* =============== pantalla de Modos =============== */
// Tres pestañas que se deslizan en horizontal (también con el dedo, que arrastra el contenido): Partidas rápidas (una
// tarjeta por baraja), Eventos (los desafíos y el contrarreloj de la semana) y El taller (tus niveles y el creador).
// Solo se ve una a la vez; se recuerda la última.
const TAB_KEY = 'chaoticgolf_modesTab', TABS = ['quick', 'special', 'workshop']; // (special: Eventos)
let modesTab = (() => { try { return TABS.includes(localStorage.getItem(TAB_KEY)) ? localStorage.getItem(TAB_KEY) : 'quick'; } catch (e) { return 'quick'; } })();
// pestaña de la partida en curso (para volver a su sitio)
const tabOfGame = () => app.mode === 'pve' && !app.variant ? 'quick' : app.mode === 'story' && !app.variant ? 'workshop' : 'special';

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
  // las estaciones: la carta partida en cuatro (primavera, verano, otoño, invierno, en el sentido del reloj) con el
  // hoyo en el centro; al pasar por la tarjeta, la rueda gira a la siguiente
  seasons: () => cardBase('seasons', '#E7A0BC', '#9C4A70') +
    `<g clip-path="url(#dk-seasons-c)"><g class="dkSeasons">` +
    `<path d="M30 30 L30 -10 L-10 -10 L-10 30Z" fill="#6DB45E"/><path d="M30 30 L70 30 L70 -10 L30 -10Z" fill="#D9C062"/>` +
    `<path d="M30 30 L30 70 L70 70 L70 30Z" fill="#C97A3E"/><path d="M30 30 L-10 30 L-10 70 L30 70Z" fill="#D7E6EE"/>` +
    `<g transform="translate(13 9) scale(.62)">${SEASON_ICON.spring}</g><g transform="translate(32.5 9) scale(.62)">${SEASON_ICON.summer}</g>` +
    `<g transform="translate(32.5 36) scale(.62)">${SEASON_ICON.autumn}</g><g transform="translate(13 36) scale(.62)">${SEASON_ICON.winter}</g></g></g>` +
    `<circle cx="30" cy="30" r="6.4" fill="#F1F1DC"/>` + FLAGP(30, 31.4) + frame,
  // el multiverso: un agujero negro con su disco en el cielo estrellado, la pelota que entra y sus copias que salen
  // (al pasar por la tarjeta, el disco gira)
  // el multiverso: Gargantua (el agujero negro de Interstellar) en el cielo estrellado (al pasar por la tarjeta, la luz
  // fluye por el disco)
  blackhole: () => cardBase('blackhole', '#2A1F55', '#07040F') +
    `<g clip-path="url(#dk-blackhole-c)"><g fill="#fff">${[[16, 12, .8], [44, 10, .6], [40, 50, .7], [17, 47, .5], [47, 18, .5], [13, 29, .45]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('')}</g>` +
    BH_GARGANTUA(30, 30, .38) + `</g>` + frame,
  // el casino: la ruleta sobre el tapete verde, con un dado delante (al pasar por la tarjeta, la ruleta gira)
  roulette: () => cardBase('roulette', '#2C8A5C', '#0F4A30') +
    `<g clip-path="url(#dk-roulette-c)"><g stroke="rgba(255,255,255,.05)" stroke-width="1.4">${[0, 12, 24, 36, 48, 60].map(i => `<path d="M${i - 14} 60 L${i + 14} 0M${i - 14} 0 L${i + 14} 60"/>`).join('')}</g></g>` +
    `<circle cx="30" cy="25" r="15.5" fill="#5A2E1A"/><circle cx="30" cy="25" r="14.5" fill="none" stroke="#E2B23C" stroke-width="1.2"/>` +
    `<g class="dkWheel">${WHEEL.map((c, i) => { const a = k => (k / WHEEL.length) * Math.PI * 2 - Math.PI / 2, p = (k, r) => `${(30 + Math.cos(a(k)) * r).toFixed(2)} ${(25 + Math.sin(a(k)) * r).toFixed(2)}`;
      return `<path d="M30 25L${p(i, 13)}A13 13 0 0 1 ${p(i + 1, 13)}Z" fill="${{ red: '#C8243A', black: '#24242A', gold: '#E2B23C' }[c]}" stroke="#E9D9A8" stroke-width=".5"/>`; }).join('')}` +
    `<circle cx="30" cy="25" r="5.4" fill="#1F6B48" stroke="#E2B23C" stroke-width=".9"/><circle cx="30" cy="25" r="1.6" fill="#E2B23C"/></g>` +
    `<path d="M30 9.5l-2.2-3.6h4.4z" fill="#F6F0E2"/>` +
    `<g transform="rotate(-12 38 44)"><rect x="31" y="38" width="14" height="13" rx="3" fill="#CFC3AE"/><rect x="31" y="35" width="14" height="13" rx="3" fill="#F6F0E2" stroke="#4A3F3A" stroke-width=".8"/>` +
    `<circle cx="34.6" cy="38.6" r="1.3" fill="#2A2226"/><circle cx="38" cy="41.5" r="1.3" fill="#2A2226"/><circle cx="41.4" cy="44.4" r="1.3" fill="#2A2226"/></g>` +
    `<g transform="translate(19 45)"><ellipse rx="5.6" ry="2" cy="2" fill="#0F4A30"/><ellipse rx="5.6" ry="2" fill="#E2B23C"/><ellipse rx="3.6" ry="1.2" fill="none" stroke="#9C6A1E" stroke-width=".7"/></g>` + frame,
  prism: () => cardBase('prism', '#E8F7F8', '#BFE3EC') + // (nácar iridiscente: Ultimate, el combinador)
    `<defs><linearGradient id="dk-prism-r" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF8FC4"/><stop offset=".35" stop-color="#8FB6FF"/><stop offset=".65" stop-color="#7EE8C8"/><stop offset="1" stop-color="#FFE38A"/></linearGradient></defs>` +
    `<g clip-path="url(#dk-prism-c)"><circle cx="30" cy="30" r="20" fill="url(#dk-prism-r)" opacity=".16"/>` +
    `<path d="M8 36 L27 29" stroke="#6B8A94" stroke-width="1.8" stroke-linecap="round" opacity=".9"/>` +
    `<g stroke-width="2.2" stroke-linecap="round">${['#FF6FA8', '#FFB347', '#FFE36B', '#7EE8C8', '#6FA8FF', '#B98CFF'].map((c, i) => `<path d="M33 ${28 + i * 1.1} L52 ${20 + i * 5}" stroke="${c}"/>`).join('')}</g></g>` +
    `<path d="M30 15 L40 36 H20 Z" fill="rgba(255,255,255,.7)" stroke="#6B8A94" stroke-width="1.4" stroke-linejoin="round"/><path d="M30 15 L40 36 L30 31 Z" fill="rgba(180,225,240,.6)"/>` +
    `<g class="dkTw" fill="#fff"><path d="M19 13 l1 2.6 2.6 1 -2.6 1 -1 2.6 -1 -2.6 -2.6 -1 2.6 -1z"/><path d="M41 44 l.7 1.8 1.8.7 -1.8.7 -.7 1.8 -.7 -1.8 -1.8 -.7 1.8 -.7z" opacity=".8"/></g>` + frame,
};
export const deckArt = dk => `<svg class="dkArt" viewBox="0 0 60 60" aria-hidden="true">${(DECK_ART[dk.emblem === 'club' ? 'classic' : dk.emblem === 'drop' ? 'water' : dk.emblem] || DECK_ART.classic)()}</svg>`;

// Ultimate, aparte del resto: un separador pequeño y su tarjeta, el combinador. Un icono por baraja (tocar = activarla o
// quitarla; siempre queda al menos una), el campo que sale, el botón de jugar y el historial de combinaciones
const ultSep = () => `<div class="ultSep" aria-hidden="true"><i></i><span>✦</span><i></i></div>`;
function ultCard(dk, qsave = loadSave('pve'), still = false) {
  const mask = currentCombo(), saved = qsave && (qsave.pveCfg?.deck || 'classic') === dk.id, n = comboHistory().length;
  const on = ULT_DECKS.filter((_, i) => mask & (1 << i)).length;
  const b = (act, label, cls) => `<button class="${cls}" data-mode="${act}">${label}</button>`;
  // cada baraja: su icono grande y su nombre; activada, con borde de arcoíris y ✓; apagada, en gris y con +
  const togs = ULT_DECKS.map((id, i) => { const act = !!(mask & (1 << i)), d = deckOfId(id);
    return `<button class="ultTog${act ? ' on' : ''}" data-ult="${id}" aria-pressed="${act}" title="${esc(t('decks.' + id + '.name'))}">` +
      `<span class="ultMark" aria-hidden="true"><svg class="i"><use href="#${act ? 'i-check' : 'i-plus'}"/></svg></span>${deckArt(d)}<span class="ultName">${esc(t('ult.short.' + id))}</span></button>`; }).join('');
  return `<article class="deckCard ultimate${still ? ' still' : ''}" data-deck="${dk.id}" style="--dk:${dk.color}">` +
    `<header class="ultTop"><span class="ultEmblem">${deckArt(dk)}</span><h3>${esc(t('decks.' + dk.id + '.name'))}</h3><p>${esc(t('decks.' + dk.id + '.desc'))}</p></header>` +
    `<div class="ultTogs" role="group" aria-label="${esc(t('ult.togglesAria'))}">${togs}</div>` +
    `<p class="ultSum"><span>${esc(t('ult.count', { n: on, total: ULT_DECKS.length }))}</span><span class="ultSize"><svg class="i" aria-hidden="true"><use href="#i-grid"/></svg>${esc(comboLabel(mask))}</span></p>` +
    `<div class="ultBtns">${saved ? `<button class="btn-continue" data-mode="resume:pve">${esc(t('menu.continue'))}</button>` : ''}` +
    b('quick:ultimate', esc(t('modes.quick.setup')), saved ? 'btn-light' : 'btn-primary') +
    b('ultHist', `<svg class="i" aria-hidden="true"><use href="#i-list"/></svg>${esc(t('ult.history'))}${n ? `<em>${n}</em>` : ''}`, 'btn-light ultHistBtn') +
    (hasDeckIntro(dk.id) ? `<button class="btn-text btn-sm dkCards" data-mode="deckCards:${dk.id}"><svg class="i" aria-hidden="true"><use href="#i-help"/></svg>${esc(t('deckIntro.button'))}</button>` : '') +
    `</div><span class="ultSheen" aria-hidden="true"></span></article>`;
}
// repinta solo la tarjeta de Ultimate (sin su animación de entrada)
function paintUlt() {
  const el = document.querySelector('.deckCard.ultimate');
  if (el) el.outerHTML = ultCard(deckOfId('ultimate'), undefined, true);
  fitUltTogs();
}
// los iconos de las barajas de Ultimate: en una fila si caben; si no, en dos filas parejas (con 7, 4 y 3; nunca 6 y 1)
export function fitUltTogs() {
  const el = document.querySelector('.ultTogs'), box = el?.parentElement;
  if (!el || !box?.clientWidth) return;
  const cs = getComputedStyle(box), w = box.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  const n = el.children.length, min = matchMedia('(max-width: 760px)').matches ? 66 : 108; // (lo que necesita cada icono, con su hueco, para que quepa su nombre)
  el.style.setProperty('--cols', n * min <= w ? n : Math.ceil(n / 2));
}
addEventListener('resize', () => fitUltTogs());
// un enlace con una combinación compartida: la misma partida (combinación, rivales, dificultad y semilla)
export async function playSharedCombo(e) {
  if (!await confirmReplaceSave('pve')) return;
  setCombo(e.mask);
  app.pveCfg = { ...app.pveCfg, deck: 'ultimate', combo: e.mask, opps: e.opps, diff: e.diff, humans: 1, kind: 'bots', rivals: [] };
  if (!await deckIntro('ultimate')) return;
  startPveMatch({ seed: e.seed, recv: true });
}

export function openModes(tab) {
  hideWin();
  aiStop();
  if (TABS.includes(tab)) modesTab = tab;
  const R = loadRecords();
  const qsave = loadSave('pve'), rsave = loadSave('rush'), csave = loadSave('challenge');
  const btn = (act, label, main = true, dis = false) => `<button class="${main ? 'btn-primary' : 'btn-light'} btn-sm" data-mode="${act}"${dis ? ' disabled' : ''}>${esc(label)}</button>`;
  const cont = (act, label = t('menu.continue')) => `<button class="btn-continue btn-sm" data-mode="${act}">${esc(label)}</button>`; // continuar: siempre en naranja
  const stat = (icon, txt) => `<span class="mdStat"><svg class="i" aria-hidden="true"><use href="#${icon}"/></svg>${esc(txt)}</span>`;
  // mini estadísticas (jugadas · victorias · %), como las de las barajas pero en una línea
  const mini = (s = {}) => { const p = s.p || 0, w = Math.min(s.w || 0, p || s.w || 0);
    return `<span class="miniSt"><span><b>${p}</b> ${esc(t('decks.played').toLowerCase())}</span><span><b>${w}</b> ${esc(t('decks.won').toLowerCase())}</span>` +
      `<span><b>${p ? Math.round(100 * Math.min(w, p) / p) : 0}%</b></span></span>`; };

  /* ---- partidas rápidas: una tarjeta por baraja ---- */
  const deckCard = dk => {
    if (dk.ultimate) return ultSep() + ultCard(dk, qsave); // (Ultimate: el combinador, aparte)
    const st = R.decks[dk.id] || { p: 0, w: 0 }, last = !dk.locked && lastPve(dk.id);
    const saved = !dk.locked && qsave && (qsave.pveCfg?.deck || 'classic') === dk.id;
    const pct = (st.p ? Math.round(100 * st.w / st.p) : 0) + '%';
    const btns = dk.locked
      ? `<span class="dkSoon"><svg class="i" aria-hidden="true"><use href="#i-lock"/></svg>${esc(t('decks.soon'))}</span>`
      : (saved ? cont('resume:pve') : '') + btn('quick:' + dk.id, t('modes.quick.setup'), !saved) + (last ? btn('repeat:' + dk.id, t('menu.repeat'), false) : '') +
        (hasDeckIntro(dk.id) ? `<button class="btn-text btn-sm dkCards" data-mode="deckCards:${dk.id}"><svg class="i" aria-hidden="true"><use href="#i-help"/></svg>${esc(t('deckIntro.button'))}</button>` : '');
    return `<article class="deckCard${dk.locked ? ' locked' : ''}${dk.ultimate ? ' ultimate' : ''}" data-deck="${dk.id}" style="--dk:${dk.color}" aria-disabled="${!!dk.locked}">` +
      `<div class="dkPic">${deckArt(dk)}${dk.locked ? `<span class="dkLock"><svg class="i" aria-hidden="true"><use href="#i-lock"/></svg></span>` : ''}</div>` +
      // (Ultimate: las barajas que reúne, a la derecha de su nombre)
      `<div class="dkMain">${dk.ultimate ? `<div class="ultHead"><h3>${esc(t('decks.' + dk.id + '.name'))}</h3>` +
        `<div class="ultIncl"><span>${esc(t('decks.includes'))}</span>${DECKS.filter(d => !d.ultimate && !d.locked && !d.noUltimate).map(d => `<i title="${esc(t('decks.' + d.id + '.name'))}">${deckArt(d)}</i>`).join('')}</div></div>`
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
  const specialPanel = crownsSectionHTML(R, csave) + rushSectionHTML(R, rushRun(), rsave); // (primero los desafíos de la semana)

  const tabBtn = id => `<button role="tab" id="mdTab-${id}" data-mtab="${id}" aria-controls="mdPanel-${id}" aria-selected="${modesTab === id}" tabindex="${modesTab === id ? 0 : -1}">` +
    `<svg class="i" aria-hidden="true"><use href="#${{ quick: 'i-bolt', special: 'i-crown', workshop: 'i-wrench' }[id]}"/></svg><span class="tL">${esc(t('modes.tabs.' + id))}</span><span class="tS">${esc(t('modes.tabsShort.' + id))}</span></button>`; // (tS: el nombre corto, en el móvil)
  $('modesGrid').innerHTML =
    `<div class="mdTabs" role="tablist" aria-label="${esc(t('modes.title'))}"><span class="mdTabInd" aria-hidden="true"></span>${TABS.map(tabBtn).join('')}</div>` +
    `<div class="mdViewport"><div class="mdTrack">` +
    `<section class="mdPanel" id="mdPanel-quick" role="tabpanel" aria-labelledby="mdTab-quick" data-panel="quick">${quickPanel}</section>` +
    `<section class="mdPanel" id="mdPanel-special" role="tabpanel" aria-labelledby="mdTab-special" data-panel="special">${specialPanel}</section>` +
    `<section class="mdPanel" id="mdPanel-workshop" role="tabpanel" aria-labelledby="mdTab-workshop" data-panel="workshop">${yoursSectionHTML()}</section>` +
    `</div></div>`;
  setModesTab(modesTab, { instant: true });
  showScreen('modes');
  fitUltTogs();
  startCrownClock(() => openModes());
  animateCrownTotal();
  if (modesTab === 'special') maybeCrownsIntro();
}

// cambia de pestaña: el indicador se desliza; el contenido sale con un fundido corto hacia un lado
// y el nuevo entra entero desde el otro. Nunca se ven las dos a la vez
// (así el cambio de altura entre secciones queda oculto y no hay saltos).
// (dragX: lo arrastrado con el dedo; la salida sigue desde ahí)
let tabSeq = 0;
function setModesTab(tab, { instant = false, focus = false, dragX = 0 } = {}) {
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
  const show = () => { panels.forEach(p => p.classList.toggle('off', p !== to)); fitUltTogs(); if (tab === 'special' && app.screen === 'modes') maybeCrownsIntro(); };
  if (instant || REDUCED || !from || !to.animate) { show(); return; }
  sfx('select');
  const out = from.animate([{ opacity: dragX ? Math.max(.3, 1 - Math.abs(dragX) / 500) : 1, transform: `translateX(${dragX}px)` },
    { opacity: 0, transform: `translateX(${dragX ? dragX - 60 * dir : -20 * dir}px)` }],
    { duration: dragX ? 140 : 110, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' });
  from.style.transform = '';
  from._anims.push(out);
  out.onfinish = () => {
    if (seq !== tabSeq) return;
    show();
    out.cancel();
    if (window.scrollY > 0) window.scrollTo({ top: 0, behavior: 'instant' });
    // el panel entero llega deslizándose, de una vez (sin tarjetas escalonadas: más limpio y más barato en el móvil)
    to._anims.push(to.animate([{ opacity: 0, transform: `translateX(${28 * dir}px)` }, { opacity: 1, transform: 'none' }],
      { duration: 220, easing: 'cubic-bezier(.2,.8,.2,1)' }));
  };
}

// deslizar con el dedo entre pestañas: en cuanto el gesto es claramente horizontal, la pestaña sigue al dedo (con
// resistencia en los extremos, donde no hay más); al soltar, si se ha arrastrado bastante (o rápido), pasa a la de al lado
// desde donde estaba; si no, vuelve a su sitio con un rebote suave
function bindModesSwipe() {
  let x0 = null, y0 = 0, t0 = 0, lock = null, cur = null, dx = 0;
  const grid = $('modesGrid');
  const panel = () => grid.querySelector('.mdPanel:not(.off)');
  grid.addEventListener('touchstart', e => {
    if (e.touches.length !== 1 || !e.target.closest('.mdViewport') || e.target.closest('.ultTogs')) { x0 = null; return; }
    x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; t0 = Date.now(); lock = null; dx = 0; cur = panel();
  }, { passive: true });
  grid.addEventListener('touchmove', e => {
    if (x0 == null || !cur || lock === 'y') return;
    const mx = e.touches[0].clientX - x0, my = e.touches[0].clientY - y0;
    if (!lock) { if (Math.abs(mx) < 10 && Math.abs(my) < 10) return; lock = Math.abs(mx) > Math.abs(my) * 1.3 ? 'x' : 'y'; if (lock === 'y') return; }
    const i = TABS.indexOf(modesTab), edge = (mx > 0 && i === 0) || (mx < 0 && i === TABS.length - 1);
    dx = edge ? mx / 4 : mx; // (en los extremos, resistencia)
    cur.style.transform = `translateX(${dx}px)`; cur.style.opacity = String(Math.max(.4, 1 - Math.abs(dx) / 600));
  }, { passive: true });
  const end = e => {
    if (x0 == null || !cur) { x0 = null; return; }
    const el = cur, vx = Math.abs(dx) / Math.max(1, Date.now() - t0), i = TABS.indexOf(modesTab) + (dx < 0 ? 1 : -1);
    x0 = null; cur = null;
    if (lock === 'x' && TABS[i] && (Math.abs(dx) > 70 || (Math.abs(dx) > 30 && vx > .45))) { el.style.opacity = ''; setModesTab(TABS[i], { dragX: dx }); return; }
    if (dx && el.animate && !REDUCED) el.animate([{ transform: `translateX(${dx}px)`, opacity: el.style.opacity || 1 }, { transform: 'none', opacity: 1 }],
      { duration: 260, easing: 'cubic-bezier(.3,1.4,.5,1)' }); // (vuelve a su sitio, con un rebote)
    el.style.transform = ''; el.style.opacity = '';
  };
  grid.addEventListener('touchend', end, { passive: true });
  grid.addEventListener('touchcancel', end, { passive: true });
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
  $('dailyCard').addEventListener('click', e => {
    if (e.target.closest('.dStats')) { openDailyStats(); return; } // (la etiqueta de las estadísticas, dentro de la tarjeta)
    if ($('dailyCard').dataset.resume) resumeGame('daily'); else startDaily();
  });
  $('modesGrid').addEventListener('click', e => {
    const ya = e.target.closest('[data-lvedit], [data-lvdel], [data-lvcode]'); // tus niveles: editar, eliminar, añadir código
    if (ya) { yoursAction(ya); return; }
    const lv = e.target.closest('[data-level]'); // tus niveles
    if (lv) { playLevelCard(lv); return; }
    const tb = e.target.closest('[data-mtab]');
    if (tb) { setModesTab(tb.dataset.mtab); return; }
    const ut = e.target.closest('[data-ult]'); // (Ultimate: activar o quitar una baraja de la combinación)
    if (ut) { if (toggleDeck(ut.dataset.ult) == null) { ut.classList.remove('nope'); void ut.offsetWidth; ut.classList.add('nope'); toast(t('ult.needOne')); } else { sfx('select'); paintUlt(); document.querySelector(`.ultTog[data-ult="${ut.dataset.ult}"]`)?.focus(); } return; }
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
      case 'crShare': shareCrowns(); break;
      case 'rwShare': shareRush(); break;
      case 'deckCards': deckIntro(arg, { force: true, play: false }); break;
      case 'ultHist': openComboHistory({ deckArt, onPick: m => { setCombo(m); paintUlt(); } }); break;
      case 'editor': openEditor(); break;
      case 'editorNew': openEditor({ fresh: true }); break; // (el + de El taller: un nivel nuevo)
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
  MODE_NAV.rush = { back: () => openModes('special'), restart: () => { store.set(RUSH_KEY, null); recordStart('rush'); startRushHole(newRush()); } }; // (otra vez la serie de la semana)
  MODE_NAV.challenge = { back: () => openModes('special'), restart: () => startChallenge(app.run?.id) };
}
async function yoursAction(b) {
  const d = b.dataset;
  if (d.lvedit != null) { openEditor({ idx: +d.lvedit }); return; }
  if (d.lvdel != null) { deleteWithUndo(+d.lvdel, info => { edLibraryChanged(info); if (app.screen === 'modes') openModes('workshop'); }); return; }
  if (d.lvcode != null && await addCodeDialog() != null) openModes('workshop');
}
export { store as modeStore, RUSH_KEY, tabOfGame };
