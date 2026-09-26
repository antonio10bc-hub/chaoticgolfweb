// Bloque (baraja de minigolf): un cubo de madera macizo. La pelota (o el hoyo) rebota y vuelve por
// donde venía; no cuenta como casilla.
import { WOOD, grain } from './wood.js';
export default {
  type: 'block',
  block: true,
  device: true,        // pieza de madera: nadie se queda encima
  cellClass: 'wood',
  pic: '<svg class="tilePic woodPic" viewBox="0 0 100 140" aria-hidden="true">' +
    `<rect x="12" y="24" width="80" height="100" rx="8" fill="rgba(40,25,10,.3)"/>` +
    `<rect x="8" y="16" width="84" height="104" rx="8" fill="${WOOD.side}"/>` +
    `<rect x="8" y="16" width="84" height="92" rx="8" fill="${WOOD.mid}"/>` +
    `<rect x="16" y="23" width="68" height="76" rx="5" fill="${WOOD.hi}"/>` + grain(16, 23, 68, 76, 4) +
    `<path d="M16 28V99" stroke="rgba(255,255,255,.35)" stroke-width="2.5" stroke-linecap="round"/></svg>`,
  tileClass: 'tile-block',
  dust: 'sand',
  placeSound: 'wood',
};
