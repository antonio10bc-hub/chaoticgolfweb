// Palo N (negra): tu pelota avanza N casillas en línea recta.
// Salir de una trampa (búnker) cuesta 1, así que un palo 1 no se puede jugar desde ella.
// copies: copias en la baraja clásica (los palos largos, 0: solo existen en minigolf y Ultimate)
function palo(n, copies = 6) {
  return {
    id: 'palo' + n,
    color: 'black',
    copies,
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
export const palo4 = palo(4, 0);
export const palo5 = palo(5, 0);
export const palo10 = palo(10, 0);

// Palo iridiscente (Ultimate): la pelota avanza sin parar hasta chocar con algo. Se para justo antes
// de un bloque; si choca con otra pelota, la golpeada hereda todo el impulso; si no hay nada, se cae.
export const paloIri = {
  id: 'paloIri',
  color: 'black',
  copies: 0,
  icon: '<span class="ico ico-palo"></span>',
  stroke: true,
  face: { art: 'paloIri', value: '∞' },
  play(game, p, idx) {
    const ball = game.ownBall(p);
    // se elige la dirección tocando una casilla vecina
    const targets = Object.entries(DIRS_FOR_IRI).map(([dir, [dx, dy]]) => ({ x: ball.x + dx, y: ball.y + dy, dir, out: false }))
      .filter(tg => game.inBoard(tg.x, tg.y));
    game.setPending({ kind: 'move', p, idx, n: 1, untilHit: true, ball, targets });
  },
  demo: { cols: 7, rows: 5, hole: { x: 6, y: 0 }, ball: { x: 0, y: 2 }, extraBalls: [{ x: 3, y: 2 }], tiles: [], card: 'paloIri', dir: 'right' },
};
const DIRS_FOR_IRI = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
