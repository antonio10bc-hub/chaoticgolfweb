// Esquina (baraja de minigolf): un triángulo de madera. Si la pelota llega por uno de sus dos lados
// abiertos, la cara inclinada la desvía 90°; si llega por la espalda, rebota como en un bloque.
// No cuenta como casilla. `rot` (0-3): dónde está el ángulo recto (0 arriba-izq, 1 arriba-der,
// 2 abajo-der, 3 abajo-izq); se elige al colocarla.
import { WOOD, grain } from './wood.js';
const TRI = [[[6, 6], [94, 6], [6, 134]], [[6, 6], [94, 6], [94, 134]], [[94, 6], [94, 134], [6, 134]], [[6, 6], [6, 134], [94, 134]]];
const pts = p => p.map(q => q.join(',')).join(' ');
export default {
  type: 'corner',
  corner: true,
  device: true,
  rotates: true,
  cellClass: 'wood',
  picFor: (tile = {}) => {
    const r = (tile.rot || 0) % 4, t = TRI[r];
    // el mismo triángulo algo más pequeño hacia dentro (la cara de arriba) y el canto inclinado
    const c = [(t[0][0] + t[1][0] + t[2][0]) / 3, (t[0][1] + t[1][1] + t[2][1]) / 3];
    const inner = t.map(([x, y]) => [x + (c[0] - x) * .2, y + (c[1] - y) * .2]);
    const hyp = r === 0 ? [t[1], t[2]] : r === 1 ? [t[0], t[2]] : r === 2 ? [t[0], t[2]] : [t[0], t[2]];
    return '<svg class="tilePic woodPic" viewBox="0 0 100 140" aria-hidden="true">' +
      `<polygon points="${pts(t.map(([x, y]) => [x + 4, y + 6]))}" fill="rgba(40,25,10,.3)"/>` +
      `<polygon points="${pts(t)}" fill="${WOOD.side}" stroke="${WOOD.dark}" stroke-width="2" stroke-linejoin="round"/>` +
      `<polygon points="${pts(inner)}" fill="${WOOD.hi}"/>` +
      `<line x1="${hyp[0][0]}" y1="${hyp[0][1]}" x2="${hyp[1][0]}" y2="${hyp[1][1]}" stroke="#F6E2BE" stroke-width="3.5" stroke-linecap="round"/>` +
      '</svg>';
  },
  tileClass: 'tile-corner',
  dust: 'sand',
  placeSound: 'wood',
};
