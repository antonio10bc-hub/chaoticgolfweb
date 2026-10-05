// Baraja del multiverso: el agujero negro (src/engine/multiverse.js tiene las reglas). Se traga la pelota que pasa o
// se para a su lado (en cruz) y salen 4: la original y 3 copias, una por dirección. Se queda en el tablero.
// Dibujo: Gargantua (Interstellar), visto casi de canto (viewBox 100×140): la sombra negra con su anillo de fotones, la luz
// del disco curvada por la gravedad formando un arco grueso por encima y uno fino por debajo, y el disco de acreción
// cruzando por delante (más brillante a la izquierda, la parte que se acerca). La luz fluye por el disco (.bhFlow).
// Sin degradados por id (en el tablero hay muchos y alguno puede estar oculto): capas de trazos con opacidad.
export const BH_GARGANTUA = (cx, cy, k = 1) => {
  const X = v => (cx + v * k).toFixed(1), Y = v => (cy + v * k).toFixed(1), R = v => (v * k).toFixed(1);
  const arc = (r, top, w, c, o = 1) => `<path d="M${X(-r)} ${Y(0)}A${R(r)} ${R(r)} 0 0 ${top ? 1 : 0} ${X(r)} ${Y(0)}" fill="none" stroke="${c}" stroke-width="${R(w)}" opacity="${o}" stroke-linecap="round"/>`;
  const disk = (half, w, c, o = 1, cls = '') => `<path${cls ? ` class="${cls}"` : ''} d="M${X(-47)} ${Y(1)}A${R(47)} ${R(6)} 0 0 ${half === 'front' ? 0 : 1} ${X(47)} ${Y(1)}" fill="none" stroke="${c}" stroke-width="${R(w)}" opacity="${o}" stroke-linecap="round"/>`;
  return `<circle cx="${X(0)}" cy="${Y(0)}" r="${R(44)}" fill="#FFB45A" opacity=".07"/><circle cx="${X(0)}" cy="${Y(0)}" r="${R(32)}" fill="#FFB45A" opacity=".1"/>` +
    // la mitad de detrás del disco (la tapa la sombra)
    disk('back', 7, '#B8551F', .5) + disk('back', 3.6, '#F4A954', .9) + disk('back', 1.2, '#FFF1D2', .9) +
    // la luz del disco, curvada: arco grueso arriba y fino abajo
    `<g class="bhRing">` + arc(24, true, 10, '#B8551F', .45) + arc(23, true, 6, '#F4A954') + arc(22.4, true, 2.2, '#FFF4DC') +
    arc(21, false, 4.4, '#E8873A', .7) + arc(20.6, false, 1.4, '#FFE7B8', .85) + `</g>` +
    // la sombra y su anillo de fotones
    `<circle cx="${X(0)}" cy="${Y(0)}" r="${R(18)}" fill="#020104"/><circle cx="${X(0)}" cy="${Y(0)}" r="${R(18.6)}" fill="none" stroke="#FFF6E2" stroke-width="${R(1)}" opacity=".95"/>` +
    // la mitad de delante del disco, por encima de la sombra; a la izquierda, más brillo (se acerca)
    disk('front', 8, '#B8551F', .55) + disk('front', 4.6, '#F4A954') + disk('front', 1.6, '#FFF4DC') +
    `<path d="M${X(-46)} ${Y(1.5)}A${R(47)} ${R(6)} 0 0 0 ${X(-10)} ${Y(6.6)}" fill="none" stroke="#FFFBEF" stroke-width="${R(2.6)}" opacity=".9" stroke-linecap="round"/>` +
    disk('front', 1.1, '#FFFFFF', .85, 'bhFlow');
};
const PIC = '<svg class="tilePic bhPic" viewBox="0 0 100 140" aria-hidden="true">' + BH_GARGANTUA(50, 70) +
  '<circle cx="18" cy="38" r="1.4" fill="#fff" opacity=".8"/><circle cx="82" cy="42" r="1.1" fill="#fff" opacity=".7"/><circle cx="76" cy="106" r="1.3" fill="#fff" opacity=".6"/><circle cx="22" cy="102" r="1" fill="#fff" opacity=".6"/>' +
  '</svg>';
export default {
  type: 'blackhole',
  blackhole: true,
  cellClass: 'space',     // la casilla, de noche
  tileClass: 'tile-blackhole',
  dust: 'space',
  placeSound: 'warpHum',
  pic: PIC,
};
