// Guardado automático de la partida en curso: uno por modo ("ranura"), así empezar una partida
// de un modo no pisa la que tengas a medias en otro. Ranuras: story (Lo básico), puzzle, daily,
// rush (contrarreloj), pve (partida rápida) y challenge (desafío).
// Se guarda tras cada jugada, al salir al menú y al ocultar la página; se borra al terminar.
// El menú ofrece "Continuar partida" con la más reciente; cada pantalla, la suya.
import { app } from './app.js';
import { stats, setStats } from './controller.js';

const KEY = slot => 'chaoticgolf_save_' + slot;
const OLD_KEY = 'chaoticgolf_save'; // formato anterior: un único guardado
const VERSION = 1;
export const SLOTS = ['story', 'puzzle', 'daily', 'rush', 'pve', 'challenge'];
export const slotOf = (mode = app.mode, variant = app.variant) => variant || mode;
export const VS_SLOTS = ['pve', 'challenge']; // contra la máquina (al continuar arranca la IA)

const finished = S => S.winner !== null && !S.jaque;

export function saveGame() {
  const g = app.game, slot = slotOf();
  if (!g || !SLOTS.includes(slot)) return;
  if (finished(g.S)) { clearSave(slot); return; } // partida terminada: nada que continuar
  const data = {
    version: VERSION, savedAt: Date.now(), slot,
    mode: app.mode, variant: app.variant, run: app.run, levelIndex: app.levelIndex, level: app.level,
    pveCfg: app.lastPveCfg, lastActor: app.lastActor, stats, viewer: app.viewer,
    game: g.serialize(),
  };
  try { localStorage.setItem(KEY(slot), JSON.stringify(data)); } catch (e) { /* sin storage o lleno */ }
}

function migrate() {
  try {
    const raw = localStorage.getItem(OLD_KEY);
    if (!raw) return;
    const d = JSON.parse(raw);
    if (d && SLOTS.includes(d.mode) && !localStorage.getItem(KEY(d.mode))) localStorage.setItem(KEY(d.mode), raw);
    localStorage.removeItem(OLD_KEY);
  } catch (e) { /* sin storage */ }
}

// guardado de una ranura (válido y sin terminar) o null
export function loadSave(slot) {
  migrate();
  try {
    const d = JSON.parse(localStorage.getItem(KEY(slot)));
    if (!d || d.version !== VERSION || (d.slot || d.mode) !== slot || !d.game?.S || finished(d.game.S)) return null;
    return d;
  } catch (e) { return null; }
}
// el guardado más reciente de cualquier modo (para "Continuar partida" del menú)
export function latestSave() {
  let best = null;
  for (const s of SLOTS) { const d = loadSave(s); if (d && (!best || d.savedAt > best.savedAt)) best = d; }
  return best;
}

export function clearSave(slot = slotOf()) { try { localStorage.removeItem(KEY(slot)); } catch (e) { /* sin storage */ } }

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
