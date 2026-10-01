/* =========================================================
   El tren (baraja del tren): el circuito de vías.
   Puro (sin DOM): lo usan el motor (Game.pve, Game.fromLevel) y el creador de niveles.

   Un circuito es una vuelta cerrada de casillas vecinas (arriba/abajo/izquierda/derecha), en el
   sentido de las agujas del reloj, con 4 paradas más o menos a las 12, las 3, las 6 y las 9:
     { path: [[x, y], …], stations: [i12, i3, i6, i9] }   (índices de path, en orden de recorrido)
   En la partida, S.train = { path, stations, pos, cars }: pos es la casilla de la locomotora y
   cars los vagones de arena que lleva detrás (0-3).

   La forma cambia mucho de una partida a otra: un contorno rectilíneo cuyo lado de arriba y de
   abajo (o, girado, los de los lados) suben y bajan a escalones, con tramos rectos largos (ahí la
   locomotora empuja sin parar) y curvas en cada escalón. Nunca pasa por las casillas de `avoid`
   (salidas de las pelotas y hoyo) y dos tramos de vía nunca se tocan de lado.
   ========================================================= */

export const MAX_CARS = 3;

const key = (x, y) => x + ',' + y;
const randInt = (rand, a, b) => a + Math.floor(rand() * (b - a + 1));

// perfil a escalones de `len` columnas: arranca en `start` y cada tramo (de 2 a 5 casillas) sube o baja
function profile(rand, len, start, lo, hi, maxStep) {
  const out = [];
  let v = start, run = randInt(rand, 2, 5);
  for (let i = 0; i < len; i++) {
    if (run <= 0 && i < len - 2) { // (sin escalón en las dos últimas: la esquina queda limpia)
      const d = randInt(rand, 1, maxStep) * (rand() < .5 ? -1 : 1);
      v = Math.max(lo, Math.min(hi, v + d));
      run = randInt(rand, 2, 5);
    }
    out.push(v); run--;
  }
  return out;
}

// un intento: contorno con el lado de arriba t(x) y el de abajo b(x), de x0 a x1 (C columnas × R filas)
function attempt(rand, C, R) {
  // ancho y alto muy variables: a veces el circuito rodea todo el campo y a veces solo una parte (y cruza el recorrido)
  const mx = Math.floor(C * .3), my = Math.floor(R / 3);
  const x0 = randInt(rand, 0, mx), x1 = C - 1 - randInt(rand, 0, mx);
  if (x1 - x0 < 3) return null;
  const n = x1 - x0 + 1, deep = rand() < .35; // a veces escalones grandes: formas muy distintas
  const maxStep = deep ? Math.max(1, Math.floor(R / 4)) : 1 + (rand() < .5 ? 1 : 0);
  const top = profile(rand, n, randInt(rand, 0, my), 0, R - 4, maxStep);
  const bot = profile(rand, n, R - 1 - randInt(rand, 0, my), 3, R - 1, maxStep);
  for (let i = 0; i < n; i++) if (bot[i] - top[i] < 3) return null; // (los dos lados, con dos filas de césped entre medias como poco)
  const path = [];
  const push = (x, y) => path.push([x, y]);
  const t = i => top[i], b = i => bot[i];
  // arriba, de izquierda a derecha (los escalones bajan o suben por la columna nueva)
  push(x0, t(0));
  for (let i = 1; i < n; i++) {
    const x = x0 + i;
    push(x, t(i - 1));
    const s = Math.sign(t(i) - t(i - 1));
    for (let y = t(i - 1) + s; s && y !== t(i) + s; y += s) push(x, y);
  }
  // derecha, hacia abajo
  for (let y = t(n - 1) + 1; y <= b(n - 1); y++) push(x1, y);
  // abajo, de derecha a izquierda
  for (let i = n - 2; i >= 0; i--) {
    const x = x0 + i;
    push(x, b(i + 1));
    const s = Math.sign(b(i) - b(i + 1));
    for (let y = b(i + 1) + s; s && y !== b(i) + s; y += s) push(x, y);
  }
  // izquierda, hacia arriba (hasta justo debajo de la primera casilla)
  for (let y = b(0) - 1; y > t(0); y--) push(x0, y);
  return path;
}

// ¿vuelta cerrada válida? casillas distintas, cada una vecina de la siguiente y sin tramos que se toquen de lado
export function validPath(path, C, R) {
  const L = path.length;
  if (L < 4) return false; // (hecho a mano en el creador puede ser pequeño; los de las partidas, de 12 o más)
  const at = new Map(path.map(([x, y], i) => [key(x, y), i]));
  if (at.size !== L) return false;
  for (let i = 0; i < L; i++) {
    const [x, y] = path[i], [nx, ny] = path[(i + 1) % L];
    if (x < 0 || y < 0 || x >= C || y >= R || Math.abs(x - nx) + Math.abs(y - ny) !== 1) return false;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const j = at.get(key(x + dx, y + dy));
      if (j !== undefined && j !== (i + 1) % L && j !== (i - 1 + L) % L) return false;
    }
  }
  return true;
}

// las 4 paradas: la casilla de la vía más cerca de las 12, las 3, las 6 y las 9 (con un desvío al azar), en
// orden de recorrido y separadas por 2 casillas como poco
function stationsFor(path, rand) {
  const L = path.length;
  const cx = path.reduce((s, p) => s + p[0], 0) / L, cy = path.reduce((s, p) => s + p[1], 0) / L;
  const ang = path.map(([x, y]) => Math.atan2(y - cy, x - cx));
  const out = [];
  for (let k = 0; k < 4; k++) {
    const target = -Math.PI / 2 + k * Math.PI / 2 + (rand() - .5) * .95; // (±27°)
    let best = -1, bd = Infinity;
    for (let i = 0; i < L; i++) {
      const d = Math.abs(Math.atan2(Math.sin(ang[i] - target), Math.cos(ang[i] - target)));
      if (d < bd && !out.includes(i)) { bd = d; best = i; }
    }
    out.push(best);
  }
  // en orden de recorrido desde la de las 12 (la vuelta va en el sentido del reloj, como las paradas)
  const s0 = out[0], ord = [...out].sort((a, b) => ((a - s0 + L) % L) - ((b - s0 + L) % L));
  for (let i = 0; i < 4; i++) { const gap = (ord[(i + 1) % 4] - ord[i] + L) % L; if (gap < 3) return null; }
  return ord;
}

// circuito nuevo para un tablero C×R sin pasar por `avoid` ([[x, y], …]); null si no cabe
export function makeCircuit(C, R, rand, avoid = []) {
  const bad = new Set(avoid.map(([x, y]) => key(x, y)));
  for (let tries = 0; tries < 400; tries++) {
    const flip = rand() < .4 && R >= 7; // girado: los lados irregulares son los de izquierda y derecha
    let path = flip ? attempt(rand, R, C) : attempt(rand, C, R);
    if (!path) continue;
    if (flip) path = path.map(([x, y]) => [y, x]).reverse(); // (al girar se invierte el sentido: se recorre al revés)
    if (rand() < .5) path = path.map(([x, y]) => [C - 1 - x, y]).reverse(); // espejo
    if (path.length < 12 || !validPath(path, C, R) || path.some(([x, y]) => bad.has(key(x, y)))) continue;
    const stations = stationsFor(path, rand);
    if (stations) return { path, stations };
  }
  return null;
}

// dirección de una casilla a la vecina
export const stepDir = (a, b) => b[0] > a[0] ? 'right' : b[0] < a[0] ? 'left' : b[1] > a[1] ? 'down' : 'up';
// pasos hasta la siguiente parada desde `pos` (nunca 0: si está en una, hasta la siguiente)
export function stepsToNext(tr, pos = tr.pos) {
  const L = tr.path.length;
  let best = L;
  for (const s of tr.stations) { const d = (s - pos + L) % L; if (d > 0 && d < best) best = d; }
  return best;
}
