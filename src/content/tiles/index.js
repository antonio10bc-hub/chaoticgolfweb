// Registro de losetas. El motor solo mira los rasgos (trap / portal); el resto
// (clase de casilla, arte, etiqueta) lo usa la interfaz.
//
// Rasgos:
//   trap   — al entrar con movimientos pendientes se pierden todos; salir cuesta 1
//            (palo, dedo, movimiento transferido y cartas de hoyo). Ej.: búnker.
//   portal — no cuenta como casilla: teletransporta al otro portal y se sigue en
//            la misma dirección. Máximo 2 en la mesa.
import bunker from './bunker.js';
import portal from './portal.js';

export const TILES = { bunker, portal };

export const tileDef = type => TILES[type];
export const isTrap = tile => !!(tile && TILES[tile.type]?.trap);
export const isPortal = tile => !!(tile && TILES[tile.type]?.portal);
