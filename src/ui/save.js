// Guardado automático de la partida en curso (Modo Historia y Partida rápida).
// Se guarda tras cada jugada y al ocultar la página; se borra al terminar la partida.
// El menú ofrece "Continuar partida" si hay una guardada.
import { app } from './app.js';
import { stats, setStats } from './controller.js';

const KEY = 'chaoticgolf_save';
const VERSION = 1;
const SAVED_MODES = ['story', 'pve'];

export function saveGame() {
  const g = app.game;
  if (!g || !SAVED_MODES.includes(app.mode)) return;
  if (g.S.winner !== null && !g.S.jaque) { clearSave(); return; } // partida terminada: nada que continuar
  const data = {
    version: VERSION, savedAt: Date.now(),
    mode: app.mode, levelIndex: app.levelIndex, level: app.level,
    pveCfg: app.lastPveCfg, lastActor: app.lastActor, stats,
    game: g.serialize(),
  };
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* sin storage o lleno */ }
}

export function loadSave() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (!d || d.version !== VERSION || !SAVED_MODES.includes(d.mode) || !d.game?.S) return null;
    return d;
  } catch (e) { return null; }
}

export function clearSave() { try { localStorage.removeItem(KEY); } catch (e) { /* sin storage */ } }

// tras restaurar: estadísticas y quién jugó la última carta
export function applySaveExtras(d) {
  if (d.stats) setStats(d.stats);
  app.lastActor = d.lastActor ?? null;
  if (d.pveCfg) { app.lastPveCfg = { ...d.pveCfg }; app.pveCfg = { ...d.pveCfg }; }
}

// al ocultar o cerrar la pestaña, último guardado (por si la jugada estaba a medias)
export function bindSave() {
  document.addEventListener('visibilitychange', () => { if (document.hidden) saveGame(); });
  window.addEventListener('pagehide', saveGame);
}
