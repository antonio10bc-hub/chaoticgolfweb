// Cartas de la baraja del Gambling (0 copias fuera de su baraja: el resto de barajas no cambia). Reglas en
// src/engine/gambling.js (las monedas y la casilla dorada no son cartas: las pone la partida al empezar).
//   dado    (negra)   pon un dado en una casilla vacía: lo que choca contra él rebota tantas casillas como marca y el dado
//                     rueda una casilla hacia el otro lado (otra cara)
//   ruleta  (naranja) gira la ruleta: las pelotas en casillas del color que salga vuelven a su salida; con el dorado, la
//                     pelota que está en la casilla dorada gana la partida
// demo: escena de ejemplo para la presentación de la baraja (src/ui/deck-intro.js), que se juega con el motor
import { WHEEL } from '../../engine/gambling.js';

// el suelo de las escenas: ajedrezado, con la casilla dorada
const FLOOR = gold => ({ gold, coins: [] });
export const dado = {
  id: 'dado', color: 'black', copies: 0,
  tile: 'dice',
  staysOnBoard: true, // (como las demás piezas: no vuelve a los descartes)
  icon: '<span class="ico ico-dice"></span>',
  face: { art: 'dado' },
  canPlay: g => g.anyPlaceFor('dice'),
  blockedReason: 'reason.noDiceSpot',
  play(game, p, idx) { game.setPending({ kind: 'placeTile', p, idx, tileType: 'dice' }); },
  // el dado delante y un palo 3 que choca con él: rebota lo que marca (aquí, 4, más que lo que le quedaba) y el dado rueda
  demo: { cols: 7, rows: 4, seed: 1, hole: { x: 6, y: 0 }, ball: { x: 2, y: 2 }, spawn: { x: 0, y: 3 }, gamble: FLOOR({ x: 4, y: 0 }),
    card: 'dado', cell: { x: 5, y: 2 }, then: { card: 'palo3', dir: 'right' } },
};
// (la IA valora la ruleta por sus tres resultados posibles, cada uno con su probabilidad: una franja de cada color)
const odds = ['red', 'black', 'gold'].map(c => [WHEEL.indexOf(c), WHEEL.filter(x => x === c).length / WHEEL.length]);
export const ruleta = {
  id: 'ruleta', color: 'orange', copies: 0,
  icon: '<span class="ico ico-roulette"></span>',
  face: { art: 'ruleta' },
  random: true, // (lo que sale es al azar: sin vista previa)
  odds,
  play(game, p, idx) {
    game.consumeCard(p, idx);
    game.spinRoulette();
    game.afterPlay();
  },
  // sale negro: la pelota, que está en una casilla negra, vuelve a su salida
  demo: { cols: 5, rows: 4, hole: { x: 4, y: 0 }, ball: { x: 2, y: 1 }, spawn: { x: 0, y: 3 }, gamble: FLOOR({ x: 1, y: 0 }),
    card: 'ruleta', spin: WHEEL.indexOf('black') },
};
