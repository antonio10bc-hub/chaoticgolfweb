// Controlador: une el motor (reglas) con la interfaz.
// Cada acción del jugador o de la IA pasa por dispatch(): se ejecuta en el motor,
// se procesan sus eventos (sonido, efectos, cola de animación…), se renderiza y
// se disparan los ganchos posteriores (victoria en solitario, turno de la IA).
import { app } from './app.js';
import { $, $$, restartClass } from './dom.js';
import { CARDS } from '../content/cards/index.js';
import { TILES } from '../content/tiles/index.js';
import { fitCellsTo } from './geometry.js';
import { renderBoard, ensurePieces, syncPieces, clearPieces, markPlaced } from './board.js';
import { renderHands, resetDealAnim } from './hands.js';
import { playQueue } from './animations.js';
import * as hud from './hud.js';
import { showWin, hideWin } from './win.js';
import { aiKick, aiStop } from './ai-driver.js';
import { fxPlayCard, fxDiscardCard, fxBadCard, fxRewind, fxZoomShake } from '../fx/effects.js';
import { blockedReason } from './reasons.js';
import { saveGame } from './save.js';
import { sfx } from '../audio/sfx.js';
import { JUICE } from '../fx/juice.js';
import { pColor } from '../art.js';
import { t } from '../i18n/index.js';
import { isBot, viewer, multiHuman, displayName, avatarHTML } from './players.js';
import { resetMoods, clearBubbles } from './persona.js';
import { botPlayed, botsGameOver } from './bot-react.js';
import { passCheck } from './hotseat.js';
import { tutorialEvent } from './tutorial.js';
import { unlock } from './achievements.js';
import { setBotTempo } from './prefs.js';
import { clearPause } from './pause.js';
import { explainPlay } from '../ai/bot.js';
import { trackMoment, resetMoments } from './why-lost.js';
import { redrawCaddie, clearCaddie, paintAssist } from './assist.js';
import { showPuzzleFail } from './win.js';
import { musicMood } from '../audio/sfx.js';
import { piecesBefore, notePlay } from './share-play.js';
import { paintLab, labGodClick } from './lab.js';

/* ---------- estadísticas de partida (resumen post-partida, decorativo) ---------- */
export let stats = null;
const resetStats = () => {
  stats = { golpes: 0, colisiones: 0, caidas: 0, portales: 0, hundidas: 0, turnos: 0,
    misTurnos: 0,                  // turnos propios (partida rápida con una persona)
    longest: { n: 0, p: null },    // jugada que más casillas movió y de quién
    hitsOnMe: {},                  // quién golpeó tu pelota: jugador -> veces
    cardsUsed: {},                 // cartas que has jugado: clave -> veces
    route: [],                     // recorrido de tu pelota: [x, y, tipo] (o salida, m paso, t portal, f caída, a reaparece, h choca, H la golpean, s emboca)
    dists: [] };                   // distancia de tu pelota al hoyo al acabar cada turno tuyo (el primero, al empezar)
};
const ROUTE_MAX = 400;
const dist = (g, p) => { const b = g.S.balls.find(bb => bb.player === p); return b ? Math.abs(b.x - g.S.hole.x) + Math.abs(b.y - g.S.hole.y) : 0; };
function noteRoute(g, me, ev) {
  const r = stats.route, last = r[r.length - 1], tag = 'b' + me;
  if (r.length >= ROUTE_MAX) return;
  if (ev.p === tag) {
    const k = { move: 'm', drift: 'm', teleport: 't', launch: 't', fall: 'f', splash: 'f', appear: 'a' }[ev.t];
    if (k) r.push([ev.x, ev.y, k]);
    else if (ev.t === 'sink' && last) r.push([last[0], last[1], 's']);
    else if (ev.t === 'impact' && last) r.push([last[0], last[1], 'h']);
  } else if (ev.t === 'impact' && ev.target === tag && last) r.push([last[0], last[1], 'H']);
}
// jugador "tú" para el resumen: la persona en partida rápida con una sola persona, o el nivel
const meSeat = g => app.mode === 'story' || app.mode === 'test' ? 0 : app.mode === 'pve' && !multiHuman() ? g.S.human : null;
export const setStats = s => { stats = { ...stats, ...s }; };
const ANIM = new Set(['move', 'teleport', 'impact', 'fall', 'appear', 'sink', 'settle', 'chainStop', 'drift', 'splash', 'bump', 'deflect', 'tunnel', 'launch']);
const STAT_OF = { impact: 'colisiones', fall: 'caidas', splash: 'caidas', teleport: 'portales', sink: 'hundidas' };

/* ---------- arranque de partidas ---------- */
export function startGame(game, mode, { levelIndex = null, level = null, variant = null, run = null } = {}) {
  aiStop();
  app.game = game;
  app.mode = mode;
  app.variant = variant;
  app.run = run;
  app.levelIndex = levelIndex;
  app.level = level;
  app.animQueue = []; app.animating = false;
  app.tipShown = {};
  app.lastPlayAt = Date.now();
  prevTurn = -1; jaqueShown = false;
  app.passFor = null; app.reacting = null;
  app.finalPlay = null;
  app.winStyle = {}; app.undo = null; app.caddie = null; app.lastWhy = null; // cómo ganó cada uno · deshacer · consejo del caddie
  resetMoments();
  clearPause();
  musicMood('calm');
  resetMoods(); clearBubbles();
  resetStats();
  const me = meSeat(game), b = me != null && game.S.balls.find(bb => bb.player === me);
  if (b) { stats.route.push([b.x, b.y, 'o']); stats.dists.push(dist(game, me)); }
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
  const pad = window.innerWidth <= 760 ? 22 : 30; // marco crema (10px, 7px en móvil) + junta (3px) a cada lado
  fitCellsTo(S.cols, S.rows, w - pad, h - pad, 84);
}

/* ---------- dispatch ---------- */
// acciones del laboratorio del creador (dar cartas, deshacer, mover piezas): pasan por el mismo camino
export const labAction = fn => dispatch(fn);
function dispatch(fn) {
  const g = app.game;
  if (!g) return false;
  const jaqueBefore = g.S.jaque && g.S.winner !== null;
  const turnBefore = g.S.turn;
  const before = app.mode === 'pve' ? g.clone({ lite: true }) : null; // para explicar la jugada y el momento clave
  const pre = piecesBefore(g); // (para compartir la jugada final)
  const ok = fn(g);
  const events = g.takeEvents();
  let resolved = false, turnEnded = false, won = false, onlyFeedback = ok === false;
  let actor = null, moves = 0, cardKey = null;
  const me = meSeat(g);
  for (const ev of events) {
    if (ANIM.has(ev.t)) {
      app.animQueue.push(ev);
      if (STAT_OF[ev.t]) stats[STAT_OF[ev.t]]++;
      if (me != null && stats.route) noteRoute(g, me, ev);
      if (ev.t === 'move') moves++;
      if (ev.t === 'impact' && me != null && ev.target === 'b' + me && ev.p !== ev.target) { // te han golpeado
        const by = +ev.p.slice(1);
        stats.hitsOnMe[by] = (stats.hitsOnMe[by] || 0) + 1;
      }
      continue;
    }
    switch (ev.t) {
      case 'card': {
        sfx('card');
        app.lastActor = ev.p; actor = ev.p; cardKey = ev.key;
        if (!isBot(ev.p)) stats.cardsUsed[ev.key] = (stats.cardsUsed[ev.key] || 0) + 1;
        // la carta vuela de la mano (o del asiento del bot, desvelándose) al centro y a descartes
        const mine = !isBot(ev.p);
        fxPlayCard(ev.p, ev.idx, ev.key, { fast: mine });
        botPlayed(ev.p, { savingJaque: jaqueBefore && !g.S.winners.includes(ev.p) });
        tutorialEvent('played', { p: ev.p, key: ev.key });
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
      case 'undo': hideWin(); fxRewind(); break;
      case 'tip': hud.storyTip(ev.key); break;
      case 'notice': hud.toast(ev.text); break;
      case 'resolved': resolved = true; break;
      case 'turnEnded':
        turnEnded = true; stats.turnos++;
        if (app.mode === 'pve' && !isBot(turnBefore)) stats.misTurnos++;
        if (me != null && turnBefore === me && stats.dists) stats.dists.push(dist(g, me));
        break;
      case 'win': won = true; break;
    }
  }
  if (!app.animQueue.length) app.animLead = 0; // la espera solo tiene sentido si hay algo que animar
  notePlay(g, pre, events, cardKey, actor ?? app.lastActor); // la última jugada con movimiento (compartir al final)
  // la jugada que más casillas ha movido (pelotas en cadena y hoyo incluidos)
  if (moves && (actor ?? app.lastActor) != null && moves > stats.longest.n) stats.longest = { n: moves, p: actor ?? app.lastActor };
  // cómo ha entrado cada pelota (para celebrar la victoria a su manera)
  noteWinStyle(g, events, actor, cardKey, jaqueBefore);
  // ayudas: una jugada propia gasta el consejo; deshacer vale para tus jugadas del turno en curso
  if (actor != null && !isBot(actor)) clearCaddie();
  if (turnEnded || (actor != null && isBot(actor))) { app.undo = null; if (turnEnded) clearCaddie(); }
  else if (resolved && actor != null && !isBot(actor) && g.S.turn === turnBefore) app.undo = { count: (app.undo?.count || 0) + 1 };
  // los bots explican su jugada; con una persona contra la máquina se apunta el momento clave
  if (resolved && before && actor != null && isBot(actor)) hud.botWhy(actor, explainPlay(before, g, actor, cardKey));
  if ((resolved || turnEnded) && app.mode === 'pve' && !multiHuman()) trackMoment(g, g.S.human, { actor, card: cardKey, before });
  // logro: una persona evita un JAQUE con una naranja
  if (jaqueBefore && actor != null && !isBot(actor) && g.S.winner === null && app.mode !== 'free') unlock('jaqueSaved');
  if (onlyFeedback && !events.some(e => e.t !== 'badCard' && e.t !== 'notice')) return ok; // nada cambió
  if (resolved) { app.lastPlayAt = Date.now(); app.playSeq++; }
  if (resolved && app.reacting != null && !g.pending) app.reacting = null; // la reacción del invitado ha terminado
  render();
  saveGame({ flash: resolved || turnEnded }); // guardado automático (con aviso breve tras una jugada)
  if (resolved || turnEnded) tutorialEvent(turnEnded ? 'turnEnded' : 'resolved');
  if (won) { botsGameOver(g.S.winners); showWin(); }
  // puzle: el turno ha terminado sin embocar
  if (turnEnded && app.variant === 'puzzle' && g.S.winner === null) setTimeout(() => { if (app.variant === 'puzzle' && app.game === g) showPuzzleFail(); }, 450);
  if (resolved) maybeSoloWin();
  if (resolved || turnEnded) aiKick(); // en PVE la máquina reacciona/actúa tras cada jugada
  return ok;
}

/* ---------- acciones (interfaz e IA) ---------- */
const CANCELLABLE = ['move', 'placeTile', 'pickBall', 'dedoAmount', 'pickHoled']; // (el dedo en marcha ya no)
export function clickCard(p, idx) {
  if (app.animating) return false;
  const pd = app.game.pending;
  // tocar otra vez la carta elegida la suelta; tocar otra carta tuya cambia de elección
  if (pd && pd.p === p && pd.idx !== undefined && CANCELLABLE.includes(pd.kind) && (app.mode !== 'pve' || !app.ai.acting)) {
    cancel();
    if (pd.idx === idx) { sfx('select'); return true; }
  }
  const before = app.game.pending;
  const ok = dispatch(g => g.clickCard(p, idx));
  if (ok && app.game.pending && app.game.pending !== before) {
    sfx('select'); // carta elegida: toca decidir
    tutorialEvent('selected', { p, key: app.game.S.hands[p]?.[idx] });
  }
  return ok;
}
export function clickCell(x, y) {
  if (app.animating) return false;
  const g = app.game;
  if (g.godMode) { if (app.mode === 'test') { labGodClick(x, y); return true; } return dispatch(gg => gg.clickCell(x, y)); } // (trampas al probar: con su validación)
  if (!g.pending) return false;
  if (app.mode === 'pve' && !app.ai.acting) { // en PVE solo se decide la acción propia (la de quien tiene el dispositivo)
    const pd = g.pending, me = viewer();
    if (pd.p !== undefined && pd.p !== me) return false;
    if (pd.kind === 'serpent' && pd.ball !== g.ownBall(me)) return false;
  }
  return dispatch(gg => gg.clickCell(x, y));
}
// casilla tocada por la persona. Las piezas que giran (esquina, lanzadera) no se colocan al primer toque:
// la pieza se queda puesta de prueba (app.placeAt); tocar la misma casilla la gira, otra la mueve,
// y "Colocar" (o Intro) la deja. La IA usa clickCell directamente.
export function uiCell(x, y, { key = false } = {}) {
  const g = app.game, pd = g?.pending;
  if (!app.animating && pd?.kind === 'placeTile' && TILES[pd.tileType]?.rotates && g.selectableAt(x, y) === 'sel' && !isBot(pd.p)) {
    const same = app.placeAt && app.placeAt.x === x && app.placeAt.y === y;
    if (same && key) return confirmPlace();
    if (same) return rotatePending();
    app.placeAt = { x, y };
    sfx('select');
    render();
    return true;
  }
  return clickCell(x, y);
}
export function confirmPlace() {
  const p = app.placeAt;
  if (!p) return false;
  app.placeAt = null;
  return clickCell(p.x, p.y);
}
export const chooseAmount = n => dispatch(g => g.chooseAmount(n));
export const pickHoled = pl => dispatch(g => g.pickHoled(pl));
export const serpentStep = dir => dispatch(g => g.serpentStep(dir));
export const endSerpent = () => dispatch(g => g.endSerpent());
export const cancel = () => dispatch(g => (g.cancel(), true));
export const rotatePending = () => { const r = dispatch(g => g.rotatePending()); sfx('select'); return r; };
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
// deshacer la última jugada propia (ayuda: Lo básico y partidas fáciles)
export const undoMove = () => dispatch(g => g.undo());

// cómo ha entrado la pelota: portal, carambola, el hoyo se la traga, robo en el JAQUE, tiro largo, dedo…
function noteWinStyle(g, events, actor, cardKey, jaqueBefore) {
  const S = g.S;
  for (const ev of events) {
    if (ev.t !== 'sink' || ev.p === 'hole') continue;
    const p = +ev.p.slice(1), ball = S.balls.find(b => b.player === p);
    if (!ball || ball.decoy) continue;
    const upTo = events.slice(0, events.indexOf(ev));
    const own = upTo.filter(e => e.p === ev.p);
    let style = null;
    if (own.some(e => e.t === 'teleport')) style = 'portal';
    else if (upTo.filter(e => e.t === 'impact').length >= 2) style = 'chain';
    else if (!own.some(e => e.t === 'move') && upTo.some(e => e.p === 'hole' && e.t === 'move')) style = 'swallow';
    else if (jaqueBefore && actor === p) style = 'steal';
    else if (app.mode === 'story' && (stats?.turnos || 0) === 0) style = 'first';
    else if (cardKey === 'dedo') style = 'zigzag';
    else if (own.filter(e => e.t === 'move').length >= 3) style = 'long';
    if (style) app.winStyle[p] = style; else delete app.winStyle[p];
  }
}

// en solitario no hay ventana de reacción: la victoria se confirma sola tras la animación
export function maybeSoloWin() {
  const S = app.game?.S;
  if (S && S.jaque && S.winner !== null && S.nPlayers === 1 && !app.animating && !app.animQueue.length) confirmWin();
}

/* ---------- render ---------- */
export function render() {
  const g = app.game;
  if (!g) return;
  if (app.placeAt && (g.pending?.kind !== 'placeTile' || !g.selectableAt(app.placeAt.x, app.placeAt.y))) app.placeAt = null; // (pieza de prueba)
  passCheck(); // multijugador local: pasar el dispositivo a quien le toca (antes de pintar las manos)
  setBotTempo(app.mode === 'pve' && (isBot(g.S.turn) || app.ai.acting)); // (ajuste: turnos de la máquina más rápidos)
  hud.renderTopbar();
  renderJaque();
  renderBoard();
  renderPieces();
  renderHands();
  hud.renderHud();
  turnCheck();
  if (hud.modeChip()) requestAnimationFrame(() => { if (app.game === g) { fitBoard(); render(); } }); // etiqueta del modo (torneo, contrarreloj…)
  paintAssist();    // botones de consejo y deshacer
  redrawCaddie();   // el consejo sigue a la vista hasta que juegas
  paintLab();       // panel del laboratorio del creador
}

function renderPieces() {
  ensurePieces();
  if (app.animating) return;              // la reproducción en curso controla las piezas
  if (app.animQueue.length) {
    playQueue(() => {
      renderJaque();   // el JAQUE se anuncia al terminar la jugada
      maybeSoloWin();  // en solitario la victoria se confirma sin ventana de reacción
      paintAssist();   // consejo y deshacer dependen de que no haya animación en curso
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
    if (jaqueShown && S.winner === null) musicMood('calm'); // el JAQUE se ha evitado: la música se relaja
    el.classList.remove('visible'); el.innerHTML = ''; el._html = ''; jaqueShown = false; return;
  }
  // mientras alguien resuelve su naranja, manda la instrucción de la barra de acción
  if (app.game.pending) { el.classList.remove('visible'); return; }
  el.classList.add('visible');
  if (!jaqueShown) { jaqueShown = true; fxZoomShake(); sfx('jaque'); sfx('tension'); musicMood('tense'); } // entrada dramática + sting
  const names = S.winners.map(displayName).join(t('common.and'));
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
  const mine = app.mode === 'pve' && !multiHuman() && S.turn === viewer();
  b.style.setProperty('--pc', pColor(S.turn));
  b.innerHTML = `${avatarHTML(S.turn)}<b>${mine ? t('turn.yoursBanner') : t('turn.ofName', { name: displayName(S.turn) })}</b>`;
  b.style.animationDuration = JUICE.turnBannerMs + 'ms';
  restartClass(b, 'show');
  restartClass(document.querySelector(`.seat[data-player="${S.turn}"]`) || $('dock'), 'turnPulse');
  sfx('turn');
}
