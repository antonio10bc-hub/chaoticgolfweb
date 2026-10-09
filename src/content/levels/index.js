// Lo básico: los niveles integrados, todos de "gana en 1 turno" (mano fija), en el orden en que se aprenden.
// basics/index.json los ordena en filas de 5: [{ section, deck, levels: [id…] }, …]
//   section  'basics' (Lo básico: una baraja tras otra) | 'advanced' (Lo no tan básico: combinaciones entre barajas)
//   deck     el bloque de la fila (su cabecera): 'basic' (palos y hoyo), 'classic', 'water'… Filas seguidas del mismo
//            bloque van bajo la misma cabecera
// Cada nivel es basics/<id>.json; el progreso se guarda por su id (nunca por su posición): se pueden añadir filas en medio.
// Formato de un nivel: { version, name, name_en?, cols, rows, hole:{x,y}, ball:{x,y}, parCells:[{x,y,n}],
//   tiles:[{type,x,y}], deckCounts:{carta:n}, hand:[carta…] (la mano fija), extraBalls?:[{x,y}] (pelotas de obstáculo),
//   spawn?:{x,y} (la salida de la pelota, si no es donde empieza) · home?:{x,y} (la casilla inicial del hoyo, ídem),
//   seed? (con azar: monedas, ruleta, túnel, meteoritos… la misma jugada da siempre el mismo resultado),
//   train?, season?, gamble? (lo de cada baraja), from? (el puzle antiguo del que viene: pNN) }
// Al cargarlo se le añaden id, section, deck, row (fila) y puzzle: true.
const BASICS = new URL('./basics/', import.meta.url);

export async function loadBasics() {
  const rows = await (await fetch(new URL('index.json', BASICS))).json();
  const levels = await Promise.all(rows.flatMap((r, row) => r.levels.map(async id =>
    ({ ...(await (await fetch(new URL(id + '.json', BASICS))).json()), id, section: r.section, deck: r.deck, row, puzzle: true }))));
  return levels;
}

// los tres niveles de la pelota Puzle (y de Estadísticas): las barajas de siempre · las nuevas · Lo no tan básico
// (con las claves de los grupos de dificultad de desafíos y puzles: warmup, mid, expert)
const FIRST = ['basic', 'classic', 'water', 'minigolf'];
export const basicTier = L => L.section === 'advanced' ? 'expert' : FIRST.includes(L.deck) ? 'warmup' : 'mid';
