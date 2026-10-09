// Tableros de Lo básico en ASCII: para escribir niveles a mano (tools/basics-design.mjs) y para enseñarlos
// (buscador, auditoría). Una casilla por palabra, separadas por espacios; una palabra puede juntar varias cosas
// (`bO`: tu pelota en un búnker).
//   .  césped        H hoyo        O tu pelota       o pelota de obstáculo
//   S  la salida de tu pelota (si no es donde empieza)   K la casilla inicial del hoyo (ídem)
//   b  búnker        P portal (P2: de la pareja 2)   ~ río   L lago
//   #  bloque        ◤ ◥ ◢ ◣ esquinas (rot 0-3: dónde está el ángulo recto)    ^ > v < lanzaderas     T túnel
//   h  hoja seca     c charco      i hielo           Y planta          F fuego           * bola de nieve
//   X  agujero negro R roca de meteorito
//   D  dado (D3: con el 3 arriba; D364: arriba 3, norte 6, este 4)  $ moneda   G casilla dorada
//   =  vía del tren y w ruta del viento (solo al dibujar: el recorrido va aparte, en train / wind)
const CORNERS = ['◤', '◥', '◢', '◣'], LAUNCH = ['^', '>', 'v', '<'];
const SIMPLE = { b: 'bunker', P: 'portal', '~': 'river', L: 'lake', '#': 'block', T: 'tunnel', h: 'leaf', c: 'puddle', i: 'ice', Y: 'plant', F: 'fire', X: 'blackhole', R: 'meteorite' };

export function parseBoard(text) {
  const lines = text.split('\n').map(s => s.trim()).filter(Boolean).map(s => s.split(/\s+/));
  const rows = lines.length, cols = lines[0].length;
  const L = { cols, rows, tiles: [], extraBalls: [] }, coins = [];
  let gold = null, snow = null;
  lines.forEach((ln, y) => {
    if (ln.length !== cols) throw new Error(`fila ${y}: ${ln.length} casillas (esperaba ${cols})`);
    ln.forEach((w, x) => {
      for (let i = 0; i < w.length; i++) {
        const ch = w[i];
        if (ch === '.' || ch === '=' || ch === 'w' || ch === '@') continue; // (vía, viento y locomotora: solo dibujo)
        if (ch === 'H') L.hole = { x, y };
        else if (ch === 'O') L.ball = { x, y };
        else if (ch === 'o') L.extraBalls.push({ x, y });
        else if (ch === 'S') L.spawn = { x, y };
        else if (ch === 'K') L.home = { x, y };
        else if (ch === 'P') { const m = /^\d/.exec(w.slice(i + 1)); L.tiles.push({ type: 'portal', x, y, ...(m ? { pair: +m[0] } : {}) }); if (m) i++; }
        else if (SIMPLE[ch]) L.tiles.push({ type: SIMPLE[ch], x, y });
        else if (CORNERS.includes(ch)) L.tiles.push({ type: 'corner', x, y, ...(CORNERS.indexOf(ch) ? { rot: CORNERS.indexOf(ch) } : {}) });
        else if (LAUNCH.includes(ch)) L.tiles.push({ type: 'launcher', x, y, ...(LAUNCH.indexOf(ch) ? { rot: LAUNCH.indexOf(ch) } : {}) });
        else if (ch === 'D') { const m = /^\d{1,3}/.exec(w.slice(i + 1)) || ['']; const [t, n, e] = [...m[0]].map(Number); L.tiles.push({ type: 'dice', x, y, ...(t ? { t } : {}), ...(n ? { n, e } : {}) }); i += m[0].length; }
        else if (ch === '$') coins.push({ x, y });
        else if (ch === 'G') gold = { x, y };
        else if (ch === '*') snow = { x, y };
        else throw new Error(`símbolo desconocido «${ch}» en (${x},${y})`);
      }
    });
  });
  if (!L.extraBalls.length) delete L.extraBalls;
  if (coins.length || gold) L.gamble = { gold, coins };
  if (snow) L.snow = snow;
  return L;
}

// dibujo de un estado (nivel o partida): hoyo, pelotas y piezas
export function drawLevel(L) {
  const at = {};
  const put = (x, y, s) => { const k = x + ',' + y; at[k] = (at[k] || '') + s; };
  for (const tl of L.tiles || []) put(tl.x, tl.y, tl.type === 'corner' ? CORNERS[tl.rot || 0] : tl.type === 'launcher' ? LAUNCH[tl.rot || 0]
    : tl.type === 'dice' ? 'D' + (tl.t || '') + (tl.n ? '' + tl.n + tl.e : '') : tl.type === 'portal' && tl.pair ? 'P' + tl.pair : Object.keys(SIMPLE).find(k => SIMPLE[k] === tl.type) || '?');
  for (const c of L.gamble?.coins || []) put(c.x, c.y, '$');
  if (L.gamble?.gold) put(L.gamble.gold.x, L.gamble.gold.y, 'G');
  if (L.season?.snow) put(L.season.snow.x, L.season.snow.y, '*');
  for (const [x, y] of L.train?.path || []) if (!at[x + ',' + y]) put(x, y, '=');
  for (const [x, y] of L.season?.wind?.path || []) if (!at[x + ',' + y]) put(x, y, 'w');
  if (L.train?.path) { const [lx, ly] = L.train.path[L.train.pos ?? 0]; put(lx, ly, '@'); } // (@: la locomotora)
  for (const e of L.extraBalls || []) put(e.x, e.y, 'o');
  if (L.spawn) put(L.spawn.x, L.spawn.y, 'S');
  if (L.home) put(L.home.x, L.home.y, 'K');
  put(L.hole.x, L.hole.y, 'H');
  put(L.ball.x, L.ball.y, 'O');
  let s = '';
  for (let y = 0; y < L.rows; y++) {
    const row = [];
    for (let x = 0; x < L.cols; x++) row.push((at[x + ',' + y] || '.').padEnd(2));
    s += row.join(' ') + '\n';
  }
  return s;
}

// vía del tren: la vuelta a un rectángulo (x0,y0)-(x1,y1) en el sentido del reloj, empezando arriba a la izquierda, con 4
// paradas repartidas; pos: la parada (0-3) donde está la locomotora
export function ring(x0, y0, x1, y1, { stop = 0, cars = 0, stations } = {}) {
  const path = [];
  for (let x = x0; x <= x1; x++) path.push([x, y0]);
  for (let y = y0 + 1; y <= y1; y++) path.push([x1, y]);
  for (let x = x1 - 1; x >= x0; x--) path.push([x, y1]);
  for (let y = y1 - 1; y > y0; y--) path.push([x0, y]);
  const L = path.length, st = stations || [0, 1, 2, 3].map(k => Math.floor((k * L) / 4 + L / 8) % L);
  return { path, stations: st, pos: st[stop], cars };
}
