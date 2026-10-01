// Creador de niveles: un taller sobre una alfombrilla de corte, con la misma barra que la partida.
//   · arriba: volver, Mis niveles, el nombre y el estado del nivel, deshacer/rehacer, guardar y compartir
//   · izquierda: las herramientas por baraja (con el dibujo real de cada pieza) y sus opciones
//   · centro: el tablero con reglas numeradas y +/− de columnas y filas en sus bordes
//   · derecha: el mazo del nivel (plantillas por baraja y cada carta con su número) o la mano inicial
//   · abajo: Probar nivel (con trampas: cualquier carta a mano, deshacer y mover piezas; ver lab.js)
// Se pinta arrastrando; clic derecho borra con cualquier herramienta. El borrador en curso se guarda
// solo; "Guardar" lo lleva a Mis niveles (my-levels.js), desde donde se comparte con un código.
import { track } from './analytics.js';
import { app } from './app.js';
import { $, esc } from './dom.js';
import { CARDS, CARD_KEYS, defaultCounts } from '../content/cards/index.js';
import { cardArtHTML } from './card-art.js';
import { TILES, tilePic } from '../content/tiles/index.js';
import { DECKS } from '../content/decks.js';
import { ASSETS, pColor } from '../art.js';
import { fitCellsTo } from './geometry.js';
import { isPhone } from './device.js';
import { makeCircuit, validPath, MAX_CARS } from '../engine/train.js';
import { trackSVG, draftTrackSVG, LOCO, WAGON } from './train-view.js';
import { cellCenterPx } from './geometry.js';
import { mulberry32, randomSeed } from '../engine/rng.js';
import { waterJoins, waterDelay } from './board.js';
import { showScreen } from './screens.js';
import { openModes } from './screen-modes.js';
import { startLevel, levelPreviewSVG } from './screen-story.js';
import { toast } from './hud.js';
import { confirmDialog } from './dialog.js';
import { sfx } from '../audio/sfx.js';
import { t } from '../i18n/index.js';
import { LEVEL_SIZE } from '../content/levels/share.js';
import { listLevels, storeLevel, deleteWithUndo, shareLevelDialog, addCodeDialog, sizeLabel } from './my-levels.js';

// level: el nivel en el taller · idx: su posición en Mis niveles (null: aún sin guardar)
// saved: cómo era al guardarlo (para saber si hay cambios) · tool/rot/pair/parN: la herramienta
export const ED = { level: null, idx: null, saved: null, tool: 'ball', rots: {}, pair: 1, parN: 1, tab: 'deck', undo: [], redo: [] };
// giro elegido para la herramienta activa (cada pieza que gira recuerda el suyo)
const curRot = () => ED.rots[ED.tool] || 0;
const setRot = r => { ED.rots[ED.tool] = r; };
const DRAFT_KEY = 'chaoticgolf_editor';
const HAND_MAX = 6, UNDO_MAX = 80;

// herramientas por grupo (la primera fila son las piezas de cualquier nivel)
const GROUPS = [
  ['basic', ['ball', 'hole', 'par', 'decoy', 'erase']],
  ['classic', ['bunker', 'portal']],
  ['water', ['river', 'lake']],
  ['mini', ['block', 'corner', 'tunnel', 'launcher']],
  ['train', ['track', 'station', 'loco']],
];
const SHORTCUT = { b: 'ball', h: 'hole', p: 'par', o: 'decoy', x: 'erase' };
const isTileTool = tool => !!TILES[tool];
const PAIRS = [1, 2, 3], PAIR_LETTER = p => 'ABC'[p - 1];

/* ---------- nivel ---------- */
// plantilla: la disposición estándar (columna de PAR + hoyo) para 1 jugador
function defaultLevel(cols = 12, rows = 9, par = 5) {
  const cx = Math.floor(cols / 2);
  const topPad = Math.max(0, Math.floor((rows - (par + 2)) / 2));
  const parCells = [];
  for (let i = 0; i < par; i++) parCells.push({ x: cx, y: topPad + 1 + i, n: par - i });
  const deckCounts = Object.fromEntries(CARD_KEYS.map(k => [k, /^palo[123]$/.test(k) ? 2 : 0]));
  return { version: 1, name: '', cols, rows, hole: { x: cx, y: topPad }, ball: { x: cx, y: Math.min(rows - 1, topPad + par + 1) }, parCells, tiles: [], deckCounts };
}
// cualquier nivel (antiguo, recibido…) con todos los campos que usa el taller
function normalize(L) {
  const out = JSON.parse(JSON.stringify(L));
  out.tiles = (out.tiles || []).filter(tl => TILES[tl.type] && !TILES[tl.type].virtual).map(tl => tl.type === 'portal' && !tl.pair ? { ...tl, pair: 1 } : tl);
  out.parCells = out.parCells || [];
  out.extraBalls = out.extraBalls || [];
  out.deckCounts = Object.fromEntries(CARD_KEYS.map(k => [k, out.deckCounts?.[k] || 0]));
  out.hand = (out.hand || []).filter(k => CARDS[k]);
  // el tren se edita casilla a casilla (out.rails); el circuito ordenado (train) se saca al guardar o probar
  if (out.train && validPath(out.train.path || [], out.cols, out.rows)) out.rails = railsFromTrain(out.train);
  delete out.train;
  if (out.rails) {
    const inB = ([x, y]) => x >= 0 && y >= 0 && x < out.cols && y < out.rows, cells = (out.rails.cells || []).filter(inB);
    const on = c => cells.some(q => q[0] === c[0] && q[1] === c[1]);
    out.rails = { cells, stations: (out.rails.stations || []).filter(on).slice(0, 4), loco: out.rails.loco && on(out.rails.loco) ? out.rails.loco : null, cars: Math.max(0, Math.min(MAX_CARS, out.rails.cars || 0)) };
    if (!cells.length) delete out.rails;
  }
  delete out.at;
  return out;
}
// el nivel tal como se guarda y se juega (sin listas vacías)
function exportable(L) {
  const out = JSON.parse(JSON.stringify(L));
  if (out.rails) { const tr = trainOf(out); if (tr) out.train = tr; delete out.rails; }
  if (!out.extraBalls?.length) delete out.extraBalls;
  if (!out.hand?.length) delete out.hand;
  return out;
}
const snap = () => JSON.stringify(ED.level); // (tal cual: con las vías a medias, para deshacer)
const dirty = () => ED.saved !== snap();

function persist() {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ level: ED.level, idx: ED.idx, saved: ED.saved })); } catch (e) { /* sin storage */ }
}
function loadDraft() {
  try {
    const d = JSON.parse(localStorage.getItem(DRAFT_KEY));
    if (d?.level?.cols) { ED.level = normalize(d.level); ED.idx = Number.isInteger(d.idx) && d.idx < listLevels().length ? d.idx : null; ED.saved = ED.idx != null ? d.saved : null; return true; }
  } catch (e) { /* borrador roto */ }
  return false;
}
function setLevel(L, idx = null) {
  ED.level = normalize(L); ED.idx = idx; ED.undo = []; ED.redo = [];
  ED.saved = idx != null ? snap() : null;
  persist();
}

/* ---------- deshacer ---------- */
function pushUndo() {
  ED.undo.push(snap());
  if (ED.undo.length > UNDO_MAX) ED.undo.shift();
  ED.redo.length = 0;
}
function undoStep(from, to) {
  if (!from.length) return;
  to.push(snap());
  ED.level = normalize(JSON.parse(from.pop()));
  sfx('select');
  refresh();
}
const edUndo = () => undoStep(ED.undo, ED.redo);
const edRedo = () => undoStep(ED.redo, ED.undo);

/* ---------- casillas ---------- */
const same = (a, x, y) => a && a.x === x && a.y === y;
const tileAt = (x, y) => ED.level.tiles.find(tl => tl.x === x && tl.y === y);
const parAt = (x, y) => ED.level.parCells.find(p => p.x === x && p.y === y);
const decoyAt = (x, y) => ED.level.extraBalls.findIndex(e => e.x === x && e.y === y);
// ¿puede estar una pelota o el hoyo en esa loseta? (solo en el búnker; en el resto no se para nadie)
const standable = tl => !tl || tl.type === 'bunker';
/* ---- el tren: vías, paradas y locomotora, casilla a casilla ----
   L.rails = { cells: [[x, y]…], stations: [[x, y]…] (4), loco: [x, y] | null, cars }. Se puede jugar cuando las vías forman
   una sola vuelta cerrada (cada casilla con dos vecinas de vía) y hay 4 paradas en ella: entonces trainOf da el circuito
   ordenado del motor ({ path, stations, pos, cars }, en el sentido del reloj) */
const key2 = (x, y) => x + ',' + y;
const railAt = (x, y) => !!ED.level.rails?.cells.some(([cx, cy]) => cx === x && cy === y);
const stationAt = (x, y) => !!ED.level.rails?.stations.some(([cx, cy]) => cx === x && cy === y);
function railsFromTrain(tr) {
  return { cells: tr.path.map(c => [...c]), stations: tr.stations.map(i => [...tr.path[i]]), loco: [...tr.path[tr.pos]], cars: tr.cars || 0 };
}
// las casillas como vuelta ordenada (en el sentido del reloj) o null si no son una sola vuelta cerrada
function orderLoop(cells) {
  if (cells.length < 4) return null;
  const has = new Set(cells.map(([x, y]) => key2(x, y)));
  const nb = ([x, y]) => [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [x + dx, y + dy]).filter(([nx, ny]) => has.has(key2(nx, ny)));
  if (cells.some(c => nb(c).length !== 2)) return null;
  const path = [cells[0]];
  let prev = null, cur = cells[0];
  for (let guard = 0; guard < cells.length; guard++) {
    const next = nb(cur).find(n => !prev || n[0] !== prev[0] || n[1] !== prev[1]);
    if (next[0] === cells[0][0] && next[1] === cells[0][1]) break;
    path.push(next); prev = cur; cur = next;
  }
  if (path.length !== cells.length) return null; // (varias vueltas sueltas)
  let area = 0;
  for (let i = 0; i < path.length; i++) { const [x0, y0] = path[i], [x1, y1] = path[(i + 1) % path.length]; area += x0 * y1 - x1 * y0; }
  return area >= 0 ? path : [path[0], ...path.slice(1).reverse()]; // (en la pantalla, área positiva = sentido del reloj)
}
// lo que falta para jugar con este tren (claves de ed.st)
function railProblems(L) {
  const R = L.rails;
  if (!R?.cells.length) return [];
  const out = [];
  const path = orderLoop(R.cells);
  if (!path) out.push(t('ed.st.trackOpen'));
  if (R.stations.length !== 4) out.push(t('ed.st.stations', { n: R.stations.length }));
  if (path && R.stations.length === 4) {
    const tr = trainOf(L, { check: false }), P = tr.path.length;
    for (let k = 0; k <= tr.cars; k++) { const [x, y] = tr.path[(tr.pos - k + P) % P]; if (same(L.ball, x, y) || same(L.hole, x, y) || L.extraBalls.some(e => same(e, x, y))) { out.push(t('ed.st.trainCovers')); break; } }
  }
  return out;
}
function trainOf(L, { check = true } = {}) {
  const R = L.rails, path = R && orderLoop(R.cells);
  if (!path || R.stations.length !== 4) return null;
  const idx = ([x, y]) => path.findIndex(c => c[0] === x && c[1] === y);
  const stations = R.stations.map(idx).sort((a, b) => a - b), li = R.loco ? idx(R.loco) : -1;
  const tr = { path, stations, pos: li >= 0 ? li : stations[0], cars: Math.min(R.cars || 0, MAX_CARS, path.length - 1) };
  return check && railProblems(L).length ? null : tr;
}
// ¿la locomotora o sus vagones están ahí? (ni pelotas ni hoyo pueden empezar encima)
function trainOn(x, y) {
  const R = ED.level.rails;
  if (!R) return false;
  const tr = trainOf(ED.level, { check: false });
  if (!tr) return !!R.loco && R.loco[0] === x && R.loco[1] === y;
  const i = tr.path.findIndex(c => c[0] === x && c[1] === y);
  return i >= 0 && (tr.pos - i + tr.path.length) % tr.path.length <= tr.cars;
}
// circuito nuevo al azar: estirado hasta casi los bordes, sin pasar por la pelota, el hoyo, los obstáculos ni las piezas
function newCircuit() {
  const L = ED.level, avoid = [[L.hole.x, L.hole.y], [L.ball.x, L.ball.y], ...L.extraBalls.map(e => [e.x, e.y]), ...L.tiles.map(tl => [tl.x, tl.y])];
  const c = makeCircuit(L.cols, L.rows, mulberry32(randomSeed()), avoid, { fill: true }); // (estirado: la vía llena el campo)
  if (!c) { toast(t('ed.bad.noCircuit'), 'warn'); return false; }
  L.rails = railsFromTrain({ path: c.path, stations: c.stations, pos: c.stations[0], cars: L.rails?.cars || 0 });
  return true;
}
const dropRail = (x, y) => { const R = ED.level.rails, not = c => !(c[0] === x && c[1] === y);
  R.cells = R.cells.filter(not); R.stations = R.stations.filter(not); if (R.loco && !not(R.loco)) R.loco = null;
  if (!R.cells.length) delete ED.level.rails; };

let badShown = 0;
function bad(x, y, key) {
  const cell = $('edBoard').children[y * ED.level.cols + x];
  cell?.classList.remove('edBad'); void cell?.offsetWidth; cell?.classList.add('edBad');
  if (Date.now() - badShown > 900) { toast(t(key), 'warn'); badShown = Date.now(); }
}

// qué hará la herramienta en esta casilla al empezar a pulsar (y en las que se arrastre)
function modeAt(x, y, erase) {
  if (erase) return 'erase';
  const tool = ED.tool, tl = tileAt(x, y);
  if (tool === 'track') return railAt(x, y) ? 'unrail' : 'rail';
  if (tool === 'station') return stationAt(x, y) ? 'unstation' : 'station';
  if (tool === 'loco') return 'loco';
  if (tool === 'ball' || tool === 'hole') return 'move';
  if (tool === 'par') return parAt(x, y)?.n === ED.parN ? 'remove' : 'paint';
  if (tool === 'decoy') return decoyAt(x, y) >= 0 ? 'remove' : 'paint';
  if (tl?.type === tool) return TILES[tool].rotates ? 'rotate' : tool === 'portal' && tl.pair !== ED.pair ? 'paint' : 'remove';
  return 'paint';
}

// aplica la herramienta en (x,y); devuelve si ha cambiado algo
function applyAt(x, y, mode) {
  const L = ED.level, tool = ED.tool, tl = tileAt(x, y);
  const isBall = same(L.ball, x, y), isHole = same(L.hole, x, y), di = decoyAt(x, y);
  const dropTile = () => { L.tiles = L.tiles.filter(q => q !== tl); };
  switch (mode) {
    case 'rail': { // vía nueva (casilla a casilla; arrastrando, un tramo)
      if (railAt(x, y)) return false;
      if (tl) { bad(x, y, 'ed.bad.onTrack'); return false; }
      (L.rails ||= { cells: [], stations: [], loco: null, cars: 0 }).cells.push([x, y]);
      return true;
    }
    case 'unrail': if (!railAt(x, y)) return false; dropRail(x, y); return true;
    case 'station': {
      if (stationAt(x, y)) return false;
      if (!railAt(x, y)) { bad(x, y, 'ed.bad.stationOffTrack'); return false; }
      if (L.rails.stations.length >= 4) { bad(x, y, 'ed.bad.stationsFull'); return false; }
      L.rails.stations.push([x, y]);
      return true;
    }
    case 'unstation': L.rails.stations = L.rails.stations.filter(c => !(c[0] === x && c[1] === y)); return true;
    case 'loco': {
      if (!railAt(x, y)) { bad(x, y, 'ed.bad.locoOffTrack'); return false; }
      if (L.rails.loco && L.rails.loco[0] === x && L.rails.loco[1] === y) return false;
      if (isBall || isHole || di >= 0) { bad(x, y, 'ed.bad.onTrain'); return false; }
      L.rails.loco = [x, y];
      return true;
    }
    case 'erase': {
      const had = !!tl || !!parAt(x, y) || di >= 0 || railAt(x, y);
      if (tl) dropTile();
      if (railAt(x, y)) dropRail(x, y);
      L.parCells = L.parCells.filter(p => !same(p, x, y));
      if (di >= 0) L.extraBalls.splice(di, 1);
      return had;
    }
    case 'move': {
      const key = tool === 'ball' ? 'ball' : 'hole', other = tool === 'ball' ? L.hole : L.ball;
      if (same(L[key], x, y)) return false;
      if (same(other, x, y)) { bad(x, y, 'ed.bad.ballHole'); return false; }
      if (!standable(tl)) { bad(x, y, 'ed.bad.onPiece'); return false; }
      if (trainOn(x, y)) { bad(x, y, 'ed.bad.onTrain'); return false; }
      if (di >= 0) L.extraBalls.splice(di, 1);
      L[key] = { x, y };
      return true;
    }
    case 'remove': {
      if (tool === 'par') { L.parCells = L.parCells.filter(p => !same(p, x, y)); return true; }
      if (tool === 'decoy') { if (di >= 0) L.extraBalls.splice(di, 1); return di >= 0; }
      if (tl?.type === tool) { dropTile(); return true; }
      return false;
    }
    case 'rotate': {
      if (!tl || !TILES[tl.type].rotates) return false;
      tl.rot = ((tl.rot || 0) + 1) % 4;
      ED.rots[tl.type] = tl.rot;
      if (!tl.rot) delete tl.rot;
      return true;
    }
    case 'paint': {
      if (tool === 'par') {
        if (tl) { bad(x, y, 'ed.bad.parOnPiece'); return false; }
        const p = parAt(x, y);
        if (p) { if (p.n === ED.parN) return false; p.n = ED.parN; } else L.parCells.push({ x, y, n: ED.parN });
        return true;
      }
      if (tool === 'decoy') {
        if (isBall || isHole || di >= 0) { if (isBall || isHole) bad(x, y, 'ed.bad.taken'); return false; }
        if (!standable(tl)) { bad(x, y, 'ed.bad.onPiece'); return false; }
        if (trainOn(x, y)) { bad(x, y, 'ed.bad.onTrain'); return false; }
        L.extraBalls.push({ x, y });
        return true;
      }
      if (!isTileTool(tool)) return false;
      if (tl?.type === tool && (tool !== 'portal' || tl.pair === ED.pair)) return false;
      if (railAt(x, y)) { bad(x, y, 'ed.bad.onTrack'); return false; } // (nada encima de las vías)
      if ((isBall || isHole || di >= 0) && tool !== 'bunker') { bad(x, y, 'ed.bad.taken'); return false; }
      if (tool === 'portal' && L.tiles.filter(q => q.type === 'portal' && q.pair === ED.pair && q !== tl).length >= 2) {
        bad(x, y, 'ed.bad.pairFull'); return false;
      }
      if (tl) dropTile();
      L.parCells = L.parCells.filter(p => !same(p, x, y));
      const nt = { type: tool, x, y };
      if (TILES[tool].rotates && curRot()) nt.rot = curRot();
      if (tool === 'portal') nt.pair = ED.pair;
      L.tiles.push(nt);
      return true;
    }
  }
  return false;
}

/* ---------- tamaño ---------- */
function resize(dc, dr) {
  const L = ED.level;
  const cols = Math.min(LEVEL_SIZE.maxCols, Math.max(LEVEL_SIZE.minCols, L.cols + dc));
  const rows = Math.min(LEVEL_SIZE.maxRows, Math.max(LEVEL_SIZE.minRows, L.rows + dr));
  if (cols === L.cols && rows === L.rows) { sfx('bad'); return; }
  pushUndo();
  L.cols = cols; L.rows = rows;
  const inB = p => p.x < cols && p.y < rows;
  L.tiles = L.tiles.filter(inB); L.parCells = L.parCells.filter(inB); L.extraBalls = L.extraBalls.filter(inB);
  if (L.rails) { const R = L.rails, inC = ([x, y]) => x < cols && y < rows; // (las vías que quedan fuera, fuera)
    R.cells = R.cells.filter(inC); R.stations = R.stations.filter(inC); if (R.loco && !inC(R.loco)) R.loco = null; if (!R.cells.length) delete L.rails; }
  for (const k of ['hole', 'ball']) {
    L[k] = { x: Math.min(L[k].x, cols - 1), y: Math.min(L[k].y, rows - 1) };
    L.tiles = L.tiles.filter(tl => !same(tl, L[k].x, L[k].y) || tl.type === 'bunker'); // (quien queda en el borde, fuera de piezas)
    L.extraBalls = L.extraBalls.filter(e => !same(e, L[k].x, L[k].y));
  }
  if (same(L.ball, L.hole.x, L.hole.y)) L.ball = { x: L.ball.x, y: L.ball.y > 0 ? L.ball.y - 1 : L.ball.y + 1 };
  sfx('woodTick');
  refresh();
}

/* ---------- estado del nivel ---------- */
const deckTotal = L => Object.values(L.deckCounts).reduce((a, b) => a + b, 0);
const levelPar = L => L.parCells.length ? Math.max(...L.parCells.map(p => p.n)) : 0;
// lo que impide jugarlo (errors) y lo que conviene saber (warns)
function issues(L) {
  const errors = [], warns = [];
  if (deckTotal(L) < 3 && !L.hand.length) errors.push(t('ed.st.deck'));
  errors.push(...railProblems(L)); // (el tren: vuelta cerrada y 4 paradas)
  for (const p of PAIRS) if (L.tiles.filter(q => q.type === 'portal' && q.pair === p).length === 1) warns.push(t('ed.st.pair', { l: PAIR_LETTER(p) }));
  if (!L.parCells.length) warns.push(t('ed.st.noPar'));
  return { errors, warns };
}
function paintStatus() {
  const L = ED.level, { errors, warns } = issues(L), el = $('edStatus');
  const parts = errors.length ? [t('ed.st.missing', { what: errors.join(' · ') })]
    : [t('ed.st.ready'), levelPar(L) ? 'PAR ' + levelPar(L) : null, t('ed.st.cards', { n: deckTotal(L) }), ...warns];
  if (dirty()) parts.push(t('ed.st.unsaved'));
  el.textContent = parts.filter(Boolean).join(' · ');
  el.className = errors.length ? 'err' : warns.length ? 'warn' : 'ok';
  $('edTest').disabled = !!errors.length;
  $('edTest').title = errors.length ? errors.join(' · ') : t('ed.testTitle');
  $('edUndo').disabled = !ED.undo.length; $('edRedo').disabled = !ED.redo.length;
  const sv = $('edSave'), clean = !dirty();
  sv.classList.toggle('isSaved', clean);
  sv.querySelector('.lbl').textContent = t(clean ? 'ed.savedShort' : 'ed.save');
  sv.querySelector('use').setAttribute('href', clean ? '#i-check' : '#i-save');
}

/* ---------- pintar ---------- */
const decoyHTML = () => `<div class="cardOnCell tile-ball edDecoy"><div class="circ" style="--pc:#F1F1DC"></div></div>`;
function toolPic(tool) {
  switch (tool) {
    case 'ball': return `<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="21" cy="22" r="11" fill="rgba(20,40,20,.25)"/><circle cx="20" cy="20" r="11" fill="${pColor(0)}" stroke="#F1F1DC" stroke-width="2.4"/></svg>`;
    case 'hole': return `<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="22" r="15" fill="#8DB05F"/><ellipse cx="18" cy="27" rx="5" ry="3.4" fill="#242424"/><path d="M18 27V9" stroke="#F1F1DC" stroke-width="2" stroke-linecap="round"/><path d="M19 9.5l10 3.4-10 3.6z" fill="#E8873A"/></svg>`;
    case 'par': return `<span class="tiPar">PAR</span>`;
    case 'decoy': return `<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="21" cy="22" r="11" fill="rgba(20,40,20,.25)"/><circle cx="20" cy="20" r="11" fill="#F1F1DC" stroke="#9A9A8C" stroke-width="2"/></svg>`;
    case 'erase': return `<svg class="i" aria-hidden="true"><use href="#i-eraser"/></svg>`;
    // el agua se dibuja con el fondo de la casilla: aquí, una muestra
    case 'river': return `<svg viewBox="0 0 40 48" aria-hidden="true"><rect x="9" y="2" width="22" height="44" rx="5" fill="#5BB6D6"/><path d="M14 2v44M26 2v44" stroke="rgba(20,80,110,.25)" stroke-width="3"/><path d="M15 14l5 5 5-5M15 26l5 5 5-5" fill="none" stroke="rgba(255,255,255,.75)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    case 'lake': return `<svg viewBox="0 0 40 48" aria-hidden="true"><rect x="3" y="6" width="34" height="36" rx="9" fill="#2E7E8C"/><path d="M9 20q5-3 10 0t10 0M11 31q5-3 10 0t10 0" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="2" stroke-linecap="round"/><path d="M24 30l7-3a7 7 0 1 1-.5 5z" fill="#5E9A58"/></svg>`;
    case 'track': return `<svg viewBox="0 0 40 48" aria-hidden="true"><path d="M8 44 C8 18 32 18 32 4" fill="none" stroke="#8A5A33" stroke-width="13" stroke-dasharray="2.6 4"/>` +
      `<path d="M3 44 C3 14 27 14 27 4M13 44 C13 22 37 22 37 4" fill="none" stroke="#4B5057" stroke-width="2.2"/></svg>`;
    case 'station': return `<svg viewBox="0 0 40 48" aria-hidden="true"><rect x="4" y="8" width="32" height="32" rx="5" fill="#CCC6B8" stroke="#ADA696" stroke-width="1.4"/>` +
      `<path d="M20 4V44" stroke="#8A5A33" stroke-width="13" stroke-dasharray="2.6 4"/><path d="M15 4V44M25 4V44" stroke="#4B5057" stroke-width="2.2"/><path d="M8 12V36M32 12V36" stroke="#E8B23A" stroke-width="2.2" stroke-linecap="round"/></svg>`;
    case 'loco': return `<svg viewBox="0 0 40 48" aria-hidden="true">${LOCO.replace(/<svg class="trainSvg" viewBox="0 0 70 100" preserveAspectRatio="none"/, '<svg x="6" y="2" width="28" height="44" viewBox="0 0 70 100"')}</svg>`;
    default: return tilePic({ type: tool, rot: ED.rots[tool] || 0 });
  }
}
const toolName = tool => t('ed.tools.' + tool);
function renderTools() {
  const key = tool => Object.keys(SHORTCUT).find(k => SHORTCUT[k] === tool);
  $('edTools').innerHTML = GROUPS.map(([g, tools]) => `<div class="edGroup"><h3>${esc(t('ed.groups.' + g))}</h3><div class="edToolRow">` +
    tools.map(tool => { const on = ED.tool === tool, k = key(tool);
      return `<button class="edTool${on ? ' on' : ''}${tool === 'portal' ? ' pair' + ED.pair : ''}" data-tool="${tool}" aria-pressed="${on}" title="${esc(toolName(tool) + (k ? ` (${k.toUpperCase()})` : ''))}">` +
        `<span class="tiPic">${toolPic(tool)}</span><span class="tiName">${esc(toolName(tool))}</span></button>`; }).join('') +
    `</div></div>`).join('');
  renderToolOpts();
}
function renderToolOpts() {
  const tool = ED.tool, L = ED.level;
  let html = `<h3>${esc(toolName(tool))}</h3>`;
  if (tool === 'par') {
    html += `<div class="edChips" role="group" aria-label="${esc(t('ed.opt.parN'))}">` + [1, 2, 3, 4, 5, 6, 7, 8, 9].map(n =>
      `<button class="chip${ED.parN === n ? ' on' : ''}" data-parn="${n}" aria-pressed="${ED.parN === n}">${n}</button>`).join('') + `</div>`;
  } else if (tool === 'portal') {
    html += `<div class="edChips pairs" role="group" aria-label="${esc(t('ed.opt.pair'))}">` + PAIRS.map(p => {
      const n = L.tiles.filter(q => q.type === 'portal' && q.pair === p).length;
      return `<button class="chip pairChip pair${p}${ED.pair === p ? ' on' : ''}" data-pair="${p}" aria-pressed="${ED.pair === p}"><i></i>${PAIR_LETTER(p)}<small>${n}/2</small></button>`; }).join('') + `</div>`;
  } else if (TILES[tool]?.rotates) {
    html += `<div class="edChips rots" role="group" aria-label="${esc(t('ed.opt.rot'))}">` + [0, 1, 2, 3].map(r =>
      `<button class="chip rotChip${curRot() === r ? ' on' : ''}" data-rot="${r}" aria-pressed="${curRot() === r}" aria-label="${esc(t('ed.opt.rotN', { n: r * 90 }))}">${tilePic({ type: tool, rot: r })}</button>`).join('') + `</div>`;
  }
  else if (tool === 'track') {
    html += `<div class="edChips"><button class="chip" data-train="new">${esc(t('ed.opt.trackRandom'))}</button>` +
      (L.rails ? `<button class="chip" data-train="del">${esc(t('ed.opt.trackDel'))}</button>` : '') + `</div>`;
  } else if (tool === 'station') {
    html += `<p class="edCount${(L.rails?.stations.length || 0) === 4 ? ' ok' : ''}">${esc(t('ed.opt.stationsN', { n: L.rails?.stations.length || 0 }))}</p>`;
  } else if (tool === 'loco') {
    html += `<div class="edChips" role="group" aria-label="${esc(t('ed.opt.cars'))}"><span class="edOptLbl">${esc(t('ed.opt.cars'))}</span>` +
      Array.from({ length: MAX_CARS + 1 }, (_, n) => `<button class="chip${(L.rails?.cars || 0) === n ? ' on' : ''}" data-cars="${n}" aria-pressed="${(L.rails?.cars || 0) === n}"${L.rails ? '' : ' disabled'}>${n}</button>`).join('') + `</div>`;
  }
  html += `<p class="edHint">${esc(t('ed.hint.' + (TILES[tool]?.rotates ? 'rotates' : tool), { l: PAIR_LETTER(ED.pair) }))}</p>`;
  html += `<p class="edHint soft">${esc(t('ed.hint.always'))}</p>`;
  $('edToolOpts').innerHTML = html;
}

export function edRender() {
  const L = ED.level, board = $('edBoard');
  board.style.gridTemplateColumns = `repeat(${L.cols}, var(--cell-w))`;
  const tmap = new Map(L.tiles.map(tl => [tl.x + ',' + tl.y, tl]));
  const tAt = (x, y) => tmap.get(x + ',' + y);
  const pmap = new Map(L.parCells.map(p => [p.x + ',' + p.y, p]));
  const dset = new Set(L.extraBalls.map(e => e.x + ',' + e.y));
  let html = '';
  for (let y = 0; y < L.rows; y++) for (let x = 0; x < L.cols; x++) {
    const par = pmap.get(x + ',' + y), tile = tAt(x, y);
    let cls = 'cell' + (((x + y) >> 1) & 1 ? ' mowB' : ''), inner = '';
    const aria = [t('a11y.cell', { x, y })];
    if (par) { cls += ' par'; inner = ASSETS.parLabelHTML(par.n); aria.push('PAR ' + par.n); }
    if (tile) {
      cls += ' ' + TILES[tile.type].cellClass + waterJoins((ox, oy) => tAt(x + ox, y + oy), x, y, tile);
      inner += ASSETS.tileHTML(tile.type, '', tile);
      aria.push(t(`tiles.${tile.type}.name`));
    }
    if (same(L.hole, x, y)) { inner += ASSETS.holeHTML(); aria.push(t('a11y.hole')); }
    if (same(L.ball, x, y)) { inner += ASSETS.ballHTML(0); aria.push(toolName('ball')); }
    if (dset.has(x + ',' + y)) { inner += decoyHTML(); aria.push(toolName('decoy')); }
    const bg = ASSETS.cellArt(tile, par);
    html += `<div class="${cls}" role="gridcell" data-x="${x}" data-y="${y}" aria-label="${esc(aria.join(', '))}" style="--row:${y};--col:${x}${tile && (tile.type === 'river' || tile.type === 'lake') ? ';--wd:' + waterDelay(tile.type) : ''}${bg ? `;background-image:url(${bg});background-size:cover` : ''}">${inner}</div>`;
  }
  board.innerHTML = html;
  if (L.rails) board.insertAdjacentHTML('beforeend', editorTrainSVG(L));
  $('edRulerX').style.gridTemplateColumns = `repeat(${L.cols}, var(--cell-w))`;
  $('edRulerY').style.gridTemplateRows = `repeat(${L.rows}, var(--cell-h))`;
  $('edRulerX').innerHTML = Array.from({ length: L.cols }, (_, i) => `<span>${i + 1}</span>`).join('');
  $('edRulerY').innerHTML = Array.from({ length: L.rows }, (_, i) => `<span>${i + 1}</span>`).join('');
  $('edSizeC').querySelector('.szN').textContent = t('ed.cols', { n: L.cols });
  $('edSizeR').querySelector('.szN').textContent = t('ed.rows', { n: L.rows });
  $('edSizeC').querySelector('[data-size="c+1"]').disabled = L.cols >= LEVEL_SIZE.maxCols;
  $('edSizeC').querySelector('[data-size="c-1"]').disabled = L.cols <= LEVEL_SIZE.minCols;
  $('edSizeR').querySelector('[data-size="r+1"]').disabled = L.rows >= LEVEL_SIZE.maxRows;
  $('edSizeR').querySelector('[data-size="r-1"]').disabled = L.rows <= LEVEL_SIZE.minRows;
  if (hover) showGhost(hover.x, hover.y);
  paintStatus();
}

// (baraja del tren) las vías del nivel y el tren en su sitio, sobre la cuadrícula del taller (no se pueden tocar: la
// casilla de debajo recibe el clic)
const ANG = { up: 0, right: 90, down: 180, left: 270 };
function editorTrainSVG(L) {
  const R = L.rails, board = $('edBoard'), w = board.offsetWidth || 1, h = board.offsetHeight || 1;
  const center = (x, y) => { const c = cellCenterPx(x, y); return [c.px, c.py]; };
  const s = cellCenterPx(1, 1), o = cellCenterPx(0, 0), cw = s.px - o.px, ch = s.py - o.py;
  const piece = (svg, [x0, y0], d) => { const [x, y] = center(x0, y0);
    return `<g transform="translate(${x} ${y}) rotate(${ANG[d]})">${svg.replace(/<svg class="trainSvg" viewBox="0 0 70 100" preserveAspectRatio="none"/, `<svg x="${-cw * .45}" y="${-ch * .49}" width="${cw * .9}" height="${ch * .98}" viewBox="0 0 70 100" preserveAspectRatio="none"`)}</g>`; };
  const tr = trainOf(L, { check: false }), dirOf = (a, b) => b[0] > a[0] ? 'right' : b[0] < a[0] ? 'left' : b[1] > a[1] ? 'down' : 'up';
  let out = '';
  if (tr) { // vuelta cerrada con sus 4 paradas: como en la partida, con la locomotora y sus vagones
    const P = tr.path.length, at = i => tr.path[(i + P) % P];
    out += trackSVG(tr, center, w, h);
    for (let k = tr.cars; k >= 1; k--) out += piece(WAGON, at(tr.pos - k), dirOf(at(tr.pos - k), at(tr.pos - k + 1)));
    out += piece(LOCO, at(tr.pos), dirOf(at(tr.pos - 1), at(tr.pos)));
  } else { // a medias: los tramos puestos y, en rojo, las casillas que aún no enlazan con dos vecinas
    out += draftTrackSVG(R.cells, R.stations, center, w, h);
    const has = new Set(R.cells.map(([x, y]) => key2(x, y)));
    for (const [x, y] of R.cells) {
      const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => has.has(key2(x + dx, y + dy))).length;
      if (n !== 2) { const [px, py] = center(x, y); out += `<circle cx="${px}" cy="${py}" r="${Math.min(cw, ch) * .38}" class="edRailOpen"/>`; }
    }
    if (R.loco) { const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].find(([dx, dy]) => has.has(key2(R.loco[0] + dx, R.loco[1] + dy)));
      out += piece(LOCO, R.loco, n ? dirOf(R.loco, [R.loco[0] + n[0], R.loco[1] + n[1]]) : 'up'); }
  }
  return `<svg class="edTrack" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true">${out}</svg>`;
}

// fantasma de la herramienta en la casilla bajo el ratón
let hover = null;
function showGhost(x, y) {
  $('edBoard').querySelectorAll('.edGhost').forEach(g => g.remove());
  $('edBoard').querySelectorAll('.edHover').forEach(c => c.classList.remove('edHover'));
  hover = x == null ? null : { x, y };
  if (!hover || ED.tool === 'erase' || ['track', 'station', 'loco'].includes(ED.tool)) return;
  const cell = $('edBoard').children[y * ED.level.cols + x];
  if (!cell) return;
  cell.classList.add('edHover');
  if (ED.tool === 'par') { cell.insertAdjacentHTML('beforeend', `<div class="edGhost par">${ASSETS.parLabelHTML(ED.parN)}</div>`); return; }
  const inner = ED.tool === 'ball' ? ASSETS.ballHTML(0) : ED.tool === 'hole' ? ASSETS.holeHTML() : ED.tool === 'decoy' ? decoyHTML()
    : ASSETS.tileHTML(ED.tool, '', { type: ED.tool, rot: curRot(), pair: ED.tool === 'portal' ? ED.pair : undefined });
  cell.insertAdjacentHTML('beforeend', `<div class="edGhost">${inner}</div>`);
}

/* ---------- cartas: mazo y mano inicial ---------- */
const ORDER = () => [...CARD_KEYS.filter(k => CARDS[k].color !== 'orange'), ...CARD_KEYS.filter(k => CARDS[k].color === 'orange')];
const cardName = k => CARDS[k].short || CARDS[k].name;
const cardDesc = k => { const d = t(`cards.${k}.desc`); return d === `cards.${k}.desc` ? '' : d; };
function presetCounts(id) {
  const base = defaultCounts();
  if (id === 'empty') return Object.fromEntries(CARD_KEYS.map(k => [k, 0]));
  const dk = DECKS.find(d => d.id === id);
  return { ...Object.fromEntries(CARD_KEYS.map(k => [k, 0])), ...(dk?.counts ? dk.counts(base) : base) };
}
function renderDeck() {
  const L = ED.level, tab = ED.tab;
  $('edDeckTabs').innerHTML = ['deck', 'hand'].map(id => `<button role="tab" data-tab="${id}" aria-selected="${tab === id}" class="${tab === id ? 'on' : ''}">` +
    `${esc(t('ed.tab.' + id))}<b>${id === 'deck' ? deckTotal(L) : L.hand.length}</b></button>`).join('');
  let html = '';
  if (tab === 'deck') {
    const counts = JSON.stringify(L.deckCounts);
    html += `<div class="edPresets"><span>${esc(t('ed.presets'))}</span>` +
      [...DECKS.map(d => d.id), 'empty'].map(id => { const on = counts === JSON.stringify(presetCounts(id));
        return `<button class="chip${on ? ' on' : ''}" data-preset="${id}"${id !== 'empty' ? ` style="--dc:${DECKS.find(d => d.id === id).color}"` : ''}>${esc(t('ed.preset.' + id))}</button>`; }).join('') + `</div>`;
    html += `<div class="edCards">` + ORDER().map(k => {
      const n = L.deckCounts[k] || 0, def = CARDS[k];
      return `<div class="edCard ${def.color}${n ? ' on' : ''}"><button class="ecAdd" data-add="${k}" title="${esc(cardName(k) + (cardDesc(k) ? ': ' + cardDesc(k) : ''))}" aria-label="${esc(t('ed.cardAria', { card: cardName(k), n }))}">` +
        `<span class="ecArt">${cardArtHTML(def)}</span><span class="ecName">${esc(cardName(k))}</span></button>` +
        `<span class="ecN" aria-hidden="true">${n}</span>` +
        (n ? `<button class="ecSub" data-sub="${k}" aria-label="${esc(t('ed.cardSub', { card: cardName(k) }))}"><svg class="i" aria-hidden="true"><use href="#i-minus"/></svg></button>` : '') + `</div>`; }).join('') + `</div>`;
    const blacks = ORDER().filter(k => CARDS[k].color !== 'orange').reduce((a, k) => a + L.deckCounts[k], 0);
    const touch = matchMedia('(pointer: coarse)').matches; // (en táctil no hay clic derecho)
    html += `<p class="edFoot">${esc(t(touch ? 'ed.deckFootTouch' : 'ed.deckFoot', { n: deckTotal(L), b: blacks, o: deckTotal(L) - blacks }))}</p>`;
  } else {
    html += `<p class="edHint">${esc(t('ed.handHint'))}</p><div class="edHand">` + Array.from({ length: HAND_MAX }, (_, i) => {
      const k = L.hand[i];
      return k ? `<button class="edSlot ${CARDS[k].color}" data-unhand="${i}" title="${esc(t('ed.handRemove', { card: cardName(k) }))}"><span class="ecArt">${cardArtHTML(CARDS[k])}</span><span class="ecName">${esc(cardName(k))}</span><i><svg class="i" aria-hidden="true"><use href="#i-x"/></svg></i></button>`
        : `<span class="edSlot empty" aria-hidden="true"></span>`; }).join('') + `</div>`;
    html += `<div class="edCards pick">` + ORDER().map(k => `<div class="edCard ${CARDS[k].color}"><button class="ecAdd" data-hand="${k}" ${L.hand.length >= HAND_MAX ? 'disabled' : ''} title="${esc(cardName(k) + (cardDesc(k) ? ': ' + cardDesc(k) : ''))}">` +
      `<span class="ecArt">${cardArtHTML(CARDS[k])}</span><span class="ecName">${esc(cardName(k))}</span></button></div>`).join('') + `</div>`;
    if (L.hand.length) html += `<p class="edFoot"><button class="btn-text" data-clearhand="1">${esc(t('ed.handClear'))}</button></p>`;
  }
  $('edDeckBody').innerHTML = html;
}

/* ---------- ajuste al hueco ---------- */
export function fitEditorBoard() {
  const st = $('edMain'), L = ED.level;
  if (!st || !L) return;
  const r = st.getBoundingClientRect();
  // reglas (22px), controles de tamaño (46px), marco del tablero (16px) y el dock de abajo
  const dock = $('edDock').getBoundingClientRect().height; // (0 en el ordenador: solo existe en el móvil)
  const narrow = innerWidth <= 900 || (isPhone() && innerHeight <= 540); // (móvil, también en horizontal: reglas y botones de tamaño más estrechos, casillas que pueden ser más pequeñas)
  fitCellsTo(L.cols, L.rows, Math.max(120, r.width - (narrow ? 18 + 46 : 22 + 56) - 24), Math.max(120, r.height - dock - (narrow ? 18 + 44 : 22 + 52) - 26), 60, narrow ? 16 : 24);
}
function refresh({ fit = true } = {}) {
  if (fit) fitEditorBoard();
  $('edName').value = ED.level.name || '';
  edRender(); renderTools(); renderDeck();
  persist();
}
// tras cambiar el nivel (con su deshacer ya apuntado)
function changed({ tools = false, deck = false } = {}) {
  edRender();
  if (tools) renderToolOpts();
  if (deck) renderDeck();
  persist();
}

/* ---------- guardar, Mis niveles, probar ---------- */
function save({ quiet = false } = {}) {
  const { errors } = issues(ED.level);
  if (errors.length) { toast(t('ed.st.missing', { what: errors.join(' · ') }), 'warn'); return false; }
  ED.idx = storeLevel(exportable(ED.level), ED.idx);
  ED.saved = snap();
  persist(); paintStatus();
  if (!quiet) { toast(t('ed.savedToast', { name: ED.level.name || t('story.untitled') })); sfx('select'); }
  return true;
}
async function leaveChanges() { // ¿se puede dejar el nivel en curso? (con cambios sin guardar, se pregunta)
  if (!dirty() || (ED.idx == null && JSON.stringify(exportable(ED.level)) === JSON.stringify(exportable(normalize(defaultLevel()))))) return true;
  return confirmDialog(t('ed.discardMsg', { name: ED.level.name || t('story.untitled') }), t('ed.discard'), true, t('ed.discardTitle'));
}
// probar: el nivel tal cual, con el panel de trampas (lab.js) para dar cartas, deshacer y mover piezas
function play() {
  const { errors } = issues(ED.level);
  if (errors.length) { toast(t('ed.st.missing', { what: errors.join(' · ') }), 'warn'); return; }
  startLevel(exportable(ED.level), 'test');
}

// cambios en Mis niveles hechos fuera (eliminar / deshacer): el nivel abierto sigue apuntando al suyo
export function edLibraryChanged({ deleted = null, restored = null } = {}) {
  if (!ED.level) return;
  if (deleted != null) { if (ED.idx === deleted) { ED.idx = null; ED.saved = null; } else if (ED.idx != null && ED.idx > deleted) ED.idx--; }
  if (restored != null && ED.idx != null && ED.idx >= restored) ED.idx++;
  persist();
}

function renderLib() {
  const levels = listLevels();
  $('edLibCount').textContent = levels.length ? String(levels.length) : '';
  $('edLibGrid').innerHTML = levels.length ? levels.map((L, j) => `<article class="libCard${j === ED.idx ? ' open' : ''}">` +
    `<button class="libMain" data-edit="${j}" aria-label="${esc(t('lib.editAria', { name: L.name || t('story.untitled') }))}"><span class="libPrev">${levelPreviewSVG(L)}</span>` +
    `<span class="libName">${esc(L.name || t('story.untitled'))}</span><span class="libMeta">${esc(sizeLabel(L))}</span>` +
    `${L.origin === 'received' ? `<span class="libTag">${esc(t('lib.received'))}</span>` : ''}${j === ED.idx ? `<span class="libTag open">${esc(t('lib.opened'))}</span>` : ''}</button>` +
    `<div class="libActs"><button class="btn-light btn-sm" data-edit="${j}">${esc(t('lib.edit'))}</button>` +
    `<button class="btn-light btn-sm btn-icon" data-share="${j}" aria-label="${esc(t('ed.share'))}" title="${esc(t('ed.share'))}"><svg class="i" aria-hidden="true"><use href="#i-share"/></svg></button>` +
    `<button class="btn-light btn-sm btn-icon danger" data-del="${j}" aria-label="${esc(t('lib.delete'))}" title="${esc(t('lib.delete'))}"><svg class="i" aria-hidden="true"><use href="#i-trash"/></svg></button></div></article>`).join('')
    : `<div class="libEmpty"><p>${esc(t('lib.empty'))}</p></div>`;
}
function openLib() { renderLib(); $('edLib').hidden = false; ($('edLibGrid').querySelector('button') || $('edLibNew')).focus(); }
const closeLib = () => { $('edLib').hidden = true; $('edLibBtn').focus(); };

/* ---------- entrada ---------- */
export async function openEditor({ idx = null } = {}) {
  if (app.screen !== 'editor') track('creador', { accion: 'abrir' }); // (analíticas)
  if (idx != null && idx !== ED.idx && ED.level && app.screen !== 'editor' && !await leaveChanges()) return;
  if (idx != null && listLevels()[idx]) { if (idx !== ED.idx || !ED.level) setLevel(listLevels()[idx], idx); }
  else if (!ED.level && !loadDraft()) setLevel(defaultLevel());
  $('edLib').hidden = true;
  showScreen('editor');
  refresh();
}

let drag = null;
function onKey(e) {
  if (app.screen !== 'editor' || document.querySelector('#dialog[open]')) return;
  const typing = e.target.closest('input, textarea');
  const mod = e.ctrlKey || e.metaKey;
  if (!$('edLib').hidden) { if (e.key === 'Escape') { e.preventDefault(); closeLib(); } return; }
  if (e.key === 'Escape' && $('edDeckPanel').classList.contains('open')) { $('edDeckPanel').classList.remove('open'); $('edDeckBtn').setAttribute('aria-expanded', 'false'); return; }
  if (mod && e.key.toLowerCase() === 'z' && !typing) { e.preventDefault(); e.shiftKey ? edRedo() : edUndo(); return; }
  if (mod && e.key.toLowerCase() === 'y' && !typing) { e.preventDefault(); edRedo(); return; }
  if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); save(); return; }
  if (typing || mod || e.altKey) return;
  const k = e.key.toLowerCase();
  if (k === 'r' && TILES[ED.tool]?.rotates) { setRot((curRot() + 1) % 4); renderTools(); if (hover) showGhost(hover.x, hover.y); sfx('woodTick'); return; }
  if (SHORTCUT[k]) { ED.tool = SHORTCUT[k]; renderTools(); if (hover) showGhost(hover.x, hover.y); }
}

export function bindEditor() {
  $('edTools').addEventListener('click', e => {
    const b = e.target.closest('[data-tool]');
    if (!b) return;
    ED.tool = b.dataset.tool; sfx('select'); renderTools();
  });
  $('edToolOpts').addEventListener('click', e => {
    const b = e.target.closest('[data-parn], [data-pair], [data-rot], [data-train], [data-cars]');
    if (!b) return;
    if (b.dataset.train || b.dataset.cars) { // (el tren cambia el nivel: con su deshacer)
      const L = ED.level; pushUndo();
      if (b.dataset.train === 'new' && !newCircuit()) { ED.undo.pop(); return; }
      if (b.dataset.train === 'del') delete L.rails;
      if (b.dataset.cars && L.rails) L.rails.cars = +b.dataset.cars;
      sfx(b.dataset.train === 'del' ? 'card' : 'woodTick'); renderTools(); changed();
      return;
    }
    if (b.dataset.parn) ED.parN = +b.dataset.parn;
    if (b.dataset.pair) ED.pair = +b.dataset.pair;
    if (b.dataset.rot) setRot(+b.dataset.rot);
    sfx('select'); renderTools();
  });
  const board = $('edBoard');
  const cellOf = e => { const c = e.target.closest?.('.cell') || document.elementFromPoint(e.clientX, e.clientY)?.closest('#edBoard .cell'); return c ? { x: +c.dataset.x, y: +c.dataset.y } : null; };
  board.addEventListener('pointerdown', e => {
    const c = cellOf(e);
    if (!c || (e.button !== 0 && e.button !== 2)) return;
    e.preventDefault();
    const mode = modeAt(c.x, c.y, e.button === 2 || ED.tool === 'erase');
    pushUndo();
    drag = { mode, last: c.x + ',' + c.y, changed: false, id: e.pointerId };
    try { board.setPointerCapture(e.pointerId); } catch (err) { /* sin captura */ }
    if (applyAt(c.x, c.y, mode)) {
      drag.changed = true;
      const tl = tileAt(c.x, c.y);
      sfx(mode === 'erase' || mode === 'remove' ? 'card' : mode === 'rotate' ? 'woodTick' : tl ? (TILES[tl.type].placeSound || 'pop') : 'card');
      changed({ tools: ['portal', 'track', 'station', 'loco'].includes(ED.tool), deck: false });
    }
  });
  board.addEventListener('pointermove', e => {
    const c = cellOf(e);
    if (!drag) { if (c && (!hover || hover.x !== c.x || hover.y !== c.y)) showGhost(c.x, c.y); return; }
    if (!c || drag.mode === 'rotate' || c.x + ',' + c.y === drag.last) return;
    drag.last = c.x + ',' + c.y;
    if (applyAt(c.x, c.y, drag.mode)) { drag.changed = true; changed({ tools: ED.tool === 'portal' }); }
  });
  const end = () => { if (!drag) return; if (!drag.changed) ED.undo.pop(); drag = null; paintStatus(); persist(); };
  board.addEventListener('pointerup', end);
  board.addEventListener('pointercancel', end);
  board.addEventListener('pointerleave', () => { if (!drag) showGhost(null); });
  board.addEventListener('contextmenu', e => e.preventDefault());
  $('edStage').addEventListener('click', e => {
    const b = e.target.closest('[data-size]');
    if (!b) return;
    const [k, d] = [b.dataset.size[0], +b.dataset.size.slice(1)];
    resize(k === 'c' ? d : 0, k === 'r' ? d : 0);
  });
  // cartas
  $('edDeckTabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) { ED.tab = b.dataset.tab; sfx('select'); renderDeck(); } });
  $('edDeckBody').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b || b.disabled) return;
    const L = ED.level, d = b.dataset;
    if (d.preset) { pushUndo(); L.deckCounts = presetCounts(d.preset);
      if (!L.rails && (d.preset === 'train' || d.preset === 'ultimate') && newCircuit()) renderTools(); } // (sus cartas necesitan vías)
    else if (d.add) { pushUndo(); L.deckCounts[d.add] = Math.min(30, (L.deckCounts[d.add] || 0) + (e.shiftKey ? -1 : 1)); L.deckCounts[d.add] = Math.max(0, L.deckCounts[d.add]); }
    else if (d.sub) { pushUndo(); L.deckCounts[d.sub] = Math.max(0, (L.deckCounts[d.sub] || 0) - 1); }
    else if (d.hand) { if (L.hand.length >= HAND_MAX) return; pushUndo(); L.hand.push(d.hand); }
    else if (d.unhand) { pushUndo(); L.hand.splice(+d.unhand, 1); }
    else if (d.clearhand) { pushUndo(); L.hand = []; }
    else return;
    sfx('card');
    changed({ deck: true });
  });
  $('edDeckBody').addEventListener('contextmenu', e => { // clic derecho en una carta: una copia menos
    const b = e.target.closest('[data-add]');
    if (!b) return;
    e.preventDefault();
    const k = b.dataset.add;
    if (!ED.level.deckCounts[k]) return;
    pushUndo(); ED.level.deckCounts[k]--; sfx('card'); changed({ deck: true });
  });
  // barra
  $('edName').addEventListener('focus', () => pushUndo());
  $('edName').addEventListener('input', e => { ED.level.name = e.target.value.slice(0, 40); paintStatus(); persist(); });
  $('edName').addEventListener('blur', () => { if (ED.undo.length && ED.undo[ED.undo.length - 1] === snap()) ED.undo.pop(); paintStatus(); });
  $('edName').addEventListener('keydown', e => { if (e.key === 'Enter') e.target.blur(); });
  $('edUndo').addEventListener('click', edUndo);
  $('edRedo').addEventListener('click', edRedo);
  $('edSave').addEventListener('click', () => save());
  $('edShare').addEventListener('click', () => {
    const { errors } = issues(ED.level);
    if (errors.length) { toast(t('ed.st.missing', { what: errors.join(' · ') }), 'warn'); return; }
    if (dirty()) save({ quiet: true }); // se comparte lo que está guardado: así también lo tienes tú
    shareLevelDialog(exportable(ED.level));
  });
  $('edTest').addEventListener('click', () => { track('creador', { accion: 'probar' }); play(); });
  $('edDeckBtn').addEventListener('click', () => { // móvil: las cartas en una hoja
    const open = $('edDeckPanel').classList.toggle('open');
    $('edDeckBtn').setAttribute('aria-expanded', String(open));
  });
  $('edDeckClose').addEventListener('click', () => { $('edDeckPanel').classList.remove('open'); $('edDeckBtn').setAttribute('aria-expanded', 'false'); $('edDeckBtn').focus(); });
  $('edMenu').addEventListener('click', () => openModes('special')); // el creador vive en Juegos especiales
  // Mis niveles
  $('edLibBtn').addEventListener('click', openLib);
  $('edLibClose').addEventListener('click', closeLib);
  $('edLib').addEventListener('click', async e => {
    if (e.target === $('edLib')) { closeLib(); return; }
    const b = e.target.closest('[data-edit], [data-share], [data-del]');
    if (!b) return;
    const d = b.dataset;
    if (d.edit != null) {
      const j = +d.edit;
      if (j !== ED.idx && !await leaveChanges()) return;
      if (j !== ED.idx) setLevel(listLevels()[j], j);
      closeLib(); refresh(); sfx('select');
    } else if (d.share != null) shareLevelDialog(listLevels()[+d.share]);
    else if (d.del != null) deleteWithUndo(+d.del, info => { edLibraryChanged(info); renderLib(); paintStatus(); });
  });
  $('edLibNew').addEventListener('click', async () => {
    if (!await leaveChanges()) return;
    setLevel(defaultLevel());
    closeLib(); refresh(); sfx('select');
  });
  $('edLibCode').addEventListener('click', async () => {
    const j = await addCodeDialog();
    if (j != null) renderLib();
  });
  document.addEventListener('keydown', onKey);
}
