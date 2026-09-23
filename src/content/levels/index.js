// Niveles integrados del modo historia: un JSON por nivel en story/, listados en story/index.json.
// Añadir un nivel = crear su JSON (se puede diseñar en el creador y exportarlo) y añadirlo al índice.
// Formato: { version, name, cols, rows, hole:{x,y}, ball:{x,y}, parCells:[{x,y,n}],
//            tiles:[{type,x,y}], deckCounts:{carta:n}, extraBalls?:[{x,y}], tips?:{hit|bunker|portal: claveI18n} }
const BASE = new URL('./story/', import.meta.url);

export async function loadStoryLevels() {
  const files = await (await fetch(new URL('index.json', BASE))).json();
  return Promise.all(files.map(async f => (await fetch(new URL(f, BASE))).json()));
}
