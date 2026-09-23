// Dedo 1-3 (negra): eliges 1, 2 o 3 pasos y mueves tu pelota casilla a casilla (en zigzag).
export default {
  id: 'dedo',
  color: 'black',
  copies: 2,
  icon: '<span class="ico ico-dedo"></span>',
  art: 'icon.dedo',
  stroke: true,
  face: { art: 'dedo', value: '1-3' },
  play(game, p, idx) {
    // el dedo solo puede usarse sobre tu propia pelota
    game.setPending({ kind: 'dedoAmount', p, idx, ball: game.ownBall(p) });
  },
};
