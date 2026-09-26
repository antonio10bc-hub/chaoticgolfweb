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
import { applyStaticTexts, setLang, detectLang, saveLang, getLang } from './i18n/index.js';
import { bindSave } from './ui/save.js';
import { loadArt } from './art.js';
import { loadStoryLevels, loadPuzzleLevels } from './content/levels/index.js';
import { bindBoard } from './ui/board.js';
import { bindHands } from './ui/hands.js';
import { bindCardTip } from './ui/card-tip.js';
import { bindWin } from './ui/win.js';
import { bindDialog } from './ui/dialog.js';
import { bindScreens, showScreen, newFreeGame, applyArtExtras } from './ui/screens.js';
import { bindStory, openStory } from './ui/screen-story.js';
import { bindPve, openPveSetup } from './ui/screen-pve.js';
import { bindModes, openModes } from './ui/screen-modes.js';
import { bindAssist } from './ui/assist.js';
import { bindZoom } from './ui/board-zoom.js';
import { bindEditor, fitEditorBoard, edRender, ED, openEditor } from './ui/editor.js';
import { bindSoundPanel } from './ui/sound-panel.js';
import * as ctl from './ui/controller.js';
import { updateEndTurnHint, updateMenuBtn } from './ui/hud.js';
import { fxArmIdle, fxAmbientStart } from './fx/effects.js';
import { sfx } from './audio/sfx.js';
import { clearPieces } from './ui/board.js';
import { loadPrefs } from './ui/prefs.js';
import { bindSettings, repaintSettings } from './ui/settings.js';
import { bindTutorial } from './ui/tutorial.js';
import { bindHotseat } from './ui/hotseat.js';
import { bindPause, pauseGame, resumePlay } from './ui/pause.js';
import { bindRules, openRules, closeRules, rulesOpen } from './ui/rules.js';
import { bindBack } from './ui/back.js';
import { bindLogFilter } from './ui/hud.js';

// preferencias (velocidad, tema del campo, accesibilidad) antes de pintar nada
loadPrefs();
// idioma: el elegido; si no, español en España e inglés fuera (por zona horaria)
setLang(detectLang());
applyStaticTexts();
bindSave();

// listeners (un único sitio; nada de onclick en el HTML)
bindBoard(ctl.clickCell);
bindHands();
bindCardTip();
bindWin();
bindDialog();
bindScreens();
bindStory();
bindPve();
bindModes();
bindAssist();
bindZoom();
bindEditor();
bindSoundPanel();
bindSettings();
bindTutorial();
bindHotseat();
bindPause();
bindRules();
bindBack();
bindLogFilter();
$('editorBtn').addEventListener('click', openEditor);
$('endTurnBtn').addEventListener('click', ctl.endTurn);
$('discardBtn').addEventListener('click', ctl.startDiscard);
$('jaque').addEventListener('click', e => { if (e.target.closest('[data-act="confirmWin"]')) ctl.confirmWin(); });
$('logTab').addEventListener('click', () => $('logPanel').classList.toggle('open'));
$('logClose').addEventListener('click', () => $('logPanel').classList.remove('open'));
$('deckPile').addEventListener('click', () => $('deckPop').classList.toggle('open'));
$('deckPile').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('deckPop').classList.toggle('open'); } });
// atajos de partida: E = terminar turno, D = descartar
window.addEventListener('keydown', e => {
  if (app.screen !== 'game' || e.metaKey || e.ctrlKey || e.altKey || e.target.matches('input, textarea, select') || document.querySelector('dialog[open], #settingsOverlay.visible, #passScreen.visible')) return;
  const k = e.key.toLowerCase();
  // P = pausa / reanudar, H o ? = reglas
  if (k === 'p') { e.preventDefault(); if (app.paused === 'user') resumePlay(); else pauseGame('user'); return; }
  if (k === 'h' || e.key === '?') { e.preventDefault(); if (rulesOpen()) closeRules(); else openRules(); return; }
  if (app.paused) return;
  if (k === 'e' && !$('endTurnBtn').disabled) { e.preventDefault(); $('endTurnBtn').click(); }
  if (k === 'd' && !$('discardBtn').disabled) { e.preventDefault(); $('discardBtn').click(); }
  if (k === 'r' && app.game?.pending?.kind === 'placeTile') { e.preventDefault(); ctl.rotatePending(); } // girar la pieza a colocar
});
// sonido sutil en cualquier botón de interfaz
document.addEventListener('click', e => { if (e.target.closest('button:not(:disabled)')) sfx('click'); }, true);
window.addEventListener('pointerdown', fxArmIdle);
window.addEventListener('keydown', fxArmIdle);
// último gesto del jugador: el aviso de "puedes jugar…" espera a que lleve un rato quieto
const markInput = () => { app.lastInputAt = Date.now(); };
window.addEventListener('pointerdown', markInput, true);
window.addEventListener('keydown', markInput, true);
window.addEventListener('resize', () => {
  if (app.screen === 'editor' && ED.level) { fitEditorBoard(); edRender(); return; }
  if (app.game) { ctl.fitBoard(); if (!app.animating) ctl.render(); }
});
// Escape cierra paneles flotantes / cancela la acción en curso
window.addEventListener('keydown', e => {
  if (e.key !== 'Escape' || document.querySelector('dialog[open]')) return;
  if (rulesOpen()) { closeRules(); return; }
  if (app.paused === 'user') { resumePlay(); return; }
  for (const [id, cls] of [['deckPop', 'open'], ['logPanel', 'open']]) {
    if ($(id).classList.contains(cls)) { $(id).classList.remove(cls); return; }
  }
  if (app.screen === 'game' && app.game?.pending && !app.ai.acting) ctl.cancel();
});
setInterval(updateEndTurnHint, 500);
// cerrar o recargar la pestaña con una jugada a medias: el navegador pide confirmación
// (la partida se guarda igualmente, pero la jugada en curso se perdería)
window.addEventListener('beforeunload', e => {
  if (app.screen !== 'game' || !app.game || app.mode === 'free') return;
  if (app.animating || app.animQueue.length || app.game.pending || app.ai.acting) { e.preventDefault(); e.returnValue = ''; }
});

// cambio de idioma en vivo (panel de ajustes): textos fijos + la pantalla actual
function paintLangBtns() { document.querySelectorAll('[data-lang]').forEach(b => b.setAttribute('aria-pressed', b.dataset.lang === getLang())); }
document.addEventListener('click', e => {
  const b = e.target.closest('[data-lang]');
  if (!b || b.dataset.lang === getLang()) return;
  setLang(b.dataset.lang); saveLang(b.dataset.lang); paintLangBtns();
  applyStaticTexts();
  repaintSettings();
  if (app.game) { ctl.render(); }
  if (app.screen === 'story') openStory();
  else if (app.screen === 'pve') openPveSetup();
  else if (app.screen === 'modes') openModes();
  else if (app.screen === 'editor') openEditor();
  else showScreen(app.screen);
  updateMenuBtn();
});
paintLangBtns();
fxAmbientStart();


// arranque: niveles de historia + partida libre de fondo + arte
// (la pantalla de carga tapa el menú hasta que están los niveles, el arte y la tipografía)
(async () => {
  const t0 = performance.now();
  try { [app.storyLevels, app.puzzleLevels] = await Promise.all([loadStoryLevels(), loadPuzzleLevels()]); }
  catch (e) { console.error('No se pudieron cargar los niveles', e); }
  newFreeGame();
  showScreen('menu');
  await Promise.all([loadArt(), document.fonts?.ready.catch(() => {})]);
  // el arte que exista sustituye a los fallbacks: reconstruir piezas y re-renderizar
  clearPieces();
  applyArtExtras();
  ctl.render();
  // un mínimo breve para que no parpadee; luego se desvanece y el menú hace su entrada
  await new Promise(r => setTimeout(r, Math.max(0, 450 - (performance.now() - t0))));
  const ld = $('loadScreen');
  ld.classList.add('done');
  document.body.classList.remove('loading'); // ahora sí: la entrada animada del menú
  setTimeout(() => ld.remove(), 500);
})();

// PWA: jugar sin conexión (solo en http/https)
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

// gancho de depuración para la consola y las pruebas de humo (tools/smoke.mjs)
window.chaoticGolf = { app, ctl };
