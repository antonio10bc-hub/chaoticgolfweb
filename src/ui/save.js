// Guardado automático de la partida en curso: uno por modo (Modo Historia y Partida rápida),
// así empezar una partida rápida no pisa el nivel de historia a medias y viceversa.
// Se guarda tras cada jugada, al salir al menú y al ocultar la página; se borra al terminar.
// El menú ofrece "Continuar partida" con la más reciente; cada pantalla, la suya.
import { app } from './app.js';
import { stats, setStats } from './controller.js';

const KEY = mode => 'chaoticgolf_save_' + mode;
const OLD_KEY = 'chaoticgolf_save'; // formato anterior: un único guardado
const VERSION = 1;
export const SAVED_MODES = ['story', 'pve'];

const finished = S => S.winner !== null && !S.jaque;

export function saveGame() {
  const g = app.game;
  if (!g || !SAVED_MODES.includes(app.mode)) return;
  if (finished(g.S)) { clearSave(app.mode); return; } // partida terminada: nada que continuar
  const data = {
    version: VERSION, savedAt: Date.now(),
    mode: app.mode, levelIndex: app.levelIndex, level: app.level,
    pveCfg: app.lastPveCfg, lastActor: app.lastActor, stats, viewer: app.viewer,
    game: g.serialize(),
  };
  try { localStorage.setItem(KEY(app.mode), JSON.stringify(data)); } catch (e) { /* sin storage o lleno */ }
}

function migrate() {
  try {
    const raw = localStorage.getItem(OLD_KEY);
    if (!raw) return;
    const d = JSON.parse(raw);
    if (d && SAVED_MODES.includes(d.mode) && !localStorage.getItem(KEY(d.mode))) localStorage.setItem(KEY(d.mode), raw);
    localStorage.removeItem(OLD_KEY);
  } catch (e) { /* sin storage */ }
}

// guardado de un modo (válido y sin terminar) o null
export function loadSave(mode) {
  migrate();
  try {
    const d = JSON.parse(localStorage.getItem(KEY(mode)));
    if (!d || d.version !== VERSION || d.mode !== mode || !d.game?.S || finished(d.game.S)) return null;
    return d;
  } catch (e) { return null; }
}
// el guardado más reciente de cualquier modo (para "Continuar partida" del menú)
export function latestSave() {
  let best = null;
  for (const m of SAVED_MODES) { const d = loadSave(m); if (d && (!best || d.savedAt > best.savedAt)) best = d; }
  return best;
}

export function clearSave(mode = app.mode) { try { localStorage.removeItem(KEY(mode)); } catch (e) { /* sin storage */ } }

// tras restaurar: estadísticas, quién jugó la última carta y quién tenía el dispositivo
export function applySaveExtras(d) {
  if (d.stats) setStats(d.stats);
  app.lastActor = d.lastActor ?? null;
  if (d.pveCfg) { app.lastPveCfg = { ...d.pveCfg }; app.pveCfg = { ...app.pveCfg, ...d.pveCfg }; }
}

// al ocultar o cerrar la pestaña, último guardado (por si la jugada estaba a medias)
export function bindSave() {
  document.addEventListener('visibilitychange', () => { if (document.hidden) saveGame(); });
  window.addEventListener('pagehide', saveGame);
}
