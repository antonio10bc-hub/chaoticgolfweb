// Código para compartir un nivel del creador: todo el nivel en un texto corto que se puede pegar o
// mandar como enlace (…#nivel=CÓDIGO). Quien lo recibe lo guarda en "Tus niveles".
//   CG1<base64url>  JSON compacto comprimido (deflate-raw)
//   CG0<base64url>  el mismo JSON sin comprimir (navegadores sin CompressionStream)
// El JSON usa claves cortas y solo lo que define el nivel; al leerlo se valida todo (tamaño, casillas
// dentro del tablero, piezas y cartas que existen), así que un código roto o manipulado no rompe nada.
import { CARDS } from '../cards/index.js';
import { TILES } from '../tiles/index.js';
import { validPath, MAX_CARS } from '../../engine/train.js';
import { SEASONS } from '../../engine/seasons.js';

export const LEVEL_SIZE = { minCols: 3, maxCols: 25, minRows: 5, maxRows: 25 };
export const LINK_KEY = 'nivel';

const b64u = bytes => { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64u = str => { const s = atob(str.replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(s, c => c.charCodeAt(0)); };
async function pipe(bytes, Stream) {
  const out = new Blob([bytes]).stream().pipeThrough(new Stream('deflate-raw'));
  return new Uint8Array(await new Response(out).arrayBuffer());
}
const canZip = () => typeof CompressionStream === 'function' && typeof DecompressionStream === 'function';

// nivel → JSON compacto (solo lo que cuenta para jugarlo)
export function packLevel(L) {
  const o = { c: L.cols, r: L.rows, h: [L.hole.x, L.hole.y], b: [L.ball.x, L.ball.y] };
  if (L.name) o.n = L.name;
  if (L.parCells?.length) o.p = L.parCells.map(p => [p.x, p.y, p.n]);
  if (L.tiles?.length) o.t = L.tiles.map(tl => { // [tipo, x, y, giro, pareja] sin los ceros del final
    const a = [tl.type, tl.x, tl.y, tl.rot || 0, tl.pair || 0];
    while (a.length > 3 && !a[a.length - 1]) a.pop();
    return a;
  });
  if (L.extraBalls?.length) o.o = L.extraBalls.map(e => [e.x, e.y]);
  const d = Object.entries(L.deckCounts || {}).filter(([k, n]) => CARDS[k] && n > 0);
  if (d.length) o.d = Object.fromEntries(d);
  if (L.hand?.length) o.k = L.hand.filter(k => CARDS[k]);
  if (L.train?.path?.length) o.tr = { p: L.train.path.flat(), s: L.train.stations, i: L.train.pos, c: L.train.cars || 0 }; // (el circuito, casilla a casilla)
  if (L.season?.now) o.s = L.season.snow ? [L.season.now, L.season.snow.x, L.season.snow.y] : [L.season.now]; // (la estación y la bola de nieve)
  return o;
}

// JSON compacto → nivel (o null si no es válido)
export function unpackLevel(o) {
  if (!o || typeof o !== 'object') return null;
  const int = v => Number.isInteger(v) ? v : NaN;
  const cols = int(o.c), rows = int(o.r);
  if (!(cols >= LEVEL_SIZE.minCols && cols <= LEVEL_SIZE.maxCols && rows >= LEVEL_SIZE.minRows && rows <= LEVEL_SIZE.maxRows)) return null;
  const inB = (x, y) => Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < cols && y < rows;
  const pt = a => Array.isArray(a) && inB(a[0], a[1]) ? { x: a[0], y: a[1] } : null;
  const hole = pt(o.h), ball = pt(o.b);
  if (!hole || !ball || (hole.x === ball.x && hole.y === ball.y)) return null;
  const used = new Set();
  const free = (x, y) => { const k = x + ',' + y; if (used.has(k)) return false; used.add(k); return true; };
  const tiles = [];
  for (const a of Array.isArray(o.t) ? o.t : []) {
    if (!Array.isArray(a) || !TILES[a[0]] || TILES[a[0]].virtual || !inB(a[1], a[2]) || !free(a[1], a[2])) continue;
    const tl = { type: a[0], x: a[1], y: a[2] };
    if (TILES[a[0]].rotates && Number.isInteger(a[3]) && a[3] > 0 && a[3] < 4) tl.rot = a[3];
    if (a[0] === 'portal' && Number.isInteger(a[4]) && a[4] > 0 && a[4] < 7) tl.pair = a[4];
    tiles.push(tl);
  }
  const parCells = (Array.isArray(o.p) ? o.p : []).filter(a => Array.isArray(a) && inB(a[0], a[1]) && Number.isInteger(a[2]) && a[2] > 0 && a[2] < 100)
    .map(a => ({ x: a[0], y: a[1], n: a[2] }));
  const extraBalls = (Array.isArray(o.o) ? o.o : []).map(pt).filter(e => e && !(e.x === ball.x && e.y === ball.y) && !(e.x === hole.x && e.y === hole.y));
  const deckCounts = {};
  for (const k of Object.keys(CARDS)) { const n = o.d?.[k]; deckCounts[k] = Number.isInteger(n) && n > 0 ? Math.min(n, 30) : 0; }
  const L = { version: 1, name: typeof o.n === 'string' ? o.n.slice(0, 40) : '', cols, rows, hole, ball, parCells, tiles, deckCounts };
  if (extraBalls.length) L.extraBalls = extraBalls;
  const hand = (Array.isArray(o.k) ? o.k : []).filter(k => CARDS[k]).slice(0, 6);
  if (hand.length) L.hand = hand;
  // el tren: una vuelta válida, 4 paradas distintas en ella, la locomotora en la vía y 0-3 vagones
  const tr = o.tr, flat = Array.isArray(tr?.p) ? tr.p : [];
  if (flat.length && flat.length % 2 === 0 && flat.length <= 2 * cols * rows) {
    const path = []; for (let i = 0; i < flat.length; i += 2) path.push([flat[i], flat[i + 1]]);
    const P = path.length, idx = v => Number.isInteger(v) && v >= 0 && v < P;
    const st = Array.isArray(tr.s) ? tr.s.filter(idx) : [];
    if (path.every(([x, y]) => inB(x, y)) && validPath(path, cols, rows) && st.length === 4 && new Set(st).size === 4 && idx(tr.i)) {
      const cars = Number.isInteger(tr.c) ? Math.max(0, Math.min(MAX_CARS, tr.c)) : 0;
      L.train = { path, stations: st, pos: tr.i, cars };
      L.tiles = L.tiles.filter(tl => !path.some(([x, y]) => x === tl.x && y === tl.y));
    }
  }
  // la estación (y, en invierno, la bola de nieve en una casilla sin nada)
  if (Array.isArray(o.s) && SEASONS.includes(o.s[0])) {
    L.season = { now: o.s[0] };
    const sn = o.s[0] === 'winter' && pt([o.s[1], o.s[2]]);
    if (sn && !used.has(sn.x + ',' + sn.y) && !(sn.x === hole.x && sn.y === hole.y) && !(sn.x === ball.x && sn.y === ball.y)) L.season.snow = sn;
  }
  return L;
}

export async function encodeLevel(L) {
  const bytes = new TextEncoder().encode(JSON.stringify(packLevel(L)));
  return canZip() ? 'CG1' + b64u(await pipe(bytes, CompressionStream)) : 'CG0' + b64u(bytes);
}

// acepta el código solo, con espacios o saltos de línea, o un enlace entero (…#nivel=CÓDIGO)
export function extractCode(text) {
  const m = /CG[01][A-Za-z0-9_-]+/.exec(String(text || '').replace(/\s+/g, ''));
  return m ? m[0] : null;
}
export async function decodeLevel(text) {
  const code = extractCode(text);
  if (!code) return null;
  try {
    let bytes = unb64u(code.slice(3));
    if (code[2] === '1') { if (!canZip()) return null; bytes = await pipe(bytes, DecompressionStream); }
    return unpackLevel(JSON.parse(new TextDecoder().decode(bytes)));
  } catch (e) { return null; }
}

// enlace que abre el juego con el nivel listo para guardar
export const levelLink = (code, base = location.origin + location.pathname) => `${base}#${LINK_KEY}=${code}`;
// huella del nivel (para no guardar dos veces el mismo)
export const levelKey = L => JSON.stringify(packLevel({ ...L, name: '' }));
