// Métrica de casillas: tamaño en CSS (--cell-w / --cell-h) y conversión a píxeles.
import { $ } from './dom.js';

export const GAP = 3; const RATIO = 73 / 52; // proporción carta de póker (GAP: el mismo hueco que #board en board.css)
export const PAD = 3; // margen interior de #board: las casillas empiezan 3px dentro (piezas, efectos y vista previa)
const RATIO_BIG = 1.12; // tableros grandes: casillas más cuadradas, para que todo se vea más grande

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
  return { px: PAD + x * s.w + (s.w - GAP) / 2, py: PAD + y * s.h + (s.h - GAP) / 2 };
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
  el.style.transform = `translate(${PAD + x * s.w}px, ${PAD + y * s.h}px)`;
}

// igual que fitCells pero con el hueco disponible ya medido (px). Si con la proporción de carta las
// casillas quedan pequeñas (tableros de minigolf y Ultimate), se hacen más cuadradas y crecen
export function fitCellsTo(cols, rows, availW, availH, max = 64, min = 24) {
  const fit = ratio => {
    const w = Math.floor((availW - GAP * (cols - 1)) / cols);
    const wByH = Math.floor(((availH - GAP * (rows - 1)) / rows) / ratio);
    return Math.max(min, Math.min(max, w, wByH));
  };
  let ratio = RATIO, w = fit(RATIO);
  if (w < 44) { const w2 = fit(RATIO_BIG); if (w2 > w) { w = w2; ratio = RATIO_BIG; } }
  setCellSize(w, Math.round(w * ratio));
  document.documentElement.classList.toggle('squareCells', ratio !== RATIO);
}
