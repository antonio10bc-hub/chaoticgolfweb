// Controlador: une el motor (reglas) con la interfaz.
// Cada acción del jugador o de la IA pasa por dispatch(): se ejecuta en el motor,
// se procesan sus eventos (sonido, efectos, cola de animación…), se renderiza y
// se disparan los ganchos posteriores (victoria en solitario, turno de la IA).
import { app } from './app.js';
import { $, $$, restartClass } from './dom.js';
import { CARDS } from '../content/cards/index.js';
import { fitCellsTo } from './geometry.js';
import { renderBoard, ensurePieces, syncPieces, clearPieces, markPlaced } from './board.js';
import { renderHands, resetDealAnim } from './hands.js';
import { playQueue } from './animations.js';
import * as hud from './hud.js';
import { showWin, hideWin } from './win.js';
import { renderDebugState, updateGodHint } from './debug.js';
import { aiKick, aiStop } from './ai-driver.js';
import { fxPlayCard, fxDiscardCard, fxBadCard, fxRewind, fxZoomShake } from '../fx/effects.js';
import { blockedReason } from './reasons.js';
import { sfx } from '../audio/sfx.js';
import { JUICE } from '../fx/juice.js';
import { pColor } from '../art.js';
import { t } from '../i18n/index.js';

/* ---------- estadísticas de partida (resumen post-partida, decorativo) ---------- */
export let stats = null;
const resetStats = () => { stats = { golpes: 0, colisiones: 0, caidas: 0, portales: 0, hundidas: 0 }; };
const ANIM = new Set(['move', 'teleport', 'impact', 'fall', 'appear', 'sink', 'settle']);
const STAT_OF = { impact: 'colisiones', fall: 'caidas', teleport: 'portales', sink: 'hundidas' };

/* ---------- arranque de partidas ---------- */
export function startGame(game, mode, { levelIndex = null, level = null } = {}) {
  aiStop();
  app.game = game;
  app.mode = mode;
  app.levelIndex = levelIndex;
  app.level = level;
  app.animQueue = []; app.animating = false;
  app.tipShown = {};
  app.lastPlayAt = Date.now();
  prevTurn = -1; jaqueShown = false;
  resetStats();
  resetDealAnim();
  clearPieces();
  hideWin();
  hud.hideStoryTip();
  hud.updateMenuBtn();
  game.takeEvents();
}

// el tablero ocupa el hueco real que le deja la columna central (entre asientos, pilas, barra y dock)
export function fitBoard() {
  const col = $('boardCol'), S = app.game.S;
  const w = col?.clientWidth || window.innerWidth - 360, h = col?.clientHeight || window.innerHeight * .6;
  fitCellsTo(S.cols, S.rows, w - 30, h - 30, 84); // marco crema (10px) + junta (3px) a cada lado
}

/* ---------- dispatch ---------- */
function dispatch(fn) {
  const g = app.game;
  const ok = fn(g);
  const events = g.takeEvents();
  let resolved = false, turnEnded = false, won = false, onlyFeedback = ok === false;
  for (const ev of events) {
    if (ANIM.has(ev.t)) {
      app.animQueue.push(ev);
      if (STAT_OF[ev.t]) stats[STAT_OF[ev.t]]++;
      continue;
    }
    switch (ev.t) {
      case 'card': {
        sfx('card');
        app.lastActor = ev.p;
        // la carta vuela de la mano (o del asiento del bot, desvelándose) al centro y a descartes
        const mine = app.mode !== 'pve' || ev.p === g.S.human;
        fxPlayCard(ev.p, ev.idx, ev.key, { fast: mine });
        // el tablero espera a que la carta despegue: primero se ve qué se juega, luego qué pasa
        app.animLead = mine ? JUICE.cardLeadMs.mine : JUICE.cardLeadMs.bot;
        if (CARDS[ev.key]?.stroke) stats.golpes++;
        break;
      }
      case 'discard':
        for (const c of ev.cards) fxDiscardCard(ev.p, c.idx, c.key);
        sfx('card');
        break;
      case 'badCard': { // carta no jugable: shake sutil + por qué
        fxBadCard(ev.p, ev.idx); sfx('bad');
        const why = blockedReason(g, ev.p, g.S.hands[ev.p][ev.idx]);
        if (why) hud.toast(why, 'warn');
        break;
      }
      case 'tilePlaced': markPlaced(ev.x, ev.y); break;
      case 'rewind': hideWin(); fxRewind(); break;                  // flash de "rebobinado"
      case 'undo': hideWin(); break;
      case 'tip': hud.storyTip(ev.key); break;
      case 'notice': hud.toast(ev.text); break;
      case 'resolved': resolved = true; break;
      case 'turnEnded': turnEnded = true; break;
      case 'win': won = true; break;
    }
  }
  if (!app.animQueue.length) app.animLead = 0; // la espera solo tiene sentido si hay algo que animar
  if (onlyFeedback && !events.some(e => e.t !== 'badCard' && e.t !== 'notice')) return ok; // nada cambió
  if (resolved) { app.lastPlayAt = Date.now(); app.playSeq++; }
  render();
  if (won) showWin();
  if (resolved) maybeSoloWin();
  if (resolved || turnEnded) aiKick(); // en PVE la máquina reacciona/actúa tras cada jugada
  return ok;
}

/* ---------- acciones (interfaz e IA) ---------- */
export function clickCard(p, idx) {
  if (app.animating) return false;
  const before = app.game.pending;
  const ok = dispatch(g => g.clickCard(p, idx));
  if (ok && app.game.pending && app.game.pending !== before) sfx('select'); // carta elegida: toca decidir
  return ok;
}
export function clickCell(x, y) {
  if (app.animating) return false;
  const g = app.game;
  if (g.godMode) { const r = dispatch(gg => gg.clickCell(x, y)); updateGodHint(); return r; }
  if (!g.pending) return false;
  if (app.mode === 'pve' && !app.ai.acting) { // en PVE el jugador no puede interferir en la acción de la máquina
    const pd = g.pending;
    if (pd.p !== undefined && pd.p !== g.S.human) return false;
    if (pd.kind === 'serpent' && pd.ball !== g.ownBall(g.S.human)) return false;
  }
  return dispatch(gg => gg.clickCell(x, y));
}
export const chooseAmount = n => dispatch(g => g.chooseAmount(n));
export const pickHoled = pl => dispatch(g => g.pickHoled(pl));
export const serpentStep = dir => dispatch(g => g.serpentStep(dir));
export const endSerpent = () => dispatch(g => g.endSerpent());
export const cancel = () => dispatch(g => (g.cancel(), true));
export function endTurn() {
  app.lastPlayAt = Date.now();
  if (app.animating) return false;
  return dispatch(g => g.endTurn());
}
export function startDiscard() {
  app.lastPlayAt = Date.now();
  if (app.animating) return false;
  return dispatch(g => g.startDiscard());
}
export const confirmDiscard = () => dispatch(g => g.confirmDiscard());
export const confirmWin = () => dispatch(g => g.confirmWin());
// herramientas de debug
export const debugAction = fn => dispatch(g => { const r = fn(g); return r === undefined ? true : r; });

// en solitario no hay ventana de reacción: la victoria se confirma sola tras la animación
export function maybeSoloWin() {
  const S = app.game?.S;
  if (S && S.jaque && S.winner !== null && S.nPlayers === 1 && !app.animating && !app.animQueue.length) confirmWin();
}

/* ---------- render ---------- */
export function render() {
  const g = app.game;
  if (!g) return;
  hud.renderTopbar();
  renderJaque();
  renderBoard();
  renderPieces();
  renderHands();
  renderDebugState();
  hud.renderHud();
  turnCheck();
}

function renderPieces() {
  ensurePieces();
  if (app.animating) return;              // la reproducción en curso controla las piezas
  if (app.animQueue.length) {
    playQueue(() => {
      renderJaque();   // el JAQUE se anuncia al terminar la jugada
      maybeSoloWin();  // en solitario la victoria se confirma sin ventana de reacción
    });
    return;
  }
  syncPieces();
}

let jaqueShown = false;
export function renderJaque() {
  const el = $('jaque'), S = app.game.S;
  // no anunciar el JAQUE hasta que termine la animación de la jugada
  if (!S.jaque || S.winner === null || app.animating || app.animQueue.length) {
    el.classList.remove('visible'); el.innerHTML = ''; el._html = ''; jaqueShown = false; return;
  }
  // mientras alguien resuelve su naranja, manda la instrucción de la barra de acción
  if (app.game.pending) { el.classList.remove('visible'); return; }
  el.classList.add('visible');
  if (!jaqueShown) { jaqueShown = true; fxZoomShake(); sfx('jaque'); sfx('tension'); } // entrada dramática + sting
  const names = S.winners.map(i => t('player.name', { n: i + 1 })).join(t('common.and'));
  const msg = S.winners.length > 1 ? t('jaque.tie', { names }) : t('jaque.one', { names });
  el.style.setProperty('--pc', pColor(S.winners[0]));
  // cuenta atrás de la ventana de reacción (la fija el orquestador de la IA en PVE)
  const jt = app.jaqueTimer;
  const timer = jt ? `<div class="jqTimer"><i style="animation-duration:${jt.ms}ms;animation-delay:-${Date.now() - jt.at}ms"></i></div>` : '';
  const html = `<div class="jqBadge">${t('jaque.title')}</div>` +
    `<div class="jqText"><b>${msg}</b><small>${t('jaque.lastChance')}</small>${timer}</div>` +
    `<button class="btn-light btn-sm" data-act="confirmWin">${t('jaque.nobody')}</button>`;
  if (el._html !== html || !jt) { el.innerHTML = html; el._html = html; }
}

// cambio de turno: banner breve + pulso del panel activo (decorativo)
let prevTurn = -1;
function turnCheck() {
  const S = app.game.S;
  if (S.turn === prevTurn) return;
  const first = prevTurn === -1;
  prevTurn = S.turn;
  if (first) return; // sin banner en el primer render de la partida
  const b = $('turnBanner');
  const mine = app.mode === 'pve' && S.turn === S.human;
  b.style.setProperty('--pc', pColor(S.turn));
  b.innerHTML = `<span class="avatar">J${S.turn + 1}</span><b>${mine ? t('turn.yoursBanner') : t('turn.ofBanner', { n: S.turn + 1 })}</b>`;
  b.style.animationDuration = JUICE.turnBannerMs + 'ms';
  restartClass(b, 'show');
  restartClass(document.querySelector(`.seat[data-player="${S.turn}"]`) || $('dock'), 'turnPulse');
  sfx('turn');
}
