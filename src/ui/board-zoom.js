// Zoom y desplazamiento del tablero (sobre todo con tableros grandes):
//   · pellizcar con dos dedos acerca / aleja (también el pellizco del trackpad)
//   · en tableros grandes (minigolf, Ultimate), también la rueda del ratón
//   · con zoom, arrastrar (dedo o ratón) mueve el tablero (sin que cuente como toque en una casilla)
//   · el botón de la esquina vuelve a ver el tablero entero
//   · interfaz táctil con casillas pequeñas (Ultimate…): al elegir destino la cámara se acerca sola a tu
//     pelota y a las casillas posibles, y al resolverse la jugada se aleja para verla entera (autoZoom)
// Solo transforma #boardZoom: el tablero, las piezas y los efectos se escalan juntos.
import { $ } from './dom.js';
import { app } from './app.js';
import { isPhone } from './device.js';
import { isBot } from './players.js';
import { cellStep, cellCenterPx } from './geometry.js';
const bigBoard = () => { const S = app.game?.S; return !!S && S.cols * S.rows > 99; };

const MIN = 1, MAX = 3;
let s = 1, tx = 0, ty = 0;
const pts = new Map();           // punteros activos: id -> {x, y}
let pinch = null, pan = null, dragged = false;

function clamp() {
  const area = $('boardZoom'), W = area.offsetWidth, H = area.offsetHeight;
  s = Math.max(MIN, Math.min(MAX, s));
  tx = Math.min(0, Math.max(W * (1 - s), tx));
  ty = Math.min(0, Math.max(H * (1 - s), ty));
}
function apply() {
  clamp();
  $('boardZoom').style.transform = s === 1 ? '' : `translate(${tx}px, ${ty}px) scale(${s})`;
  $('zoomReset').hidden = s === 1;
  $('boardWrap').classList.toggle('zoomed', s > 1);
}
export function resetZoom() { s = 1; tx = 0; ty = 0; autoOn = false; autoSig = ''; if ($('boardZoom')) apply(); }

/* ---------- cámara automática (táctil) ---------- */
const SMALL_PX = 30; // casillas más pequeñas que esto: al elegir destino, la cámara se acerca…
const TAP_PX = 46;   // …hasta que midan esto (cómodas para el dedo)
let autoOn = false, autoSig = '';
// transición suave solo para los movimientos de la cámara (el pellizco va pegado al dedo)
function glide(ms = 380) {
  const z = $('boardZoom');
  z.style.transition = `transform ${ms}ms cubic-bezier(.3,.7,.2,1)`;
  clearTimeout(z._glide);
  z._glide = setTimeout(() => { z.style.transition = ''; }, ms + 40);
}
// encuadra el rectángulo (px del tablero sin escalar) con un margen alrededor
function frame(x0, y0, x1, y1, margin) {
  const area = $('boardZoom'), W = area.offsetWidth, H = area.offsetHeight;
  const ns = Math.min(MAX, TAP_PX / cellStep().w, W / (x1 - x0 + margin * 2), H / (y1 - y0 + margin * 2));
  if (ns < 1.15) return false; // ya se ve bien: la cámara no se mueve
  s = ns; tx = W / 2 - (x0 + x1) / 2 * s; ty = H / 2 - (y0 + y1) / 2 * s;
  glide(); apply();
  return true;
}
// se llama tras cada render de la partida
export function autoZoom() {
  if (!isPhone() || !$('boardZoom')) return;
  const g = app.game, pd = g?.pending;
  const who = pd ? (pd.p !== undefined ? pd.p : pd.ball?.player) : null;
  const picking = !!pd && !app.animating && !app.ai.acting && who != null && !isBot(who)
    && ['move', 'serpent', 'placeTile', 'pickBall'].includes(pd.kind) && cellStep().w < SMALL_PX;
  if (!picking) { // jugada resuelta o cancelada: vuelta a ver el tablero entero
    if (autoOn) { autoOn = false; autoSig = ''; s = 1; tx = 0; ty = 0; glide(); apply(); }
    return;
  }
  const cells = [...document.querySelectorAll('#board .cell.selectable, #board .cell.selectable-out')];
  if (!cells.length) return;
  const sig = pd.kind + ':' + cells.map(c => c.dataset.x + ',' + c.dataset.y).join(' ');
  if (sig === autoSig) return; // (mismo encuadre: cada render no mueve la cámara)
  autoSig = sig;
  const st = cellStep();
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const add = (px, py) => { x0 = Math.min(x0, px - st.w / 2); y0 = Math.min(y0, py - st.h / 2); x1 = Math.max(x1, px + st.w / 2); y1 = Math.max(y1, py + st.h / 2); };
  for (const c of cells) { const p = cellCenterPx(+c.dataset.x, +c.dataset.y); add(p.px, p.py); }
  if (pd.ball && !pd.ball.holed) { const p = cellCenterPx(pd.ball.x, pd.ball.y); add(p.px, p.py); } // tu pelota, también a la vista
  if (frame(x0, y0, x1, y1, st.w * .6)) autoOn = true;
}

// escala alrededor de un punto de la pantalla (cx, cy)
function zoomAt(ns, cx, cy) {
  const r = $('boardZoom').getBoundingClientRect();
  const lx = (cx - r.left) / s, ly = (cy - r.top) / s; // punto en coordenadas del tablero sin escalar
  const base = { x: r.left - tx, y: r.top - ty };      // origen del tablero sin transformar
  s = Math.max(MIN, Math.min(MAX, ns));
  tx = cx - base.x - lx * s; ty = cy - base.y - ly * s;
  apply();
}

export function bindZoom() {
  const wrap = $('boardWrap');
  wrap.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' && (s <= 1 || e.button !== 0)) return; // con ratón solo se arrastra con zoom
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    dragged = false;
    if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), s0: s };
      pan = null;
    } else if (pts.size === 1 && s > 1) pan = { x: e.clientX, y: e.clientY, tx, ty };
  });
  wrap.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pts.size >= 2) {
      const [a, b] = [...pts.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      zoomAt(pinch.s0 * d / pinch.d, (a.x + b.x) / 2, (a.y + b.y) / 2);
      dragged = true;
      autoOn = false;
    } else if (pan) {
      const dx = e.clientX - pan.x, dy = e.clientY - pan.y;
      if (!dragged && Math.hypot(dx, dy) < 8) return; // un toque, no un arrastre
      dragged = true;
      tx = pan.tx + dx; ty = pan.ty + dy; apply();
    }
  });
  const up = e => {
    pts.delete(e.pointerId);
    if (pts.size < 2) pinch = null;
    if (!pts.size) pan = null;
    else if (pts.size === 1 && s > 1) { const [p] = [...pts.values()]; pan = { x: p.x, y: p.y, tx, ty }; }
  };
  wrap.addEventListener('pointerup', up);
  wrap.addEventListener('pointercancel', up);
  // un arrastre o un pellizco no son un toque en una casilla
  wrap.addEventListener('click', e => { if (dragged) { e.stopPropagation(); e.preventDefault(); dragged = false; } }, true);
  // pellizco del trackpad (llega como rueda con ctrl)
  wrap.addEventListener('wheel', e => {
    if (!e.ctrlKey && !bigBoard()) return;
    e.preventDefault();
    zoomAt(s * Math.exp(-e.deltaY / (e.ctrlKey ? 500 : 700)), e.clientX, e.clientY);
  }, { passive: false });
  $('zoomReset').addEventListener('click', resetZoom);
  window.addEventListener('resize', resetZoom);
}
