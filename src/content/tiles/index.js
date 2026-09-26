// Registro de losetas. El motor solo mira los rasgos (trap / portal); el resto
// (clase de casilla, arte, etiqueta) lo usa la interfaz.
//
// Rasgos:
//   trap   — al entrar con movimientos pendientes se pierden todos; salir cuesta 1
//            (palo, dedo, movimiento transferido y cartas de hoyo). Ej.: búnker.
//   portal — no cuenta como casilla: teletransporta al otro portal y se sigue en
//            la misma dirección. Máximo 2 en la mesa.
//   river  — (agua) corriente que baja: para el movimiento y arrastra hasta debajo del río.
//   lake   — (agua) caer dentro es como caerse del tablero.
// Sonido (opcional, interfaz): placeSound al colocarla, stepSound al rodar por encima.
import bunker from './bunker.js';
import portal from './portal.js';
import river from './river.js';
import lake from './lake.js';

export const TILES = { bunker, portal, river, lake };

export const tileDef = type => TILES[type];
export const isTrap = tile => !!(tile && TILES[tile.type]?.trap);
export const isPortal = tile => !!(tile && TILES[tile.type]?.portal);
export const isRiver = tile => !!(tile && TILES[tile.type]?.river);
export const isLake = tile => !!(tile && TILES[tile.type]?.lake);
export const isWater = tile => isRiver(tile) || isLake(tile);
