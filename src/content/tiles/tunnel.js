// Túnel cuádruple (baraja de minigolf): un cubo de madera con cuatro bocas. La pelota entra por
// cualquier lado y sale por uno de los cuatro al azar. No cuenta como casilla.
import { WOOD, grain } from './wood.js';
const arch = (d) => `<path d="${d}" fill="#3A2614"/>`;
export default {
  type: 'tunnel',
  tunnel: true,
  device: true,
  cellClass: 'wood',
  pic: '<svg class="tilePic woodPic" viewBox="0 0 100 140" aria-hidden="true">' +
    `<rect x="12" y="24" width="80" height="100" rx="10" fill="rgba(40,25,10,.3)"/>` +
    `<rect x="8" y="16" width="84" height="104" rx="10" fill="${WOOD.side}"/>` +
    `<rect x="8" y="16" width="84" height="96" rx="10" fill="${WOOD.mid}"/>` +
    `<rect x="18" y="26" width="64" height="76" rx="6" fill="${WOOD.hi}"/>` + grain(18, 26, 64, 76, 3) +
    arch('M38 16a12 12 0 0 1 24 0Z') + arch('M38 112a12 12 0 0 0 24 0Z') + arch('M8 52a12 12 0 0 1 0 24Z') + arch('M92 52a12 12 0 0 0 0 24Z') +
    `<circle cx="50" cy="64" r="11" fill="${WOOD.side}"/><text x="50" y="69.5" text-anchor="middle" font-size="15" font-weight="700" fill="${WOOD.hi}">?</text></svg>`,
  tileClass: 'tile-tunnel',
  dust: 'sand',
  placeSound: 'wood',
};
