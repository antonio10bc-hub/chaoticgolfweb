// Cartas de colocar loseta (negras): se juegan sobre una casilla libre y se quedan en la mesa.
// extra: rasgos propios (copias, canPlay…). El agua (río y lago) solo existe en la baraja de agua:
// 0 copias por defecto, así el resto de barajas no cambia.
function placeTile(type, extra = {}) {
  return {
    id: type,
    color: 'black',
    copies: 2,
    tile: type,
    staysOnBoard: true, // no entra en descartes (el rebarajado nunca duplica cartas en mesa)
    icon: `<span class="ico ico-${type}"></span>`,
    art: 'icon.' + type,
    face: { art: type },
    play(game, p, idx) {
      game.setPending({ kind: 'placeTile', p, idx, tileType: type });
    },
    ...extra,
  };
}

export const bunker = placeTile('bunker');
export const portal = placeTile('portal');
// sin sitio donde crecer (o ya hay 5), no se puede jugar
// demo: escena de ejemplo para la presentación de las cartas nuevas de una baraja (src/ui/deck-intro.js):
//   un tablero pequeño, sus losetas, una pelota (con su salida) y una jugada que el motor resuelve de verdad
export const river = placeTile('river', { copies: 0, canPlay: g => g.anyPlaceFor('river'), blockedReason: 'reason.noRiverSpot',
  demo: { cols: 5, rows: 5, hole: { x: 4, y: 4 }, ball: { x: 0, y: 1 }, tiles: [{ type: 'river', x: 2, y: 0 }, { type: 'river', x: 2, y: 1 }, { type: 'river', x: 2, y: 2 }],
    card: 'palo3', dir: 'right' } });
export const lake = placeTile('lake', { copies: 0, canPlay: g => g.anyPlaceFor('lake'), blockedReason: 'reason.noLakeSpot',
  demo: { cols: 5, rows: 5, hole: { x: 4, y: 0 }, ball: { x: 0, y: 2 }, spawn: { x: 1, y: 4 }, tiles: [{ type: 'lake', x: 2, y: 1 }, { type: 'lake', x: 2, y: 2 }, { type: 'lake', x: 3, y: 2 }],
    card: 'palo3', dir: 'right' } });
