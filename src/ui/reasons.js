// ¿Por qué no se puede jugar esta carta ahora? — feedback claro al pulsar una carta bloqueada.
// Replica, en el mismo orden, las comprobaciones de Game.canPlay y devuelve un texto.
import { CARDS } from '../content/cards/index.js';
import { t } from '../i18n/index.js';

export function blockedReason(g, p, key) {
  const S = g.S, def = CARDS[key];
  if (!def) return null;
  if (g.godMode) return t('reason.godMode');
  if (g.pending) return t('reason.pending');
  if (S.winner !== null && !S.jaque) return t('reason.over');
  if (S.winner !== null && def.color !== 'orange') return t('reason.jaqueOrange');
  if (def.color === 'black' && p !== S.turn) return t('reason.notYourTurn');
  if (def.color === 'black' && S.blackPlayed >= 2) return t('reason.twoBlacks');
  if (def.canPlay && !def.canPlay(g, p)) return def.blockedReason ? t(def.blockedReason) : t('reason.generic');
  return null;
}
