// NO (naranja): cancela los efectos de la última carta jugada (rebobina el tablero).
import { cardDef } from './index.js';

export default {
  id: 'no',
  color: 'orange',
  copies: 2,
  icon: '<span class="ico ico-no"></span>',
  art: 'icon.no',
  canPlay(game) { return !!game.S.lastSnap; },
  play(game, p, idx) {
    const S = game.S;
    game.consumeCard(p, idx);
    game.restoreBoardSnap(S.lastSnap);
    game.emit({ t: 'rewind' }); // flash de "rebobinado" al restaurar el tablero (decorativo)
    game.log('log.cancelEffects', { card: S.lastCardLabel });
    // una colocación cancelada sale del tablero: su carta pasa a descartes
    if (cardDef(S.lastCardKey)?.staysOnBoard) S.discard.push(S.lastCardKey);
    S.lastSnap = null; S.lastCardLabel = null; S.lastCardKey = null;
    S.jaque = S.winner !== null; // si al restaurar sigue habiendo victoria, el JAQUE continúa
    game.afterPlay();
  },
};
