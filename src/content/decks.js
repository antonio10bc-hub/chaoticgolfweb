// Barajas de la partida rápida: cada una es el mazo base más su tipo de cartas especiales.
// `locked`: aún no se puede jugar (se muestra en Modos de juego como "Próximamente").
// `color`: color de la baraja (tarjeta, emblema y etiqueta).
// `counts(base)`: el mazo de la baraja a partir de las copias por defecto de cada carta.
// `scene`: fondo propio de la partida (clase en #gameScreen; ver styles/features.css).
// `grow`: casillas de más respecto al tamaño elegido ({ cols, rows }). `par`: su propio PAR.
// `newCards`: las cartas especiales de la baraja. La primera vez que se juega, se presentan con un
// tablero de ejemplo animado (src/ui/deck-intro.js; cada carta define su escena en `demo`).
import { defaultCounts } from './cards/index.js';

export const DECKS = [
  { id: 'classic', color: '#4F8A4B', emblem: 'club' },
  // agua: sin búnkeres ni portales; con río (corriente que baja) y lago (como caerse del tablero)
  { id: 'water', color: '#1F8A8A', emblem: 'drop', scene: 'lake', newCards: ['river', 'lake'],
    counts: base => ({ ...base, bunker: 0, portal: 0, river: 5, lake: 5 }) },
  // minigolf: piezas de madera, palos largos y un campo 8 columnas más ancho (sin búnkeres ni portales:
  // son de la baraja clásica)
  { id: 'minigolf', color: '#A8743F', emblem: 'mill', scene: 'mini', grow: { cols: 8, rows: 0 }, par: 5,
    newCards: ['corner', 'block', 'tunnel', 'launcher', 'palo4', 'palo5'],
    counts: base => ({ ...base, bunker: 0, portal: 0, block: 4, corner: 4, tunnel: 2, launcher: 3, palo4: 4, palo5: 3 }) },
  // el tren: un circuito de vías (distinto en cada partida) con 4 paradas; la locomotora avanza sola al acabar cada
  // turno y empuja lo que encuentra. Sin búnkeres ni portales (sus vagones llevan la arena)
  { id: 'train', color: '#B5483B', emblem: 'train', scene: 'rail', grow: { cols: 4, rows: 2 }, train: true,
    newCards: ['trenVuelta', 'oTren1', 'vagon'], trainLayout: true, // (salidas abajo, vías en medio y el hoyo arriba: hay que cruzarlas)
    counts: base => ({ ...base, bunker: 0, portal: 0, palo2: base.palo2 + 1, trenVuelta: 3, oTren1: 3, vagon: 3 }) },
  // las estaciones: el campo cambia con la estación (una al azar al empezar) y la carta negra pasa a la siguiente.
  // Primavera: viento y plantas carnívoras · verano: incendios · otoño: hojas secas y lluvia · invierno: bola de nieve
  // y hielo. Sin búnkeres ni portales
  { id: 'seasons', color: '#C2618B', emblem: 'seasons', scene: 'seasons', grow: { cols: 2, rows: 0 }, seasons: true,
    newCards: ['estacion', 'incendio', 'oNieve'], introLead: 'deckIntro.leads.seasons', // (la presentación cuenta qué trae cada estación)
    counts: base => ({ ...base, bunker: 0, portal: 0, estacion: 4, incendio: 1, oNieve: 3 }) },
  // el multiverso: agujeros negros que parten la pelota en 4 (la original y 3 copias; una copia en el hoyo también gana,
  // pero si se sale del tablero desaparece), gravedad que atrae lo que hay en cruz y lluvia de meteoritos. Sin búnkeres
  // ni portales
  { id: 'multiverse', color: '#5B3FB8', emblem: 'blackhole', scene: 'space', grow: { cols: 2, rows: 0 },
    newCards: ['agujeroNegro', 'gravedad', 'oGravedad', 'meteoritos'],
    counts: base => ({ ...base, bunker: 0, portal: 0, agujeroNegro: 1, gravedad: 2, oGravedad: 1, meteoritos: 3 }) },
  // el Gambling: el casino. El suelo es ajedrezado (rojo y negro) con una casilla dorada; al empezar hay 3 monedas por
  // jugador (cara: repites el movimiento; cruz: a tu salida), dados que te hacen rebotar lo que marcan y la ruleta, que
  // devuelve a su salida a las pelotas del color que salga (con el dorado, la de la casilla dorada gana). Sin búnkeres ni
  // portales
  { id: 'gambling', color: '#B8892B', emblem: 'roulette', scene: 'casino', grow: { cols: 2, rows: 0 }, gambling: true,
    newCards: ['dado', 'ruleta'], introLead: 'deckIntro.leads.gambling', // (la presentación cuenta lo de las monedas y la casilla dorada)
    counts: base => ({ ...base, bunker: 0, portal: 0, dado: 2, ruleta: 2 }) },
  // (las barajas nuevas van aquí, detrás de la última: Ultimate siempre al final)
  // Ultimate: el combinador. En su tarjeta se activan las barajas que se quieran (las 6, o las que sea) y la partida
  // junta sus cartas y lo suyo (tren, estaciones…) en un campo que crece con la combinación (comboCfg). Siempre trae el
  // palo iridiscente, y en campos grandes el palo de 10. `counts` es el Ultimate fijo de antes (clásica, agua, minigolf y
  // tren): lo usan el desafío Caos total y la plantilla del creador
  { id: 'ultimate', color: '#9FD8E8', emblem: 'prism', scene: 'prism', grow: { cols: 12, rows: 4 }, par: 7, ultimate: true,
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
// tamaño del campo de una baraja a partir del tamaño elegido
// (el tablero crece solo en filas si el PAR no cabe: hoyo + PAR + fila de pelotas)
export const deckSize = (dk, sz) => {
  const par = dk.par || sz.par;
  return { ...sz, par, cols: sz.cols + (dk.grow?.cols || 0), rows: Math.max(sz.rows + (dk.grow?.rows || 0), par + 3) };
};

/* ---------- Ultimate: combinaciones de barajas ----------
   Una combinación es una máscara de bits sobre ULT_DECKS (1 = clásica, 2 = agua, 4 = minigolf…; las 6 = 63). */
export const ULT_DECKS = ['classic', 'water', 'minigolf', 'train', 'seasons', 'multiverse', 'gambling']; // (una nueva, siempre al final: los bits de las ya guardadas no cambian)
export const ALL_COMBO = (1 << ULT_DECKS.length) - 1;
export const comboIds = mask => ULT_DECKS.filter((_, i) => mask & (1 << i));
export const comboMask = ids => ids.reduce((m, id) => m | (ULT_DECKS.includes(id) ? 1 << ULT_DECKS.indexOf(id) : 0), 0);
export const validCombo = mask => Number.isInteger(mask) && mask > 0 && mask <= ALL_COMBO;
// tamaños de la partida rápida (pequeño, mediano, grande): cuanto más grande el campo, más largo el PAR
export const PVE_SIZES = {
  s: { cols: 5, rows: 5, par: 2 },
  m: { cols: 7, rows: 9, par: 3 },
  l: { cols: 9, rows: 11, par: 5 },
};
const BASE_M = PVE_SIZES.m; // (el campo mediano)
// el campo de una combinación: con una baraja, el suyo; con más, crece (las 6: 19×13, como el Ultimate de siempre) y, cuanto
// más grande, más largo el PAR
export function comboSize(mask) {
  const dks = comboIds(mask).map(deckById);
  if (dks.length === 1) return deckSize(dks[0], BASE_M);
  const n = dks.length, gc = Math.max(...dks.map(d => d.grow?.cols || 0)), gr = Math.max(...dks.map(d => d.grow?.rows || 0));
  const cols = BASE_M.cols + Math.min(12, gc + 2 * (n - 1)), rows = BASE_M.rows + Math.min(4, gr + Math.floor((n - 1) / 2));
  const par = Math.max(3, Math.min(8, Math.max(...dks.map(d => d.par || 3), rows - 6)));
  return { cols, rows: Math.max(rows, par + 3), par };
}
// todo lo que necesita la partida de una combinación: mazo, tamaño y lo suyo (tren, estaciones)
export function comboCfg(mask) {
  const ids = comboIds(mask), size = comboSize(mask), base = defaultCounts();
  const counts = { ...base, bunker: 0, portal: 0 }; // (sin la clásica, ni búnkeres ni portales)
  for (const id of ids) { const c = deckById(id).counts ? deckById(id).counts(base) : base; for (const [k, n] of Object.entries(c)) counts[k] = Math.max(counts[k] || 0, n); }
  counts.paloIri = 2; counts.palo10 = size.cols >= 13 ? 3 : 0; // (el palo de 10, solo en campos grandes)
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
