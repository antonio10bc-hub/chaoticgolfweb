// Cartas de mover el hoyo: dirección y distancia impresas en la carta.
// Negras (+2) en tu turno; naranjas (+1) en cualquier momento, también durante el JAQUE.
function hoyo(id, color, dir, dist, artRot) {
  return {
    id, color, dir, dist,
    copies: color === 'black' ? 2 : 1,
    icon: `<span class="ico ico-hoyo ${dir}"></span>`,
    art: dist === 2 ? 'icon.hoyo2' : 'icon.hoyo1', // flecha hacia ARRIBA: el juego la rota
    artRot,
    face: { art: 'hoyo', value: '+' + dist, dir },
    blockedReason: 'reason.holeTrapped',
    // con el hoyo en una trampa, la carta pierde 1 de distancia (un +1 se queda en 0)
    canPlay(game) { return game.holeMoveDist(this) > 0; },
    play(game, p, idx) {
      const dist = game.holeMoveDist(this);
      if (game.holeInTrap()) {
        if (dist <= 0) { game.notice('notice.holeTrapped', { card: this.name }); return; }
        game.log('log.holeLeavesTrap', { n: dist });
      }
      game.consumeCard(p, idx);
      // mover el hoyo durante un JAQUE anula la victoria: las pelotas salen del hoyo
      if (game.S.jaque && game.S.winner !== null) game.popHoledBalls();
      game.moveHole(this.dir, dist);
      game.afterPlay();
    },
  };
}

export const hoyoUp = hoyo('hoyoUp', 'black', 'up', 2, 0);
export const hoyoDown = hoyo('hoyoDown', 'black', 'down', 2, 180);
export const hoyoLeft = hoyo('hoyoLeft', 'black', 'left', 2, 270);
export const hoyoRight = hoyo('hoyoRight', 'black', 'right', 2, 90);
export const oHoyoUp = hoyo('oHoyoUp', 'orange', 'up', 1, 0);
export const oHoyoDown = hoyo('oHoyoDown', 'orange', 'down', 1, 180);
export const oHoyoLeft = hoyo('oHoyoLeft', 'orange', 'left', 1, 270);
export const oHoyoRight = hoyo('oHoyoRight', 'orange', 'right', 1, 90);
