// Persistencia en localStorage con esquema versionado.
//   chaoticgolf_levels   { version: 1, levels: [nivel, …] }   (antes: un array suelto → se migra)
//   chaoticgolf_progress { "<índice de historia>": true }
//   chaoticgolf_sound    { muted, sfx, mus, on }
export const LEVELS_VERSION = 1;
const LS_LEVELS = 'chaoticgolf_levels';
const LS_PROGRESS = 'chaoticgolf_progress';
const LS_SOUND = 'chaoticgolf_sound';

function read(key, fallback) {
  try { const v = JSON.parse(localStorage.getItem(key)); return v ?? fallback; } catch (e) { return fallback; }
}
function write(key, v) {
  try { localStorage.setItem(key, JSON.stringify(v)); return true; } catch (e) { return false; }
}

// acepta cualquier formato conocido (array antiguo o documento versionado) y devuelve la lista
export function normalizeLevels(data) {
  if (Array.isArray(data)) return data.map(migrateLevel);                 // formato previo a la v1
  if (data && Array.isArray(data.levels)) return data.levels.map(migrateLevel);
  return null;
}
export function migrateLevel(L) {
  const out = { version: LEVELS_VERSION, ...L };
  out.tiles = out.tiles || [];
  out.parCells = out.parCells || [];
  out.deckCounts = out.deckCounts || {};
  return out;
}
export const isValidLevel = L => !!(L && Number.isInteger(L.cols) && Number.isInteger(L.rows) &&
  L.hole && L.ball && Array.isArray(L.tiles) && Array.isArray(L.parCells) && L.deckCounts);

export const loadLevels = () => normalizeLevels(read(LS_LEVELS, [])) || [];
export const saveLevels = levels => write(LS_LEVELS, { version: LEVELS_VERSION, levels });

export const loadProgress = () => read(LS_PROGRESS, {}) || {};
export const saveProgress = p => write(LS_PROGRESS, p);

export const loadSound = () => read(LS_SOUND, null);
export const saveSound = s => write(LS_SOUND, s);
