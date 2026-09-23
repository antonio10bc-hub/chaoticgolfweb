// Efectos decorativos basados en DOM (todo es cosmético: nunca toca el estado del juego).
import { JUICE, REDUCED, CONFETTI_C } from './juice.js';
import { fxRand, fxSpawn, fxCount } from './particles.js';
import { cellCenterPx } from '../ui/geometry.js';
import { $, $$, restartClass } from '../ui/dom.js';
import { app } from '../ui/app.js';
import { sfx } from '../audio/sfx.js';
import { ASSETS } from '../art.js';
import { CARDS } from '../content/cards/index.js';
import { t } from '../i18n/index.js';

/* ---- sacudidas / zoom del tablero ---- */
function fxBoardClass(cls, ms) {
  if (REDUCED) return;
  const el = $('boardArea');
  el.classList.remove('shake', 'zoomPulse', 'zoomShake'); void el.offsetWidth;
  el.classList.add(cls);
  setTimeout(() => el.classList.remove(cls), ms);
}
export const fxShake = () => fxBoardClass('shake', JUICE.impact.shakeMs + 40);
export const fxZoomPulse = () => fxBoardClass('zoomPulse', 650);
export const fxZoomShake = () => fxBoardClass('zoomShake', 460);

/* carta NO — rebobinado: captura las posiciones DOM actuales (pre-render);
   syncPieces llamará a fxRewindApply() para que las piezas retrocedan
   visualmente hasta su posición restaurada. */
let rewindMap = null;
export function fxRewind() {
  rewindMap = {};
  $$('#pieces .piece').forEach(el => {
    if (el.style.display !== 'none' && el.style.transform) rewindMap[el.dataset.id] = el.style.transform;
  });
  restartClass($('rewindTag'), 'go');
  sfx('rewind');
}
export function fxRewindApply() {
  if (!rewindMap) return;
  const map = rewindMap; rewindMap = null;
  if (REDUCED) return;
  $$('#pieces .piece').forEach(el => {
    const old = map[el.dataset.id];
    if (!old || el.style.display === 'none') return;
    const target = el.style.transform;          // posición ya sincronizada al estado restaurado
    if (old === target) return;
    el.style.transition = 'none';
    el.style.transform = old;                    // saltar a la posición previa...
    el.classList.add('rewindFx');
    requestAnimationFrame(() => requestAnimationFrame(() => {
      el.style.transition = `transform ${JUICE.rewindMs}ms cubic-bezier(.6,0,.3,1), opacity .15s`;
      el.style.transform = target;               // ...y retroceder a la restaurada
      setTimeout(() => el.classList.remove('rewindFx'), 380);
    }));
  });
}

/* ---- capa DOM para elementos fx que no son partículas (estela, combo, trayectoria) ---- */
function fxGetDomLayer() {
  let l = $('fxLayer');
  if (!l) { l = document.createElement('div'); l.id = 'fxLayer'; $('boardArea').appendChild(l); }
  return l;
}

// estela fantasma del camino de la última jugada
const trail = [];
export const fxTrailReset = () => { trail.length = 0; };
export const fxTrailPush = (x, y, color) => { if (trail.length < JUICE.trail.max) trail.push({ x, y, color }); };
export function fxTrailShow() {
  if (REDUCED || !trail.length) return;
  const layer = fxGetDomLayer();
  trail.forEach((tr, i) => {
    const { px, py } = cellCenterPx(tr.x, tr.y);
    const d = document.createElement('div');
    d.className = 'trailDot';
    d.style.left = px + 'px'; d.style.top = py + 'px';
    d.style.background = tr.color;
    d.style.setProperty('--trail-ms', JUICE.trail.fadeMs + 'ms');
    d.style.animationDelay = (i * 45) + 'ms';
    layer.appendChild(d);
    setTimeout(() => d.remove(), JUICE.trail.fadeMs + i * 45 + 80);
  });
}

// texto flotante de combo en colisiones encadenadas
export function fxComboText(px, py, n) {
  if (REDUCED) return;
  const d = document.createElement('div');
  d.className = 'comboText';
  d.textContent = t('fx.combo', { n });
  d.style.left = px + 'px'; d.style.top = (py - 12) + 'px';
  fxGetDomLayer().appendChild(d);
  setTimeout(() => d.remove(), JUICE.comboMs);
}

// previsualización de trayectoria al hover de una casilla seleccionable
export function fxShowTraj(bx, by, tx, ty, out) {
  if (REDUCED) return;
  const layer = fxGetDomLayer();
  let tr = $('traj');
  if (!tr) {
    tr = document.createElement('div');
    tr.id = 'traj';
    tr.innerHTML = '<div class="line"></div><div class="head"></div>';
    layer.appendChild(tr);
  }
  const a = cellCenterPx(bx, by), b = cellCenterPx(tx, ty);
  const dx = b.px - a.px, dy = b.py - a.py, len = Math.hypot(dx, dy);
  if (len < 6) { fxHideTraj(); return; }
  tr.classList.toggle('out', !!out);
  tr.style.display = 'block';
  tr.style.left = a.px + 'px'; tr.style.top = a.py + 'px';
  tr.style.width = len + 'px';
  tr.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;
  tr.querySelector('.line').style.width = len + 'px';
}
export function fxHideTraj() { const tr = $('traj'); if (tr) tr.style.display = 'none'; }

// animaciones de reposo tras unos segundos sin input
let idleT = null;
export function fxArmIdle() {
  clearTimeout(idleT);
  const pieces = $('pieces');
  if (pieces) pieces.classList.remove('idle');
  if (REDUCED) return;
  idleT = setTimeout(() => {
    if (!app.animating && app.screen === 'game' && pieces) pieces.classList.add('idle');
  }, JUICE.idle.ms);
}

// pétalos ambientales que cruzan el tablero de vez en cuando
let ambientT = null;
export function fxAmbientStart() {
  if (REDUCED || ambientT) return;
  ambientT = setInterval(() => {
    if (document.hidden || app.screen !== 'game' || fxRand() < 0.45) return;
    const area = $('boardArea');
    if (!area || !area.offsetWidth) return;
    fxSpawn(-12, 10 + fxRand() * area.offsetHeight * 0.6, {
      n: 1, colors: ['#cfe8a8', '#ffffff', '#f3d9e6', '#b9de90'], size: 9,
      dist: area.offsetWidth * 1.05, dur: 7000, angMin: -0.22, angMax: 0.22, shape: 'leaf', alpha: .75,
    });
  }, JUICE.ambientMs);
}

// perf HUD del panel debug (FPS + partículas activas); solo mide con el panel abierto
let perfFrames = 0, perfLast = 0, perfRaf = 0;
function fxPerfTick(ts) {
  perfFrames++;
  if (ts - perfLast >= 500) {
    const fps = Math.round(perfFrames * 1000 / (ts - perfLast));
    perfFrames = 0; perfLast = ts;
    const hud = $('perfHud');
    if (hud) hud.innerHTML = t('debug.perf', { fps, n: fxCount() });
  }
  perfRaf = $('debugPanel').classList.contains('visible') ? requestAnimationFrame(fxPerfTick) : 0;
}
export function fxPerfWatch() { if (!perfRaf) { perfFrames = 0; perfLast = performance.now(); perfRaf = requestAnimationFrame(fxPerfTick); } }

// confeti de celebración en un punto de la pantalla (capa fija)
function fxConfettiAt(clientX, clientY, n) {
  fxSpawn(clientX, clientY, { n, colors: CONFETTI_C, size: 9, dist: 120, up: 60, gravity: 60,
    dur: 750, rect: true, fixed: true });
}
export function fxWinConfetti() {
  if (REDUCED) return;
  const cx = window.innerWidth / 2, cy = window.innerHeight * 0.32;
  for (let i = 0; i < JUICE.confettiWin.bursts; i++) {
    setTimeout(() => fxConfettiAt(cx + (fxRand() - .5) * 220, cy + (fxRand() - .5) * 80,
      JUICE.confettiWin.perBurst), i * JUICE.confettiWin.gapMs);
  }
}

const handCard = (p, idx) => {
  const hand = $$('#hands .hand')[p];
  return hand && hand.querySelectorAll('.card')[idx];
};

// clona una carta de la mano y la anima (viaje al tablero o salida de descarte)
export function fxCloneCard(p, idx, mode) {
  if (REDUCED) return;
  const card = handCard(p, idx);
  if (!card) return;
  const r = card.getBoundingClientRect();
  const c = card.cloneNode(true);
  c.style.cssText = `position:fixed;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;
    margin:0;z-index:90;pointer-events:none;transition:none;`;
  document.body.appendChild(c);
  let anim;
  if (mode === 'play') { // viaja al centro del tablero con un arco y se encoge
    const bw = $('boardWrap').getBoundingClientRect();
    const tx = bw.left + bw.width / 2 - r.left - r.width / 2;
    const ty = bw.top + bw.height / 2 - r.top - r.height / 2;
    anim = c.animate([
      { transform: 'translate(0,0) rotate(0) scale(1)', opacity: 1 },
      { transform: `translate(${tx * .5}px, ${ty * .5 - 46}px) rotate(${(fxRand() - .5) * 14}deg) scale(.92)`, opacity: 1, offset: .55 },
      { transform: `translate(${tx}px, ${ty}px) rotate(0) scale(.25)`, opacity: 0 },
    ], { duration: JUICE.cardFlyMs, easing: 'cubic-bezier(.3,.6,.3,1)', fill: 'forwards' });
  } else { // descarte: sale por abajo girando
    anim = c.animate([
      { transform: 'translate(0,0) rotate(0) scale(1)', opacity: 1 },
      { transform: `translate(${(fxRand() - .5) * 60}px, 130px) rotate(${(fxRand() - .5) * 40}deg) scale(.85)`, opacity: 0 },
    ], { duration: 300, easing: 'cubic-bezier(.4,0,.7,.4)', fill: 'forwards' });
  }
  anim.onfinish = () => c.remove();
}

// en PVE las manos rivales están tapadas: cuando la máquina usa una carta, se
// desvela desde su mano (carta boca arriba que se eleva y se desvanece)
export function fxRevealCard(p, idx, cardKey) {
  if (REDUCED) return;
  const card = handCard(p, idx);
  const def = CARDS[cardKey];
  if (!card || !def) return;
  const r = card.getBoundingClientRect();
  const c = document.createElement('div');
  c.className = `card ${def.color}`;
  c.innerHTML = ASSETS.handCardHTML(def);
  c.style.cssText = `position:fixed;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;
    margin:0;z-index:90;pointer-events:none;`;
  document.body.appendChild(c);
  const anim = c.animate([
    { transform: 'translateY(0) scale(1)', opacity: 1 },
    { transform: 'translateY(-24px) scale(1.1)', opacity: 1, offset: .5 },
    { transform: 'translateY(-44px) scale(1.04)', opacity: 0 },
  ], { duration: 950, easing: 'cubic-bezier(.3,.6,.3,1)', fill: 'forwards' });
  anim.onfinish = () => c.remove();
}

// carta no jugable: shake sutil
export const fxBadCard = (p, idx) => restartClass(handCard(p, idx), 'shake');
