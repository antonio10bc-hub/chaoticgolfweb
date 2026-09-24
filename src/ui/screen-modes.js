// Pantalla de Modos: reto diario, contrarreloj, torneo de 9 hoyos y desafíos con reglas especiales.
//   · Reto diario  — un tablero y un mazo iguales para todos cada día (semilla de la fecha):
//                    récord del día (menos turnos) y racha de días jugados.
//   · Contrarreloj — 5 hoyos generados de dificultad creciente; puntos por turnos y rapidez.
//   · Torneo       — 9 hoyos contra los mismos bots (mismas caras y humor de un hoyo a otro);
//                    gana quien más hoyos haya ganado.
//   · Desafíos     — partidas contra la máquina con reglas especiales.
// La serie en curso (torneo, contrarreloj) se guarda aparte de la partida, para poder dejarla
// entre hoyos y seguir otro día.
import { app } from './app.js';
import { $, esc } from './dom.js';
import { mulberry32, randomSeed } from '../engine/rng.js';
import { startGame } from './controller.js';
import { aiStart, aiStop } from './ai-driver.js';
import { hideWin } from './win.js';
import { refreshGivePlayer } from './debug.js';
import { updateMenuBtn } from './hud.js';
import { t, getLang } from '../i18n/index.js';
const locale = () => getLang() === 'es' ? 'es-ES' : 'en-GB';
import { saveGame, loadSave, clearSave } from './save.js';
import { recordStart, recordDailyPlayed, loadRecords, updateRecords, turnsLabel } from './records.js';
import { musicScene } from '../audio/sfx.js';
import { generateLevel, dateKey, seedOf } from '../content/levels/generate.js';
import { PERSONAS, personaById, setMood, faceSVG } from './persona.js';
import { isBot, displayName } from './players.js';
import { showScreen, confirmReplaceSave, MODE_NAV } from './screens.js';
import { startLevel, levelPreviewSVG } from './screen-story.js';
import { createVsGame, dressVsGame, PVE_COLORS, STYLE_COLOR } from './screen-pve.js';
import { resumeGame } from './resume.js';
import { stats } from './controller.js';

const store = {
  get: k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
  set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sin storage */ } },
};
const RUSH_KEY = 'chaoticgolf_rush', TOUR_KEY = 'chaoticgolf_tour';
export const RUSH_HOLES = 5, TOUR_HOLES = 9;
const TOUR_SIZES = ['m', 's', 'm', 'l', 'm', 's', 'l', 'm', 'l']; // el torneo varía de campo hoyo a hoyo

/* =============== reto diario =============== */
const dailyDate = () => dateKey();
export function dailyLevel(date = dailyDate()) { return generateLevel(seedOf('daily:' + date), 3); }
export async function startDaily() {
  if (!await confirmReplaceSave('daily')) return;
  const date = dailyDate();
  recordDailyPlayed(date); // jugar hoy ya cuenta para la racha
  startLevel(dailyLevel(date), 'story', null, { variant: 'daily', run: { date }, seed: seedOf('deck:' + date) });
}

/* =============== contrarreloj =============== */
// puntos de un hoyo: menos turnos = más puntos, y un extra por terminarlo rápido
export const rushScore = (turns, secs) => {
  const base = Math.max(100, 1000 - 150 * (turns - 1));
  const bonus = Math.max(0, Math.round(300 - 5 * secs));
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
  startLevel(lvl, 'story', null, { variant: 'rush', run: { ...run, elapsed: 0 }, seed: run.seeds[run.hole] ^ 0x5bd1e995 });
}
export async function startRush(fresh) {
  if (!await confirmReplaceSave('rush')) return;
  if (fresh) store.set(RUSH_KEY, null);
  if (fresh || !store.get(RUSH_KEY)) recordStart('rush');
  startRushHole(fresh ? newRush() : store.get(RUSH_KEY) || newRush());
}
// al embocar en contrarreloj: puntos del hoyo, total y siguiente (o final)
export function rushHoleDone() {
  const run = app.run, turns = (stats?.turnos || 0) + 1;
  const sc = rushScore(turns, Math.round(run.elapsed || 0));
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

/* =============== torneo de 9 hoyos =============== */
const tourCfg = { opps: 3, diff: 'normal' };
function newTour() {
  const r = mulberry32(randomSeed());
  const pool = [...PERSONAS];
  const bots = Array.from({ length: tourCfg.opps }, () => pool.splice(Math.floor(r() * pool.length), 1)[0].id);
  const points = { me: 0 }; for (const id of bots) points[id] = 0;
  return { hole: 0, total: TOUR_HOLES, diff: tourCfg.diff, bots, points, moods: {} };
}
export function startTourHole(run = store.get(TOUR_KEY)) {
  if (!run) run = newTour();
  store.set(TOUR_KEY, run);
  const cfg = { humans: 1, opps: run.bots.length, diff: run.diff, size: TOUR_SIZES[run.hole % TOUR_SIZES.length] };
  const made = createVsGame(cfg, { rivals: run.bots });
  startGame(made.game, 'pve', { variant: 'tour', run });
  dressVsGame(made);
  // cada bot conserva su humor del hoyo anterior (contento si lo ganó, mosqueado si no)
  const S = app.game.S;
  for (let p = 0; p < S.nPlayers; p++) if (isBot(p) && run.moods[S.personas[p]]) setMood(p, run.moods[S.personas[p]], 7000);
  launchVs();
}
export async function startTour(fresh) {
  if (!await confirmReplaceSave('tour')) return;
  if (fresh) store.set(TOUR_KEY, null);
  if (fresh || !store.get(TOUR_KEY)) recordStart('tour');
  startTourHole(fresh ? newTour() : store.get(TOUR_KEY) || newTour());
}
// quién es quién en el torneo: 'me' o el id del personaje
const tourId = (S, p) => isBot(p) ? S.personas?.[p] : 'me';
export function tourHoleDone(winners) {
  const run = app.run, S = app.game.S;
  const points = { ...run.points }, moods = {};
  for (const w of winners) { const id = tourId(S, w); if (id in points) points[id]++; }
  for (let p = 0; p < S.nPlayers; p++) if (isBot(p)) moods[S.personas[p]] = winners.includes(p) ? 'happy' : 'angry';
  const last = run.hole + 1 >= run.total;
  const table = Object.entries(points).sort((a, b) => b[1] - a[1]);
  const top = table[0][1], champs = table.filter(([, v]) => v === top).map(([id]) => id);
  if (last) {
    store.set(TOUR_KEY, null);
    if (champs.includes('me')) updateRecords(d => { d.tour.champion++; d.won.tour++; });
  } else store.set(TOUR_KEY, { ...run, hole: run.hole + 1, points, moods });
  return { points, table, last, champs };
}
export const streakLabel = n => n === 1 ? t('modes.daily.streak1') : t('modes.daily.streak', { n });
export const tourName = id => id === 'me' ? t('win.sum.you') : (personaById(id)?.name || id);

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
  launchVs();
}
export function challengeDone(won) {
  const id = app.run?.id;
  if (won && id) updateRecords(d => { d.challenges[id] = true; });
  return { id, won };
}

// arranque común de las partidas contra la máquina de estos modos
function launchVs() {
  refreshGivePlayer();
  updateMenuBtn();
  musicScene('game', { newGame: true });
  showScreen('game');
  saveGame();
  aiStart(900);
}

/* =============== etiqueta del modo en la barra de la partida =============== */
const mmss = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
export function modeChipText() {
  const r = app.run;
  switch (app.variant) {
    case 'daily': return `${t('modes.daily.title')} · ${new Date().toLocaleDateString(locale(), { day: 'numeric', month: 'short' })}`;
    case 'rush': return `${t('modes.holeN', { n: r.hole + 1, total: r.total })} · ${mmss(r.elapsed || 0)} · ${t('modes.rush.pts', { n: (r.scores || []).reduce((a, b) => a + b, 0) })}`;
    case 'tour': return `${t('modes.tour.title')} · ${t('modes.holeN', { n: r.hole + 1, total: r.total })}`;
    case 'challenge': return t('challenges.' + r.id + '.name');
    case 'puzzle': return t('story.puzzleChip');
  }
  return '';
}
// reloj del contrarreloj: cuenta solo con la partida a la vista, sin pausa y sin terminar
let lastTick = 0;
setInterval(() => {
  const now = Date.now(), dt = lastTick ? (now - lastTick) / 1000 : 0;
  lastTick = now;
  if (app.variant !== 'rush' || !app.run || app.screen !== 'game' || app.paused || !app.game || app.game.S.winner !== null) return;
  app.run.elapsed = (app.run.elapsed || 0) + dt;
  const el = $('modeChip'); if (el) el.textContent = modeChipText();
}, 1000);

/* =============== pantalla =============== */
export function openModes() {
  hideWin();
  aiStop();
  const R = loadRecords(), date = dailyDate(), today = R.daily.days[date];
  const dsave = loadSave('daily'), rsave = loadSave('rush'), tsave = loadSave('tour'), csave = loadSave('challenge');
  const rush = store.get(RUSH_KEY), tour = store.get(TOUR_KEY);
  const btn = (act, label, main = true, extra = '') => `<button class="${main ? 'btn-primary' : 'btn-light'} btn-sm" data-mode="${act}" ${extra}>${esc(label)}</button>`;
  const stat = (icon, txt) => `<span class="mdStat"><svg class="i" aria-hidden="true"><use href="#${icon}"/></svg>${esc(txt)}</span>`;
  const dl = dailyLevel(date);
  const dailyCard = `<article class="modeCard daily">
      <div class="mdHead"><span class="mdIco"><svg class="i" aria-hidden="true"><use href="#i-calendar"/></svg></span><div><h3>${esc(t('modes.daily.title'))}</h3><small>${esc(new Date().toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long' }))}</small></div></div>
      <div class="mdPreview">${levelPreviewSVG(dl)}</div>
      <p>${esc(t('modes.daily.sub'))}</p>
      <div class="mdStats">${stat('i-trophy', today?.best ? t('modes.daily.bestToday', { turns: turnsLabel(today.best) }) : t('modes.daily.notYet'))}${stat('i-flag', streakLabel(R.daily.last === date || R.daily.last === prevDayKey(date) ? R.daily.streak : 0))}</div>
      <div class="mdBtns">${dsave ? btn('resume:daily', t('menu.continue')) : btn('daily', today?.best ? t('modes.again') : t('modes.play'))}</div></article>`;
  const rushCard = `<article class="modeCard rush">
      <div class="mdHead"><span class="mdIco"><svg class="i" aria-hidden="true"><use href="#i-timer"/></svg></span><div><h3>${esc(t('modes.rush.title'))}</h3><small>${esc(t('modes.rush.holes', { n: RUSH_HOLES }))}</small></div></div>
      <p>${esc(t('modes.rush.sub'))}</p>
      <div class="mdStats">${stat('i-trophy', t('modes.rush.best', { n: R.rush.best || 0 }))}${rush ? stat('i-flag', t('modes.holeN', { n: rush.hole + 1, total: rush.total })) : ''}</div>
      <div class="mdBtns">${rsave ? btn('resume:rush', t('menu.continue')) : rush ? btn('rush', t('modes.rush.continue', { n: rush.hole + 1 })) + btn('rushNew', t('modes.restartRun'), false) : btn('rushNew', t('modes.play'))}</div></article>`;
  const standings = tour ? `<div class="mdTable">${Object.entries(tour.points).sort((a, b) => b[1] - a[1]).map(([id, v]) =>
    `<span class="${id === 'me' ? 'me' : ''}">${esc(tourName(id))} <b>${v}</b></span>`).join('')}</div>` : '';
  const tourCard = `<article class="modeCard tour">
      <div class="mdHead"><span class="mdIco"><svg class="i" aria-hidden="true"><use href="#i-trophy"/></svg></span><div><h3>${esc(t('modes.tour.title'))}</h3><small>${esc(t('modes.tour.holes', { n: TOUR_HOLES }))}</small></div></div>
      <p>${esc(t('modes.tour.sub'))}</p>
      ${tour ? standings + `<div class="mdStats">${stat('i-flag', t('modes.holeN', { n: tour.hole + 1, total: tour.total }))}</div>` :
        `<div class="mdCfg"><span>${esc(t('modes.tour.rivals'))}</span><span class="segBtns">${[1, 2, 3].map(n => `<button class="btn-sm" data-tour-opps="${n}" aria-pressed="${tourCfg.opps === n}">${n}</button>`).join('')}</span></div>
         <div class="mdCfg"><span>${esc(t('pve.diff'))}</span><span class="segBtns">${['easy', 'normal', 'hard'].map(d => `<button class="btn-sm" data-tour-diff="${d}" aria-pressed="${tourCfg.diff === d}">${esc(t('pve.diff' + d[0].toUpperCase() + d.slice(1)))}</button>`).join('')}</span></div>`}
      <div class="mdStats">${stat('i-trophy', t('modes.tour.titles', { n: R.tour.champion }))}</div>
      <div class="mdBtns">${tsave ? btn('resume:tour', t('menu.continue')) : tour ? btn('tour', t('modes.tour.continue', { n: tour.hole + 1 })) + btn('tourNew', t('modes.restartRun'), false) : btn('tourNew', t('modes.tour.start'))}</div></article>`;
  const chCards = CHALLENGES.map(ch => {
    const done = R.challenges[ch.id];
    return `<article class="chCard${done ? ' done' : ''}"><span class="mdIco"><svg class="i" aria-hidden="true"><use href="#${ch.icon}"/></svg></span>` +
      `<div class="chTxt"><b>${esc(t('challenges.' + ch.id + '.name'))}</b><small>${esc(t('challenges.' + ch.id + '.desc'))}</small></div>` +
      (done ? `<span class="chDone"><svg class="i" aria-hidden="true"><use href="#i-check"/></svg></span>` : '') +
      (csave?.run?.id === ch.id ? btn('resume:challenge', t('menu.continue')) : btn('ch:' + ch.id, t('modes.play'), !done)) + `</article>`;
  }).join('');
  const nDone = CHALLENGES.filter(c => R.challenges[c.id]).length;
  $('modesGrid').innerHTML =
    `<section class="mdSection"><h3>${esc(t('modes.soloH'))}</h3><div class="mdRow">${dailyCard}${rushCard}</div></section>` +
    `<section class="mdSection"><h3>${esc(t('modes.vsH'))}</h3><div class="mdRow">${tourCard}</div></section>` +
    `<section class="mdSection"><h3>${esc(t('modes.challengesH'))} <span class="lvlCount">${nDone}/${CHALLENGES.length}</span></h3><div class="chGrid">${chCards}</div></section>`;
  showScreen('modes');
}
function prevDayKey(date) {
  const [y, m, d] = date.split('-').map(Number);
  return dateKey(new Date(y, m - 1, d - 1));
}
// hay reto diario sin jugar hoy (punto en el botón del menú)
export const dailyPending = () => !loadRecords().daily.days[dailyDate()]?.best;

export function bindModes() {
  $('modesBtn').addEventListener('click', openModes);
  $('modesBack').addEventListener('click', () => showScreen('menu'));
  $('modesGrid').addEventListener('click', e => {
    const o = e.target.closest('[data-tour-opps]'), d = e.target.closest('[data-tour-diff]');
    if (o) { tourCfg.opps = +o.dataset.tourOpps; openModes(); return; }
    if (d) { tourCfg.diff = d.dataset.tourDiff; openModes(); return; }
    const b = e.target.closest('[data-mode]');
    if (!b) return;
    const [act, arg] = b.dataset.mode.split(':');
    switch (act) {
      case 'resume': resumeGame(arg); break;
      case 'daily': startDaily(); break;
      case 'rush': startRush(false); break;
      case 'rushNew': startRush(true); break;
      case 'tour': startTour(false); break;
      case 'tourNew': startTour(true); break;
      case 'ch': startChallenge(arg); break;
    }
  });
  MODE_NAV.daily = { back: openModes, restart: () => { clearSave('daily'); const date = dailyDate(); startLevel(dailyLevel(date), 'story', null, { variant: 'daily', run: { date }, seed: seedOf('deck:' + date) }); } };
  MODE_NAV.rush = { back: openModes, restart: () => { store.set(RUSH_KEY, null); recordStart('rush'); startRushHole(newRush()); } };
  MODE_NAV.tour = { back: openModes, restart: () => startTourHole(app.run) }; // repite el hoyo (la serie sigue)
  MODE_NAV.challenge = { back: openModes, restart: () => startChallenge(app.run?.id) };
}
export { store as modeStore, RUSH_KEY, TOUR_KEY };
