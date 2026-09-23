// Registro de cartas. Añadir una carta = crear su módulo y añadirla a CARD_LIST.
// El ORDEN importa: es el orden de construcción del mazo (y por tanto del barajado),
// de los paneles de debug/editor y del popover del mazo.
//
// Forma de una carta:
//   id, color ('black' | 'orange'), copies (copias por defecto en el mazo),
//   icon (HTML del icono CSS de respaldo), art / artRot (arte bitmap opcional),
//   stroke: true si cuenta como "golpe" en las estadísticas,
//   staysOnBoard: true si al jugarse se queda en la mesa (no va a descartes),
//   dir / dist (cartas de hoyo),
//   canPlay(game, p) -> bool   reglas propias además de las generales (opcional)
//   play(game, p, idx)         efecto al pulsarla: resuelve o abre una acción pendiente
// El nombre visible sale de i18n: cards.<id>.name / cards.<id>.short
import { t } from '../../i18n/index.js';
import { palo1, palo2, palo3 } from './palo.js';
import dedo from './dedo.js';
import { hoyoUp, hoyoDown, hoyoLeft, hoyoRight, oHoyoUp, oHoyoDown, oHoyoLeft, oHoyoRight } from './hoyo.js';
import { bunker, portal } from './place-tile.js';
import oPalo1 from './palo-reactivo.js';
import no from './no.js';

const CARD_LIST = [
  palo1, palo2, palo3, dedo,
  hoyoUp, hoyoDown, hoyoLeft, hoyoRight,
  bunker, portal,
  oPalo1,
  oHoyoUp, oHoyoDown, oHoyoLeft, oHoyoRight,
  no,
];

for (const c of CARD_LIST) {
  Object.defineProperty(c, 'name', { get() { return t(`cards.${c.id}.name`); }, configurable: true });
  Object.defineProperty(c, 'short', {
    get() { const s = t(`cards.${c.id}.short`); return s === `cards.${c.id}.short` ? undefined : s; },
    configurable: true,
  });
}

export const CARDS = Object.fromEntries(CARD_LIST.map(c => [c.id, c]));
export const CARD_KEYS = CARD_LIST.map(c => c.id);
export const cardDef = key => CARDS[key];

// copias por defecto de cada carta ({ id: n }, en el orden del registro)
export const defaultCounts = () => Object.fromEntries(CARD_LIST.map(c => [c.id, c.copies]));
