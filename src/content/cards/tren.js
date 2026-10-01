// Cartas de la baraja del tren (0 copias fuera de su baraja: el resto de barajas no cambia).
//   tren2       (negra)   la locomotora avanza 2 paradas
//   trenVuelta  (negra)   da una vuelta entera al circuito
//   oTren1      (naranja) avanza 1 parada, en cualquier momento (también durante un JAQUE)
//   vagon       (negra)   engancha un vagón de arena detrás del tren (3 como mucho); se queda en la mesa
// Sin tren en la partida (o sin sitio para otro vagón) no se pueden jugar.
const run = (opts) => function play(game, p, idx) {
  game.consumeCard(p, idx);
  game.trainRun(opts);
  game.afterPlay();
};
const hasTrain = g => !!g.S.train;
// escenas de ejemplo (presentación de la baraja, src/ui/deck-intro.js): un circuito que bordea un tablero de 6×5
// (índices: 0-5 arriba, 6-9 a la derecha, 10-14 abajo y 15-17 a la izquierda) con sus 4 paradas
const RING = [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [5, 1], [5, 2], [5, 3], [5, 4], [4, 4], [3, 4], [2, 4], [1, 4], [0, 4], [0, 3], [0, 2], [0, 1]];
const scene = (pos, rest, cars = 0) => ({ cols: 6, rows: 5, seed: 5, train: { path: RING, stations: [2, 7, 12, 16], pos, cars }, ...rest });

export const tren2 = {
  id: 'tren2', color: 'black', copies: 0,
  icon: '<span class="ico ico-train"></span>',
  face: { art: 'tren', value: '2' },
  blockedReason: 'reason.noTrain',
  canPlay: hasTrain,
  play: run({ stops: 2 }),
  // empuja la pelota por la recta de arriba y, en la curva, la saca del tablero
  demo: scene(16, { hole: { x: 3, y: 2 }, ball: { x: 2, y: 0 }, spawn: { x: 2, y: 3 }, card: 'tren2' }),
};
export const trenVuelta = {
  id: 'trenVuelta', color: 'black', copies: 0,
  icon: '<span class="ico ico-train"></span>',
  face: { art: 'trenLoop', value: '↻' },
  blockedReason: 'reason.noTrain',
  canPlay: hasTrain,
  play: run({ loop: true }),
  // vuelta entera: baja por la derecha empujando la pelota… hasta el hoyo (cuenta para su dueño)
  demo: scene(0, { hole: { x: 5, y: 3 }, ball: { x: 5, y: 1 }, card: 'trenVuelta' }, 1),
};
export const oTren1 = {
  id: 'oTren1', color: 'orange', copies: 0,
  icon: '<span class="ico ico-train"></span>',
  face: { art: 'tren', value: '1' },
  blockedReason: 'reason.noTrain',
  canPlay: hasTrain,
  play: run({ stops: 1 }),
  // una parada: empuja el hoyo por la vía (en un JAQUE, así se anula)
  demo: scene(12, { hole: { x: 0, y: 3 }, ball: { x: 3, y: 2 }, card: 'oTren1' }),
};
export const vagon = {
  id: 'vagon', color: 'black', copies: 0,
  staysOnBoard: true, // (el vagón se queda enganchado: no va a descartes)
  icon: '<span class="ico ico-wagon"></span>',
  face: { art: 'vagon' },
  blockedReason: 'reason.noWagon',
  canPlay: g => g.canAddWagon(),
  play(game, p, idx) {
    game.consumeCard(p, idx);
    game.addWagon();
    game.afterPlay();
  },
  // el vagón se engancha detrás… justo donde estaba la pelota: se queda en la arena
  demo: scene(2, { hole: { x: 3, y: 2 }, ball: { x: 1, y: 0 }, card: 'vagon' }),
};
