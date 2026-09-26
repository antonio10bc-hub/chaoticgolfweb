// Bloque (baraja de minigolf): un cubo de madera macizo. La pelota (o el hoyo) rebota y vuelve por
// donde venía; no cuenta como casilla.
import { WOOD } from './wood.js';
// cubo visto desde arriba y un poco de frente: cara superior biselada (con vetas, un nudo y 4 clavijas)
// y cara frontal en sombra con las juntas de los tablones
const PIC = '<svg class="tilePic woodPic" viewBox="0 0 100 140" aria-hidden="true">' +
  '<rect x="13" y="27" width="80" height="104" rx="13" fill="rgba(40,25,10,.32)"/>' +                     // sombra
  `<rect x="7" y="17" width="86" height="108" rx="13" fill="#8A5A2E" stroke="${WOOD.dark}" stroke-width="2"/>` +     // cara frontal
  '<path d="M26 104V123M48 104V124M70 104V123" stroke="rgba(40,25,10,.35)" stroke-width="1.6" stroke-linecap="round"/>' + // juntas
  `<rect x="7" y="17" width="86" height="88" rx="13" fill="${WOOD.mid}" stroke="${WOOD.dark}" stroke-width="2"/>` +          // cara superior
  '<rect x="14" y="23" width="72" height="75" rx="9" fill="#DDAE72"/>' +                                      // bisel
  '<path d="M14 32Q14 23 23 23H77L14 86Z" fill="rgba(255,240,210,.28)"/>' +                                  // luz arriba-izq
  '<path d="M20 38q14-5 28 0t30 0M20 56q12-6 26-1t32 1M20 76q16-5 30 0t28 0" fill="none" stroke="rgba(122,82,48,.32)" stroke-width="1.5" stroke-linecap="round"/>' +
  '<ellipse cx="64" cy="66" rx="6" ry="4" fill="none" stroke="rgba(122,82,48,.45)" stroke-width="1.5"/><ellipse cx="64" cy="66" rx="2.4" ry="1.5" fill="rgba(122,82,48,.45)"/>' + // nudo
  '<path d="M18 28Q18 25 22 25H78" stroke="rgba(255,255,255,.55)" stroke-width="2.6" fill="none" stroke-linecap="round"/>' + // brillo
  '<path d="M84 30V92" stroke="rgba(122,82,48,.25)" stroke-width="4" stroke-linecap="round"/>' +
  [[20, 30], [80, 30], [20, 91], [80, 91]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.2" fill="${WOOD.dark}" opacity=".55"/><circle cx="${x - .6}" cy="${y - .6}" r=".8" fill="#F6E2BE" opacity=".6"/>`).join('') +
  '</svg>';
export default {
  type: 'block',
  block: true,
  device: true,        // pieza de madera: nadie se queda encima
  cellClass: 'wood',
  pic: PIC,
  tileClass: 'tile-block',
  dust: 'sand',
  placeSound: 'wood',
};
