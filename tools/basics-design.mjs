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
import { NEED } from './lib/basics-needs.mjs';
import { ring } from './lib/basics-ascii.mjs';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname), OUT = path.join(ROOT, 'src/content/levels/basics');
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
  /* ---------- agua ---------- */
  { section: 'basics', deck: 'water', levels: [
    { id: 'water-1', from: 'p04', name: ['Río abajo', 'Downstream'], hand: ['palo3','hoyoDown'], need: ['river','holeRiver'],
      teach: ['El río frena a quien entra y lo baja hasta la casilla de debajo del río.', 'A river stops whatever rolls in and carries it down to the square below it.'],
      board: `
. . H . . .
. . ~ . O .
. . ~ . . .
. . ~ . . .
. . ~ . . .
. . . . . .
. . . . . .
. . . . . .` },
    { id: 'water-2', name: ['El hoyo al río', 'Hole in the river'], hand: ['hoyoLeft','palo3'], need: ['holeRiver'],
      teach: ['El hoyo también cae al río y la corriente lo baja.', 'The hole falls in the river too, and the current carries it down.'],
      board: `
. . . .
O ~ . H
. ~ . .
. . . .
. . . .` },
    { id: 'water-3', name: ['Desemboca fuera', 'Over the edge'], hand: ['palo1','palo3'], need: ['riverFall'],
      teach: ['Si el río acaba en el borde, la corriente te saca del tablero: vuelves a tu salida.', 'If the river ends at the edge, the current takes you off the board: back to your tee.'],
      board: `
. . . .
~ . . H
~ O . .
~ . . .
~ . . S` },
    { id: 'water-4', name: ['Dedo al agua', 'Finger in the water'], hand: ['dedo','hoyoDown'], need: ['dedo','river'],
      teach: ['Entrar en el río acaba el dedo, aunque te queden pasos.', 'Stepping into the river ends the finger move, even with steps left.'],
      board: `
. . . .
H . . .
~ . . O
~ . . .
. . . .` },
    { id: 'water-5', name: ['Pon un río', 'Place a river'], hand: ['river','hoyoRight'], need: ['placed','holeRiver'],
      teach: ['La carta de río pone un tramo donde quieras: aprovecha la corriente.', 'The river card places a stretch wherever you like: use the current.'],
      board: `
. H . .
. . O .
. . . .
. . . .
. . . .` },
  ] },
  { section: 'basics', deck: 'water', levels: [
    { id: 'water-6', name: ['Al lago', 'Into the lake'], hand: ['palo1','hoyoUp'], need: ['lake'],
      teach: ['Caer al lago es como caerse del tablero: vuelves a tu salida.', 'Falling in the lake is like falling off the board: back to your tee.'],
      board: `
S . . . .
. . . . .
H . . O L
. . . . .` },
    { id: 'water-7', name: ['El hoyo al lago', 'Hole in the lake'], hand: ['hoyoRight','palo1'], need: ['holeLake'],
      teach: ['Si el hoyo cae al lago, vuelve a su casilla inicial.', 'If the hole falls in the lake, it goes back to its starting square.'],
      board: `
. . . . .
. . . H L
. . . . .
. . . K O` },
    { id: 'water-8', name: ['Del río al lago', 'River to lake'], hand: ['palo1','palo2'], need: ['river','lake'],
      teach: ['Si el río desemboca en el lago, la corriente te lleva hasta él.', 'If the river flows into the lake, the current takes you right in.'],
      board: `
. . . .
. . . .
. . . .
H . S .
~ O . .
~ . . .
L . . .` },
    { id: 'water-9', from: 'p09', name: ['Orilla', 'Lakeshore'], hand: ['oHoyoLeft','hoyoUp','palo3'],
      teach: ['El lago está en medio: rodéalo.', 'The lake is in the way: go around it.'],
      board: `
. . . . . .
. . . . . .
. O . . . .
. . . . . .
. . . . L H
. . . . . .` },
    { id: 'water-10', name: ['Pon un lago', 'Place a lake'], hand: ['lake', 'hoyoRight'], need: ['placed', 'holeLake'],
      teach: ['La carta de lago pone uno: si el hoyo cae dentro, vuelve a su casilla inicial.', 'The lake card places one: if the hole falls in, it goes back to its starting square.'],
      board: `
. . . . .
. H . . .
. . . . .
. . . . .
. . . OK .` },
  ] },
  /* ---------- minigolf ---------- */
  { section: 'basics', deck: 'minigolf', levels: [
    { id: 'mini-1', name: ['Palos largos', 'Long clubs'], hand: ['palo4','palo5'], need: ['long'],
      teach: ['En el minigolf hay palos de 4 y de 5.', 'Mini golf has 4 and 5 clubs.'],
      board: `
. O . . . .
. . . . . .
. . . . . .
. . . . . .
. . . . . .
. . . . . H` },
    { id: 'mini-2', from: 'p05', name: ['Rebote', 'Rebound'], hand: ['palo4','hoyoRight'], need: ['holeBump'],
      teach: ['El bloque hace rebotar lo que choca con él (también el hoyo); no cuenta como casilla.', 'A block bounces back whatever hits it (the hole too); it doesn\'t count as a square.'],
      board: `
. . . . .
. . H # .
. . . . .
. . . . .
. . . . .
O . . . .
. . . . .
. . . . .` },
    { id: 'mini-3', from: 'p07', name: ['Esquinazo', 'Round the corner'], hand: ['palo3','hoyoDown'], need: ['deflect'],
      teach: ['Por su cara inclinada, la esquina te desvía 90°.', 'On its slanted side, a corner turns you 90°.'],
      board: `
. . . . . .
. . . . . .
. . . H . .
. . . . . .
. . . . . .
. . . . . .
. . . ◣ . O
. . . . . .` },
    { id: 'mini-4', name: ['La espalda', 'The back side'], hand: ['palo3','palo2'], need: ['bump'],
      teach: ['Por la espalda, la esquina es como un bloque: rebotas.', 'From behind, a corner is like a block: you bounce.'],
      board: `
. . . . . O
. . . H . .
. . . . . .
. . . . . ◥
. . . . . .
. . . . . .
. . . . . .` },
    { id: 'mini-5', from: 'p06', name: ['Codo', 'Elbow'], hand: ['hoyoDown','palo1'], need: ['deflect'],
      teach: ['La esquina no cuenta como casilla: aunque avances 1, te desvía.', 'A corner isn\'t a square: even moving 1, it turns you.'],
      board: `
. . . H . .
. . . . . .
. . ◣ . . .
. . O ◢ . .
. . . . . .
. . . . . .` },
  ] },
  { section: 'basics', deck: 'minigolf', levels: [
    { id: 'mini-6', name: ['Lanzamiento', 'Launch'], hand: ['palo2'], need: ['launch'],
      teach: ['Si pasas por una lanzadera, vuelas 3 casillas hacia su flecha.', 'Roll over a launcher and you fly 3 squares where its arrow points.'],
      board: `
. . . . .
. . H . .
. . . . .
. . . . .
O . ^ . .` },
    { id: 'mini-7', name: ['Dos lanzaderas', 'Two launchers'], hand: ['hoyoDown','palo2'], need: ['launch2'],
      teach: ['Aterrizar en otra lanzadera te vuelve a lanzar.', 'Landing on another launcher launches you again.'],
      board: `
. . . v O
H . . . .
. . . . .
. . . < .
. . . . .` },
    { id: 'mini-8', name: ['Vuelo fuera', 'Flying off'], hand: ['palo1','hoyoUp'], need: ['launchFall'],
      teach: ['Si la lanzadera te saca del tablero, vuelves a tu salida.', 'If a launcher flies you off the board, you go back to your tee.'],
      board: `
S . . .
. . . .
H . O v
. . . .` },
    { id: 'mini-9', from: 'p08', name: ['El hoyo vuela', 'Flying hole'], hand: ['palo3','hoyoRight'], need: ['holeLaunch'],
      teach: ['El hoyo también vuela si pasa por una lanzadera.', 'The hole flies too if it crosses a launcher.'],
      board: `
. . . . . . .
. . . . . . .
. . H . v . .
. . . . . . .
. . . . . . .
. O . . . . .
. . . . . . .` },
    { id: 'mini-10', from: 'p23', name: ['Vuelo y rebote', 'Flight and bounce'], hand: ['palo3','palo4'],
      teach: ['Lanzadera y bloque en el mismo tiro.', 'Launcher and block in one shot.'],
      board: `
. . . . . .
. . . H . #
. . . . . .
. . . . . .
. ^ . . O .
. . . . . .` },
  ] },
  { section: 'basics', deck: 'minigolf', levels: [
    { id: 'mini-11', name: ['Túnel', 'Tunnel'], hand: ['palo1','palo3'], need: ['tunnel'], seed: 7324,
      teach: ['El túnel te saca por uno de sus cuatro lados, al azar.', 'A tunnel sends you out of one of its four sides, at random.'],
      board: `
. . . . .
. . . H .
. . . T .
O . . . .` },
    { id: 'mini-12', name: ['Pon un bloque', 'Place a block'], hand: ['block','palo4'], need: ['placed','bump'],
      teach: ['La carta de bloque pone uno: rebota en él para volver al hoyo.', 'The block card places one: bounce off it back to the hole.'],
      board: `
O . H . .
. . . . .
. . . . .
. . . . .` },
    { id: 'mini-13', from: 'p16', name: ['Pon la esquina', 'Place the corner'], hand: ['corner','palo2'], need: ['placed'],
      teach: ['Al poner una esquina eliges hacia dónde mira (gírala).', 'When placing a corner you choose where it faces (rotate it).'],
      board: `
. . . . . .
. . . . . .
. . . . . .
. . . . . .
. . . . . .
. . . H . .
. . . . . O` },
    { id: 'mini-14', name: ['Pon una lanzadera', 'Place a launcher'], hand: ['launcher','palo3'], need: ['placed','launch'],
      teach: ['La lanzadera también se gira al ponerla: elige su flecha.', 'Launchers rotate too when placed: choose the arrow.'],
      board: `
O . . . .
. . . . .
. . . . .
. . . H .
. . . . .` },
    { id: 'mini-15', name: ['Madera para el hoyo', 'Wood for the hole'], hand: ['oHoyoUp','hoyoLeft'],
      teach: ['El hoyo rebota en los bloques y se desvía en las esquinas, como la pelota.', 'The hole bounces off blocks and turns at corners, like the ball.'],
      board: `
. . . . . .
. . . . . .
. . . # . .
. . ◤ H . .
. O . . . .` },
  ] },
  /* ---------- tren ---------- */
  { section: 'basics', deck: 'train', levels: [
    { id: 'train-1', from: 'p25', name: ['Último tren', 'Last train'], hand: ['palo2','oTren1'], need: ['train'], train: {"path":[[0,0],[1,0],[2,0],[3,0],[4,0],[5,0],[5,1],[5,2],[5,3],[5,4],[4,4],[3,4],[2,4],[1,4],[0,4],[0,3],[0,2],[0,1]],"stations":[2,7,12,16],"pos":2,"cars":0},
      teach: ['El tren 1 parada (naranja) mueve la locomotora y empuja lo que hay en la vía.', 'Train 1 stop (orange) moves the engine, pushing whatever is on the track.'],
      board: `
= = =@ = =H =
= . . . . =
= . . O . =
= . . . . =
= = = = = =` },
    { id: 'train-2', name: ['El tren lleva el hoyo', 'The train brings the hole'], hand: ['oTren1','palo1'], need: ['holeShove','swallow'], train: {"path":[[0,1],[1,1],[2,1],[3,1],[4,1],[5,1],[5,2],[5,3],[4,3],[3,3],[2,3],[1,3],[0,3],[0,2]],"stations":[1,5,8,12],"pos":1,"cars":0},
      teach: ['El tren también empuja el hoyo.', 'The train pushes the hole too.'],
      board: `
. . . . . .
= =@ = =H = =
= . . . O =
= = = = = =
. . . . . .` },
    { id: 'train-3', from: 'p27', name: ['Hoyo en marcha', 'Moving hole'], hand: ['oHoyoRight','trenVuelta'], train: {"path":[[1,1],[2,1],[3,1],[4,1],[5,1],[5,2],[5,3],[5,4],[5,5],[4,5],[3,5],[2,5],[1,5],[1,4],[1,3],[1,2]],"stations":[2,6,10,14],"pos":1,"cars":0},
      teach: ['La vuelta entera recorre todo el circuito.', 'The full loop runs the whole circuit.'],
      board: `
. . . . . . .
. = =@ = = = .
. = . . . = .
. = . . H = .
. = . . . = .
. = = = = = .
. . . . . O .` },
    { id: 'train-4', name: ['En fila', 'In a row'], hand: ['palo3','trenVuelta'], need: ['trainShove'], train: {"path":[[1,0],[2,0],[3,0],[3,1],[3,2],[3,3],[3,4],[2,4],[1,4],[1,3],[1,2],[1,1]],"stations":[1,4,7,10],"pos":4,"cars":0},
      teach: ['El tren empuja la fila entera de pelotas que tenga delante.', 'The train pushes the whole row of balls in front of it.'],
      board: `
. = = = .
. = . = .
. = . =@ .
. = o = .
H = = = .
. . . . .
. . O . .` },
    { id: 'train-5', name: ['Fuera de la vía', 'Off the line'], hand: ['trenVuelta','palo3'], need: ['trainFall'], train: {"path":[[0,0],[1,0],[2,0],[3,0],[3,1],[3,2],[3,3],[3,4],[2,4],[1,4],[0,4],[0,3],[0,2],[0,1]],"stations":[1,5,8,12],"pos":1,"cars":0},
      teach: ['Si el tren te empuja fuera del tablero, vuelves a tu salida.', 'If the train pushes you off the board, back to your tee.'],
      board: `
= =@ = = S
= . . = .
= . . =O .
= . . = H
= = = = .` },
  ] },
  { section: 'basics', deck: 'train', levels: [
    { id: 'train-6', name: ['Paseo en vagón', 'Wagon ride'], hand: ['vagon','trenVuelta'], need: ['wagon','ride'], train: {"path":[[0,0],[1,0],[2,0],[3,0],[3,1],[3,2],[3,3],[3,4],[2,4],[1,4],[0,4],[0,3],[0,2],[0,1]],"stations":[1,5,8,12],"pos":1,"cars":0},
      teach: ['El vagón se engancha detrás: lo que hay en su arena viaja con el tren.', 'The wagon hooks on behind: whatever is in its sand rides with the train.'],
      board: `
=O =@ = = .
= . . = .
= . . =H .
= . . = .
= = = = .` },
    { id: 'train-7', name: ['El hoyo de pasajero', 'Hole on board'], hand: ['vagon','trenVuelta'], need: ['wagon','holeRide'], train: {"path":[[0,2],[1,2],[2,2],[3,2],[4,2],[5,2],[5,3],[5,4],[4,4],[3,4],[2,4],[1,4],[0,4],[0,3]],"stations":[1,5,8,12],"pos":8,"cars":0},
      teach: ['El hoyo también viaja en el vagón.', 'The hole rides in the wagon too.'],
      board: `
. . . . . .
. . . . . .
= = = = = =
= . . . . =
= = =O = =@ =H` },
    { id: 'train-8', name: ['Bajar del vagón', 'Getting off'], hand: ['palo1','palo2'], need: ['trapExit'], train: {"path":[[2,0],[3,0],[4,0],[4,1],[4,2],[4,3],[4,4],[3,4],[2,4],[2,3],[2,2],[2,1]],"stations":[1,4,7,10],"pos":10,"cars":1},
      teach: ['El vagón es arena: salir cuesta 1, como de un búnker.', 'A wagon is sand: getting out costs 1, like a bunker.'],
      board: `
. . = = =
. . = . =
. . =@ . =
H . =O . =
. . = = =` },
    { id: 'train-9', from: 'p26', name: ['Vagón exprés', 'Express wagon'], hand: ['vagon','oTren1','palo2'], need: ['wagon'], train: {"path":[[0,0],[1,0],[2,0],[3,0],[4,0],[5,0],[5,1],[5,2],[5,3],[5,4],[4,4],[3,4],[2,4],[1,4],[0,4],[0,3],[0,2],[0,1]],"stations":[2,7,12,16],"pos":2,"cars":0},
      teach: ['Vagón y parada: súbete y que te lleve.', 'Wagon and stop: get on and let it carry you.'],
      board: `
= =O =@ = = =
= . . . H =
= . . . . =
= . . . . =
= = = = = =` },
    { id: 'train-10', name: ['Vuelta completa', 'Full circle'], hand: ['palo3','trenVuelta'], need: ['holeShove','swallow'], train: {"path":[[3,0],[4,0],[5,0],[5,1],[5,2],[5,3],[5,4],[4,4],[3,4],[3,3],[3,2],[3,1]],"stations":[1,4,7,10],"pos":4,"cars":0},
      teach: ['Ponte en el camino del hoyo: el tren lo empujará hasta ti.', 'Get in the hole\'s way: the train will push it to you.'],
      board: `
. . . = = =
O . . = . =
. . . = . =@
. . . =H . =
. . . = = =` },
  ] },
  /* ---------- estaciones ---------- */
  { section: 'basics', deck: 'seasons', levels: [
    { id: 'season-1', name: ['El viento', 'The wind'], hand: ['palo2','palo1'], need: ['wind'], season: {"now":"spring","wind":{"path":[[2,0],[2,1],[2,2],[2,3],[2,4]],"on":true}},
      teach: ['Primavera: el viento se lleva lo que entra en su ruta y lo saca del tablero.', 'Spring: the wind carries whatever enters its path off the board.'],
      board: `
. . w . .
. . w . .
. S w . .
. . w O .
. H w . .` },
    { id: 'season-2', name: ['Planta carnívora', 'Carnivorous plant'], hand: ['palo1','palo2'], need: ['eaten'], season: {"now":"spring"},
      teach: ['La planta se come la pelota que se para a su lado: vuelves a tu salida.', 'The plant eats a ball that stops next to it: back to your tee.'],
      board: `
. Y . H . S
. . . . . .
. O . . . .
. . . . . .` },
    { id: 'season-3', name: ['Se come el hoyo', 'It eats the hole'], hand: ['palo1','oHoyoDown'], need: ['holeEaten'], season: {"now":"spring"},
      teach: ['También se come el hoyo: vuelve a su casilla inicial.', 'It eats the hole too: back to its starting square.'],
      board: `
. . . . .
. . K . .
H . O . .
. Y . . .` },
    { id: 'season-4', from: 'p28', name: ['Cortafuegos', 'Firebreak'], hand: ['palo3','palo1'], need: ['flare'], season: {"now":"summer"},
      teach: ['Verano: cruzar el fuego da 2 casillas más.', 'Summer: crossing fire gives you 2 more squares.'],
      board: `
. . . . . H
. . . . . .
. . . . . .
. . . . F .
. . . . . F
. . . . O .` },
    { id: 'season-5', name: ['Quemado', 'Burnt'], hand: ['palo1','palo3'], need: ['burn'], season: {"now":"summer"},
      teach: ['Pero si te quedas dentro del fuego, vuelves a tu salida.', 'But stop inside the fire and you go back to your tee.'],
      board: `
. . F S . .
. . O . F .
. . . . . .
. . . H . .` },
  ] },
  { section: 'basics', deck: 'seasons', levels: [
    { id: 'season-6', name: ['Incendio', 'Wildfire'], hand: ['incendio','palo2'], need: ['fireCard','flare'], season: {"now":"summer"},
      teach: ['El incendio (naranja) prende fuego a una casilla vacía.', 'Wildfire (orange) sets an empty square on fire.'],
      board: `
H . . . O
. . . . .
. . . . .
. . . . .` },
    { id: 'season-7', name: ['Hojarasca', 'Dry leaves'], hand: ['palo2','hoyoDown'], need: ['leaf'], season: {"now":"autumn"},
      teach: ['Otoño: la hoja seca te quita 1 casilla y se rompe.', 'Autumn: a dry leaf costs you 1 square and breaks.'],
      board: `
. . . H . .
. . . . . .
. . O h . .
. . . . . .
. . h . . .` },
    { id: 'season-8', name: ['Charco', 'Puddle'], hand: ['palo1','palo2'], need: ['puddle'], season: {"now":"autumn"},
      teach: ['El charco también quita 1, pero no se rompe.', 'A puddle also costs 1, but it stays.'],
      board: `
. . . .
. H . .
c . . .
O c . .
. . . .` },
    { id: 'season-9', name: ['Hielo', 'Ice'], hand: ['palo1','palo2'], need: ['slide'], season: {"now":"winter"},
      teach: ['Invierno: el hielo te da 1 casilla más.', 'Winter: ice gives you 1 more square.'],
      board: `
. i . O .
. . . . .
. . . i .
. . . . .
. . . H .` },
    { id: 'season-10', name: ['Resbalón', 'Slip'], hand: ['dedo','hoyoDown'], need: ['slide','dedo'], season: {"now":"winter"},
      teach: ['Con el dedo, el hielo te hace resbalar una casilla más sin gastar paso.', 'With the finger, ice slides you one more square for free.'],
      board: `
. H . . .
. . . . i
. . i . O
. . . . .` },
  ] },
  { section: 'basics', deck: 'seasons', levels: [
    { id: 'season-11', name: ['Bola de nieve', 'Snowball'], hand: ['palo1','oNieve'], need: ['snowBall'], season: {"now":"winter"},
      teach: ['La bola de nieve (naranja) rueda 5 y se lleva lo que pilla; salir de ella no cuesta.', 'The snowball (orange) rolls 5 and takes what it catches; getting out is free.'],
      board: `
. . O . *
H . . . .
. . . . .
. . . . .
. . . . .` },
    { id: 'season-12', name: ['Todo en la bola', 'All in the ball'], hand: ['palo3','oNieve'], need: ['snowHole'], season: {"now":"winter"},
      teach: ['Si la bola lleva tu pelota y pilla el hoyo, entras.', 'If the snowball carries your ball and catches the hole, you\'re in.'],
      board: `
. . . . .
O . . . .
. . . . .
. . . . .
* . H . .` },
    { id: 'season-13', from: 'p29', name: ['Viaje en la nieve', 'Snow trip'], hand: ['oNieve','palo2','oHoyoUp'], season: {"now":"winter"},
      teach: ['Bola de nieve, palo y hoyo: el orden importa.', 'Snowball, club and hole: order matters.'],
      board: `
. . . . . .
. . . . . *
H . . . . .
. . . . O .
. . . . . .
. . . . . .
. . . . . .` },
    { id: 'season-14', name: ['Del hielo, plantas', 'From ice, plants'], hand: ['estacion', 'oPalo1', 'palo2'], need: ['season', 'eaten'], season: { now: 'winter' },
      teach: ['La carta de estación cambia el campo: en primavera, el hielo se vuelve planta.', 'The season card changes the course: in spring, ice turns into plants.'],
      board: `
. . . . .
. . i . .
. O . . .
. . . . .
. S . H .` },
    { id: 'season-15', name: ['Llega el verano', 'Summer is here'], hand: ['estacion', 'palo2', 'oHoyoUp'], need: ['season'], season: { now: 'spring' },
      teach: ['En verano las plantas se secan: ya puedes pararte a su lado.', 'In summer, plants wither: now you can stop next to them.'],
      board: `
. . . . .
. Y . . .
. . . O .
. H . . .
. . . . .` },
  ] },
  /* ---------- multiverso ---------- */
  { section: 'basics', deck: 'multiverse', levels: [
    { id: 'multi-1', name: ['Agujero negro', 'Black hole'], hand: ['palo2','palo3'], need: ['absorb','copySink'],
      teach: ['Si pasas junto a un agujero negro te traga y salen 4: tú y 3 copias. Una copia en el hoyo también gana.', 'Pass next to a black hole and it swallows you; out come 4: you and 3 copies. A copy in the hole wins too.'],
      board: `
. . O . .
. . . . .
. . . . .
X H . . .
. . . . .` },
    { id: 'multi-2', name: ['Elige pelota', 'Pick a ball'], hand: ['palo1','palo2'], need: ['absorb','pickOwn','copySink'],
      teach: ['Con copias, cada palo pregunta qué pelota mueves.', 'With copies, each club asks which ball to move.'],
      board: `
. . . . .
. . . X .
. . . . H
. . . O .
. . . . .` },
    { id: 'multi-3', name: ['Copia perdida', 'Lost copy'], hand: ['palo2','palo3'], need: ['absorb','copyGone'],
      teach: ['Una copia que se sale del tablero desaparece para siempre.', 'A copy that falls off the board is gone for good.'],
      board: `
. . . . .
. . . . .
. . H . .
X . . . O` },
    { id: 'multi-4', name: ['Dedo y agujero', 'Finger and black hole'], hand: ['dedo','hoyoLeft'], need: ['absorb','dedo'],
      teach: ['El dedo también: las 4 salen con los pasos que te quedaban (al menos 1).', 'The finger too: all 4 come out with your remaining steps (at least 1).'],
      board: `
X . . . O
. H . . .
. . . . .
. . . . .` },
    { id: 'multi-5', name: ['Pon un agujero', 'Place a black hole'], hand: ['palo2','agujeroNegro'], need: ['placed','absorb'],
      teach: ['La carta de agujero negro pone uno en una casilla vacía.', 'The black hole card puts one on an empty square.'],
      board: `
. . . .
. . H .
. . . .
O . . .` },
  ] },
  { section: 'basics', deck: 'multiverse', levels: [
    { id: 'multi-6', from: 'p30', name: ['Horizonte doble', 'Double horizon'], hand: ['hoyoLeft','palo3'], need: ['holeSplit'],
      teach: ['El hoyo también se parte en 4 si pasa junto a un agujero negro.', 'The hole splits in 4 too if it passes a black hole.'],
      board: `
. . . . . .
. . . H . .
. X . . . .
. . . . . .
O . . . . .
. . . . . .` },
    { id: 'multi-7', name: ['Cuatro hoyos', 'Four holes'], hand: ['oHoyoRight','hoyoRight'], need: ['holeSplit'],
      teach: ['Las copias del hoyo son hoyos de verdad.', 'Hole copies are real holes.'],
      board: `
H . . O .
. X . . .
. . . . .
. . . . .
. . . . .` },
    { id: 'multi-8', from: 'p32', name: ['Hoyos gemelos', 'Twin holes'], hand: ['oGravedad','hoyoLeft','hoyoRight'],
      teach: ['Con varios hoyos, cada carta de hoyo pregunta cuál mueves.', 'With several holes, each hole card asks which one moves.'],
      board: `
. . . . .
. . . . .
. . . H .
. X . . .
. . . . .
. . . . O` },
    { id: 'multi-9', name: ['Hoyo perdido', 'Lost hole'], hand: ['oHoyoUp','palo1'], need: ['holeSplit','holeCopyGone'],
      teach: ['Una copia del hoyo que se sale del tablero desaparece.', 'A hole copy that falls off the board disappears.'],
      board: `
. . . .
. O . X
. . H .
. . . .` },
    { id: 'multi-10', name: ['Roca', 'Rock'], hand: ['palo3','palo2'], need: ['rockBump'],
      teach: ['La roca de meteorito es un muro: rebotas, como en un bloque.', 'A meteor rock is a wall: you bounce, like off a block.'],
      board: `
. . . .
R . . .
. . H .
O . . .
R . . .` },
  ] },
  { section: 'basics', deck: 'multiverse', levels: [
    { id: 'multi-11', name: ['Lluvia de meteoritos', 'Meteor shower'], hand: ['meteoritos','palo2'], need: ['meteorHit'], seed: 74465,
      teach: ['Si un meteorito alcanza tu pelota, vuelve a su salida.', 'If a meteor hits your ball, it goes back to its tee.'],
      board: `
. . . .
. . . .
. O . .
H . S .` },
    { id: 'multi-12', from: 'p31', name: ['Atracción fatal', 'Fatal attraction'], hand: ['gravedad','palo1'], need: ['gravity'],
      teach: ['La gravedad 2 atrae hacia su casilla lo que hay en su cruz (2 casillas).', 'Gravity 2 pulls whatever is in its cross (2 squares) toward its square.'],
      board: `
. . . . .
. . . . .
. . . O R
. . . . .
. . . . .
. . H . .` },
    { id: 'multi-13', name: ['Gravedad', 'Gravity'], hand: ['gravedad','palo2'], need: ['gpullHole','swallow'],
      teach: ['La gravedad también atrae al hoyo: si llega a tu pelota, se la traga.', 'Gravity pulls the hole too: if it reaches your ball, it swallows it.'],
      board: `
. . . .
. . . .
. . . H
O . . .` },
    { id: 'multi-14', name: ['Gravedad 1', 'Gravity 1'], hand: ['palo1','oGravedad'], need: ['gpullBall'],
      teach: ['La gravedad 1 (naranja) atrae lo que está pegado en cruz.', 'Gravity 1 (orange) pulls whatever is right next to it.'],
      board: `
H . . .
. . . .
. . . .
O . . .` },
    { id: 'multi-15', name: ['Atrae la copia', 'Pull the copy'], hand: ['oGravedad','palo3'], need: ['absorb','gpullCopy'],
      teach: ['La gravedad atrae también a las copias.', 'Gravity pulls copies too.'],
      board: `
. . . .
. H . .
. . . .
X . . O` },
  ] },
  /* ---------- Gambling ---------- */
  { section: 'basics', deck: 'gambling', levels: [
    { id: 'gamb-1', from: 'p33', name: ['Golpe y vuelta', 'Hit and back'], hand: ['hoyoDown','palo3'], need: ['dice'],
      teach: ['Casino: chocar con el dado te hace rebotar tantas casillas como marca.', 'Casino: hit the die and you bounce as many squares as it shows.'],
      board: `
. . . . .
. . H . .
. . . . .
D132 O . . .
. . . . .
. . . . .` },
    { id: 'gamb-2', from: 'p34', name: ['El hoyo rebota', 'The hole bounces'], hand: ['palo2','oHoyoRight','palo3'],
      teach: ['El hoyo también rebota en el dado.', 'The hole bounces off the die too.'],
      board: `
. . . . . .
. O . . . .
. . . . . .
. . . . . .
. . . . H D142
. . . . . .` },
    { id: 'gamb-3', name: ['Otro número', 'Another number'], hand: ['hoyoDown','oHoyoDown'], need: ['diceTwice'],
      teach: ['Cada golpe hace rodar el dado: la segunda vez marca otro número.', 'Each hit rolls the die: the second time it shows another number.'],
      board: `
. . . .
. . . .
. . . O
. . . .
. . . H
. . . D124` },
    { id: 'gamb-4', name: ['Dedo y dado', 'Finger and die'], hand: ['dedo','hoyoDown'], need: ['dice','dedo'],
      teach: ['Con el dedo, chocar con el dado te hace rebotar en recta y se acaba el dedo.', 'With the finger, hitting the die bounces you straight and ends the move.'],
      board: `
. . . . .
. . . . .
. . H . .
. . D624 . .
. . O . .` },
    { id: 'gamb-5', name: ['Pon un dado', 'Place a die'], hand: ['palo2','dado'], need: ['placed','dice'], seed: 79302,
      teach: ['La carta de dado pone uno con un número al azar.', 'The die card places one showing a random number.'],
      board: `
. . . . .
. . . . .
. O . . H
. . . . .` },
  ] },
  { section: 'basics', deck: 'gambling', levels: [
    { id: 'gamb-6', name: ['Cara', 'Heads'], hand: ['palo2'], need: ['coin','heads'], seed: 84290,
      teach: ['Pasa por una moneda y te la llevas: al acabar se lanza; con cara, vuelves a tirar.', 'Roll over a coin to grab it; it\'s tossed after the move: heads, you go again.'],
      board: `
H . . .
. . $ .
. . O .
. . . .` },
    { id: 'gamb-7', name: ['Cruz', 'Tails'], hand: ['palo3','palo1'], need: ['coin','tails'], seed: 68517,
      teach: ['Con cruz, vuelves a tu salida.', 'Tails: back to your tee.'],
      board: `
H . . .
. $ . .
. O . .
. . . S` },
    { id: 'gamb-8', name: ['La moneda del hoyo', 'The hole\'s coin'], hand: ['oHoyoRight','palo1'], need: ['holeCoin'], seed: 36357,
      teach: ['El hoyo también recoge monedas; con cara, lo vuelves a mover.', 'The hole picks up coins too; heads, you move it again.'],
      board: `
. . . .
. . . .
. . . O
. . H $` },
    { id: 'gamb-9', name: ['Casilla dorada', 'Golden square'], hand: ['palo1','palo2'], need: ['gold'], seed: 29518,
      teach: ['Pararte en la casilla dorada gira la ruleta: con el dorado, ganas directamente.', 'Stopping on the golden square spins the wheel: gold and you win outright.'],
      board: `
H G . .
. . . .
. . O .
. . . .` },
    { id: 'gamb-10', name: ['Ruleta', 'Roulette'], hand: ['ruleta','palo1'], need: ['roulette','goHome'], seed: 41960,
      teach: ['La ruleta manda a su salida a las pelotas del color que sale.', 'The roulette sends balls on the colour that comes up back to their tee.'],
      board: `
. O . .
. . H S
. G . .
. . . .` },
  ] },
  /* ---------- Lo no tan básico: combinaciones entre barajas ---------- */
  { section: 'advanced', deck: 'ultimate', levels: [
    { id: 'adv-1', name: ['Palo 10', '10 club'], hand: ['palo1','palo10'], need: ['palo10'],
      teach: ['En los campos grandes de Ultimate hay palo de 10.', 'Big Ultimate courses have a 10 club.'],
      board: `
. . . . . . . . . . .
. . . . . . . . . . .
. . . . . . . . . . .
. . . . . . . . . . .
O . . . . . . . . H .` },
    { id: 'adv-2', name: ['Iridiscente', 'Iridescent'], hand: ['paloIri','palo2'], need: ['iri','iriHit'],
      teach: ['El palo iridiscente no para hasta chocar con una pelota (que sale disparada igual) o caerse.', 'The iridescent club doesn\'t stop until it hits a ball (which flies off the same way) or falls off.'],
      board: `
O . . . .
. . H . .
o . . . .
. . . . .
. . . . .` },
    { id: 'adv-3', from: 'p11', name: ['Tope', 'Stopper'], hand: ['paloIri','palo2'], need: ['iri'],
      teach: ['Con el iridiscente, una pelota de obstáculo es tu tope.', 'With the iridescent club, an obstacle ball is your stopper.'],
      board: `
. . . . . .
. . . . # .
. . . . . .
. . O . . .
. . . . . .
. . . . H .
. . . . o .` },
    { id: 'adv-4', name: ['Carambola de madera', 'Wooden bank shot'], hand: ['paloIri','palo3'], need: ['iri','iriBump'],
      teach: ['El iridiscente rebota en bloques y esquinas y sigue.', 'The iridescent club bounces off blocks and corners and keeps going.'],
      board: `
o . . . #
H . . . .
. . . . O
◣ . . . .
. . . . .
. . . . .` },
    { id: 'adv-5', from: 'p20', name: ['Arcoíris en vuelo', 'Rainbow in flight'], hand: ['paloIri','hoyoDown','oPalo1'], need: ['iri'],
      teach: ['El iridiscente vuela en las lanzaderas y, al aterrizar, sigue.', 'The iridescent club flies off launchers and keeps rolling after landing.'],
      board: `
. . . . . O
. . . v . .
. . . H . .
. . . . . .
. . . . . .
. . . . . .` },
  ] },
  { section: 'advanced', deck: 'water+minigolf', levels: [
    { id: 'adv-6', from: 'p18', name: ['Hoyo volador', 'Flying hole'], hand: ['hoyoLeft','palo1','oPalo1'],
      teach: ['El hoyo vuela en la lanzadera y la pelota baja por el río: júntalos.', 'The hole flies off the launcher and the ball floats down the river: bring them together.'],
      board: `
. . . . .
. ~ . . .
. ~ O . .
. . . . .
. . . . .
. . . . .
^ . H . .` },
    { id: 'adv-7', from: 'p12', name: ['Corriente y codo', 'Current and elbow'], hand: ['palo1','oPalo1'], need: ['river'],
      teach: ['La corriente te deja junto a una esquina: úsala.', 'The current drops you by a corner: use it.'],
      board: `
. . . . . .
. O ~ . . .
. . ~ . . .
. . ~ . . .
. H ~ . . .
. ◣ . . . .` },
    { id: 'adv-8', from: 'p15', name: ['Paso atrás', 'Step back'], hand: ['palo1','palo3'],
      teach: ['La esquina te lleva al hoyo; el lago, mejor ni tocarlo.', 'The corner leads you to the hole; better stay clear of the lake.'],
      board: `
. . . . . .
. . . . . .
. . . . . .
L H . ◥ . .
L . . O . .
. . . . . .` },
    { id: 'adv-9', name: ['Desembocadura de madera', 'Wooden river mouth'], hand: ['palo1','palo2'], need: ['river','deflect'],
      teach: ['Si una esquina tapa la desembocadura, la corriente te pasa a través y te desvía.', 'If a corner blocks the river\'s mouth, the current takes you through and turns you.'],
      board: `
O . ~ .
. . ~ .
. . ~ .
. . ~ H
. . ◣ .` },
    { id: 'adv-10', name: ['Corriente contra el bloque', 'Current against the block'], hand: ['palo2','palo3'], need: ['river'],
      teach: ['Si un bloque tapa la desembocadura, la corriente te deja en una casilla libre de al lado.', 'If a block blocks the river\'s mouth, the current drops you on a free square nearby.'],
      board: `
H ~ . . .
. ~ . . .
. ~ O . .
. ~ ◥ . .
. # . . .` },
  ] },
  { section: 'advanced', deck: 'classic+mix', levels: [
    { id: 'adv-11', from: 'p10', name: ['Palo largo', 'Long club'], hand: ['palo4','hoyoLeft','oHoyoDown'],
      teach: ['Un palo largo y un portal: cuenta las casillas.', 'A long club and a portal: count the squares.'],
      board: `
. . . . . . P
O . . . . . .
. . H . . . .
. . P . . . .
. . . . . . .
. . . . . . .` },
    { id: 'adv-12', from: 'p19', name: ['Correo aéreo', 'Air mail'], hand: ['oPalo1','palo2','hoyoRight'],
      teach: ['Por el portal hasta la lanzadera, y a volar.', 'Through the portal onto the launcher, and fly.'],
      board: `
. . . . .
. O . . P
. . . . .
. . . . .
. . . P v
. . . . .
. . . . .
. . H . .` },
    { id: 'adv-13', name: ['Río al portal', 'River to portal'], hand: ['palo3','palo2'], need: ['river','portal'],
      teach: ['Si el río desemboca en un portal, la corriente te lleva a través.', 'If the river flows into a portal, the current takes you through.'],
      board: `
. ~ . . .
. ~ . . .
P ~ . . .
H P . . .
. O . . .` },
    { id: 'adv-14', name: ['Vuelo y portal', 'Flight and portal'], hand: ['palo1','palo3'], need: ['launch','portal'],
      teach: ['Lanzadera y portal en la misma jugada.', 'Launcher and portal in the same play.'],
      board: `
. . . . .
. . . O .
. . . . .
. . . < P
P . . . H` },
    { id: 'adv-15', name: ['Río, portal y lanzadera', 'River, portal and launcher'], hand: ['palo3','oPalo1','oHoyoUp'], need: ['river','launch'],
      teach: ['Lanzadera, portal y río: el hoyo también se mueve.', 'Launcher, portal and river: the hole moves too.'],
      board: `
O . . . . .
v P ~ . . .
. . ~ . . .
. . . . . .
. P H . . .
. . . . . .` },
  ] },
  { section: 'advanced', deck: 'train+mix', levels: [
    { id: 'adv-16', name: ['Tren al río', 'Train to the river'], hand: ['trenVuelta','palo1'], need: ['trainShove','river'], train: {"path":[[0,4],[1,4],[2,4],[3,4],[3,5],[3,6],[2,6],[1,6],[0,6],[0,5]],"stations":[1,3,6,8],"pos":6,"cars":0},
      teach: ['El tren puede empujarte al río.', 'The train can push you into the river.'],
      board: `
. . . . .
O ~ . . .
. ~ . . .
. ~ . . .
= = = =H .
= . . = .
= = =@ = .` },
    { id: 'adv-17', name: ['Tren al lago', 'Train to the lake'], hand: ['palo2','trenVuelta'], need: ['trainShove','lake'], train: {"path":[[2,2],[3,2],[4,2],[5,2],[5,3],[5,4],[4,4],[3,4],[2,4],[2,3]],"stations":[1,3,6,8],"pos":8,"cars":0},
      teach: ['O al lago: vuelves a tu salida.', 'Or into the lake: back to your tee.'],
      board: `
. . . . . . .
H . . . . . .
. . = = = = .
S L = . . = .
. L =@ =O = = .` },
    { id: 'adv-18', name: ['Tren a la arena', 'Train to the sand'], hand: ['trenVuelta','palo2'], need: ['trainShove','bunker'], train: {"path":[[2,0],[3,0],[4,0],[4,1],[4,2],[3,2],[2,2],[2,1]],"stations":[1,3,5,7],"pos":5,"cars":0},
      teach: ['El tren te deja en el búnker: salir cuesta 1.', 'The train drops you in the bunker: getting out costs 1.'],
      board: `
. . = = = .
. . = . = .
H b =O =@ = .
. . . . . .
. . . . . .` },
    { id: 'adv-19', name: ['Tren al portal', 'Train to the portal'], hand: ['palo3','trenVuelta'], need: ['trainShove','portal'], train: {"path":[[1,1],[2,1],[3,1],[3,2],[3,3],[2,3],[1,3],[1,2]],"stations":[1,3,5,7],"pos":5,"cars":0},
      teach: ['El tren te empuja a través del portal.', 'The train pushes you through the portal.'],
      board: `
. H . P O
. = = = .
. = . = P
. = =@ = .
. . . . .` },
    { id: 'adv-20', name: ['Tren a la lanzadera', 'Train to the launcher'], hand: ['trenVuelta','palo2'], need: ['trainShove','launch'], train: {"path":[[1,3],[2,3],[3,3],[4,3],[4,4],[4,5],[3,5],[2,5],[1,5],[1,4]],"stations":[1,3,6,8],"pos":8,"cars":0},
      teach: ['El tren te empuja a la lanzadera: a volar.', 'The train pushes you onto the launcher: off you go.'],
      board: `
. . . . .
. . . . H
. . . . .
. = = = =
. = . . =
. =@ = = =O
. . . . ^` },
  ] },
  { section: 'advanced', deck: 'seasons+mix', levels: [
    { id: 'adv-21', name: ['Fuego y portal', 'Fire and portal'], hand: ['palo2','palo3'], need: ['flare','portal'], season: {"now":"summer"},
      teach: ['El fuego da +2 también a través de un portal.', 'Fire gives +2 through a portal too.'],
      board: `
. P . . .
. H . . .
. F . . .
. . . . .
. O . . P` },
    { id: 'adv-22', name: ['Hielo y arena', 'Ice and sand'], hand: ['palo3','palo2'], need: ['slide','bunker'], season: {"now":"winter"},
      teach: ['El hielo te da 1 más… pero el búnker te frena igual.', 'Ice gives you 1 more… but the bunker still stops you.'],
      board: `
. . . O
. . . i
. . . b
. . . H
. . . .
. . . .` },
    { id: 'adv-23', name: ['Nieve contra madera', 'Snow against wood'], hand: ['palo3','oNieve'], need: ['snowBall'], season: {"now":"winter"},
      teach: ['La bola de nieve se para contra la madera.', 'The snowball stops against wood.'],
      board: `
. . O . . .
H . . * . .
. . . . . .
. . # . . .
. . . . . .` },
    { id: 'adv-24', name: ['Fuego y lanzadera', 'Fire and launcher'], hand: ['palo2','hoyoDown'], need: ['flare','launch'], season: {"now":"summer"},
      teach: ['El fuego te da 2 más hasta la lanzadera.', 'Fire gives you 2 more to reach the launcher.'],
      board: `
. H . . .
. . . . .
. . . . <
. . . . F
. . . . O
. . . . .` },
    { id: 'adv-25', name: ['Copias a la planta', 'Copies to the plant'], hand: ['palo3','palo1'], need: ['absorb','copyEaten','copySink'], season: {"now":"spring"},
      teach: ['La planta se come también las copias, y desaparecen.', 'The plant eats copies too, and they\'re gone.'],
      board: `
. . H . .
. O . X .
. . . . .
. . . . Y
. . . . .` },
  ] },
  { section: 'advanced', deck: 'multiverse+mix', levels: [
    { id: 'adv-26', name: ['Copia al lago', 'Copy in the lake'], hand: ['palo3','palo1'], need: ['absorb','copyLake'],
      teach: ['Una copia que cae al lago desaparece.', 'A copy that falls in the lake is gone.'],
      board: `
L X . . .
H . . . .
. . . . .
. O . . .
. . . . .` },
    { id: 'adv-27', name: ['Copias por el portal', 'Copies through the portal'], hand: ['palo1','palo2'], need: ['absorb','teleportAny','copySink'],
      teach: ['Las copias cruzan los portales como cualquier pelota.', 'Copies cross portals like any ball.'],
      board: `
. . . . O
. . P . X
. . . . .
. . . . .
H . P . .` },
    { id: 'adv-28', name: ['Gravedad y río', 'Gravity and river'], hand: ['palo3','oGravedad'], need: ['gpullBall','river'],
      teach: ['La gravedad puede meterte en el río.', 'Gravity can pull you into the river.'],
      board: `
. H ~ .
. . ~ .
. . . .
. . . O
. . . .` },
    { id: 'adv-29', name: ['Iridiscente y rocas', 'Iridescent and rocks'], hand: ['paloIri','palo3'], need: ['iri','iriBump'],
      teach: ['El iridiscente rebota en las rocas como en un bloque.', 'The iridescent club bounces off rocks like off a block.'],
      board: `
. . . R .
O . . . .
. . H o .
. . . . .
R . . . .
. . . . .` },
    { id: 'adv-30', name: ['Tren al agujero', 'Train to the black hole'], hand: ['palo2','trenVuelta'], need: ['absorb','trainShove'], train: {"path":[[0,2],[1,2],[2,2],[3,2],[3,3],[3,4],[3,5],[2,5],[1,5],[0,5],[0,4],[0,3]],"stations":[1,4,7,10],"pos":10,"cars":0},
      teach: ['El tren te lleva junto al agujero negro.', 'The train takes you next to the black hole.'],
      board: `
. . . . H .
. . . . X .
= = = = . .
= . . = . .
=@ O . = . .
= = = = . .` },
  ] },
  { section: 'advanced', deck: 'gambling+mix', levels: [
    { id: 'adv-31', name: ['Iridiscente y dado', 'Iridescent and die'], hand: ['palo1','paloIri'], need: ['iri','dice'],
      teach: ['El iridiscente rebota en el dado, pero no cuenta su número: sigue sin parar.', 'The iridescent club bounces off the die but ignores its number: it keeps going.'],
      board: `
. . . . . H
. . . . . .
. . . . . .
. . . . . O
. . . . . D132` },
    { id: 'adv-32', name: ['Dedo con suerte', 'Lucky finger'], hand: ['dedo'], need: ['coin','heads','dedo'], seed: 20333,
      teach: ['Con el dedo, si sale cara eliges otra vez los pasos y el camino.', 'With the finger, heads lets you pick the steps and path again.'],
      board: `
$ O . .
. . . .
. . . H
. . . .` },
    { id: 'adv-33', name: ['Dado y arena', 'Die and sand'], hand: ['palo1','hoyoLeft'], need: ['dice','bunker'],
      teach: ['Rebote en el dado y frenazo en el búnker.', 'Bounce off the die, stop in the bunker.'],
      board: `
b H . O D465
. . . . .
. . . . .
. . . . .
. . . . .` },
    { id: 'adv-34', name: ['Copia dorada', 'Golden copy'], hand: ['palo3','palo2'], need: ['absorb','roulette'], seed: 96397,
      teach: ['Una copia en la casilla dorada también gira la ruleta.', 'A copy on the golden square spins the wheel too.'],
      board: `
. . . . .
. . . O .
. H . . .
. G . X .
. . . . .` },
    { id: 'adv-35', name: ['Hielo y dado', 'Ice and die'], hand: ['oPalo1','palo3'], need: ['slide','dice'], season: {"now":"winter"},
      teach: ['Hielo, dado y búnker en el mismo campo.', 'Ice, die and bunker on one course.'],
      board: `
. H . . . .
. i . . . .
. . O . . .
. . b . . .
. D241 . . . .
. . . . . .` },
  ] },
  { section: 'advanced', deck: 'all', levels: [
    { id: 'adv-36', from: 'p24', name: ['Caos controlado', 'Controlled chaos'], hand: ['hoyoRight','paloIri'],
      teach: ['Río, esquina, lanzadera e iridiscente: un solo tiro.', 'River, corner, launcher and iridescent: one shot.'],
      board: `
. . . . . . .
. . . . . . .
O . . . . . .
. . . . . . .
. . . . . . .
◣ . . ~ . . .
. . . ~ . . .
. . . > H . .` },
    { id: 'adv-37', from: 'p22', name: ['Tope de arena', 'Sand stopper'], hand: ['paloIri','oPalo1','hoyoLeft'], need: ['iri'],
      teach: ['El búnker frena al iridiscente.', 'A bunker stops the iridescent club.'],
      board: `
. . . P . .
b H . . . .
. . . . . .
. . . . . .
. . . . . O
. . . . . P` },
    { id: 'adv-38', name: ['Fuego, vuelo y agujero', 'Fire, flight and black hole'], hand: ['palo3','palo1'], need: ['absorb'], season: {"now":"summer"},
      teach: ['Fuego, lanzadera y agujero negro.', 'Fire, launcher and black hole.'],
      board: `
. . . . . . .
^ . O X . . .
. . . . H . .
. . . . . . .
. . F . . . .
. . . . . . .` },
    { id: 'adv-39', name: ['Río, dado y portal', 'River, die and portal'], hand: ['palo3','oPalo1'], need: ['teleportAny'],
      teach: ['Río, dado y portal.', 'River, die and portal.'],
      board: `
. . . . . . .
. . . . . P .
. . . . ~ . D154
. . . . ~ O P
. . . . ~ . .
. . . . . . H` },
    { id: 'adv-40', name: ['Otoño en el espacio', 'Autumn in space'], hand: ['palo3','palo1'], need: ['absorb','leaf'], season: {"now":"autumn"},
      teach: ['Hojas secas, lanzadera y agujero negro.', 'Dry leaves, launcher and black hole.'],
      board: `
. . h . . .
. . X . . .
. . . . . .
. ^ O . . .
. . . H h .
. . . . . .` },
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
  if (B.snow) { L.season = { ...L.season, snow: B.snow }; delete L.snow; } // (la bola de nieve, en su estación)
  if (L.gamble && spec.hand.includes('ruleta')) L.deckCounts = { ...L.deckCounts, ruleta: 0 }; // (con ruleta, el suelo de colores)
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
