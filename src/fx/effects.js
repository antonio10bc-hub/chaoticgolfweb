// Efectos decorativos basados en DOM (todo es cosmético: nunca toca el estado del juego).
import { JUICE, REDUCED, CONFETTI_C } from './juice.js';
import { fxRand, fxSpawn, fxCount } from './particles.js';
import { cellCenterPx } from '../ui/geometry.js';
import { $, $$, restartClass } from '../ui/dom.js';
import { app } from '../ui/app.js';
import { sfx } from '../audio/sfx.js';
import { cardFaceHTML } from '../ui/card-art.js';
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

// carta de una mano en pantalla (dock o asiento)
const handCard = (p, idx) => document.querySelector(`.card[data-p="${p}"][data-idx="${idx}"]`);
const rectOf = id => { const el = $(id); const r = el && el.getBoundingClientRect(); return r && r.width ? r : null; };
const center = r => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });

// una carta boca arriba, del tamaño de las del dock, suelta en la capa fija
function floatingCard(def, w) {
  const c = document.createElement("div");
  c.className = `card floating ${def.color}`;
  c.innerHTML = cardFaceHTML(def);
  c.style.cssText = `position:fixed;left:0;top:0;--cw:${w}px;margin:0;z-index:95;pointer-events:none;`;
  document.body.appendChild(c);
  return c;
}

// carta jugada: vuela desde donde está (mano / asiento), se exhibe un instante sobre el
// tablero y termina en la pila de descartes (o se funde, si se queda en la mesa)
export function fxPlayCard(p, idx, cardKey, { fast = false } = {}) {
  const def = CARDS[cardKey];
  if (!def) return;
  const src = handCard(p, idx)?.getBoundingClientRect() || $$(`.seat[data-player="${p}"]`)[0]?.getBoundingClientRect();
  const board = rectOf("boardWrap");
  if (!src || !board) return;
  const W = 96, H = W * 1.4;
  const c = floatingCard(def, W);
  const from = center(src), show = { x: board.left + board.width / 2, y: board.top + Math.min(board.height * .28, 150) };
  const pile = rectOf("discardPile");
  const end = def.staysOnBoard || !pile ? { ...show, s: .6, o: 0 } : { ...center(pile), s: .42, o: .0 };
  const at = (pt, s, r = 0) => `translate(${pt.x - W / 2}px, ${pt.y - H / 2}px) scale(${s}) rotate(${r}deg)`;
  const s0 = src.width / W;
  if (REDUCED) { c.remove(); return; }
  const frames = [
    { transform: at(from, s0, 0), opacity: 1, offset: 0 },
    { transform: at(show, 1.18, (fxRand() - .5) * 6), opacity: 1, offset: fast ? .3 : .28 },
    { transform: at(show, 1.08, 0), opacity: 1, offset: fast ? .55 : .72 },
    { transform: at(end, end.s, (fxRand() - .5) * 30), opacity: end.o, offset: 1 },
  ];
  const anim = c.animate(frames, { duration: fast ? 700 : 1250, easing: "cubic-bezier(.3,.7,.3,1)", fill: "forwards" });
  anim.onfinish = () => c.remove();
  sfx("whoosh");
}

// descarte: las cartas vuelan a la pila de descartes (desveladas si eran de un bot)
export function fxDiscardCard(p, idx, cardKey) {
  if (REDUCED) return;
  const def = CARDS[cardKey];
  const el = handCard(p, idx);
  const pile = rectOf("discardPile");
  if (!def || !el || !pile) return;
  const src = el.getBoundingClientRect();
  const W = 96, H = W * 1.4, c = floatingCard(def, W);
  const a = center(src), b = center(pile);
  const at = (pt, s, r) => `translate(${pt.x - W / 2}px, ${pt.y - H / 2}px) scale(${s}) rotate(${r}deg)`;
  const anim = c.animate([
    { transform: at(a, src.width / W, 0), opacity: 1 },
    { transform: at({ x: (a.x + b.x) / 2, y: Math.min(a.y, b.y) - 60 }, .8, (fxRand() - .5) * 40), opacity: 1, offset: .5 },
    { transform: at(b, .42, (fxRand() - .5) * 30), opacity: .2 },
  ], { duration: 520, easing: "cubic-bezier(.4,0,.3,1)", fill: "forwards" });
  anim.onfinish = () => c.remove();
}

// robo: las cartas nuevas salen del mazo y aterrizan en su sitio (FLIP)
export function fxDealFrom(pileId, els) {
  if (REDUCED || !els.length) return;
  const pile = rectOf(pileId);
  let i = 0;
  for (const el of els) {
    const r = el.getBoundingClientRect();
    if (!r.width) continue;
    const from = pile ? center(pile) : { x: r.left + r.width / 2, y: r.top + 60 };
    const dx = from.x - (r.left + r.width / 2), dy = from.y - (r.top + r.height / 2);
    el.animate([
      { transform: `translate(${dx}px, ${dy}px) scale(.45) rotate(-12deg)`, opacity: 0 },
      { transform: `translate(${dx * .15}px, ${dy * .15 - 18}px) scale(1.05) rotate(3deg)`, opacity: 1, offset: .7 },
      { transform: "none", opacity: 1 },
    ], { duration: 460, delay: i * JUICE.dealStaggerMs, easing: "cubic-bezier(.3,.8,.35,1)", fill: "backwards" });
    if (i < 3) setTimeout(() => sfx("deal"), i * JUICE.dealStaggerMs + 60);
    i++;
  }
}

// carta no jugable: shake sutil
export const fxBadCard = (p, idx) => restartClass(handCard(p, idx), "shake");
