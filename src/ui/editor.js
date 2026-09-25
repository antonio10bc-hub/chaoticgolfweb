// Creador de niveles: se guardan en localStorage y aparecen en "Tus niveles" del modo historia.
import { app } from './app.js';
import { $, esc } from './dom.js';
import { CARDS } from '../content/cards/index.js';
import { cardArtHTML } from './card-art.js';
import { TILES } from '../content/tiles/index.js';
import { ASSETS } from '../art.js';
import { clone } from '../engine/game.js';
import { fitCells } from './geometry.js';
import { loadLevels, saveLevels, loadProgress, saveProgress, exportLevels, normalizeLevels, isValidLevel, LEVELS_VERSION } from '../storage.js';
import { showScreen } from './screens.js';
import { openModes } from './screen-modes.js';
import { startLevel } from './screen-story.js';
import { toast } from './hud.js';
import { confirmDialog, showTextDialog, askTextDialog } from './dialog.js';
import { sfx } from '../audio/sfx.js';
import { t } from '../i18n/index.js';

export const ED = { level: null, tool: 'ball' };
const TOOLS = ['ball', 'hole', 'bunker', 'portal', 'par', 'erase'];

// plantilla de nivel: la disposición estándar (columna de PAR + hoyo) para 1 jugador
function defaultLevel(cols = 7, rows = 9, par = 5) {
  const cx = Math.floor(cols / 2);
  const topPad = Math.max(0, Math.floor((rows - (par + 2)) / 2));
  const parCells = [];
  for (let i = 0; i < par; i++) parCells.push({ x: cx, y: topPad + 1 + i, n: par - i });
  const deckCounts = {};
  for (const k of Object.keys(CARDS)) deckCounts[k] = /^palo[123]$/.test(k) ? 1 : 0; // por defecto: 1 palo de 1, 2 y 3
  return {
    version: LEVELS_VERSION, name: '',
    cols, rows,
    hole: { x: cx, y: topPad },
    ball: { x: cx, y: Math.min(rows - 1, topPad + par + 1) },
    parCells, tiles: [],
    deckCounts,
  };
}

export function openEditor() {
  if (!ED.level) ED.level = defaultLevel();
  syncFields();
  refreshEdSlots();
  buildEdTools();
  showScreen('editor');
}
function syncFields() {
  $('edCols').value = ED.level.cols; $('edRows').value = ED.level.rows;
  $('edName').value = ED.level.name || '';
  buildEdDeckInputs();
}

function buildEdTools() {
  $('edTools').innerHTML = TOOLS.map(id =>
    `<button class="edTool ${ED.tool === id ? 'active' : ''}" data-tool="${id}" aria-pressed="${ED.tool === id}">${t('editor.tools.' + id)}</button>`).join('');
  $('edParRow').style.display = ED.tool === 'par' ? 'flex' : 'none';
}

function buildEdDeckInputs() {
  $('edDeck').innerHTML = Object.entries(CARDS).map(([k, def]) =>
    `<div class="drow ${def.color}">` + `<span class="deckMini ${def.color}" aria-hidden="true">${cardArtHTML(def)}</span>` +
    `<label for="ed_${k}">${esc(def.name)}</label>` +
    `<input type="number" id="ed_${k}" data-card="${k}" min="0" max="30" value="${ED.level.deckCounts[k] ?? 0}"></div>`).join('');
}

export const fitEditorBoard = () => fitCells(ED.level.cols, ED.level.rows, 'edBoardWrap', 360, 0.86);

export function edRender() {
  const L = ED.level;
  const board = $('edBoard');
  board.style.gridTemplateColumns = `repeat(${L.cols}, var(--cell-w))`;
  const tAt = (x, y) => L.tiles.find(tt => tt.x === x && tt.y === y);
  const pAt = (x, y) => L.parCells.find(p => p.x === x && p.y === y);
  let html = '';
  for (let y = 0; y < L.rows; y++) for (let x = 0; x < L.cols; x++) {
    const par = pAt(x, y), tile = tAt(x, y);
    let cls = 'cell' + (((x + y) >> 1) & 1 ? ' mowB' : ''), inner = ''; // mowB: banda de segado (decorativo)
    if (par) { cls += ' par'; inner = ASSETS.parLabelHTML(par.n); }
    if (tile) { cls += ' ' + TILES[tile.type].cellClass; inner += ASSETS.tileHTML(tile.type); }
    if (L.hole.x === x && L.hole.y === y) inner += ASSETS.holeHTML();
    if (L.ball.x === x && L.ball.y === y) inner += ASSETS.ballHTML(0);
    const bg = ASSETS.cellArt(tile, par);
    const style = bg ? ` style="background-image:url(${bg});background-size:cover"` : '';
    html += `<div class="${cls}" data-x="${x}" data-y="${y}"${style}>${inner}</div>`;
  }
  board.innerHTML = html;
  const totalCards = Object.values(L.deckCounts).reduce((a, b) => a + b, 0);
  $('edInfo').innerHTML = t('editor.info', { hx: L.hole.x, hy: L.hole.y, bx: L.ball.x, by: L.ball.y,
    tiles: L.tiles.length, pars: L.parCells.length, cards: totalCards });
}

function edRenderFlash(x, y) { // re-render + flash de feedback en la casilla tocada
  edRender();
  const cell = $('edBoard').children[y * ED.level.cols + x];
  if (cell) cell.classList.add('edFlash');
  sfx('card');
}

function edEraseAt(x, y) { // borrado directo de la casilla (botón derecho), con cualquier herramienta activa
  const L = ED.level;
  L.tiles = L.tiles.filter(tt => !(tt.x === x && tt.y === y));
  L.parCells = L.parCells.filter(p => !(p.x === x && p.y === y));
  edRenderFlash(x, y);
}

function edCellClick(x, y) {
  const L = ED.level;
  const tAt = () => L.tiles.find(tt => tt.x === x && tt.y === y);
  const isBall = L.ball.x === x && L.ball.y === y;
  const isHole = L.hole.x === x && L.hole.y === y;
  switch (ED.tool) {
    case 'ball':
      if (isHole || tAt()) { toast(t('editor.occupied')); return; }
      L.ball = { x, y }; break;
    case 'hole':
      if (isBall || tAt()) { toast(t('editor.occupied')); return; }
      L.hole = { x, y }; break;
    case 'bunker':
    case 'portal': {
      if (isBall || isHole || tAt()) { toast(t('editor.occupiedErase')); return; }
      const max = TILES[ED.tool].maxOnBoard;
      if (max && L.tiles.filter(tt => tt.type === ED.tool).length >= max) { toast(t('editor.maxTiles', { n: max })); return; }
      L.tiles.push({ type: ED.tool, x, y }); break;
    }
    case 'par': {
      if (isBall || isHole || tAt()) { toast(t('editor.occupied')); return; }
      const n = Math.max(1, parseInt($('edParN').value) || 1);
      const existing = L.parCells.find(p => p.x === x && p.y === y);
      if (existing) existing.n = n; else L.parCells.push({ x, y, n });
      break;
    }
    case 'erase':
      edEraseAt(x, y); return;
  }
  edRenderFlash(x, y);
}

function edApplySize() {
  const L = ED.level;
  L.cols = Math.min(25, Math.max(3, parseInt($('edCols').value) || 7));
  L.rows = Math.min(25, Math.max(5, parseInt($('edRows').value) || 9));
  L.tiles = L.tiles.filter(tt => tt.x < L.cols && tt.y < L.rows);
  L.parCells = L.parCells.filter(p => p.x < L.cols && p.y < L.rows);
  L.hole.x = Math.min(L.hole.x, L.cols - 1); L.hole.y = Math.min(L.hole.y, L.rows - 1);
  L.ball.x = Math.min(L.ball.x, L.cols - 1); L.ball.y = Math.min(L.ball.y, L.rows - 1);
  if (L.ball.x === L.hole.x && L.ball.y === L.hole.y) L.ball.y = L.hole.y > 0 ? L.hole.y - 1 : L.hole.y + 1;
  fitEditorBoard(); edRender();
}

function refreshEdSlots(keep) {
  const levels = loadLevels();
  const sel = $('edSlot');
  const cur = keep !== undefined ? keep : parseInt(sel.value || '0');
  sel.innerHTML = levels.map((L, i) => `<option value="${i}">${esc(t('story.level', { n: i + 1 }) + (L.name ? ` · ${L.name}` : ''))}</option>`).join('') +
    `<option value="${levels.length}">${t('editor.newSlot', { n: levels.length + 1 })}</option>`;
  sel.value = Math.min(isNaN(cur) ? 0 : cur, levels.length);
  edUpdateSlotBadge();
}

function edUpdateSlotBadge() { // refresca la insignia de la esquina superior izquierda
  const levels = loadLevels();
  const v = parseInt($('edSlot').value || '0');
  $('edSlotBadge').textContent = v < levels.length ? t('editor.slot', { n: v + 1 }) : t('editor.slotNew', { n: v + 1 });
}

function edValidate() {
  const L = ED.level;
  if (L.ball.x === L.hole.x && L.ball.y === L.hole.y) { toast(t('editor.ballOnHole')); return false; }
  if (Object.values(L.deckCounts).reduce((a, b) => a + b, 0) < 3) { toast(t('editor.deckTooSmall')); return false; }
  return true;
}

export function bindEditor() {
  $('edTools').addEventListener('click', e => {
    const b = e.target.closest('[data-tool]');
    if (b) { ED.tool = b.dataset.tool; buildEdTools(); }
  });
  $('edDeck').addEventListener('input', e => {
    const k = e.target.dataset.card;
    if (k) { ED.level.deckCounts[k] = Math.max(0, parseInt(e.target.value) || 0); edRender(); }
  });
  $('edName').addEventListener('input', e => { ED.level.name = e.target.value.slice(0, 40); });
  const board = $('edBoard');
  board.addEventListener('click', e => { const c = e.target.closest('.cell'); if (c) edCellClick(+c.dataset.x, +c.dataset.y); });
  board.addEventListener('contextmenu', e => { // botón derecho = borrar
    const c = e.target.closest('.cell');
    if (c) { e.preventDefault(); edEraseAt(+c.dataset.x, +c.dataset.y); }
  });
  $('edSlot').addEventListener('change', edUpdateSlotBadge);
  $('edLoad').addEventListener('click', () => {
    const levels = loadLevels();
    const slot = parseInt($('edSlot').value);
    if (!levels[slot]) { toast(t('editor.emptySlot')); return; }
    ED.level = clone(levels[slot]);
    syncFields();
    fitEditorBoard(); edRender();
    toast(t('editor.loaded', { n: slot + 1 }));
  });
  $('edResize').addEventListener('click', edApplySize);
  $('edTest').addEventListener('click', () => { if (edValidate()) startLevel(ED.level, 'test'); });
  $('edSave').addEventListener('click', () => {
    if (!edValidate()) return;
    const levels = loadLevels();
    const slot = Math.min(parseInt($('edSlot').value), levels.length);
    const L = clone(ED.level);
    if (slot >= levels.length) levels.push(L); else levels[slot] = L;
    saveLevels(levels);
    refreshEdSlots(slot);
    toast(t('editor.saved', { n: slot + 1 }));
  });
  $('edDelete').addEventListener('click', async () => {
    const levels = loadLevels();
    const slot = parseInt($('edSlot').value);
    if (!levels[slot]) { toast(t('editor.emptySlot')); return; }
    if (!await confirmDialog(t('editor.confirmDelete', { n: slot + 1 }), t('editor.delete'), true)) return;
    levels.splice(slot, 1);
    saveLevels(levels);
    // el progreso de los niveles siguientes se renumera (los integrados no se tocan)
    const prog = loadProgress(), np = {};
    const si = app.storyLevels.length + slot;
    for (const [k, v] of Object.entries(prog)) {
      const i = parseInt(k);
      if (i < si) np[i] = v; else if (i > si) np[i - 1] = v;
    }
    saveProgress(np);
    refreshEdSlots(0);
    toast(t('editor.deleted', { n: slot + 1 }));
  });
  $('edExport').addEventListener('click', async () => {
    const r = await showTextDialog(t('editor.exportTitle'), exportLevels(), 'chaoticgolf-niveles.json');
    if (r === 'copied') toast(t('editor.copied'));
    if (r === 'copyFailed') toast(t('editor.copyFailed'));
  });
  $('edImport').addEventListener('click', async () => {
    const txt = await askTextDialog(t('editor.importTitle'), t('editor.importHint'));
    if (!txt) return;
    try {
      const levels = normalizeLevels(JSON.parse(txt));
      if (!levels || !levels.every(isValidLevel)) throw new Error('formato');
      saveLevels(levels);
      refreshEdSlots(0);
      toast(t('editor.imported', { n: levels.length }));
    } catch (e) { toast(t('editor.badJson')); }
  });
  $('edMenu').addEventListener('click', () => openModes()); // el creador vive en Modos de juego
}
