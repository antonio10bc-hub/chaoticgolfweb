// (baraja del tren) piezas "virtuales": la locomotora es maciza como un bloque de madera (se rebota contra ella) y
// el vagón lleva arena como un búnker (atrapa). Se dibujan como piezas móviles, no en la casilla.
export const loco = { type: 'loco', block: true, device: true, virtual: true, cellClass: '', pic: '' };
export const wagon = { type: 'wagon', trap: true, virtual: true, cellClass: '', pic: '', stepSound: 'sandStep' };
