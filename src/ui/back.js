// Botón / gesto de "atrás" del sistema (Android, navegador): en lugar de salir del juego,
// cierra el panel que esté abierto o vuelve a la pantalla anterior. En el menú, sin nada
// abierto, atrás sale como siempre.
//
// Funciona con una única entrada "de guarda" en el historial: mientras se está fuera del
// menú (o con un panel abierto) hay una; al pulsar atrás el navegador la consume, se
// gestiona la vuelta y, si sigue habiendo a dónde volver, se repone.
import { app } from './app.js';
import { $ } from './dom.js';

let guarded = false, ignore = 0;

export function ensureGuard() {
  if (guarded) return;
  try { history.pushState({ cg: 1 }, ''); guarded = true; } catch (e) { /* sin historial (file://) */ }
}
// al cambiar de pantalla: fuera del menú hace falta la guarda; al volver al menú se retira
export function historyScreen(s) {
  if (s !== 'menu') ensureGuard();
  else if (guarded && !overlayOpen()) { guarded = false; ignore++; history.back(); }
}

// paneles que atrás cierra, del más alto al más bajo: [¿abierto?, cerrar]
const OVERLAYS = [
  [() => document.querySelector('dialog[open]'), () => document.querySelector('dialog[open]').close('cancel')],
  [() => $('rulesOverlay').classList.contains('visible'), () => $('rulesOverlay').querySelector('[data-rules="close"]').click()],
  [() => $('settingsOverlay').classList.contains('visible'), () => $('setBox').querySelector('[data-set-act="close"]').click()],
  [() => $('pauseOverlay').classList.contains('visible'), () => $('pauseOverlay').querySelector('[data-pause="resume"]').click()],
  [() => $('logPanel').classList.contains('open'), () => $('logPanel').classList.remove('open')],
  [() => $('sndPanel').classList.contains('open'), () => $('sndPanel').classList.remove('open')],
  [() => $('deckPop').classList.contains('open'), () => $('deckPop').classList.remove('open')],
  [() => $('debugPanel').classList.contains('visible'), () => $('debugPanel').classList.remove('visible')],
];
const overlayOpen = () => OVERLAYS.some(([open]) => open());

function goBack() {
  for (const [open, close] of OVERLAYS) if (open()) { close(); return; }
  if ($('passScreen').classList.contains('visible')) return; // pasando el dispositivo: no se sale
  switch (app.screen) {
    case 'game':
      if ($('winOverlay').classList.contains('visible')) { ($('winBtns').querySelector('[data-act="menu"], [data-act="levels"], [data-act="editor"]') || $('menuBtn')).click(); return; }
      $('menuBtn').click(); return;              // guarda la partida y vuelve (menú, niveles o editor)
    case 'story': $('storyBack').click(); return;
    case 'pve': $('pveBack').click(); return;
    case 'editor': $('edMenu').click(); return;
  }
}

export function bindBack() {
  window.addEventListener('popstate', () => {
    if (ignore) { ignore--; return; }
    guarded = false;
    goBack();
    if (app.screen !== 'menu' || overlayOpen()) ensureGuard();
  });
}
