// Zoom y desplazamiento del tablero (sobre todo con tableros grandes):
//   · pellizcar con dos dedos acerca / aleja (también el pellizco del trackpad)
//   · en tableros grandes (minigolf, Ultimate), también la rueda del ratón
//   · con zoom, arrastrar (dedo o ratón) mueve el tablero (sin que cuente como toque en una casilla)
//   · el botón de la esquina vuelve a ver el tablero entero
// Solo transforma #boardZoom: el tablero, las piezas y los efectos se escalan juntos.
import { $ } from './dom.js';
import { app } from './app.js';
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
export function resetZoom() { s = 1; tx = 0; ty = 0; if ($('boardZoom')) apply(); }

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
