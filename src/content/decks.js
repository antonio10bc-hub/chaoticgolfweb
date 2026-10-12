// Barajas de la partida rápida: cada una es el mazo base más su tipo de cartas especiales.
// `locked`: aún no se puede jugar (se muestra en Modos de juego como "Próximamente").
// `color`: color de la baraja (tarjeta, emblema y etiqueta).
// `counts(base)`: el mazo de la baraja a partir de las copias por defecto de cada carta.
// `scene`: fondo propio de la partida (clase en #gameScreen; ver styles/features.css).
// `newCards`: las cartas especiales de la baraja. La primera vez que se juega, se presentan con un
// tablero de ejemplo animado (src/ui/deck-intro.js; cada carta define su escena en `demo`).
import { defaultCounts } from './cards/index.js';

// tamaños de la partida rápida (pequeño, mediano, grande), los mismos para todas las barajas (Ultimate: solo el grande).
// Cuanto más grande el campo, más largo el PAR
export const PVE_SIZES = {
  s: { cols: 5, rows: 5, par: 2 },
  m: { cols: 7, rows: 9, par: 3 },
  l: { cols: 11, rows: 9, par: 5 },
};

export const DECKS = [
  { id: 'classic', color: '#4F8A4B', emblem: 'club' },
  // agua: sin búnkeres ni portales; con río (corriente que baja) y lago (como caerse del tablero)
  { id: 'water', color: '#1F8A8A', emblem: 'drop', scene: 'lake', newCards: ['river', 'lake'],
    counts: base => ({ ...base, bunker: 0, portal: 0, river: 5, lake: 5 }) },
  // minigolf: piezas de madera y palos largos (sin búnkeres ni portales: son de la baraja clásica)
  { id: 'minigolf', color: '#A8743F', emblem: 'mill', scene: 'mini',
    newCards: ['corner', 'block', 'tunnel', 'launcher', 'palo4', 'palo5'],
    counts: base => ({ ...base, bunker: 0, portal: 0, block: 4, corner: 4, tunnel: 2, launcher: 3, palo4: 4, palo5: 3 }) },
  // el tren: un circuito de vías (distinto en cada partida) con 4 paradas; la locomotora avanza sola al acabar cada
  // turno y empuja lo que encuentra. Sin búnkeres ni portales (sus vagones llevan la arena)
  { id: 'train', color: '#B5483B', emblem: 'train', scene: 'rail', train: true,
    newCards: ['trenVuelta', 'oTren1', 'vagon'], trainLayout: true, // (salidas abajo, vías en medio y el hoyo arriba: hay que cruzarlas)
    counts: base => ({ ...base, bunker: 0, portal: 0, palo2: base.palo2 + 1, trenVuelta: 3, oTren1: 3, vagon: 3 }) },
  // las estaciones: el campo cambia con la estación (una al azar al empezar) y la carta negra pasa a la siguiente.
  // Primavera: viento y plantas carnívoras · verano: incendios · otoño: hojas secas y lluvia · invierno: bola de nieve
  // y hielo. Sin búnkeres ni portales
  { id: 'seasons', color: '#C2618B', emblem: 'seasons', scene: 'seasons', seasons: true,
    newCards: ['estacion', 'incendio', 'oNieve'], introLead: 'deckIntro.leads.seasons', // (la presentación cuenta qué trae cada estación)
    counts: base => ({ ...base, bunker: 0, portal: 0, estacion: 4, incendio: 1, oNieve: 3 }) },
  // el multiverso: agujeros negros que parten la pelota en 4 (la original y 3 copias; una copia en el hoyo también gana,
  // pero si se sale del tablero desaparece), gravedad que atrae lo que hay en cruz y lluvia de meteoritos. Sin búnkeres
  // ni portales
  { id: 'multiverse', color: '#5B3FB8', emblem: 'blackhole', scene: 'space',
    newCards: ['agujeroNegro', 'gravedad', 'oGravedad', 'meteoritos'],
    counts: base => ({ ...base, bunker: 0, portal: 0, agujeroNegro: 1, gravedad: 2, oGravedad: 1, meteoritos: 3 }) },
  // el casino: el casino. El suelo es ajedrezado (rojo y negro) con una casilla dorada; al empezar hay 3 monedas por
  // jugador (cara: repites el movimiento; cruz: a tu salida), dados que te hacen rebotar lo que marcan y la ruleta, que
  // devuelve a su salida a las pelotas del color que salga (con el dorado, la de la casilla dorada gana). Sin búnkeres ni
  // portales
  { id: 'gambling', color: '#B8892B', emblem: 'roulette', scene: 'casino', gambling: true,
    newCards: ['dado', 'ruleta'], introLead: 'deckIntro.leads.gambling', // (la presentación cuenta lo de las monedas y la casilla dorada)
    counts: base => ({ ...base, bunker: 0, portal: 0, dado: 2, ruleta: 2 }) },
  // (las barajas nuevas van aquí, detrás de la última: Ultimate siempre al final)
  // Ultimate: el combinador. En su tarjeta se activan las barajas que se quieran (las 6, o las que sea) y la partida
  // junta sus cartas y lo suyo (tren, estaciones…) en el campo grande, 11×9, sea cual sea la combinación (comboCfg). Siempre
  // trae el palo iridiscente. `counts` es el Ultimate fijo de antes (clásica, agua, minigolf y tren, con el palo de 10): lo
  // usan el desafío Caos total y la plantilla del creador
  { id: 'ultimate', color: '#9FD8E8', emblem: 'prism', scene: 'prism', ultimate: true,
    newCards: ['paloIri', 'palo10'],
    counts: base => {
      const all = { ...base };
      for (const id of ['water', 'minigolf', 'train']) for (const [k, n] of Object.entries(deckById(id).counts(base))) all[k] = Math.max(all[k] || 0, n);
      return { ...all, palo10: 3, paloIri: 2 };
    } },
];
export const deckById = id => DECKS.find(d => d.id === id) || DECKS[0];
// ¿la partida lleva tren? (su baraja, y Ultimate, que tiene todo lo de las demás)
export const deckHasTrain = dk => !!(dk.train || (dk.ultimate && DECKS.some(d => d.train)));
// tamaño del campo de una baraja a partir del tamaño elegido: el mismo para todas (Ultimate, siempre el grande)
export const deckSize = (dk, sz) => ({ ...(dk.ultimate ? PVE_SIZES.l : sz) });

/* ---------- Ultimate: combinaciones de barajas ----------
   Una combinación es una máscara de bits sobre ULT_DECKS (1 = clásica, 2 = agua, 4 = minigolf…; las 6 = 63). */
export const ULT_DECKS = ['classic', 'water', 'minigolf', 'train', 'seasons', 'multiverse', 'gambling']; // (una nueva, siempre al final: los bits de las ya guardadas no cambian)
export const ALL_COMBO = (1 << ULT_DECKS.length) - 1;
export const comboIds = mask => ULT_DECKS.filter((_, i) => mask & (1 << i));
export const comboMask = ids => ids.reduce((m, id) => m | (ULT_DECKS.includes(id) ? 1 << ULT_DECKS.indexOf(id) : 0), 0);
export const validCombo = mask => Number.isInteger(mask) && mask > 0 && mask <= ALL_COMBO;
// el campo de una combinación: siempre el grande (11×9, PAR 5), sea cual sea
export const comboSize = () => ({ ...PVE_SIZES.l });
// todo lo que necesita la partida de una combinación: mazo, tamaño y lo suyo (tren, estaciones)
export function comboCfg(mask) {
  const ids = comboIds(mask), size = comboSize(mask), base = defaultCounts();
  const counts = { ...base, bunker: 0, portal: 0 }; // (sin la clásica, ni búnkeres ni portales)
  for (const id of ids) { const c = deckById(id).counts ? deckById(id).counts(base) : base; for (const [k, n] of Object.entries(c)) counts[k] = Math.max(counts[k] || 0, n); }
  counts.paloIri = 2; counts.palo10 = 0; // (el palo de 10, no: cruzaría el campo de 11 de punta a punta)
  const dks = ids.map(deckById), startWith = [...new Set(['paloIri', ...dks.flatMap(d => d.newCards || [])])].filter(k => counts[k] > 0);
  return { ids, size, counts, startWith, train: dks.some(d => d.train), trainLayout: dks.length === 1 && !!dks[0].trainLayout, seasons: dks.some(d => d.seasons), gambling: dks.some(d => d.gambling) };
}
// compartir una combinación con el mismo reparto: u1.<combinación>.<rivales>.<dificultad>.<semilla> (en base 36)
const DIFFS = ['easy', 'normal', 'hard'];
export const comboCode = ({ mask, opps, diff, seed }) => ['u1', mask, opps, DIFFS.indexOf(diff), seed >>> 0].map(v => typeof v === 'number' ? v.toString(36) : v).join('.');
export function parseComboCode(code) {
  const [v, ...p] = String(code || '').trim().split('.');
  if (v !== 'u1' || p.length !== 4) return null;
  const [mask, opps, di, seed] = p.map(x => parseInt(x, 36));
  if (!validCombo(mask) || !(opps >= 1 && opps <= 5) || !DIFFS[di] || !Number.isFinite(seed)) return null;
  return { mask, opps, diff: DIFFS[di], seed: seed >>> 0 };
}
