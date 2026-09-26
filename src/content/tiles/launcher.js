// Lanzadera (baraja de minigolf): un disco de madera con una flecha. Si la pelota (o el hoyo) pasa
// por encima, pierde el resto del movimiento y sale volando 5 casillas hacia donde marca la flecha.
// Cada turno la flecha gira un cuarto de vuelta. `rot` (0-3): 0 arriba, 1 derecha, 2 abajo, 3 izquierda.
import { WOOD } from './wood.js';
export default {
  type: 'launcher',
  launcher: true,
  rotates: true,
  cellClass: 'wood',
  picFor: (tile = {}) => '<svg class="tilePic woodPic" viewBox="0 0 100 140" aria-hidden="true">' +
    `<circle cx="53" cy="75" r="38" fill="rgba(40,25,10,.3)"/>` +
    `<circle cx="50" cy="70" r="38" fill="${WOOD.side}"/><circle cx="50" cy="66" r="36" fill="${WOOD.mid}"/>` +
    `<circle cx="50" cy="66" r="27" fill="${WOOD.hi}"/><circle cx="50" cy="66" r="27" fill="none" stroke="${WOOD.grain}" stroke-width="1.4" stroke-dasharray="4 5"/>` +
    `<g class="lArrow" style="--r:${(tile.rot || 0) * 90}deg"><path d="M50 40L66 60H56V88H44V60H34Z" fill="#E8873A" stroke="${WOOD.dark}" stroke-width="2" stroke-linejoin="round"/></g></svg>`,
  tileClass: 'tile-launcher',
  dust: 'sand',
  placeSound: 'wood',
};
