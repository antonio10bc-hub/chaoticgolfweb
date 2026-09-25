// Estadísticas globales del jugador (todas sus partidas en este dispositivo):
// partidas empezadas y ganadas por modo, totales de la mesa, el mejor resultado de cada nivel,
// la racha de partida rápida, el reto diario (récord del día y racha de días), el contrarreloj,
// los desafíos y puzles superados, el desafío semanal (récord de cada semana), el historial contra
// cada rival (y quién te gana más: tu némesis), partidas por día (evolución) y cartas más usadas.
import { t } from '../i18n/index.js';
import { dateKey } from '../content/levels/generate.js';

const KEY = 'chaoticgolf_stats';
const VERSION = 1;
// "1 turno" / "3 turnos"
export const turnsLabel = n => n === 1 ? t('stats.turn1') : t('stats.turnsShort', { n });
export const REC_MODES = ['story', 'puzzle', 'daily', 'rush', 'pve', 'local', 'challenge', 'weekly'];

const zeros = () => Object.fromEntries(REC_MODES.map(m => [m, 0]));
const blank = () => ({
  version: VERSION,
  played: zeros(), won: zeros(),
  totals: { golpes: 0, colisiones: 0, caidas: 0, portales: 0, hundidas: 0, turnos: 0 },
  levels: {},   // índice de Lo básico -> { turns, strokes, at }
  puzzles: {},  // índice de puzle -> true
  pve: { streak: 0, bestStreak: 0, fastest: null }, // partida rápida (1 persona): racha y victoria con menos turnos
  daily: { days: {}, streak: 0, bestStreak: 0, last: null }, // fecha -> { best, strokes }
  rush: { best: 0, runs: 0 },
  challenges: {}, // id -> true
  weekly: { weeks: {} },  // semana "AAAA-Www" -> { best, strokes }
  rivals: {},     // personaje -> { w, l, beat } (tus victorias y derrotas contra él; beat: veces que ganó él)
  history: {},    // fecha -> { p, w } (partidas terminadas y ganadas ese día)
  cards: {},      // carta -> veces que la has jugado
});

export function loadRecords() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (d && d.version === VERSION) {
      const b = blank();
      return { ...b, ...d, played: { ...b.played, ...d.played }, won: { ...b.won, ...d.won }, totals: { ...b.totals, ...d.totals },
        pve: { ...b.pve, ...d.pve }, daily: { ...b.daily, ...d.daily }, rush: { ...b.rush, ...d.rush },
        weekly: { ...b.weekly, ...d.weekly }, rivals: { ...d.rivals }, history: { ...d.history }, cards: { ...d.cards },
        puzzles: { ...d.puzzles }, challenges: { ...d.challenges } };
    }
  } catch (e) { /* sin storage o corrupto */ }
  return blank();
}
const saveRecords = d => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { /* sin storage */ } };
export const resetRecords = () => saveRecords(blank());
export const updateRecords = fn => { const d = loadRecords(); fn(d); saveRecords(d); return d; };

// una partida nueva (no al continuar una guardada)
export function recordStart(kind) {
  if (!REC_MODES.includes(kind)) return;
  updateRecords(d => { d.played[kind]++; });
}

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
    dl.streak = dl.last === prevDay(date) ? dl.streak + 1 : 1;
    dl.bestStreak = Math.max(dl.bestStreak, dl.streak);
    dl.last = date;
    dl.days[date] = dl.days[date] || { best: null, strokes: null };
    // solo se guardan los últimos 60 días
    const keys = Object.keys(dl.days).sort();
    while (keys.length > 60) delete dl.days[keys.shift()];
  }).daily;
}
export const dailyToday = date => loadRecords().daily.days[date] || null;

// fin de partida: suma los totales, la victoria y los récords del modo.
// Devuelve lo necesario para anunciarlo en el resumen final.
// rivals: [{ id, winner }] — los personajes de la mesa (con una persona contra la máquina)
export function recordEnd(kind, { won, stats, levelIndex = null, date = null, week = null, rivals = [] }) {
  if (!REC_MODES.includes(kind)) return {};
  const d = loadRecords();
  if (won) d.won[kind]++;
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
  let newBest = false, best = null;
  if (kind === 'story' && won && levelIndex != null && stats) {
    const prev = d.levels[levelIndex];
    newBest = !!prev && (turns < prev.turns || (turns === prev.turns && strokes < prev.strokes));
    if (!prev || newBest) d.levels[levelIndex] = { turns, strokes, at: Date.now() };
    best = d.levels[levelIndex];
  }
  if (kind === 'puzzle' && won && levelIndex != null) d.puzzles[levelIndex] = true;
  if (kind === 'daily' && won && date) {
    const day = d.daily.days[date] = d.daily.days[date] || { best: null, strokes: null };
    newBest = day.best != null && (turns < day.best || (turns === day.best && strokes < day.strokes));
    if (day.best == null || newBest) { day.best = turns; day.strokes = strokes; }
    best = { turns: day.best, strokes: day.strokes };
  }
  if (kind === 'weekly' && won && week) {
    const wk = d.weekly.weeks[week] = d.weekly.weeks[week] || { best: null, strokes: null };
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

// tu némesis: el personaje que más veces te ha ganado (al menos 2)
export function nemesisId(R = loadRecords()) {
  let best = null;
  for (const [id, r] of Object.entries(R.rivals)) if (r.beat >= 2 && (!best || r.beat > R.rivals[best].beat)) best = id;
  return best;
}
