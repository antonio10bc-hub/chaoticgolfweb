// Cartas de colocar loseta (negras): se juegan sobre una casilla libre y se quedan en la mesa.
function placeTile(type) {
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
  };
}

export const bunker = placeTile('bunker');
export const portal = placeTile('portal');
