// Río (baraja de agua): una corriente vertical que siempre baja. Quien entra pierde el resto del
// movimiento y el agua lo arrastra hasta la casilla justo debajo del final del río.
// Se coloca en cualquier casilla libre la primera vez; después solo alarga el río por arriba o por abajo.
export default {
  type: 'river',
  river: true,
  maxOnBoard: 5,
  cellClass: 'water river',
  // la corriente (chevrones que bajan) es un patrón continuo de la casilla, alineado con el tablero,
  // para que varios tramos seguidos se lean como un solo río (ver board.css)
  pic: '',
  tileClass: 'tile-river',
  dust: 'water',
  placeSound: 'splash',
};
