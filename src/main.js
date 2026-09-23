/* =========================================================
   Chaotic Golf — mesa digital del juego de cartas.
   Punto de entrada: textos, listeners, arte, niveles y primera partida.

   Mapa del código:
     engine/   reglas puras (Game) + RNG con semilla        → tests/engine.*
     content/  cartas, losetas y niveles (datos + comportamiento)
     ai/       decisiones de los bots (simulan jugadas con el motor)
     ui/       pantallas, tablero, manos, HUD, editor, orquestador de la IA
     fx/       partículas, efectos y constantes de "juice"
     audio/    efectos de sonido y música generativa
     i18n/     textos
   ========================================================= */
import { app } from './ui/app.js';
import { $ } from './ui/dom.js';
import { applyStaticTexts } from './i18n/index.js';
import { loadArt } from './art.js';
import { loadStoryLevels } from './content/levels/index.js';
import { bindBoard } from './ui/board.js';
import { bindHands } from './ui/hands.js';
import { bindWin } from './ui/win.js';
import { bindDialog } from './ui/dialog.js';
import { bindScreens, showScreen, newFreeGame, applyArtExtras } from './ui/screens.js';
import { bindEditor, fitEditorBoard, edRender, ED, openEditor } from './ui/editor.js';
import { bindDebug, buildDebugPanel } from './ui/debug.js';
import { bindSoundPanel } from './ui/sound-panel.js';
import * as ctl from './ui/controller.js';
import { updateEndTurnHint } from './ui/hud.js';
import { fxArmIdle, fxAmbientStart } from './fx/effects.js';
import { clearPieces } from './ui/board.js';

applyStaticTexts();

// listeners (un único sitio; nada de onclick en el HTML)
bindBoard(ctl.clickCell);
bindHands();
bindWin();
bindDialog();
bindScreens();
bindEditor();
bindDebug();
bindSoundPanel();
$('editorBtn').addEventListener('click', openEditor);
$('endTurnBtn').addEventListener('click', ctl.endTurn);
$('discardBtn').addEventListener('click', ctl.startDiscard);
$('jaque').addEventListener('click', e => { if (e.target.closest('[data-act="confirmWin"]')) ctl.confirmWin(); });
$('logTab').addEventListener('click', () => $('logPanel').classList.toggle('open'));
$('deckInfo').addEventListener('click', () => $('deckPop').classList.toggle('open'));
$('deckInfo').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('deckPop').classList.toggle('open'); } });
window.addEventListener('pointerdown', fxArmIdle);
window.addEventListener('keydown', fxArmIdle);
window.addEventListener('resize', () => {
  if (app.screen === 'editor' && ED.level) { fitEditorBoard(); edRender(); return; }
  if (app.game) { ctl.fitBoard(); if (!app.animating) ctl.render(); }
});
// Escape cierra paneles flotantes / cancela la acción en curso
window.addEventListener('keydown', e => {
  if (e.key !== 'Escape' || document.querySelector('dialog[open]')) return;
  for (const [id, cls] of [['deckPop', 'open'], ['sndPanel', 'open'], ['logPanel', 'open'], ['debugPanel', 'visible']]) {
    if ($(id).classList.contains(cls)) { $(id).classList.remove(cls); return; }
  }
  if (app.screen === 'game' && app.game?.pending && !app.ai.acting) ctl.cancel();
});
setInterval(updateEndTurnHint, 500);
fxAmbientStart();

buildDebugPanel();

// arranque: niveles de historia + partida libre de fondo (testing tool) + arte
(async () => {
  try { app.storyLevels = await loadStoryLevels(); }
  catch (e) { console.error('No se pudieron cargar los niveles de historia', e); }
  newFreeGame();
  showScreen('menu');
  await loadArt();
  // el arte que exista sustituye a los fallbacks: reconstruir piezas y re-renderizar
  clearPieces();
  applyArtExtras();
  ctl.render();
})();

// PWA: jugar sin conexión (solo en http/https)
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

// gancho de depuración para la consola y las pruebas de humo (tools/smoke.mjs)
window.chaoticGolf = { app, ctl };
