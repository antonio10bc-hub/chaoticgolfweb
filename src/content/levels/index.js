// Niveles integrados: Lo básico (story/) y los puzles de "gana en 1 turno" (puzzles/).
// Un JSON por nivel, listados en su index.json. Añadir un nivel = crear su JSON (se puede
// diseñar en el creador y exportarlo) y añadirlo al índice.
// Formato: { version, name, name_en?, cols, rows, hole:{x,y}, ball:{x,y}, parCells:[{x,y,n}],
//            tiles:[{type,x,y}], deckCounts:{carta:n}, extraBalls?:[{x,y}], tips?:{hit|bunker|portal: claveI18n},
//            hand?:[carta…] (mano fija), puzzle?: true (hay que ganar en el primer turno) }
const STORY = new URL('./story/', import.meta.url);
const PUZZLES = new URL('./puzzles/', import.meta.url);

async function loadDir(base) {
  const files = await (await fetch(new URL('index.json', base))).json();
  return Promise.all(files.map(async f => (await fetch(new URL(f, base))).json()));
}
export const loadStoryLevels = () => loadDir(STORY);
export const loadPuzzleLevels = () => loadDir(PUZZLES);
