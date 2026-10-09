// Lo básico: los niveles integrados, todos de "gana en 1 turno" (mano fija), en el orden en que se aprenden.
// Todos en un solo archivo, basics.json (una petición al arrancar, no una por nivel), en filas de 5:
//   [{ section, deck, levels: [nivel…] }, …]
//   section  'basics' (Lo básico: una baraja tras otra) | 'advanced' (Lo no tan básico: combinaciones entre barajas)
//   deck     el bloque de la fila (su cabecera): 'basic' (palos y hoyo), 'classic', 'water'… y en Lo no tan básico
//            'ultimate', 'water+minigolf', 'train+mix'…, 'all'. Filas seguidas del mismo bloque van bajo la misma cabecera
// El progreso se guarda por el id de cada nivel (nunca por su posición): se pueden añadir filas en medio. El archivo lo
// genera tools/basics-design.mjs (la fuente, con los tableros en ASCII).
// Un nivel: { id, version, name, name_en?, teach, teach_en, cols, rows, hole:{x,y}, ball:{x,y}, parCells:[{x,y,n}],
//   tiles:[{type,x,y}], deckCounts:{carta:n}, hand:[carta…] (la mano fija), extraBalls?:[{x,y}] (pelotas de obstáculo),
//   spawn?:{x,y} (la salida de la pelota, si no es donde empieza) · home?:{x,y} (la casilla inicial del hoyo, ídem),
//   seed? (con azar: monedas, ruleta, túnel, meteoritos… la misma jugada da siempre el mismo resultado),
//   train?, season? (con wind?), gamble? (lo de cada baraja), from? (el puzle antiguo del que viene: pNN) }
// Al cargarlo se le añaden section, deck, row (fila) y puzzle: true.
const BASICS = new URL('./basics.json', import.meta.url);

export async function loadBasics() {
  const rows = await (await fetch(BASICS)).json();
  return rows.flatMap((r, row) => r.levels.map(L => ({ ...L, section: r.section, deck: r.deck, row, puzzle: true })));
}

// los tres niveles de la pelota Puzle (y de Estadísticas): las barajas de siempre · las nuevas · Lo no tan básico
// (con las claves de los grupos de dificultad de desafíos y puzles: warmup, mid, expert)
const FIRST = ['basic', 'classic', 'water', 'minigolf'];
export const basicTier = L => L.section === 'advanced' ? 'expert' : FIRST.includes(L.deck) ? 'warmup' : 'mid';
