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
//   block / corner / tunnel — (minigolf, `device`) piezas de madera que no cuentan como casilla:
//            el bloque hace rebotar, la esquina desvía 90° (o rebota por la espalda), el túnel
//            saca por un lado al azar. Nadie se queda encima.
//   launcher — (minigolf) al pasar por encima, vuela 5 casillas hacia su flecha; gira cada turno.
//   rotates — se elige la orientación (`rot`) al colocarla; picFor(tile) la dibuja.
// Sonido (opcional, interfaz): placeSound al colocarla, stepSound al rodar por encima.
import bunker from './bunker.js';
import portal from './portal.js';
import river from './river.js';
import lake from './lake.js';
import block from './block.js';
import corner from './corner.js';
import tunnel from './tunnel.js';
import launcher from './launcher.js';

export const TILES = { bunker, portal, river, lake, block, corner, tunnel, launcher };

export const tileDef = type => TILES[type];
export const isTrap = tile => !!(tile && TILES[tile.type]?.trap);
export const isPortal = tile => !!(tile && TILES[tile.type]?.portal);
export const isRiver = tile => !!(tile && TILES[tile.type]?.river);
export const isLake = tile => !!(tile && TILES[tile.type]?.lake);
export const isWater = tile => isRiver(tile) || isLake(tile);
export const isBlock = tile => !!(tile && TILES[tile.type]?.block);
export const isCorner = tile => !!(tile && TILES[tile.type]?.corner);
export const isTunnel = tile => !!(tile && TILES[tile.type]?.tunnel);
export const isLauncher = tile => !!(tile && TILES[tile.type]?.launcher);
export const isDevice = tile => !!(tile && TILES[tile.type]?.device);
// dibujo de una loseta concreta (las que giran dependen de su orientación)
export const tilePic = tile => { const d = TILES[tile?.type]; return d?.picFor ? d.picFor(tile) : d?.pic || ''; };
