// Barajas de la partida rápida: cada una es el mazo base más su tipo de cartas especiales.
// `locked`: aún no se puede jugar (se muestra en Modos de juego como "Próximamente").
// `color`: color de la baraja (tarjeta, emblema y etiqueta).
// `counts(base)`: el mazo de la baraja a partir de las copias por defecto de cada carta.
// `scene`: fondo propio de la partida (clase en #gameScreen; ver styles/features.css).
// `grow`: casillas de más respecto al tamaño elegido ({ cols, rows }). `par`: su propio PAR.
// `newCards`: las cartas especiales de la baraja. La primera vez que se juega, se presentan con un
// tablero de ejemplo animado (src/ui/deck-intro.js; cada carta define su escena en `demo`).
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
  // Ultimate: las cartas de TODAS las demás barajas (las futuras también se suman solas), un campo
  // enorme, palos de 10 y el palo iridiscente
  { id: 'ultimate', color: '#8E6BE0', emblem: 'prism', scene: 'prism', grow: { cols: 12, rows: 4 }, par: 7, ultimate: true,
    newCards: ['paloIri', 'palo10'],
    counts: base => {
      const all = { ...base };
      for (const dk of DECKS) if (!dk.ultimate && dk.counts) for (const [k, n] of Object.entries(dk.counts(base))) all[k] = Math.max(all[k] || 0, n);
      return { ...all, palo10: 3, paloIri: 2 };
    } },
];
export const deckById = id => DECKS.find(d => d.id === id) || DECKS[0];
// tamaño del campo de una baraja a partir del tamaño elegido
// (el tablero crece solo en filas si el PAR no cabe: hoyo + PAR + fila de pelotas)
export const deckSize = (dk, sz) => {
  const par = dk.par || sz.par;
  return { ...sz, par, cols: sz.cols + (dk.grow?.cols || 0), rows: Math.max(sz.rows + (dk.grow?.rows || 0), par + 3) };
};
