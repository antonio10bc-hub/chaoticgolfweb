// Baraja del multiverso: la roca que deja la lluvia de meteoritos (una por lluvia, en una casilla vacía). Es un muro,
// como el bloque de madera del minigolf: la pelota (o el hoyo) rebota y vuelve por donde venía; nadie se queda encima.
// Dibujo: un pedrusco casi cúbico que llena la casilla (cara de arriba con cráteres, cara de delante en sombra y unas
// grietas que aún brillan de calor), visto desde arriba y un poco de frente, como el bloque.
const PIC = '<svg class="tilePic rockPic" viewBox="0 0 100 140" aria-hidden="true">' +
  '<path d="M14 30L26 16H80L94 30V118L84 130H22L10 118Z" fill="rgba(20,10,30,.35)" transform="translate(5 6)"/>' +                         // sombra
  '<path d="M8 28L22 13H80L93 27V117L82 129H20L7 116Z" fill="#4A3E46" stroke="#2A2128" stroke-width="2" stroke-linejoin="round"/>' +        // cara de delante
  '<path d="M18 104L30 126M48 106L46 128M72 104L80 125" stroke="rgba(20,10,20,.35)" stroke-width="1.8" stroke-linecap="round"/>' +
  '<path d="M8 28L22 13H80L93 27V98L84 108H18L7 97Z" fill="#7A6A70" stroke="#2A2128" stroke-width="2" stroke-linejoin="round"/>' +          // cara de arriba
  '<path d="M15 31L26 20H76L86 30V92L79 100H22L14 92Z" fill="#8E7E83"/>' +                                                                   // bisel
  '<path d="M15 31L26 20H76L15 82Z" fill="rgba(255,240,230,.16)"/>' +                                                                        // luz arriba-izq
  '<ellipse cx="36" cy="44" rx="10" ry="7" fill="#6A5B61"/><ellipse cx="35" cy="42.5" rx="7.4" ry="4.8" fill="#5A4C52"/>' +                 // cráteres
  '<ellipse cx="66" cy="72" rx="12" ry="8" fill="#6A5B61"/><ellipse cx="65" cy="70.5" rx="9" ry="5.6" fill="#5A4C52"/>' +
  '<ellipse cx="62" cy="38" rx="4.5" ry="3" fill="#6A5B61"/><ellipse cx="30" cy="80" rx="5" ry="3.4" fill="#6A5B61"/>' +
  '<path d="M44 58L52 52L50 64L60 60" fill="none" stroke="#F2913A" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="rockGlow"/>' + // grietas calientes
  '<path d="M74 88L80 80M22 62L28 66" fill="none" stroke="#F2913A" stroke-width="1.8" stroke-linecap="round" class="rockGlow"/>' +
  '<path d="M18 30Q18 24 24 22H74" stroke="rgba(255,255,255,.35)" stroke-width="2.4" fill="none" stroke-linecap="round"/>' +                // brillo
  '</svg>';
export default {
  type: 'meteorite',
  block: true,
  device: true,         // nadie se queda encima (como el bloque)
  cellClass: 'crater',  // la casilla, chamuscada
  pic: PIC,
  tileClass: 'tile-meteorite',
  dust: 'rock',
  placeSound: 'meteor',
};
