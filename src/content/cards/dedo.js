// Dedo 1-3 (negra): eliges 1, 2 o 3 pasos y mueves tu pelota casilla a casilla (en zigzag).
export default {
  id: 'dedo',
  color: 'black',
  copies: 2,
  icon: '<span class="ico ico-dedo"></span>',
  art: 'icon.dedo',
  stroke: true,
  face: { art: 'dedo', value: '1-3' },
  // el dedo solo puede usarse sobre tu propia pelota (multiverso: o una de sus copias, que se elige antes)
  play(game, p, idx) { game.playOwn(p, idx, this.id); },
  start(game, p, idx, ball) { game.setPending({ kind: 'dedoAmount', p, idx, ball }); },
};
