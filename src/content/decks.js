// Barajas de la partida rápida: cada una es el mazo base más su tipo de cartas especiales.
// `locked`: aún no se puede jugar (se muestra en Modos de juego como "Próximamente").
// `color`: color de la baraja (tarjeta, emblema y, cuando exista, el campo de juego).
// `counts(base)`: el mazo de la baraja a partir de las copias por defecto de cada carta.
// `scene`: fondo propio de la partida (clase en #gameScreen; ver styles/features.css).
export const DECKS = [
  { id: 'classic', color: '#4F8A4B', emblem: 'club' },
  // agua: sin búnkeres ni portales; con río (corriente que baja) y lago (como caerse del tablero)
  { id: 'water', color: '#1F8A8A', emblem: 'drop', scene: 'lake', counts: base => ({ ...base, bunker: 0, portal: 0, river: 5, lake: 5 }) },
  { id: 'minigolf', color: '#7B4FB0', emblem: 'mill', locked: true },
];
export const deckById = id => DECKS.find(d => d.id === id) || DECKS[0];
