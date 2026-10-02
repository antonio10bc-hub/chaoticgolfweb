// Baraja de las estaciones: lo que hay en el campo según la estación (src/engine/seasons.js tiene las reglas).
//   leaf    (otoño)     hoja seca: quien pasa por encima pierde 1 del tiro y la hoja se rompe
//   puddle  (otoño)     charco: resta 1 al tiro de quien pasa por encima (no atrapa)
//   ice     (invierno)  hielo: suma 1 al tiro (se resbala una casilla más)
//   plant   (primavera) planta carnívora: se come la pelota (o el hoyo) que se queda a su lado o encima
//   fire    (verano)    incendio: cruzarlo suma 2 al tiro; quedarse dentro es como caerse del tablero
//   snowball (invierno) la bola de nieve: pieza "virtual" que se mueve sola (como la locomotora). Atrapa como un
//            búnker, pero salir no cuesta nada (soft). Se dibuja en la capa de piezas (src/ui/seasons-view.js).
// Todas se ponen solo en casillas vacías y nunca en una salida ni en la casilla inicial del hoyo.
// Dibujos: vistos desde arriba en el viewBox de las losetas (100×140), con sombra suave.

const LEAF = 'M0 -31C7 -27 6 -19 12 -17C20 -15 15 -7 21 -3C27 1 17 7 19 13C21 21 9 20 4 26L0 33L-4 26C-9 20 -21 21 -19 13C-17 7 -27 1 -21 -3C-15 -7 -20 -15 -12 -17C-6 -19 -7 -27 0 -31Z';
const LEAF_PIC = '<svg class="tilePic leafPic" viewBox="0 0 100 140" aria-hidden="true">' +
  '<g transform="translate(40 66) rotate(38) scale(.62)" opacity=".9"><path d="' + LEAF + '" fill="#D9A441"/><path d="M0 -25V30" stroke="#A8743F" stroke-width="2.2" stroke-linecap="round"/></g>' +
  '<g class="leafSway" transform="translate(54 74) rotate(-22)">' +
  `<path d="${LEAF}" fill="rgba(40,30,10,.22)" transform="translate(4 5)"/>` +
  `<path d="${LEAF}" fill="#C9692E"/>` +
  '<path d="M0 -31C7 -27 6 -19 12 -17C20 -15 15 -7 21 -3C27 1 17 7 19 13C21 21 9 20 4 26L0 33Z" fill="#B4552A"/>' + // la mitad en sombra
  '<path d="M0 -25V40M0 -9L11 -15M0 3L14 0M0 14L10 15M0 -9L-11 -15M0 3L-14 0M0 14L-10 15" fill="none" stroke="#7E3A18" stroke-width="1.7" stroke-linecap="round"/>' +
  '<path d="M-12 -14C-9 -18 -6 -20 -3 -22" fill="none" stroke="rgba(255,230,180,.55)" stroke-width="2" stroke-linecap="round"/>' +
  '</g></svg>';

const PUDDLE_PIC = '<svg class="tilePic puddlePic" viewBox="0 0 100 140" aria-hidden="true">' +
  '<path d="M18 70C14 52 30 44 46 47C58 49 64 42 76 46C90 51 92 66 86 78C80 92 62 98 46 96C28 94 21 84 18 70Z" fill="rgba(30,60,70,.18)" transform="translate(2 4)"/>' +
  '<path d="M18 70C14 52 30 44 46 47C58 49 64 42 76 46C90 51 92 66 86 78C80 92 62 98 46 96C28 94 21 84 18 70Z" fill="#6FA8BC"/>' +
  '<path d="M24 70C21 56 34 50 47 52C57 54 63 48 74 51C85 55 86 66 82 75C77 87 61 91 47 90C33 88 26 81 24 70Z" fill="#8CC2D3"/>' +
  '<g class="puddleRing"><ellipse cx="56" cy="70" rx="14" ry="7" fill="none" stroke="rgba(255,255,255,.7)" stroke-width="1.6"/></g>' +
  '<path d="M33 62C38 57 45 56 51 57" fill="none" stroke="rgba(255,255,255,.75)" stroke-width="2.6" stroke-linecap="round"/>' +
  '<path d="M68 84C72 82 75 79 77 76" fill="none" stroke="rgba(255,255,255,.4)" stroke-width="2" stroke-linecap="round"/>' +
  '</svg>';

// hielo: una placa helada que cubre casi toda la casilla, de borde irregular con escarcha, facetas, grietas y brillos
const ICE_EDGE = 'M10 16C24 7 38 11 52 8C66 5 80 9 90 15C95 34 91 52 94 70C97 88 92 108 89 126C74 133 60 129 47 132C33 135 19 131 10 125C5 106 9 88 6 70C3 52 8 34 10 16Z';
const ICE_PIC = '<svg class="tilePic icePic" viewBox="0 0 100 140" aria-hidden="true">' +
  `<path d="${ICE_EDGE}" fill="rgba(30,70,90,.16)" transform="translate(2 3)"/>` +
  `<path d="${ICE_EDGE}" fill="#BFE3F0"/>` +
  '<path d="M10 16C24 7 38 11 52 8C66 5 80 9 90 15C88 30 72 44 50 52C34 58 18 66 7 80C5 60 8 34 10 16Z" fill="#D7EFF8"/>' +       // facetas claras
  '<path d="M94 70C97 88 92 108 89 126C74 133 60 129 47 132C58 116 72 98 94 70Z" fill="#A9D5E6"/>' +                             // y en sombra
  '<path d="M50 52L30 90L38 132M50 52L78 38M50 52L72 96L89 126M30 90L8 98M72 96L94 84" fill="none" stroke="rgba(255,255,255,.75)" stroke-width="1.3" stroke-linejoin="round"/>' + // grietas
  '<path d="M30 90L22 104M72 96L60 110" fill="none" stroke="rgba(120,180,205,.55)" stroke-width="1.1"/>' +
  `<path d="${ICE_EDGE}" fill="none" stroke="#F4FBFE" stroke-width="3" stroke-dasharray="1 7" stroke-linecap="round" opacity=".9"/>` + // escarcha
  `<path d="${ICE_EDGE}" fill="none" stroke="#8CC6DA" stroke-width="1.6"/>` +
  '<g class="iceShine"><path d="M20 30L42 18M22 44L54 26M64 112L82 100" stroke="#fff" stroke-width="3" stroke-linecap="round"/></g>' +
  '<path d="M76 60l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#fff" class="iceSpark"/><path d="M26 112l1.4 3.4 3.4 1.4-3.4 1.4-1.4 3.4-1.4-3.4-3.4-1.4 3.4-1.4z" fill="#fff" class="iceSpark" style="animation-delay:-1.2s"/>' +
  '</svg>';

// dionea: dos lóbulos rojos con dientes que se abren y se cierran despacio, sobre su roseta de hojas
const JAW = side => `<g class="plantJaw ${side}"><path d="M0 0C${side === 'l' ? '-6 -16 -26 -20 -30 -6C-32 2 -22 6 -12 4' : '6 -16 26 -20 30 -6C32 2 22 6 12 4'}Z" fill="#C8463F"/>` +
  `<path d="M0 0C${side === 'l' ? '-6 -12 -20 -14 -24 -5' : '6 -12 20 -14 24 -5'}" fill="none" stroke="#E98A77" stroke-width="3" stroke-linecap="round"/>` +
  `<path d="${side === 'l' ? 'M-30 -6l-5 -3M-27 -13l-4 -5M-20 -17l-1 -6M-12 -17l2 -6' : 'M30 -6l5 -3M27 -13l4 -5M20 -17l1 -6M12 -17l-2 -6'}" stroke="#F1E6C0" stroke-width="2" stroke-linecap="round"/></g>`;
const PLANT_PIC = '<svg class="tilePic plantPic" viewBox="0 0 100 140" aria-hidden="true">' +
  '<ellipse cx="53" cy="94" rx="30" ry="10" fill="rgba(20,40,10,.22)"/>' +
  '<g fill="#4F8A3A"><path d="M50 92C34 92 20 86 16 76C30 76 42 82 50 92Z"/><path d="M50 92C66 92 80 86 84 76C70 76 58 82 50 92Z"/><path d="M50 92C42 98 30 104 24 102C30 94 42 92 50 92Z"/><path d="M50 92C58 98 70 104 76 102C70 94 58 92 50 92Z"/></g>' +
  '<path d="M50 92C49 80 50 70 50 62" stroke="#3E7230" stroke-width="5" stroke-linecap="round" fill="none"/>' +
  '<g transform="translate(50 62)"><g class="plantHead">' + JAW('l') + JAW('r') +
  '<ellipse cx="0" cy="-1" rx="5" ry="3.6" fill="#8E2B28"/></g></g>' +
  '</svg>';

// incendio: lenguas de fuego que tiemblan sobre la hierba quemada, con chispas
// (la llama que tiembla va dentro del grupo colocado: una animación CSS de transform pisaría el transform del SVG)
const FLAME = (x, s, d, c1, c2) => `<g transform="translate(${x} 96) scale(${s})"><g class="flame" style="--fd:${d}s">` +
  `<path d="M0 0C-14 0 -18 -14 -10 -28C-6 -36 -4 -44 -6 -54C4 -46 14 -34 14 -20C14 -8 10 0 0 0Z" fill="${c1}"/>` +
  `<path d="M0 0C-7 0 -9 -8 -5 -16C-3 -21 -2 -26 -3 -31C3 -26 8 -18 7 -10C7 -4 5 0 0 0Z" fill="${c2}"/></g></g>`;
const FIRE_PIC = '<svg class="tilePic firePic" viewBox="0 0 100 140" aria-hidden="true">' +
  '<ellipse cx="50" cy="98" rx="38" ry="12" fill="rgba(40,16,6,.35)"/>' +
  FLAME(30, .78, 0, '#E8873A', '#FFD23F') + FLAME(70, .82, -.35, '#E8873A', '#FFD23F') + FLAME(50, 1.12, -.7, '#D9603A', '#FFB33F') +
  '<g class="sparks" fill="#FFE38A"><circle cx="34" cy="40" r="2"/><circle cx="64" cy="34" r="1.6"/><circle cx="52" cy="26" r="1.4"/></g>' +
  '</svg>';

const base = { seasonal: true, cellClass: '' };
export const leaf = { ...base, type: 'leaf', leaf: true, cellClass: 'leafy', pic: LEAF_PIC, tileClass: 'tile-leaf', dust: 'leaf', placeSound: 'leaf' };
export const puddle = { ...base, type: 'puddle', puddle: true, cellClass: 'puddly', pic: PUDDLE_PIC, tileClass: 'tile-puddle', dust: 'water', placeSound: 'drip', stepSound: 'drip' };
export const ice = { ...base, type: 'ice', ice: true, cellClass: 'icy', pic: ICE_PIC, tileClass: 'tile-ice', dust: 'snow', placeSound: 'ice', stepSound: 'ice' };
export const plant = { ...base, type: 'plant', plant: true, cellClass: 'planty', pic: PLANT_PIC, tileClass: 'tile-plant', dust: 'leaf', placeSound: 'plant' };
export const fire = { ...base, type: 'fire', fire: true, cellClass: 'burning', pic: FIRE_PIC, tileClass: 'tile-fire', dust: 'ash', placeSound: 'fire' };
export const snowball = { type: 'snowball', trap: true, soft: true, virtual: true, cellClass: '', pic: '', stepSound: 'snow' };
