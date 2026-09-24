// Navegación entre pantallas y lo común a todos los modos: salir de una partida (guardándola),
// reiniciarla, sustituir un guardado y el modo libre (testing tool). Cada modo vive en su módulo:
//   screen-story.js  Lo básico y puzles       screen-pve.js    Partida rápida
//   screen-modes.js  Reto diario, contrarreloj, torneo y desafíos
//   resume.js        continuar partidas guardadas
import { app } from './app.js';
import { $ } from './dom.js';
import { Game } from '../engine/game.js';
import { ART } from '../art.js';
import { startGame, fitBoard, render } from './controller.js';
import { hideWin } from './win.js';
import { aiStop } from './ai-driver.js';
import { readDebugSettings, refreshGivePlayer } from './debug.js';
import { fitEditorBoard, edRender, ED } from './editor.js';
import { updateMenuBtn, toast } from './hud.js';
import { t, getLang } from '../i18n/index.js';
import { confirmDialog } from './dialog.js';
import { saveGame, loadSave, clearSave, slotOf } from './save.js';
import { musicScene } from '../audio/sfx.js';
import { REDUCED } from '../fx/juice.js';
import { tutorialStop } from './tutorial.js';
import { syncWakeLock } from './wake.js';
import { historyScreen } from './back.js';
import { clearPause } from './pause.js';
import { resetZoom } from './board-zoom.js';
import { clearBubbles } from './persona.js';
import { setCourseSlot } from './prefs.js';
import { renderDailyCard, paintRushTimer } from './screen-modes.js';

// qué hacen "← Volver" y "Reiniciar" en cada modo (lo rellena cada módulo de pantalla)
//   MODE_NAV[ranura] = { back(), restart() }
export const MODE_NAV = {};

// nombre de un nivel en el idioma activo (name_en, …) o el original
export const levelName = L => (L && (L['name_' + getLang()] || L.name)) || '';

// ¿el usuario navega con teclado? (entonces al cambiar de pantalla se enfoca su primer control)
let usingKeyboard = false;
window.addEventListener('keydown', e => { if (e.key === 'Tab' || e.key.startsWith('Arrow') || e.key === 'Enter') usingKeyboard = true; }, true);
window.addEventListener('pointerdown', () => { usingKeyboard = false; }, true);

const DISPLAY = { menu: 'flex', game: 'block', editor: 'block', story: 'flex', pve: 'flex', modes: 'flex' };

export function showScreen(s) {
  const prev = app.screen;
  app.screen = s;
  // transición: la pantalla que entra aparece con un fundido suave (salvo movimiento reducido)
  const el = $(s + 'Screen');
  if (prev !== s && el && !REDUCED) { el.classList.remove('screenIn'); void el.offsetWidth; el.classList.add('screenIn'); }
  setCourseSlot(s === 'game' ? app.variant : null); // cada modo con su color de campo
  musicScene(s === 'game' ? 'game' : 'menu'); // la música acompaña: menú ↔ partida con fundido cruzado
  if (s !== 'game') { tutorialStop(); clearBubbles(); } // ni tutorial ni bocadillos de los bots fuera de la partida
  document.body.dataset.screen = s; // los estilos recolocan controles globales (sonido) por pantalla
  for (const id of Object.keys(DISPLAY)) $(id + 'Screen').style.display = id === s ? DISPLAY[id] : 'none';
  $('logPanel').style.display = s === 'game' ? 'flex' : 'none';   // el historial solo vive en la partida
  if (s === 'game' && app.game) { resetZoom(); fitBoard(); render(); } // recalcular tamaños al hacerse visible
  paintRushTimer();   // la cuenta atrás del contrarreloj (y el tinte rojo) solo en su partida
  if (s === 'editor' && ED.level) { fitEditorBoard(); edRender(); }
  if (s === 'menu') renderDailyCard();
  syncWakeLock();     // en partida, la pantalla no se apaga (móvil)
  historyScreen(s);   // botón / gesto de atrás del sistema
  if (!usingKeyboard) return; // con ratón no se mueve el foco (evita anillos de foco inesperados)
  const focusTarget = { menu: '.mBtn', story: '.lvlCard', pve: '#pvePlay', modes: '.modeCard button', editor: '#edTools button', game: '#hands .card[data-p]' }[s];
  requestAnimationFrame(() => document.querySelector(`#${s}Screen ${focusTarget}`)?.focus({ preventScroll: true }));
}

/* ---------- modo libre (partida del panel de debug) ---------- */
export function newFreeGame() {
  const cfg = readDebugSettings();
  startGame(Game.free(cfg, { seed: cfg.seed }), 'free');
  refreshGivePlayer();
  updateMenuBtn();
  fitBoard();
  render();
}

export function backToEditor() {
  hideWin();
  showScreen('editor');
}
export function leaveToMenu() { // salir al menú desde el popup final (partida ya terminada)
  discardGame();
  showScreen('menu');
}

/* ---------- salir / reiniciar / sustituir partida ---------- */
const gameInProgress = () => { const S = app.game?.S; return !!S && !(S.winner !== null && !S.jaque); };

// reiniciar pide confirmación si hay una partida a medias (se perderá). true = seguir adelante
async function confirmReset() {
  if (!gameInProgress()) return true;
  return confirmDialog(t('game.confirmReset'), t('game.resetShort'), true, t('game.confirmTitle'));
}

// empezar una partida nueva sustituye a la guardada de ese modo: se avisa antes. true = seguir adelante
export async function confirmReplaceSave(slot) {
  if (!loadSave(slot)) return true;
  return confirmDialog(t('save.confirmReplace'), t('save.replaceOk'), true, t('save.title'));
}

// detiene todo lo que corre en segundo plano (IA, temporizadores, cartas en pantalla)
function stopGameActivity() {
  aiStop();
  clearPause();
  hideWin();
  clearBubbles();
  document.querySelectorAll('.card.floating').forEach(el => el.remove());
  app.animQueue = []; app.animLead = 0;
}

// salir al menú con la partida a medias: queda guardada para "Continuar partida"
export function suspendGame() {
  saveGame();
  stopGameActivity();
  app.game = null;
}

// deja la partida realmente cerrada: sin IA, sin guardado y sin partida activa
export function discardGame() {
  stopGameActivity();
  if (app.game) clearSave(slotOf());
  app.game = null;
}

/* ---------- arte del menú ---------- */
export function applyArtExtras() {
  if (ART['menu.bg']) {
    $('menuScene').style.display = 'none';
    $('scene').style.background = `url(${ART['menu.bg']}) center / cover no-repeat`;
  }
  if (ART['menu.logo']) {
    const title = document.querySelector('.mTitle');
    title.innerHTML = `<img src="${ART['menu.logo']}" alt="Chaotic Golf" style="max-width:min(560px,86vw);height:auto">`;
    title.style.textShadow = 'none';
    title.style.webkitTextStroke = '0';
  }
}

/* ---------- listeners comunes ---------- */
export function bindScreens() {
  MODE_NAV.free = { back: () => showScreen('menu'), restart: newFreeGame };
  // "← Menú / Niveles / Modos": la partida se guarda y se vuelve a la pantalla de su modo
  $('menuBtn').addEventListener('click', () => {
    const slot = slotOf();
    suspendGame();
    (MODE_NAV[slot]?.back || (() => showScreen('menu')))();
  });
  $('resetBtn').addEventListener('click', async () => { // empezar de cero: el nivel, la partida o la serie en curso
    if (!await confirmReset()) return;
    const slot = slotOf();
    aiStop(); clearSave(slot); // la partida anterior deja de existir antes de crear la nueva
    document.querySelectorAll('.card.floating').forEach(el => el.remove());
    (MODE_NAV[slot]?.restart || newFreeGame)();
    toast(t('hud.restarted'));
  });
}
