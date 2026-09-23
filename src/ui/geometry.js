// Métrica de casillas: tamaño en CSS (--cell-w / --cell-h) y conversión a píxeles.
import { $ } from './dom.js';

const GAP = 4, RATIO = 73 / 52; // proporción carta de póker

// tamaño de casilla + hueco; se cachea para no forzar getComputedStyle en cada llamada
// (solo cambia en setCellSize, que actualiza las variables CSS y la caché a la vez)
let stepCache = null;
export function cellStep() {
  if (!stepCache) {
    const cs = getComputedStyle(document.documentElement);
    stepCache = {
      w: parseFloat(cs.getPropertyValue('--cell-w')) + GAP,
      h: parseFloat(cs.getPropertyValue('--cell-h')) + GAP,
    };
  }
  return stepCache;
}
export function setCellSize(w, h) {
  document.documentElement.style.setProperty('--cell-w', w + 'px');
  document.documentElement.style.setProperty('--cell-h', h + 'px');
  stepCache = { w: w + GAP, h: h + GAP };
}

// ajusta el tamaño de casilla para que cols x rows quepa en el contenedor wrapId
export function fitCells(cols, rows, wrapId, sideW, hFrac) {
  const wrap = $(wrapId);
  const availW = (wrap.clientWidth || window.innerWidth - sideW) - 36;
  const availH = window.innerHeight * hFrac - 36;
  let w = Math.floor((availW - GAP * (cols - 1)) / cols);
  const wByH = Math.floor(((availH - GAP * (rows - 1)) / rows) / RATIO);
  w = Math.max(24, Math.min(56, w, wByH));
  setCellSize(w, Math.round(w * RATIO));
}

// centro de una casilla en px dentro de #boardArea (misma métrica que setPos)
export function cellCenterPx(x, y) {
  const s = cellStep();
  return { px: x * s.w + (s.w - GAP) / 2, py: y * s.h + (s.h - GAP) / 2 };
}

// centro actual de una pieza leyendo su transform (sin tocar el estado)
export function pieceCenterPx(el) {
  const m = /translate\(([-\d.]+)px(?:,\s*([-\d.]+)px)?\)/.exec(el.style.transform || '');
  const s = cellStep();
  const tx = m ? parseFloat(m[1]) : 0, ty = m && m[2] !== undefined ? parseFloat(m[2]) : 0;
  return { px: tx + (s.w - GAP) / 2, py: ty + (s.h - GAP) / 2 };
}

export function setPos(el, x, y, ms, ease) {
  el.style.transition = ms ? `transform ${ms}ms ${ease || 'linear'}, opacity .15s` : 'opacity .15s';
  const s = cellStep();
  el.style.transform = `translate(${x * s.w}px, ${y * s.h}px)`;
}
