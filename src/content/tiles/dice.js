// Baraja del casino: el dado (src/engine/gambling.js tiene las reglas). Un cubo como el bloque de madera del minigolf:
// lo que choca contra él rebota tantas casillas como marque y el dado rueda una casilla hacia el otro lado (otra cara).
// Cada dado lleva su orientación: t (la cara de arriba), n (la del norte) y e (la del este); la de delante es 7 − n.
// Dibujo: un dado de marfil visto desde arriba y un poco de frente (como el bloque): la cara de arriba con sus puntos (el
// uno, rojo y grande, como en los dados de casino) y la de delante, en sombra, con los suyos aplastados.

const PIP = { c: [0, 0], tl: [-1, -1], tr: [1, -1], ml: [-1, 0], mr: [1, 0], bl: [-1, 1], br: [1, 1] };
export const PIPS = { 1: ['c'], 2: ['tr', 'bl'], 3: ['tr', 'c', 'bl'], 4: ['tl', 'tr', 'bl', 'br'], 5: ['tl', 'tr', 'c', 'bl', 'br'], 6: ['tl', 'tr', 'ml', 'mr', 'bl', 'br'] };
// los puntos de una cara: centro (cx, cy), separación (sx, sy) y radios
export const pips = (n, cx, cy, sx, sy, r, ry = r, ink = '#2A2226') => (PIPS[n] || []).map(k => {
  const [i, j] = PIP[k], one = n === 1;
  return `<ellipse cx="${(cx + i * sx).toFixed(1)}" cy="${(cy + j * sy).toFixed(1)}" rx="${(one ? r * 1.5 : r).toFixed(1)}" ry="${(one ? ry * 1.5 : ry).toFixed(1)}" fill="${one ? '#C8243A' : ink}"/>`;
}).join('');
export function dicePic(d = {}) {
  const t = d.t || 1, front = d.n ? 7 - d.n : 2; // (la de delante: la opuesta a la del norte)
  return '<svg class="tilePic dicePic" viewBox="0 0 100 140" aria-hidden="true">' +
    '<rect x="13" y="27" width="80" height="104" rx="16" fill="rgba(10,5,10,.38)"/>' +                                    // sombra
    '<rect x="7" y="17" width="86" height="108" rx="16" fill="#CFC3AE" stroke="#4A3F3A" stroke-width="2"/>' +               // cara de delante
    pips(front, 50, 115, 22, 4.2, 4.6, 2.6, '#4A3F3A') +
    '<rect x="7" y="17" width="86" height="88" rx="16" fill="#F6F0E2" stroke="#4A3F3A" stroke-width="2"/>' +                // cara de arriba
    '<path d="M14 36Q14 24 26 24H74L14 84Z" fill="rgba(255,255,255,.55)"/>' +                                              // luz arriba-izq
    '<path d="M86 34V88Q86 98 76 98H30" fill="none" stroke="rgba(120,100,80,.18)" stroke-width="4" stroke-linecap="round"/>' +
    `<g class="dicePips">${pips(t, 50, 61, 22, 22, 7.2)}</g>` +
    '<path d="M20 26Q20 23 24 23H70" stroke="#fff" stroke-width="2.6" fill="none" stroke-linecap="round"/>' +              // brillo
    '</svg>';
}
export default {
  type: 'dice',
  dice: true,
  block: true,          // (se rebota contra él; el motor le da su número antes que al bloque)
  device: true,         // nadie se queda encima
  cellClass: 'diceCell',
  pic: dicePic(),
  picFor: dicePic,
  tileClass: 'tile-dice',
  dust: 'felt',
  placeSound: 'diceDrop',
};
