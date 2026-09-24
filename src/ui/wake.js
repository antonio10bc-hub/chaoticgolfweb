// Pantalla siempre encendida durante la partida (Wake Lock), para que el móvil no se apague
// mientras juegan los bots. Se suelta fuera de la partida y se recupera al volver a la pestaña.
import { app } from './app.js';

let lock = null;
export async function syncWakeLock() {
  const want = app.screen === 'game' && !document.hidden;
  if (!('wakeLock' in navigator)) return;
  try {
    if (want && !lock) {
      lock = await navigator.wakeLock.request('screen');
      lock.addEventListener('release', () => { lock = null; });
    } else if (!want && lock) { await lock.release(); lock = null; }
  } catch (e) { lock = null; /* sin permiso o no soportado: no pasa nada */ }
}
document.addEventListener('visibilitychange', syncWakeLock);
