// Estadísticas globales del jugador (todas sus partidas en este dispositivo):
// partidas empezadas y ganadas por modo, totales de la mesa, el mejor resultado de cada nivel,
// la racha de partida rápida, el reto diario (récord del día y racha de días), el contrarreloj,
// los desafíos y los niveles de Lo básico superados, las coronas (desafíos de la semana ganados), el antiguo desafío
// semanal (récord de cada semana), el historial contra
// cada rival (y quién te gana más: tu némesis), partidas por día (evolución) y cartas más usadas.
import { t } from '../i18n/index.js';
import { dateKey } from '../content/levels/generate.js';
import { trackStart, trackEnd } from './analytics.js';
import { loadProgress, saveProgress } from '../storage.js';

const KEY = 'chaoticgolf_stats';
const VERSION = 1;
// "1 turno" / "3 turnos"
export const turnsLabel = n => n === 1 ? t('stats.turn1') : t('stats.turnsShort', { n });
export const REC_MODES = ['story', 'puzzle', 'daily', 'rush', 'pve', 'local', 'challenge', 'weekly'];
// totales de la mesa (todas las pelotas de todas tus partidas): de qué eventos del motor sale cada uno (on; ball: solo
// los de pelotas), que el controlador cuenta al jugarse (countTotals), y su icono en Estadísticas (el texto, stats.tot.<k>).
// Una mecánica nueva = una entrada aquí y su texto, o su evento en NOT_COUNTED: tests/stats.test.mjs comprueba que cada
// evento animado del controlador esté en un sitio o en el otro, y que no falten textos
export const TOTALS = [
  { k: 'golpes', icon: 'i-club' }, // (una por jugada que mueve algo: controller.js)
  { k: 'hundidas', icon: 'i-hole', on: ['sink'] },
  { k: 'colisiones', icon: 'i-burst', on: ['impact'] },
  { k: 'portales', icon: 'i-spiral', on: ['teleport'] },
  { k: 'caidas', icon: 'i-out', on: ['fall', 'splash', 'burn', 'eaten', 'goHome'] }, // (goHome: cruz o la ruleta, en el casino)
  { k: 'rio', icon: 'i-wave', on: ['drift'], ball: true },      // casillas que el río arrastra pelotas
  { k: 'lanzadas', icon: 'i-launch', on: ['launch'], ball: true },
  { k: 'tuneles', icon: 'i-tunnel', on: ['tunnel'] },
  { k: 'tren', icon: 'i-train', on: ['train'] },                // casillas que recorre el tren
  { k: 'nieve', icon: 'i-snow', on: ['snow'] },                 // casillas que rueda la bola de nieve
  { k: 'tragadas', icon: 'i-blackhole', on: ['absorb'] },       // pelotas y hoyos que se traga un agujero negro
  { k: 'meteoritos', icon: 'i-meteor', on: ['meteor'] },
  { k: 'monedas', icon: 'i-coin', on: ['coinFlip'] },           // monedas lanzadas (casino)
  { k: 'dados', icon: 'i-dice', on: ['diceRoll'] },             // veces que rueda un dado
  { k: 'ruletas', icon: 'i-roulette', on: ['roulette'] },       // vueltas de la ruleta
  { k: 'turnos', hidden: true },
];
// los eventos animados que no son un total (pasos, apariciones, efectos de otro evento ya contado…)
export const NOT_COUNTED = ['move', 'appear', 'settle', 'chainStop', 'bump', 'deflect', 'wagon', 'season', 'wind', 'gust', 'crunch',
  'puddle', 'slide', 'flare', 'grow', 'snowIn', 'snowOut', 'snowPack', 'clone', 'vanish', 'gravity', 'gpull', 'gstuck', 'clash', 'meteorRock',
  'coinPick', 'coinDrop', 'diceTurn', 'goldWin'];
const isBall = e => typeof e.p === 'string' && /^b\d/.test(e.p);
const COUNTED = TOTALS.filter(x => x.on);
// suma un evento del motor a los totales de la partida (stats del controlador)
export function countTotals(st, ev) { for (const x of COUNTED) if (x.on.includes(ev.t) && (!x.ball || isBall(ev))) st[x.k] = (st[x.k] || 0) + 1; }
const zeroTotals = () => Object.fromEntries(TOTALS.map(x => [x.k, 0]));

const zeros = () => Object.fromEntries(REC_MODES.map(m => [m, 0]));
const blank = () => ({
  version: VERSION,
  played: zeros(), won: zeros(),
  totals: zeroTotals(),
  levels: {},   // índice de tus niveles -> { turns, strokes, at }
  basics: {},   // id de nivel de Lo básico -> true (superado)
  puzzles: {},  // (antiguo: índice de puzle -> true; solo para pasarlo a Lo básico)
  pve: { streak: 0, bestStreak: 0, fastest: null }, // partida rápida (1 persona): racha y victoria con menos turnos
  daily: { days: {}, streak: 0, bestStreak: 0, last: null, goalSeen: null, // fecha -> { best, strokes }; goalSeen: día de la última meta celebrada
    played: 0, won: 0, dist: {} }, // días jugados y ganados, y en cuántos turnos (tu mejor de cada día): turnos -> días (sin límite de fechas)
  rush: { best: 0, runs: 0 }, // (done: series completas, las cinco; lo añade rushHoleDone)
  challenges: {}, // id -> true (ganado alguna vez)
  weekly: { weeks: {} },  // (el antiguo desafío semanal) semana "AAAA-Www" -> { best, strokes }
  crowns: { n: 0, weeks: {}, legacy: 0 }, // coronas: n (todas), weeks (semana -> ids ganados esa semana), legacy (las regaladas)
  rivals: {},     // personaje -> { w, l, beat } (tus victorias y derrotas contra él; beat: veces que ganó él)
  history: {},    // fecha -> { p, w } (partidas terminadas y ganadas ese día)
  cards: {},      // carta -> veces que la has jugado
  decks: {},      // baraja de la partida rápida -> { p: jugadas, w: victorias (tuyas o de alguna persona en local) }
  chStats: {},    // desafío -> { p: jugadas, w: victorias }
});
// antes de existir las coronas: una por cada desafío superado y por cada semana ganada del antiguo desafío semanal
function seedCrowns(d) {
  const n = Object.values(d.challenges || {}).filter(Boolean).length + Object.values(d.weekly?.weeks || {}).filter(w => w?.best != null).length;
  return { n, weeks: {}, legacy: n };
}
// antes de existir, de cada desafío solo se sabía si estaba superado: cuenta como 1 jugada y 1 victoria
const seedChStats = d => Object.fromEntries(Object.keys(d.challenges || {}).filter(k => d.challenges[k]).map(k => [k, { p: 1, w: 1 }]));
// antes de existir los contadores del reto diario, se sacan de los días guardados (los últimos 60) y de la mejor racha
function seedDaily(dl = {}) {
  const days = Object.values(dl.days || {}), dist = {};
  for (const d of days) if (d.best != null) dist[d.best] = (dist[d.best] || 0) + 1;
  return { played: Math.max(days.length, dl.bestStreak || 0), won: days.filter(d => d.best != null).length, dist };
}
// antes de existir, todas las partidas rápidas eran de la baraja clásica
const seedDecks = d => ({ classic: { p: (d.played?.pve || 0) + (d.played?.local || 0), w: (d.won?.pve || 0) + (d.won?.local || 0) } });

export function loadRecords() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (d && d.version === VERSION) {
      const b = blank();
      return { ...b, ...d, played: { ...b.played, ...d.played }, won: { ...b.won, ...d.won }, totals: { ...b.totals, ...d.totals },
        pve: { ...b.pve, ...d.pve }, daily: { ...b.daily, ...d.daily, ...(d.daily?.dist ? { dist: { ...d.daily.dist } } : seedDaily(d.daily)) }, rush: { ...b.rush, ...d.rush },
        weekly: { ...b.weekly, ...d.weekly }, rivals: { ...d.rivals }, history: { ...d.history }, cards: { ...d.cards },
        decks: d.decks ? { ...d.decks } : seedDecks(d),
        chStats: d.chStats ? { ...d.chStats } : seedChStats(d),
        crowns: d.crowns ? { ...b.crowns, ...d.crowns, weeks: { ...d.crowns.weeks } } : seedCrowns(d),
        basics: { ...d.basics }, puzzles: { ...d.puzzles }, challenges: { ...d.challenges } };
    }
  } catch (e) { /* sin storage o corrupto */ }
  return blank();
}
const saveRecords = d => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { /* sin storage */ } };
export const resetRecords = () => saveRecords(blank());
// cambios de los niveles integrados (época guardada en este dispositivo), una sola vez cada uno:
//   2  puzles y desafíos rediseñados: su progreso empieza de cero
//   3  Lo básico pasa a ser los niveles de un turno (por id): los puzles antiguos que siguen (`from: pNN`) cuentan como
//      superados, y tus niveles dejan de ir detrás de los 8 de antes (su progreso, récords y partida guardada se corren)
const LEVELS_EPOCH = 3, EPOCH_KEY = 'chaoticgolf_levelsEpoch', OLD_STORY = 8;
export function migrateLevelsOnce(basics = []) {
  try {
    const was = +(localStorage.getItem(EPOCH_KEY) || 0);
    if (was >= LEVELS_EPOCH) return;
    if (was < 2) {
      updateRecords(d => { d.puzzles = {}; d.challenges = {}; d.chStats = {}; });
      for (const slot of ['puzzle', 'challenge']) localStorage.removeItem('chaoticgolf_save_' + slot);
    }
    if (was < 3) {
      const shift = m => Object.fromEntries(Object.entries(m || {}).filter(([k]) => +k >= OLD_STORY).map(([k, v]) => [+k - OLD_STORY, v]));
      updateRecords(d => {
        for (const L of basics) { const m = /^p(\d+)$/.exec(L.from || ''); if (m && d.puzzles[+m[1] - 1]) d.basics[L.id] = true; }
        d.puzzles = {};
        d.levels = shift(d.levels);
      });
      saveProgress(shift(loadProgress()));
      localStorage.removeItem('chaoticgolf_save_puzzle'); // (un puzle antiguo a medias)
      const sv = JSON.parse(localStorage.getItem('chaoticgolf_save_story') || 'null');
      if (sv && (sv.levelIndex ?? -1) >= OLD_STORY) { sv.levelIndex -= OLD_STORY; localStorage.setItem('chaoticgolf_save_story', JSON.stringify(sv)); }
      else if (sv) localStorage.removeItem('chaoticgolf_save_story'); // (un nivel de los de antes, que ya no está)
    }
    localStorage.setItem(EPOCH_KEY, String(LEVELS_EPOCH));
  } catch (e) { /* sin storage */ }
}
export const updateRecords = fn => { const d = loadRecords(); fn(d); saveRecords(d); return d; };

// una partida nueva (no al continuar una guardada)
// sub: lo que tiene sus propias estadísticas — { deck } (baraja de la partida rápida),
// { challenge } (cada desafío) o { week } (el desafío semanal de esa semana)
export function recordStart(kind, { deck = null, challenge = null, week = null } = {}) {
  if (!REC_MODES.includes(kind)) return;
  trackStart(kind); // (analíticas: qué modos se juegan)
  updateRecords(d => {
    d.played[kind]++;
    const bump = (map, id) => { const k = map[id] = map[id] || { p: 0, w: 0 }; k.p = (k.p || 0) + 1; };
    if (deck) bump(d.decks, deck);
    if (challenge) bump(d.chStats, challenge);
    if (week) bump(d.weekly.weeks, week);
  });
}
export const deckStats = id => loadRecords().decks[id] || { p: 0, w: 0 };

// día anterior a una fecha "AAAA-MM-DD"
function prevDay(key) {
  const [y, m, dd] = key.split('-').map(Number);
  const d = new Date(y, m - 1, dd - 1), p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
// reto diario: jugar hoy cuenta para la racha de días seguidos
export function recordDailyPlayed(date) {
  return updateRecords(d => {
    const dl = d.daily;
    if (dl.last === date) return;
    // (congelada: los días sin jugar no la cortan)
    dl.streak = dl.last === prevDay(date) || (dl.frozen && dl.streak > 0) ? dl.streak + 1 : 1;
    dl.bestStreak = Math.max(dl.bestStreak, dl.streak);
    dl.last = date;
    if (!dl.days[date]) dl.played++;
    dl.days[date] = dl.days[date] || { best: null, strokes: null };
    // solo se guardan los últimos 60 días
    const keys = Object.keys(dl.days).sort();
    while (keys.length > 60) delete dl.days[keys.shift()];
  }).daily;
}
export const dailyToday = date => loadRecords().daily.days[date] || null;

// metas de la racha del reto diario (después de 365, cada 100 días)
const STREAK_GOALS = [3, 7, 15, 30, 50, 100, 150, 200, 365];
export const nextStreakGoal = n => STREAK_GOALS.find(g => g > n) ?? (Math.floor(n / 100) + 1) * 100;
export const isStreakGoal = n => STREAK_GOALS.includes(n) || (n > 365 && n % 100 === 0);
// la racha vista desde hoy: viva (jugada hoy o ayer), en peligro (aún no has jugado hoy) o apagada. Congelada
// (regalo de early tester), no se pierde aunque pasen días sin jugar
export function dailyStreakInfo(date, R = loadRecords()) {
  const dl = R.daily, frozen = !!dl.frozen && dl.streak > 0, alive = frozen || dl.last === date || dl.last === prevDay(date);
  return { n: alive ? dl.streak : 0, today: dl.last === date, atRisk: alive && !frozen && dl.last !== date && dl.streak > 0,
    lost: !alive && dl.streak >= 2 ? dl.streak : 0, ...(dl.frozen ? { frozen: true } : {}) };
}
// estadísticas del reto diario (la ventana de la tarjeta): días jugados, % ganados, racha actual y máxima, distribución
export function dailyStats(date, R = loadRecords()) {
  const dl = R.daily, played = Math.max(dl.played || 0, dl.won || 0);
  return { played, won: dl.won || 0, pct: played ? Math.round(100 * (dl.won || 0) / played) : 0,
    streak: dailyStreakInfo(date, R).n, best: dl.bestStreak || 0, dist: dl.dist || {}, today: dl.days[date]?.best ?? null };
}
export const streakFrozen = () => !!loadRecords().daily.frozen;
// congelar / descongelar la racha. Al descongelarla sigue viva hoy, como si el último reto fuera de ayer: hoy toca jugarlo
export function setStreakFrozen(on, date) {
  return updateRecords(d => {
    const dl = d.daily;
    if (on) { dl.frozen = { since: date }; return; }
    delete dl.frozen;
    if (dl.streak > 0 && dl.last && dl.last !== date && dl.last !== prevDay(date)) dl.last = prevDay(date);
  }).daily;
}
// ¿toca celebrar hoy una meta de la racha? (una sola vez por día, aunque se repita el reto)
export function claimStreakGoal(date) {
  let ok = false;
  updateRecords(d => {
    const dl = d.daily;
    if (dl.last !== date || !isStreakGoal(dl.streak) || dl.goalSeen === date) return;
    dl.goalSeen = date; ok = true;
  });
  return ok;
}

// fin de partida: suma los totales, la victoria y los récords del modo.
// Devuelve lo necesario para anunciarlo en el resumen final.
// rivals: [{ id, winner }] — los personajes de la mesa (con una persona contra la máquina)
export function recordEnd(kind, { won, stats, levelIndex = null, levelId = null, date = null, week = null, rivals = [], deck = null, challenge = null }) {
  if (!REC_MODES.includes(kind)) return {};
  const d = loadRecords();
  if (won) d.won[kind]++;
  const win = (map, id) => { const k = map[id] = map[id] || { p: 0, w: 0 }; k.w = (k.w || 0) + 1; };
  if (won && deck) win(d.decks, deck);
  if (won && challenge) win(d.chStats, challenge);
  if (won && kind === 'weekly' && week) win(d.weekly.weeks, week);
  if (stats) for (const k of Object.keys(d.totals)) d.totals[k] += stats[k] || 0;
  // evolución: partidas terminadas y ganadas por día (últimos 90 días)
  const today = dateKey(), h = d.history[today] = d.history[today] || { p: 0, w: 0 };
  h.p++; if (won) h.w++;
  const days = Object.keys(d.history).sort();
  while (days.length > 90) delete d.history[days.shift()];
  for (const [k, n] of Object.entries(stats?.cardsUsed || {})) d.cards[k] = (d.cards[k] || 0) + n;
  for (const r of rivals) {
    const rv = d.rivals[r.id] = d.rivals[r.id] || { w: 0, l: 0, beat: 0 };
    if (won) rv.w++; else rv.l++;
    if (r.winner) rv.beat++;
  }
  // reto diario y semanal contra bots: cuentan tus turnos, no los de toda la mesa
  const own = (kind === 'daily' || kind === 'weekly') && stats?.misTurnos;
  const turns = (own ? stats.misTurnos : stats?.turnos || 0) + 1, strokes = stats?.golpes || 0;
  trackEnd(kind, { won, turns }); // (analíticas: cómo acaban)
  let newBest = false, best = null;
  if (kind === 'story' && won && levelIndex != null && stats) {
    const prev = d.levels[levelIndex];
    newBest = !!prev && (turns < prev.turns || (turns === prev.turns && strokes < prev.strokes));
    if (!prev || newBest) d.levels[levelIndex] = { turns, strokes, at: Date.now() };
    best = d.levels[levelIndex];
  }
  if (kind === 'puzzle' && won && levelId) d.basics[levelId] = true; // (Lo básico: por el id del nivel)
  if (kind === 'daily' && won && date) {
    const day = d.daily.days[date] = d.daily.days[date] || { best: null, strokes: null };
    newBest = day.best != null && (turns < day.best || (turns === day.best && strokes < day.strokes));
    // la distribución cuenta tu mejor resultado de cada día (si lo mejoras, se mueve)
    const dist = d.daily.dist;
    if (day.best == null) d.daily.won++;
    else if (newBest && turns !== day.best && dist[day.best]) dist[day.best]--;
    if (day.best == null || (newBest && turns !== day.best)) dist[turns] = (dist[turns] || 0) + 1;
    if (day.best == null || newBest) { day.best = turns; day.strokes = strokes; }
    best = { turns: day.best, strokes: day.strokes };
  }
  if (kind === 'weekly' && won && week) {
    const wk = d.weekly.weeks[week] = { best: null, strokes: null, ...d.weekly.weeks[week] };
    newBest = wk.best != null && (turns < wk.best || (turns === wk.best && strokes < wk.strokes));
    if (wk.best == null || newBest) { wk.best = turns; wk.strokes = strokes; }
    best = { turns: wk.best, strokes: wk.strokes };
    const ks = Object.keys(d.weekly.weeks).sort();
    while (ks.length > 26) delete d.weekly.weeks[ks.shift()];
  }
  // partida rápida: racha de victorias seguidas y victoria más rápida (en turnos propios)
  let streak = 0, newFastest = false;
  if (kind === 'pve') {
    d.pve.streak = won ? d.pve.streak + 1 : 0;
    d.pve.bestStreak = Math.max(d.pve.bestStreak, d.pve.streak);
    streak = d.pve.streak;
    if (won && stats) {
      const mine = (stats.misTurnos || 0) + 1;
      newFastest = d.pve.fastest != null && mine < d.pve.fastest;
      if (d.pve.fastest == null || mine < d.pve.fastest) d.pve.fastest = mine;
    }
  }
  saveRecords(d);
  return { newBest, best, streak, newFastest, fastest: d.pve.fastest, dailyStreak: d.daily.streak };
}
export const levelBest = i => loadRecords().levels[i] || null;

// coronas: ganar un desafío de la semana (una vez por semana y desafío) suma una
export function winCrown(week, id) {
  let fresh = false;
  const d = updateRecords(d => {
    d.challenges[id] = true;
    const wk = d.crowns.weeks[week] = d.crowns.weeks[week] || [];
    if (wk.includes(id)) return;
    wk.push(id); d.crowns.n++; fresh = true;
  });
  return { fresh, n: d.crowns.n };
}
export const crownsOf = (week, R = loadRecords()) => R.crowns.weeks[week] || [];

// tu némesis: el personaje que más veces te ha ganado (al menos 2)
export function nemesisId(R = loadRecords()) {
  let best = null;
  for (const [id, r] of Object.entries(R.rivals)) if (r.beat >= 2 && (!best || r.beat > R.rivals[best].beat)) best = id;
  return best;
}
