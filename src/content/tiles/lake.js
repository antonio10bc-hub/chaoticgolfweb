// Lago (baraja de agua): agua quieta. Caer dentro es como caerse del tablero: la pelota (o el hoyo)
// vuelve a su salida. La primera carta va en cualquier casilla libre; las siguientes, pegadas por un
// lado a una casilla de lago que ya esté en la mesa (el lago crece).
export default {
  type: 'lake',
  lake: true,
  maxOnBoard: 5,
  cellClass: 'water lake',
  // agua quieta: reflejos que respiran despacio y un nenúfar (ver board.css)
  // reflejos y ondas: un patrón continuo en coordenadas del tablero (board.css); aquí solo el nenúfar
  pic: '<svg class="tilePic lakePic" viewBox="0 0 100 140" aria-hidden="true">' +
    '<g transform="translate(62 84)"><g class="padBob"><ellipse cx="2" cy="4" rx="15" ry="5" fill="rgba(10,40,50,.25)"/><path d="M0 0L14 -4A15 15 0 1 1 13 6Z" fill="#5E9A58" transform="rotate(-20)"/><path d="M0 0L9 -8" stroke="#4A8546" stroke-width="1.2"/><circle cx="-1" cy="1" r="2.2" fill="#F2B6C8"/></g></g>' +
    '</svg>',
  tileClass: 'tile-lake',
  dust: 'water',
  placeSound: 'splash',
};
