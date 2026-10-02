// Dibujos de la baraja de las estaciones (puros: sin DOM), compartidos por la partida, las cartas, la presentación de la
// baraja, el anuncio de baraja nueva y el creador: el icono de cada estación y la bola de nieve vista desde arriba.
// Estilo de siempre: formas planas, trazo fino y sombra suave.

// icono de cada estación en un cuadro de 24×24 (flor de cerezo · sol · hoja · copo)
const PETAL = 'M0 0C-3.4 -2.6 -3.6 -7.2 0 -9.6C3.6 -7.2 3.4 -2.6 0 0Z';
export const SEASON_ICON = {
  spring: '<g transform="translate(12 12.4)">' + [0, 72, 144, 216, 288].map(a => `<path d="${PETAL}" transform="rotate(${a})" fill="#F4A9C4"/>`).join('') +
    '<circle r="2.6" fill="#F7D774"/><circle r="1" fill="#E8873A"/></g>',
  summer: '<g transform="translate(12 12)"><g stroke="#F2B705" stroke-width="2" stroke-linecap="round">' +
    [0, 45, 90, 135, 180, 225, 270, 315].map(a => `<path d="M0 -8.4V-10.6" transform="rotate(${a})"/>`).join('') + '</g>' +
    '<circle r="5.6" fill="#FFD23F"/><circle cx="-1.6" cy="-1.6" r="1.8" fill="#FFF0A8"/></g>',
  autumn: '<g transform="translate(12 12.5) rotate(-18) scale(.34)"><path d="M0 -31C7 -27 6 -19 12 -17C20 -15 15 -7 21 -3C27 1 17 7 19 13C21 21 9 20 4 26L0 33L-4 26C-9 20 -21 21 -19 13C-17 7 -27 1 -21 -3C-15 -7 -20 -15 -12 -17C-6 -19 -7 -27 0 -31Z" fill="#D9703A"/>' +
    '<path d="M0 -25V36M0 -9L11 -15M0 3L14 0M0 -9L-11 -15M0 3L-14 0" fill="none" stroke="#8A3E18" stroke-width="3" stroke-linecap="round"/></g>',
  winter: '<g transform="translate(12 12)" stroke="#5FA9D6" stroke-width="1.9" stroke-linecap="round" fill="none">' +
    [0, 60, 120].map(a => `<path d="M0 -9.5V9.5M-2.6 -7L0 -4.6L2.6 -7M-2.6 7L0 4.6L2.6 7" transform="rotate(${a})"/>`).join('') + '</g>',
};
export const seasonIcon = (s, cls = 'seIco') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${SEASON_ICON[s] || ''}</svg>`;

// bola de nieve vista desde arriba (viewBox 100×100): nieve apretada de contorno irregular, con su volumen en capas
// planas (la sombra azulada abajo a la derecha, la luz arriba a la izquierda), grumos, el brillo y algún destello.
// La textura (.snowTex) gira al rodar
const SNOW_D = 'M94.0 42.0Q94.2 50.0 94.0 58.0Q93.8 65.9 88.3 71.7Q82.8 77.5 78.0 83.9Q73.3 90.4 65.4 91.3Q57.4 92.1 49.5 94.7Q41.7 97.3 35.1 92.2Q28.6 87.1 21.5 83.5Q14.3 80.0 12.0 72.3Q9.8 64.6 6.6 57.3Q3.4 50.0 5.9 42.4Q8.5 34.9 11.4 27.5Q14.3 20.0 21.5 16.5Q28.6 12.9 35.3 8.5Q41.9 4.1 49.7 6.0Q57.4 7.9 65.7 8.1Q74.0 8.4 78.4 15.5Q82.8 22.5 88.3 28.3Q93.8 34.1 94.0 42.0Z';
export const SNOWBALL = '<svg class="snowSvg" viewBox="0 0 100 100" aria-hidden="true">' +
  `<path d="${SNOW_D}" fill="rgba(25,50,70,.3)" transform="translate(6 9)"/>` +              // sombra en el suelo
  `<path d="${SNOW_D}" fill="#D5E5EE"/>` +                                                   // la bola (en sombra)
  `<path d="M86.1 43.5Q86.2 50.0 86.1 56.5Q85.9 63.1 81.4 67.8Q76.9 72.6 73.0 77.8Q69.1 83.1 62.6 83.8Q56.1 84.6 49.6 86.7Q43.2 88.8 37.8 84.6Q32.5 80.4 26.6 77.5Q20.7 74.6 18.9 68.3Q17.0 62.0 14.4 56.0Q11.8 50.0 13.9 43.8Q15.9 37.6 18.3 31.5Q20.7 25.4 26.6 22.5Q32.5 19.6 37.9 16.0Q43.4 12.4 49.7 13.9Q56.1 15.4 62.9 15.7Q69.7 15.9 73.3 21.7Q76.9 27.4 81.4 32.2Q85.9 36.9 86.1 43.5Z" fill="#F2F8FB" transform="translate(-4 -4)"/>` +                          // la cara iluminada
  '<path d="M18 46C20 28 34 16 52 15C40 22 30 32 27 48Z" fill="#FFFFFF"/>' +                    // luz
  '<g class="snowTex">' +
  '<path d="M26 60c5 4 11 5 16 3M58 30c5-1 10 1 13 5M60 64c4-3 9-3 12 0M36 34c3-2 7-2 9 0" fill="none" stroke="#C9DCE8" stroke-width="3.2" stroke-linecap="round"/>' +
  '<g fill="#FFFFFF"><circle cx="66" cy="44" r="4.4"/><circle cx="40" cy="70" r="3.6"/><circle cx="52" cy="52" r="2.6"/><circle cx="30" cy="48" r="2.2"/><circle cx="74" cy="62" r="2.8"/></g>' +
  '<g fill="#BFD5E3"><circle cx="68" cy="46" r="1.8"/><circle cx="42" cy="72" r="1.5"/><circle cx="76" cy="64" r="1.2"/></g></g>' +
  `<path d="${SNOW_D}" fill="none" stroke="#A7C3D4" stroke-width="2"/>` +
  '<ellipse cx="34" cy="27" rx="9" ry="4.6" fill="#fff" transform="rotate(-32 34 27)"/>' +
  '<path class="snowSpark" d="M71 22l1.6 4 4 1.6-4 1.6-1.6 4-1.6-4-4-1.6 4-1.6z" fill="#fff"/>' +
  '</svg>';
