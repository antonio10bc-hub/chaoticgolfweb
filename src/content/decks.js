// Barajas de la partida rápida: cada una es el mazo base más su tipo de cartas especiales.
// `locked`: aún no se puede jugar (se muestra en Modos de juego como "Próximamente").
// `color`: color de la baraja (tarjeta, emblema y, cuando exista, el campo de juego).
export const DECKS = [
  { id: 'classic', color: '#4F8A4B', emblem: 'club' },
  { id: 'water', color: '#1F8A8A', emblem: 'drop', locked: true },
  { id: 'minigolf', color: '#7B4FB0', emblem: 'mill', locked: true },
];
export const deckById = id => DECKS.find(d => d.id === id) || DECKS[0];
