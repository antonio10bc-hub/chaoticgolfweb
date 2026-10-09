// Lo básico, la fuente: cada fila de 5 niveles con sus tableros en ASCII (leyenda en lib/basics-ascii.mjs), su nombre,
// lo que enseña (una línea, sale al empezar el nivel) y su mano. Genera src/content/levels/basics/<id>.json y el índice,
// y comprueba cada nivel con el solucionador (una solución que no dependa del azar, cada carta hace falta, ninguna pieza
// sobra y, con `need`, que TODAS las soluciones pasen por lo que enseña).
//   node tools/basics-design.mjs            comprueba y escribe
//   node tools/basics-design.mjs --check    solo comprueba (y enseña los tableros con su solución)
//   node tools/basics-design.mjs <id…>      solo esos niveles (comprobar; con --write, también escribe)
// Un nivel: { id, name: [es, en], teach: [es, en], hand: [...], board: `...`, need?: [eventos], spare?: n (cartas que
// sobran a propósito), from?: 'pNN' (el puzle antiguo del que viene: su progreso se conserva), seed?, …lo demás del JSON }
import fs from 'node:fs';
import path from 'node:path';
import { parseBoard, drawLevel } from './lib/basics-ascii.mjs';
import { quality, describe } from './lib/basics-solver.mjs';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname), OUT = path.join(ROOT, 'src/content/levels/basics');
// lo que tiene que pasar en todas las soluciones: una pista del motor (story.tips) o un evento con su pieza
const tip = k => evs => evs.some(e => e.t === 'tip' && e.key === k);
const ev = (t, f = () => true) => evs => evs.some(e => e.t === t && f(e));
const NEED = {
  hit: tip('hit'), chain: tip('chain'), decoy: tip('decoy'), swallow: tip('swallow'), holeFell: tip('holeFell'), fall: ev('fall', e => e.p === 'b0'),
  bunker: tip('bunker'), trapExit: tip('trapExit'), portal: ev('teleport', e => e.p === 'b0'), holePortal: ev('teleport', e => e.p === 'hole'),
  holeTrap: ev('settle', e => e.p === 'hole'), placed: ev('tilePlaced'), orange: ev('card', e => e.key.startsWith('o')), dedo: ev('card', e => e.key === 'dedo'),
  dedoHit: evs => evs.some((e, i) => e.t === 'card' && e.key === 'dedo' && evs.slice(i).some(m => m.t === 'impact' && m.p === 'b0')),
};

const ROWS = [
  /* ---------- Lo básico ---------- */
  { section: 'basics', deck: 'basic', levels: [
    { id: 'clubs-1', name: ['Al hoyo', 'Into the hole'], hand: ['palo3'],
      teach: ['Toca la carta y luego la casilla: tu pelota avanza en línea recta.', 'Tap the card, then the square: your ball goes in a straight line.'],
      board: `
. . H . .
. . . . .
. . . . .
. . O . .
. . . . .` },
    { id: 'clubs-2', name: ['Justo', 'Spot on'], hand: ['palo2', 'palo1'],
      teach: ['Tiene que acabar justo en el hoyo: pasar por encima no vale. Juega 2 cartas.', 'It has to stop right on the hole: rolling over it doesn\'t count. Play 2 cards.'],
      board: `
. . . . .
. . H . .
. . . . .
. . . . .
. . O . .` },
    { id: 'clubs-3', name: ['En L', 'L-shaped'], hand: ['palo2', 'palo3'],
      teach: ['Cada carta, una dirección: combina dos para doblar la esquina.', 'Each card, one direction: combine two to turn the corner.'],
      board: `
. . . . .
. . . . .
. . . H .
. . . . .
O . . . .` },
    { id: 'clubs-4', name: ['Dos de tres', 'Two out of three'], hand: ['palo1', 'palo2', 'palo3'], spare: 1,
      teach: ['Como mucho 2 cartas negras por turno: elige bien cuáles.', 'At most 2 black cards per turn: pick the right ones.'],
      board: `
. . . . .
. . H . .
. . . . .
. . . . .
O . . . .` },
    { id: 'clubs-5', name: ['El dedo', 'The finger'], hand: ['dedo'], need: ['dedo'],
      teach: ['El dedo mueve 1, 2 o 3 pasos, casilla a casilla, y puede girar.', 'The finger moves 1, 2 or 3 steps, square by square, and can turn.'],
      board: `
. . . . .
. . . . .
. . . H .
. O . . .
. . . . .` },
  ] },
  { section: 'basics', deck: 'basic', levels: [
    { id: 'hole-1', from: 'p01', name: ['Acércalo', 'Bring it closer'], hand: ['hoyoLeft', 'palo3'],
      teach: ['Las cartas de hoyo lo mueven 2 casillas hacia su flecha.', 'Hole cards move it 2 squares in the arrow\'s direction.'],
      board: `
. . . . .
. . . H .
. . . . .
. . . . .
. O . . .
. . . . .` },
    { id: 'hole-2', name: ['Trágatela', 'Swallow it'], hand: ['hoyoDown', 'oHoyoLeft'], need: ['swallow'],
      teach: ['El hoyo se mueve como una pelota: si cae sobre la tuya, se la traga.', 'The hole moves like a ball: if it lands on yours, it swallows it.'],
      board: `
. . . . .
. . . H .
. . . . .
. . O . .
. . . . .` },
    { id: 'hole-3', name: ['Naranja', 'Orange'], hand: ['palo1', 'oHoyoRight', 'palo3'], need: ['orange'],
      teach: ['Las cartas naranjas no cuentan para el límite de 2 negras.', 'Orange cards don\'t count towards the 2 black card limit.'],
      board: `
. . . H .
. . . . .
. . . . .
. . . . .
. . . . O` },
    { id: 'hole-4', name: ['Vuelta a la salida', 'Back to the tee'], hand: ['palo2', 'palo3'], need: ['fall'],
      teach: ['Si te caes del tablero, vuelves a tu salida (la marca de tu color).', 'Fall off the board and you go back to your tee (the mark in your colour).'],
      board: `
. . . . .
. . . . O
. . H . .
. . . . .
. . . . .
. . S . .` },
    { id: 'hole-5', name: ['El hoyo vuelve', 'The hole comes back'], hand: ['palo2', 'hoyoRight'], need: ['holeFell'],
      teach: ['Si el hoyo se cae del tablero, vuelve a su casilla inicial (la bandera).', 'If the hole falls off the board, it goes back to its starting square (the flag).'],
      board: `
. . . . .
. . . H .
. . . . .
K . . . .
. . . . .
O . . . .` },
  ] },
  { section: 'basics', deck: 'basic', levels: [
    { id: 'balls-1', name: ['Choque', 'Bump'], hand: ['palo3', 'palo2'], need: ['hit'],
      teach: ['Si chocas con otra pelota, se lleva los pasos que te quedaban y tú te paras.', 'Hit another ball and it takes your remaining steps; you stop.'],
      board: `
. . . .
. . . .
. . . o
. H . .
. . . O` },
    { id: 'balls-2', name: ['Fuera de juego', 'Out of play'], hand: ['palo3', 'palo2'], need: ['decoy'],
      teach: ['Una pelota de obstáculo que entra en el hoyo desaparece: no gana.', 'An obstacle ball that drops in the hole vanishes: it doesn\'t win.'],
      board: `
. . H .
. . o .
. . . .
. . . .
. . O .` },
    { id: 'balls-3', name: ['Dedo y choque', 'Finger bump'], hand: ['dedo'], need: ['dedoHit'],
      teach: ['Con el dedo, chocar gasta solo 1 paso: sigues con los que te quedan.', 'With the finger, a bump only uses 1 step: you keep the rest.'],
      board: `
. . . . .
. . . . .
O o H . .
. . . . .` },
    { id: 'balls-4', name: ['Aparta', 'Out of the way'], hand: ['palo2', 'oPalo1'],
      teach: ['El palo 1 reactivo (naranja) mueve 1 casilla cualquier pelota.', 'The reactive club 1 (orange) moves any ball 1 square.'],
      board: `
. . . . .
. . . . .
. . . . .
. . . . .
. H o O .` },
    { id: 'balls-5', from: 'p21', name: ['Cuenta exacta', 'Exact count'], hand: ['palo2', 'oPalo1', 'palo1'],
      teach: ['El palo reactivo también mueve tu pelota: es una naranja más.', 'The reactive club moves your ball too: one more orange card.'],
      board: `
. . . . .
. . . . .
. . . . .
. . . . O
. . . . .
. . . . .
. . . H .` },
  ] },
  /* ---------- clásica ---------- */
  { section: 'basics', deck: 'classic', levels: [
    { id: 'bunker-1', name: ['Arena', 'Sand'], hand: ['palo3', 'hoyoRight'], need: ['bunker'],
      teach: ['El búnker frena: quien entra pierde el resto del movimiento.', 'A bunker stops you: whoever rolls in loses the rest of the move.'],
      board: `
. . . O
. . . .
. . H b
. . . .
. . . .` },
    { id: 'bunker-2', name: ['Salir cuesta 1', 'Getting out costs 1'], hand: ['palo1', 'palo3'], need: ['trapExit'],
      teach: ['Salir del búnker cuesta 1: el palo avanza una casilla menos (y el palo 1 no te saca).', 'Getting out of a bunker costs 1: the club goes one square less (club 1 can\'t get you out).'],
      board: `
. . . .
. H . .
. . . .
. . . .
. bO . .` },
    { id: 'bunker-3', from: 'p02', name: ['Frenazo', 'Sudden stop'], hand: ['palo3', 'hoyoDown'], need: ['holeTrap'],
      teach: ['El hoyo se mueve como una pelota: el búnker también lo frena.', 'The hole moves like a ball: a bunker stops it too.'],
      board: `
. . . . . .
H . . . . .
b . . O . .
. . . . . .
. . . . . .
. . . . . .` },
    { id: 'bunker-4', name: ['Hoyo atascado', 'Stuck hole'], hand: ['hoyoRight', 'palo3'],
      teach: ['El hoyo en un búnker también paga 1 al salir: el +2 lo mueve solo 1.', 'A hole in a bunker also pays 1 to get out: the +2 only moves it 1.'],
      board: `
. O . .
. . . .
. . . .
bH . . .
. . . .` },
    { id: 'bunker-5', name: ['Pon un búnker', 'Place a bunker'], hand: ['bunker', 'palo3', 'oHoyoDown'], need: ['placed', 'bunker'],
      teach: ['La carta de búnker pone uno en una casilla libre: úsalo para frenar justo donde quieres.', 'The bunker card puts one on a free square: use it to stop exactly where you want.'],
      board: `
. . . . .
. . . . .
. . H . .
O . . . .
. . . . .` },
  ] },
  { section: 'basics', deck: 'classic', levels: [
    { id: 'portal-1', from: 'p03', name: ['Atajo', 'Shortcut'], hand: ['palo1', 'palo3'], need: ['portal'],
      teach: ['El portal no cuenta como casilla: sales por el otro, en la misma dirección.', 'A portal isn\'t a square: you come out of the other one, same direction.'],
      board: `
. . . . H .
. . . . . .
. . . . P .
P . . . . .
. . . . . .
. . . . . .
O . b . . .` },
    { id: 'portal-2', name: ['El hoyo también', 'The hole too'], hand: ['palo1', 'hoyoUp'], need: ['holePortal'],
      teach: ['El hoyo también cruza los portales.', 'The hole goes through portals too.'],
      board: `
O . . . . .
. . . . . .
. P . . . .
. P . . . .
. H . . . .
. . . . . .` },
    { id: 'portal-3', name: ['El otro portal', 'The other portal'], hand: ['hoyoLeft', 'portal'], need: ['placed', 'holePortal'],
      teach: ['La carta de portal pone el segundo: se une al que ya hay.', 'The portal card places the second one: it links up with the one already there.'],
      board: `
O P . . .
. . . . .
. . . . .
. . H . .
. . . . .` },
    { id: 'portal-4', name: ['Caída con portal', 'Falling through'], hand: ['palo2'], need: ['fall', 'portal'],
      teach: ['Tu salida es un portal: si te caes, lo cruzas y sales por el otro, hacia donde caías.', 'Your tee is a portal: fall off and you go through it and out of the other one, in the direction you fell.'],
      board: `
. . . . .
. O . . .
. . . H .
. . . P .
. . . . .
SP . . . .` },
    { id: 'portal-5', from: 'p17', name: ['Por los pelos', 'By a whisker'], hand: ['palo3', 'oHoyoRight', 'palo1'],
      teach: ['Portales, hoyo y una naranja: cuenta bien las casillas.', 'Portals, the hole and an orange card: count the squares carefully.'],
      board: `
H . . . . .
. . . . . .
. P . . . .
. . . . P .
. . . . . .
. . . . . .
. . . . O .` },
  ] },
  { section: 'basics', deck: 'classic', levels: [
    { id: 'classic-1', name: ['Golpe a la arena', 'Into the sand'], hand: ['palo3', 'palo2'], need: ['hit'],
      teach: ['Una pelota en el búnker también paga 1 al salir: si le llega solo 1, no se mueve.', 'A ball in a bunker also pays 1 to get out: if only 1 step reaches it, it doesn\'t move.'],
      board: `
. . . . . .
. . . . . O
. . . . . .
. . . H . .
. . . . . bo` },
    { id: 'classic-2', from: 'p14', name: ['Zigzag', 'Zigzag'], hand: ['palo1', 'dedo'],
      teach: ['El búnker también frena al dedo: esquívalo.', 'Bunkers stop the finger too: steer around them.'],
      board: `
. . . . .
. . . . .
. . . . .
b . H . .
. b . . .
O . . . .` },
    { id: 'classic-3', from: 'p13', name: ['Quita de en medio', 'Clear the way'], hand: ['oPalo1', 'palo3'],
      teach: ['Quita la pelota que estorba (sin caer en la arena).', 'Move the ball that\'s in the way (without landing in the sand).'],
      board: `
. . . . .
. . H . .
. . o . .
. . . . .
. b O b .
. . . . .` },
    { id: 'classic-4', name: ['Choque en el portal', 'Portal bump'], hand: ['palo3', 'palo3'], need: ['hit', 'decoy'],
      teach: ['Si al salir del portal hay una pelota, chocas: se lleva tus pasos y tú te quedas en la entrada.', 'If there\'s a ball where you come out of a portal, you hit it: it takes your steps and you stay at the entrance.'],
      board: `
. . . . .
P o . H .
. . . . .
. . . . .
. . . . .
. . O . P` },
    { id: 'classic-5', name: ['El hoyo en portal', 'Hole through the portal'], hand: ['palo2', 'hoyoRight'], need: ['holeFell', 'holePortal'],
      teach: ['Si la casilla inicial del hoyo es un portal, al caerse lo cruza y sale por el otro.', 'If the hole\'s starting square is a portal, when it falls it goes through and out of the other one.'],
      board: `
. . . . .
. . . H .
. . P . .
. . . . .
KP . . O .` },
  ] },
];

/* ---------- comprobar y escribir ---------- */
const args = process.argv.slice(2), check = args.includes('--check'), write = !check && (args.includes('--write') || !args.some(a => !a.startsWith('--')));
const only = args.filter(a => !a.startsWith('--'));
const KEYS = new Set(['id', 'name', 'teach', 'hand', 'board', 'need', 'spare']);
function build(spec) {
  const B = parseBoard(spec.board);
  const L = { version: 1, puzzle: true, name: spec.name[0], name_en: spec.name[1], teach: spec.teach[0], teach_en: spec.teach[1], ...B,
    hand: spec.hand, parCells: [], deckCounts: { palo1: 3, palo2: 3, palo3: 3 } };
  for (const [k, v] of Object.entries(spec)) if (!KEYS.has(k)) L[k] = v;
  if (!L.tiles.length) L.tiles = [];
  return L;
}
let bad = 0, n = 0;
const index = [];
for (const row of ROWS) {
  index.push({ section: row.section, deck: row.deck, levels: row.levels.map(s => s.id) });
  for (const spec of row.levels) {
    n++;
    const L = build(spec);
    if (only.length && !only.includes(spec.id)) { if (write) fs.writeFileSync(path.join(OUT, spec.id + '.json'), JSON.stringify(L, null, 2) + '\n'); continue; }
    const need = (spec.need || []).map(k => { if (!NEED[k]) throw new Error('need ' + k); return NEED[k]; });
    const q = quality(L, { need: need.length ? evs => need.every(f => f(evs)) : null });
    const spare = q.spareCards?.length || 0, ok = q.wins > 0 && q.robust && q.needOk && spare === (spec.spare || 0) && !q.idleTiles?.length && !q.idleDecoys?.length;
    if (!ok) bad++;
    console.log(`${ok ? '✓' : '✗'} ${String(n).padStart(3)} ${spec.id.padEnd(12)} ${(spec.name[0]).padEnd(22)} ${L.cols}x${L.rows} ${q.wins}/${q.total} (${(100 * (q.ratio || 0)).toFixed(1)}%)` +
      (q.why ? ' ' + q.why : '') + (q.robust === false ? ' AZAR' : '') + (q.needOk === false ? ' NO-ENSEÑA' : '') + (spare !== (spec.spare || 0) ? ' sobra:' + q.spareCards : '') +
      (q.idleTiles?.length ? ' piezas-inútiles:' + q.idleTiles : '') + (q.idleDecoys?.length ? ' obst-inútiles:' + q.idleDecoys : '') +
      (q.sol ? '   ' + describe(L, q.sol) : ''));
    if (check && (only.length || !ok)) console.log(drawLevel(L));
    if (write) fs.writeFileSync(path.join(OUT, spec.id + '.json'), JSON.stringify(L, null, 2) + '\n');
  }
}
if (write && !only.length) {
  fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(index, null, 2) + '\n');
  for (const f of fs.readdirSync(OUT)) if (f !== 'index.json' && !ROWS.some(r => r.levels.some(s => s.id + '.json' === f))) fs.unlinkSync(path.join(OUT, f)); // (los que ya no están)
}
console.log(`${n} niveles, ${bad} con problemas`);
process.exit(bad ? 1 : 0);
