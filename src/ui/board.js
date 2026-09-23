// Tablero de juego: cuadrícula persistente (las casillas se crean una vez por tamaño
// y en cada render solo se actualiza lo que cambia) + capa de piezas móviles.
import { app } from './app.js';
import { $, $$ } from './dom.js';
import { ASSETS, pColor } from '../art.js';
import { tileDef } from '../content/tiles/index.js';
import { setPos } from './geometry.js';
import { fxRewindApply } from '../fx/effects.js';
import { previewCell, hidePreview } from './preview.js';
import { fxBurstCell } from '../fx/particles.js';
import { JUICE, SAND_C, CEMENT_C } from '../fx/juice.js';
import { sfx } from '../audio/sfx.js';
import { t } from '../i18n/index.js';

let cells = [], dims = '';
let justPlaced = null; // última loseta colocada, para su animación de aparición
export const markPlaced = (x, y) => { justPlaced = { x, y }; };
let focusIdx = 0;      // casilla con el foco de teclado (tabindex roving)
let armed = null;      // pantallas táctiles: casilla con la vista previa a la espera del segundo toque
let lastPointer = 'mouse'; // tipo del último toque sobre el tablero (táctil: dos toques para confirmar)

function buildGrid(board, cols, rows) {
  board.innerHTML = '';
  board.style.gridTemplateColumns = `repeat(${cols}, var(--cell-w))`;
  const frag = document.createDocumentFragment();
  cells = [];
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const c = document.createElement('div');
    c.dataset.x = x; c.dataset.y = y;
    c.setAttribute('role', 'gridcell');
    c.tabIndex = -1;
    c._cls = c._html = c._bg = c._title = c._aria = null;
    cells.push(c);
    frag.appendChild(c);
  }
  board.appendChild(frag);
  dims = cols + 'x' + rows;
  focusIdx = Math.min(focusIdx, cells.length - 1);
  cells[focusIdx].tabIndex = 0;
}

export function renderBoard() {
  const g = app.game, S = g.S;
  hidePreview(); armed = null; // la vista previa se recalcula con el hover tras cada render
  const board = $('board');
  if (dims !== S.cols + 'x' + S.rows || board.children.length !== cells.length) buildGrid(board, S.cols, S.rows);
  for (let y = 0; y < S.rows; y++) for (let x = 0; x < S.cols; x++) {
    const cell = cells[y * S.cols + x];
    let cls = 'cell' + (((x + y) >> 1) & 1 ? ' mowB' : ''), html = '', title = ''; // mowB: banda de segado (decorativo)
    const aria = [t('a11y.cell', { x, y })];
    const par = g.parAt(x, y), tile = g.tileAt(x, y), ball = g.ballAt(x, y);
    if (par) { cls += ' par'; html = ASSETS.parLabelHTML(par.n); aria.push(`PAR ${par.n}`); }
    if (tile) cls += ' ' + tileDef(tile.type).cellClass;
    if (tile) { // pelotas y hoyo viven en la capa de piezas; aquí solo losetas y avisos
      const pop = justPlaced && justPlaced.x === x && justPlaced.y === y ? ' tilePop' : '';
      html += ASSETS.tileHTML(tile.type, pop);
      if (tileDef(tile.type).trap && (ball || g.isHole(x, y))) html += ASSETS.trapBadgeHTML();
      aria.push(t(`tiles.${tile.type}.name`));
      if (pop) { // nubecilla de polvo al colocar la loseta (decorativo)
        const dustC = tileDef(tile.type).dust === 'sand' ? SAND_C : CEMENT_C;
        fxBurstCell(x, y, { n: JUICE.place.dust, colors: dustC, size: 7, dist: 30, dur: 460, gravity: 10 });
        sfx(tileDef(tile.type).placeSound || 'pop');
      }
    }
    if (g.isHole(x, y)) aria.push(t('a11y.hole'));
    if (ball) aria.push(t('player.name', { n: ball.player + 1 }));
    // marca sutil de las casillas iniciales reales (fijadas al empezar la partida)
    for (const m of g.initMarks) {
      if (m.x === x && m.y === y)
        html += `<span class="spawnMark" style="--pc:${pColor(m.player)}" title="${t('board.spawnMark', { n: m.player + 1 })}"></span>`;
    }
    if (S.hole.initX === x && S.hole.initY === y)
      html += `<span class="spawnMark holeMark" title="${t('board.holeMark')}"></span>`;
    const sel = g.selectableAt(x, y);
    if (sel === 'sel') { cls += ' selectable'; aria.push(t('a11y.selectable')); }
    if (sel === 'out') { cls += ' selectable-out'; title = t('board.outWarning'); aria.push(title); }
    const bg = ASSETS.cellArt(tile, par);
    if (cell._cls !== cls) { cell.className = cls; cell._cls = cls; }
    if (cell._html !== html) { cell.innerHTML = html; cell._html = html; }
    if (cell._bg !== bg) {
      cell.style.backgroundImage = bg ? `url(${bg})` : '';
      cell.style.backgroundSize = bg ? 'cover' : '';
      cell._bg = bg;
    }
    if (cell._title !== title) { cell.title = title; cell._title = title; }
    const a = aria.join(', ');
    if (cell._aria !== a) { cell.setAttribute('aria-label', a); cell._aria = a; }
  }
  justPlaced = null;
}

/* ---- interacción: click, teclado y previsualización de trayectoria ---- */
export function bindBoard(onCell) {
  const board = $('board');
  board.addEventListener('pointerdown', e => { lastPointer = e.pointerType || 'mouse'; });
  board.addEventListener('click', e => {
    const c = e.target.closest('.cell');
    if (!c) return;
    const x = +c.dataset.x, y = +c.dataset.y;
    // sin ratón no hay hover: el primer toque en un destino enseña la jugada, el segundo la confirma
    if (lastPointer === 'touch' && previewable(c) && !(armed && armed.x === x && armed.y === y)) {
      armed = { x, y };
      previewCell(x, y, { armedAt: armed });
      return;
    }
    armed = null;
    onCell(x, y);
  });
  board.addEventListener('keydown', e => {
    const S = app.game?.S;
    if (!S) return;
    const i = cells.indexOf(document.activeElement);
    if (i < 0) return;
    const x = i % S.cols, y = Math.floor(i / S.cols);
    const moves = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (moves[e.key]) {
      e.preventDefault();
      const nx = Math.max(0, Math.min(S.cols - 1, x + moves[e.key][0]));
      const ny = Math.max(0, Math.min(S.rows - 1, y + moves[e.key][1]));
      focusCell(ny * S.cols + nx);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onCell(x, y);
      requestAnimationFrame(() => cells[i]?.focus());
    }
  });
  board.addEventListener('focusin', e => { const i = cells.indexOf(e.target); if (i >= 0) focusIdx = i; showTrajFor(e.target); });
  board.addEventListener('mouseover', e => showTrajFor(e.target.closest('.cell')));
  board.addEventListener('mouseleave', () => { if (!armed) hidePreview(); });
}
function focusCell(i) {
  if (!cells[i]) return;
  cells[focusIdx].tabIndex = -1;
  focusIdx = i;
  cells[i].tabIndex = 0;
  cells[i].focus();
}
// ¿la casilla es un destino de una jugada con recorrido (palo, dedo, palo reactivo)?
function previewable(cell) {
  const pd = app.game?.pending;
  return !!cell && !!pd && (pd.kind === 'move' || pd.kind === 'serpent')
    && (cell.classList.contains('selectable') || cell.classList.contains('selectable-out'));
}
function showTrajFor(cell) {
  if (armed) return; // táctil: se mantiene la vista previa del primer toque
  if (!previewable(cell)) { hidePreview(); return; }
  previewCell(+cell.dataset.x, +cell.dataset.y);
}

/* ---- capa de piezas móviles ---- */
export const pieceEl = id => document.querySelector(`#pieces .piece[data-id="${id}"]`);

function ensurePiece(id, html) {
  let el = pieceEl(id);
  if (!el) {
    el = document.createElement('div');
    el.className = 'piece ' + (id === 'hole' ? 'phole' : 'pball');
    el.dataset.id = id;
    el.innerHTML = html;
    $('pieces').appendChild(el);
  }
  return el;
}
export function clearPieces() { $('pieces').innerHTML = ''; }

export function ensurePieces() {
  const g = app.game, S = g.S, pd = g.pending;
  ensurePiece('hole', ASSETS.holeHTML());
  for (const b of S.balls) {
    const el = ensurePiece('b' + b.player, ASSETS.ballHTML(b.player) + '<div class="turnMark" aria-hidden="true"></div>');
    el.style.setProperty('--pc', pColor(b.player));
    // marcador sobre la pelota de quien juega + halo en la pelota que se está moviendo/eligiendo
    el.classList.toggle('isTurn', S.nPlayers > 1 && !b.decoy && b.player === S.turn && S.winner === null);
    el.classList.toggle('isSel', !!pd?.ball && pd.ball.player === b.player);
  }
}

// coloca todas las piezas exactamente según el estado (sin animar)
export function syncPieces() {
  const g = app.game, S = g.S;
  const h = pieceEl('hole');
  setPos(h, S.hole.x, S.hole.y, 0);
  h.style.opacity = 1; h.firstChild.style.transform = '';
  h.classList.toggle('sunk', g.trapAt(S.hole.x, S.hole.y));
  for (const b of S.balls) {
    const el = pieceEl('b' + b.player);
    if (!el) continue;
    el.style.display = b.holed ? 'none' : 'flex';
    if (!b.holed) {
      setPos(el, b.x, b.y, 0); el.style.opacity = 1; el.firstChild.style.transform = '';
      el.classList.toggle('sunk', g.trapAt(b.x, b.y));
    }
  }
  // limpia clases transitorias de la reproducción para no dejar estados colgados
  $$('#pieces .piece').forEach(el =>
    el.classList.remove('glide', 'falling', 'dropping', 'sinking', 'warp', 'warpOut', 'warpIn', 'air', 'acting'));
  fxRewindApply(); // si venimos de una carta NO, retrocede visualmente desde la posición previa
}
