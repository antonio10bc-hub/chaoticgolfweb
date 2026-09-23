// Palo 1 reactivo (naranja): mueve 1 casilla CUALQUIER pelota (propia o rival).
// Durante el JAQUE puede sacar del hoyo la pelota que está dentro.
export default {
  id: 'oPalo1',
  color: 'orange',
  copies: 2,
  icon: '<span class="ico ico-palo"></span>',
  art: 'icon.palo',
  stroke: true,
  face: { art: 'paloReactivo', value: '1' },
  play(game, p, idx) {
    game.setPending({ kind: 'pickBall', p, idx, card: 'oPalo1' });
  },
};
