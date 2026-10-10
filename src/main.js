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
import { takeComboLink } from './ui/ultimate.js';
import { maybeAnnounceDeck } from './ui/new-deck.js';
import { maybeShowGift } from './ui/gift.js';
import { renderDailyCard } from './ui/screen-modes.js';
import { app } from './ui/app.js';
import { $ } from './ui/dom.js';
import { t, applyStaticTexts, setLang, detectLang, saveLang, getLang } from './i18n/index.js';
import { bindSave } from './ui/save.js';
import { loadArt } from './art.js';
import { loadBasics } from './content/levels/index.js';
import { bindBoard } from './ui/board.js';
import { bindHands } from './ui/hands.js';
import { bindCardTip } from './ui/card-tip.js';
import { bindWin } from './ui/win.js';
import { bindScreens, bindFabAutoHide, showScreen, newFreeGame, applyArtExtras, suspendGame } from './ui/screens.js';
import { bindStory, openStory, userLevelAt, startLevel, warmBasics } from './ui/screen-story.js';
import { bindPve, openPveSetup } from './ui/screen-pve.js';
import { bindModes, openModes, startDaily, DAILY_HASHES, playSharedCombo } from './ui/screen-modes.js';
import { bindAssist } from './ui/assist.js';
import { bindZoom } from './ui/board-zoom.js';
import { bindEditor, fitEditorBoard, edRender, ED, openEditor } from './ui/editor.js';
import { bindLab } from './ui/lab.js';
import { migrateLevelsOnce } from './ui/records.js';
import { offerLinkedLevel } from './ui/my-levels.js';
import { takeLinkedCode, handOffLink, bindLinkInbox } from './ui/link-tabs.js';
import { toast } from './ui/hud.js';
import { bindSoundPanel } from './ui/sound-panel.js';
import * as ctl from './ui/controller.js';
import { updateEndTurnHint, updateMenuBtn } from './ui/hud.js';
import { fxArmIdle, fxAmbientStart } from './fx/effects.js';
import { sfx, sfxEnsure, SFX } from './audio/sfx.js';
import { clearPieces } from './ui/board.js';
import { loadPrefs } from './ui/prefs.js';
import { bindSettings, repaintSettings } from './ui/settings.js';
import { bindTutorial } from './ui/tutorial.js';
import { bindHotseat } from './ui/hotseat.js';
import { bindLineup } from './ui/lineup.js';
import { bindPause, pauseGame, resumePlay } from './ui/pause.js';
import { bindRules, openRules, closeRules, rulesOpen } from './ui/rules.js';
import { bindBack } from './ui/back.js';
import { bindLogFilter } from './ui/hud.js';
import { bakeGrain, bakeScene, sceneFromCache } from './ui/bake.js';
import { UMAMI_ID, flushQueue, track } from './ui/analytics.js';
import { bindMyBall } from './ui/my-ball.js';

// texturas precocinadas (grano y fondo desenfocado de los menús): se pintan una vez y se usan como imagen
sceneFromCache();
bakeGrain().then(() => setTimeout(bakeScene, 200));
performance.setResourceTimingBufferSize?.(1000); // (la lista de archivos cargados que se guardan para jugar sin conexión)
// preferencias (velocidad, tema del campo, accesibilidad) antes de pintar nada
loadPrefs();
// idioma: el elegido; si no, español en España e inglés fuera (por zona horaria)
setLang(detectLang());
applyStaticTexts();
bindSave();

// listeners (un único sitio; nada de onclick en el HTML)
bindBoard(ctl.uiCell);
bindHands();
bindCardTip();
bindWin();
bindScreens();
bindFabAutoHide();
bindStory();
bindPve();
bindModes();
bindAssist();
bindZoom();
bindEditor();
bindLab();
bindSoundPanel();
bindSettings();
bindTutorial();
bindHotseat();
bindLineup();
bindPause();
bindRules();
bindBack();
bindLogFilter();
bindMyBall();
$('endTurnBtn').addEventListener('click', ctl.endTurn);
$('discardBtn').addEventListener('click', ctl.startDiscard);
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
// el audio se prepara al presionar (ya es un gesto del jugador): crearlo en el clic retrasaba la pantalla que se abre
window.addEventListener('pointerdown', () => { if (!SFX.ctx) sfxEnsure(); }, true);
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
// el hueco del tablero también cambia sin que cambie la ventana (la fila de rivales con "Reaccionar", la etiqueta
// del modo, girar el móvil…): se reajusta la casilla. Nunca a mitad de una animación (las piezas se descolocarían)
let refitLater = null;
function refitBoard() {
  if (!app.game || app.screen !== 'game') return;
  if (app.animating) { clearTimeout(refitLater); refitLater = setTimeout(refitBoard, 250); return; }
  ctl.fitBoard(); ctl.render();
}
if (typeof ResizeObserver === 'function') {
  let last = '';
  new ResizeObserver(([e]) => {
    const k = Math.round(e.contentRect.width) + 'x' + Math.round(e.contentRect.height);
    if (k !== last) { last = k; refitBoard(); }
  }).observe($('boardCol'));
}
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
  else if (app.screen === 'game') ctl.render(); // (el panel del laboratorio también)
  else showScreen(app.screen);
  updateMenuBtn();
});
paintLangBtns();
fxAmbientStart();


// arranque: niveles de Lo básico + partida libre de fondo + arte
// (la pantalla de carga tapa el menú hasta que están los niveles, el arte y la tipografía; con tope:
// pase lo que pase, se quita)
(async () => {
  const t0 = performance.now();
  // enlace con un nivel compartido (…#nivel=CÓDIGO): si el juego ya está abierto en otra pestaña, el
  // nivel va a esa y esta se cierra; si no, se ofrece aquí guardarlo en Tus niveles (y jugarlo)
  let linked = takeLinkedCode();
  const handOff = linked ? handOffLink(linked) : null;
  try { app.basics = await loadBasics(); }
  catch (e) { console.error('No se pudieron cargar los niveles', e); }
  migrateLevelsOnce(app.basics); // (niveles integrados rediseñados: su progreso, una vez)
  warmBasics(); // (sus miniaturas, en ratos libres: Lo básico se abre al momento)
  if (handOff && await handOff) {
    window.close();
    await new Promise(r => setTimeout(r, 400));
    linked = null; toast(t('lib.inOtherTab')); // (el navegador no ha dejado cerrarla: el juego sigue aquí)
  }
  try {
    newFreeGame();
    showScreen('menu');
    const art = Promise.all([loadArt(), document.fonts?.ready.catch(() => {})]);
    const late = await Promise.race([art.then(() => false), new Promise(r => setTimeout(r, 3000, true))]);
    // el arte que exista sustituye a los fallbacks: reconstruir piezas y re-renderizar
    const applyArt = () => { clearPieces(); applyArtExtras(); ctl.render(); };
    if (late) art.then(() => { if (!app.animating) applyArt(); }); else applyArt();
  } catch (e) { console.error('Arranque', e); }
  // un mínimo breve para que no parpadee; luego se desvanece y el menú hace su entrada
  await new Promise(r => setTimeout(r, Math.max(0, 450 - (performance.now() - t0))));
  const ld = $('loadScreen');
  ld.classList.add('done');
  document.body.classList.remove('loading'); // ahora sí: la entrada animada del menú
  setTimeout(() => ld.remove(), 500);
  const playLinked = idx => startLevel(userLevelAt(idx), 'story', idx);
  const offer = code => offerLinkedLevel(code, playLinked);
  offer(linked);
  bindLinkInbox(offer); // (enlaces que otras pestañas o la app instalada pasan a esta)
  // enlace del reto diario (…/#reto, el que se comparte al terminarlo): directo al reto de hoy
  const dailyFromLink = () => {
    if (!DAILY_HASHES.includes(location.hash)) return;
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* sin history */ }
    if (app.screen === 'game' && app.variant === 'daily') return; // (ya está en él)
    if (app.screen === 'game' && app.game) suspendGame(); // (la partida en curso queda guardada)
    track('reto', { desde: 'enlace' });
    startDaily();
  };
  dailyFromLink();
  // TEMPORAL (vídeos de cada baraja): los niveles vitrina se guardan solos en Tus niveles, una vez por dispositivo (si los
  // borras, no vuelven; con …/#vitrina se vuelven a añadir). Borrar con src/content/levels/vitrina.js
  const VITRINA_KEY = 'chaoticgolf_vitrina';
  const vitrinaFromLink = async () => {
    const link = location.hash === '#vitrina';
    let done = null; try { done = localStorage.getItem(VITRINA_KEY); } catch (e) { /* sin storage */ }
    if (!link && done) return;
    if (link) try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* sin history */ }
    const [{ VITRINA }, { receiveLevel }, { openModes }] = await Promise.all([import('./content/levels/vitrina.js'), import('./ui/my-levels.js'), import('./ui/screen-modes.js')]);
    const added = VITRINA.filter(L => !receiveLevel(L).dup).length;
    try { localStorage.setItem(VITRINA_KEY, '1'); } catch (e) { /* sin storage */ }
    if (link) { toast(added ? `${added} niveles vitrina guardados en Tus niveles` : 'Los niveles vitrina ya estaban en Tus niveles'); openModes('workshop'); }
    else if (app.screen === 'modes') openModes('workshop'); // (si ya estaba en Modos de juego, que los vea)
  };
  vitrinaFromLink();
  // enlace con una combinación de Ultimate compartida (…#ultimate=CÓDIGO): la misma partida
  const comboFromLink = () => { const e = takeComboLink(); if (!e) return; if (app.screen === 'game' && app.game) suspendGame(); track('ultimate', { desde: 'enlace' }); playSharedCombo(e); };
  comboFromLink();
  // baraja nueva: se anuncia una vez a quien ya jugaba (al llegar al menú, sin nada más abierto)
  // y el regalo de early tester (después del anuncio, si lo hay)
  app.onStreakChange = () => { if (app.screen === 'menu') renderDailyCard(); };
  if (!linked) setTimeout(() => {
    if (app.screen !== 'menu') return;
    if (maybeAnnounceDeck()) $('dialog').addEventListener('close', () => setTimeout(maybeShowGift, 500), { once: true });
    else maybeShowGift();
  }, 1100);
  window.addEventListener('hashchange', () => { dailyFromLink(); comboFromLink(); vitrinaFromLink(); offer(takeLinkedCode()); }); // (enlace pegado en esta pestaña)
})();

// PWA: jugar sin conexión (solo en http/https)
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  // lo que esta página ya ha cargado, a la caché del service worker: la primera visita y la que estrena
  // versión no pasan por él, y sin esto un arranque sin red se quedaba sin algunos módulos
  const warm = () => navigator.serviceWorker.controller?.postMessage({ t: 'warm',
    urls: [location.pathname + location.search, ...performance.getEntriesByType('resource').map(r => r.name)] });
  navigator.serviceWorker.addEventListener('controllerchange', warm);
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); warm(); });
}

// Vercel: analíticas (visitas) y Speed Insights (rendimiento real). Los scripts los sirve Vercel en
// cada despliegue; en local no existen.
// Umami: los eventos del juego (qué modos se juegan y cómo acaban, src/ui/analytics.js). Solo en la web
// publicada: en local y en los tests no se cuenta nada. Sin la búsqueda ni el #nivel=… de la dirección
if (location.protocol === 'https:' && !/^(localhost|127\.|192\.168\.)/.test(location.hostname)) {
  for (const src of ['/_vercel/insights/script.js', '/_vercel/speed-insights/script.js']) {
    const sc = document.createElement('script');
    sc.defer = true; sc.src = src;
    document.head.append(sc);
  }
  const um = document.createElement('script');
  um.defer = true; um.src = 'https://cloud.umami.is/script.js';
  Object.assign(um.dataset, { websiteId: UMAMI_ID, excludeSearch: 'true', excludeHash: 'true' });
  um.onload = flushQueue;
  document.head.append(um);
}

// app instalada (analíticas)
window.addEventListener('appinstalled', () => track('instalar'));

// gancho de depuración para la consola y las pruebas de humo (tools/smoke.mjs)
window.chaoticGolf = { app, ctl };
