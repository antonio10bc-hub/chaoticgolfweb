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
export const river = placeTile('river', { copies: 0, canPlay: g => g.anyPlaceFor('river'), blockedReason: 'reason.noRiverSpot' });
export const lake = placeTile('lake', { copies: 0, canPlay: g => g.anyPlaceFor('lake'), blockedReason: 'reason.noLakeSpot' });
