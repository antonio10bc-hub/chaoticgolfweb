// Estadísticas globales del jugador (todas sus partidas en este dispositivo):
// partidas empezadas y ganadas por modo, totales de la mesa y el mejor resultado de
// cada nivel de historia (menos turnos; a igualdad, menos golpes).
import { t } from '../i18n/index.js';

const KEY = 'chaoticgolf_stats';
// "1 turno" / "3 turnos"
export const turnsLabel = n => n === 1 ? t('stats.turn1') : t('stats.turnsShort', { n });
const VERSION = 1;
export const REC_MODES = ['story', 'pve', 'local'];

const blank = () => ({
  version: VERSION,
  played: { story: 0, pve: 0, local: 0 },
  won: { story: 0, pve: 0, local: 0 },
  totals: { golpes: 0, colisiones: 0, caidas: 0, portales: 0, hundidas: 0, turnos: 0 },
  levels: {}, // índice de historia -> { turns, strokes, at }
  pve: { streak: 0, bestStreak: 0, fastest: null }, // partida rápida (1 persona): racha y victoria con menos turnos
});

export function loadRecords() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (d && d.version === VERSION) {
      const b = blank();
      return { ...b, ...d, played: { ...b.played, ...d.played }, won: { ...b.won, ...d.won }, totals: { ...b.totals, ...d.totals }, pve: { ...b.pve, ...d.pve } };
    }
  } catch (e) { /* sin storage o corrupto */ }
  return blank();
}
const saveRecords = d => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { /* sin storage */ } };
export const resetRecords = () => saveRecords(blank());

// una partida nueva (no al continuar una guardada)
export function recordStart(kind) {
  if (!REC_MODES.includes(kind)) return;
  const d = loadRecords();
  d.played[kind]++;
  saveRecords(d);
}

// fin de partida: suma los totales, la victoria y, en historia, el récord del nivel.
// Devuelve { newBest, best } para anunciarlo en el resumen final.
export function recordEnd(kind, { won, stats, levelIndex = null }) {
  if (!REC_MODES.includes(kind)) return {};
  const d = loadRecords();
  if (won) d.won[kind]++;
  if (stats) for (const k of Object.keys(d.totals)) d.totals[k] += stats[k] || 0;
  let newBest = false, best = null;
  if (kind === 'story' && won && levelIndex != null && stats) {
    const cur = { turns: (stats.turnos || 0) + 1, strokes: stats.golpes || 0, at: Date.now() };
    const prev = d.levels[levelIndex];
    newBest = !!prev && (cur.turns < prev.turns || (cur.turns === prev.turns && cur.strokes < prev.strokes));
    if (!prev || newBest) d.levels[levelIndex] = cur;
    best = d.levels[levelIndex];
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
  return { newBest, best, streak, newFastest, fastest: d.pve.fastest };
}
export const levelBest = i => loadRecords().levels[i] || null;
