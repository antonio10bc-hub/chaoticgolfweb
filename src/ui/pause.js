// Pausa real de la partida: la máquina y sus temporizadores se quedan quietos (también la
// cuenta atrás del JAQUE, que vuelve a empezar al reanudar). Abrir Ajustes o las reglas
// durante la partida también pausa, y al cerrarlos se reanuda sola.
import { app } from './app.js';
import { $ } from './dom.js';
import { aiKick } from './ai-driver.js';
import { ensureGuard } from './back.js';
import * as ctl from './controller.js';
import { sfx } from '../audio/sfx.js';

// motivo de la pausa: 'user' (botón / tecla P) o el panel que la abrió ('settings', 'rules')
export function pauseGame(reason = 'user') {
  if (app.screen !== 'game' || !app.game) return;
  const S = app.game.S;
  if (S.winner !== null && !S.jaque) return; // partida terminada: nada que parar
  if (app.paused) { if (reason === 'user' && app.paused !== 'user') { app.paused = 'user'; show(); } return; }
  app.paused = reason;
  document.documentElement.classList.add('paused');
  if (reason === 'user') show();
  ensureGuard();
}
function show() {
  $('pauseOverlay').classList.add('visible');
  $('pauseOverlay').querySelector('[data-pause="resume"]')?.focus({ preventScroll: true });
  sfx('select');
}

// reanuda; si se pasa un motivo, solo si la pausa era por ese motivo (cerrar Ajustes no quita una pausa del jugador)
export function resumePlay(reason, { kick = true } = {}) {
  if (!app.paused || (reason && app.paused !== reason)) return;
  clearPause();
  app.jaqueTimer = null; // la ventana de reacción del JAQUE vuelve a contar entera
  if (kick && app.game) { ctl.renderJaque(); aiKick(); }
}
// quita la pausa sin reanudar nada (al salir de la partida o empezar otra)
export function clearPause() {
  app.paused = false;
  document.documentElement.classList.remove('paused');
  $('pauseOverlay')?.classList.remove('visible');
}
export const isPausedByUser = () => app.paused === 'user';

export function bindPause() {
  $('pauseBtn').addEventListener('click', () => pauseGame('user'));
  $('pauseOverlay').addEventListener('click', e => {
    const b = e.target.closest('[data-pause]');
    if (!b) return;
    switch (b.dataset.pause) {
      case 'resume': resumePlay(); break;
      case 'rules': $('rulesBtn').click(); break;
      case 'settings': $('sndCfgBtn').click(); break;
      case 'log': resumePlay(); $('logPanel').classList.add('open'); break;
      case 'menu': clearPause(); $('menuBtn').click(); break;
    }
  });
  // al ocultar la pestaña (cambiar de app en el móvil) la partida se pausa sola
  document.addEventListener('visibilitychange', () => { if (document.hidden && app.screen === 'game' && app.mode === 'pve') pauseGame('user'); });
}
