// Palo N (negra): tu pelota avanza N casillas en línea recta.
// Salir de una trampa (búnker) cuesta 1, así que un palo 1 no se puede jugar desde ella.
function palo(n) {
  return {
    id: 'palo' + n,
    color: 'black',
    copies: 6,
    icon: '<span class="ico ico-palo"></span>',
    art: 'icon.palo',
    stroke: true,
    face: { art: 'palo', value: String(n) },
    blockedReason: 'reason.paloTrap',
    canPlay(game, p) { return !(n <= 1 && game.inTrap(game.ownBall(p))); },
    play(game, p, idx) {
      const ball = game.ownBall(p);
      game.setPending({ kind: 'move', p, idx, n, ball, targets: game.straightTargets(ball, n) });
    },
  };
}

export const palo1 = palo(1);
export const palo2 = palo(2);
export const palo3 = palo(3);
