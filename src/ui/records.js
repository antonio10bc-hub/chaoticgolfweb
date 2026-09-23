// Estadísticas globales del jugador (todas sus partidas en este dispositivo):
// partidas empezadas y ganadas por modo, totales de la mesa y el mejor resultado de
// cada nivel de historia (menos turnos; a igualdad, menos golpes).
const KEY = 'chaoticgolf_stats';
const VERSION = 1;
export const REC_MODES = ['story', 'pve', 'local'];

const blank = () => ({
  version: VERSION,
  played: { story: 0, pve: 0, local: 0 },
  won: { story: 0, pve: 0, local: 0 },
  totals: { golpes: 0, colisiones: 0, caidas: 0, portales: 0, hundidas: 0, turnos: 0 },
  levels: {}, // índice de historia -> { turns, strokes, at }
});

export function loadRecords() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (d && d.version === VERSION) {
      const b = blank();
      return { ...b, ...d, played: { ...b.played, ...d.played }, won: { ...b.won, ...d.won }, totals: { ...b.totals, ...d.totals } };
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
  saveRecords(d);
  return { newBest, best };
}
export const levelBest = i => loadRecords().levels[i] || null;
