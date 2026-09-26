// Trampas al probar un nivel del creador (modo 'test'): el nivel se juega con cualquier carta a mano.
//   · Mover piezas: toca una pelota, el hoyo o una pieza y luego su nuevo sitio (el modo libre del motor).
//     Con la rueda del ratón (clic central) se hace lo mismo en cualquier momento, sin activar nada.
//   · Tocar una carta del panel la añade a tu mano; deshacer vale para cualquier jugada (también de
//     turnos anteriores) y "Vaciar mano" deja la mano a cero.
import { app } from './app.js';
import { $, esc } from './dom.js';
import { CARDS, CARD_KEYS } from '../content/cards/index.js';
import { cardArtHTML } from './card-art.js';
import { t } from '../i18n/index.js';
import { labAction } from './controller.js';
import { sfx } from '../audio/sfx.js';
import { toast } from './hud.js';

export const isLab = () => app.mode === 'test';
const HAND_MAX = 8;
const ORDER = () => [...CARD_KEYS.filter(k => CARDS[k].color !== 'orange'), ...CARD_KEYS.filter(k => CARDS[k].color === 'orange')];

let built = '';
function build(el) {
  el.innerHTML = `<button class="labToggle btn-light btn-icon" data-lab="toggle" aria-expanded="false"><svg class="i" aria-hidden="true"><use href="#i-flask"/></svg><span>${esc(t('lab.title'))}</span></button>` +
    `<div class="labBody"><div class="labHead"><svg class="i" aria-hidden="true"><use href="#i-flask"/></svg><b>${esc(t('lab.title'))}</b></div>` +
    `<button class="btn-light btn-sm btn-icon labGodBtn" data-lab="god" aria-pressed="false"><svg class="i" aria-hidden="true"><use href="#i-hand"/></svg>${esc(t('lab.god'))}</button>` +
    `<p class="labGod" aria-live="polite"></p>` +
    `<p class="labHint">${esc(t('lab.hint'))}</p><div class="labCards">` +
    ORDER().map(k => `<button class="labCard ${CARDS[k].color}" data-give="${k}" title="${esc(CARDS[k].name)}"><span class="ecArt">${cardArtHTML(CARDS[k])}</span><span class="ecName">${esc(CARDS[k].short || CARDS[k].name)}</span></button>`).join('') +
    `</div><div class="labActs">` +
    `<button class="btn-light btn-sm btn-icon" data-lab="undo"><svg class="i" aria-hidden="true"><use href="#i-undo"/></svg>${esc(t('lab.undo'))}</button>` +
    `<button class="btn-light btn-sm btn-icon" data-lab="clear"><svg class="i" aria-hidden="true"><use href="#i-trash"/></svg>${esc(t('lab.clear'))}</button>` +
    `</div></div>`;
  built = document.documentElement.lang || 'x';
}

// ¿se puede soltar lo elegido en (x,y)? (casilla vacía; la pelota también sobre un búnker o el hoyo)
function canDrop(g, x, y) {
  const gp = g.godPick;
  if (!gp || !g.inBoard(x, y) || g.ballAt(x, y)) return false;
  const tl = g.tileAt(x, y), hole = g.isHole(x, y);
  if (gp.what === 'ball') return !hole && (!tl || tl.type === 'bunker');
  if (gp.what === 'hole') return !tl || tl.type === 'bunker';
  return !tl && !hole;
}

// se repinta tras cada render de la partida
export function paintLab() {
  const el = $('labPanel');
  if (!el) return;
  const on = isLab();
  el.hidden = !on;
  $('table')?.classList.toggle('lab', on);
  if (!on) { el.classList.remove('open'); return; }
  if (built !== (document.documentElement.lang || 'x') || !el.firstChild) build(el);
  const g = app.game, S = g.S;
  const busy = app.animating || S.winner !== null && !S.jaque;
  const full = S.hands[0].length >= HAND_MAX;
  el.querySelectorAll('[data-give]').forEach(b => { b.disabled = busy || full || !!g.pending || g.godMode; });
  el.querySelector('[data-lab="undo"]').disabled = busy || !g.history.length;
  el.querySelector('[data-lab="clear"]').disabled = busy || !S.hands[0].length || !!g.pending;
  const god = el.querySelector('[data-lab="god"]');
  god.disabled = busy || !!g.pending;
  god.setAttribute('aria-pressed', String(!!g.godMode));
  god.classList.toggle('on', !!g.godMode);
  const what = g.godPick && (g.godPick.what === 'tile' ? t(`tiles.${g.godPick.ref.type}.name`) : g.godPick.kind);
  const What = what ? what[0].toUpperCase() + what.slice(1) : '';
  el.querySelector('.labGod').classList.toggle('act', !!(g.godPick || g.godMode));
  el.querySelector('.labGod').textContent = g.godPick ? t('lab.godPlace', { what: What }) : g.godMode ? t('lab.godPick') : full ? t('lab.full', { n: HAND_MAX }) : t('lab.wheel');
  // lo elegido, marcado en el tablero, y las casillas donde se puede soltar
  document.querySelectorAll('#board .cell.godPicked, #board .cell.godTarget').forEach(c => c.classList.remove('godPicked', 'godTarget'));
  const gp = g.godPick, at = gp && (gp.what === 'hole' ? S.hole : gp.ref);
  if (!at) return;
  document.querySelector(`#board .cell[data-x="${at.x}"][data-y="${at.y}"]`)?.classList.add('godPicked');
  for (let y = 0; y < S.rows; y++) for (let x = 0; x < S.cols; x++) {
    if (canDrop(g, x, y)) document.querySelector(`#board .cell[data-x="${x}"][data-y="${y}"]`)?.classList.add('godTarget');
  }
}

// elegir / soltar una pieza (botón central del ratón o "Mover piezas" activo)
function godAt(x, y) {
  const g = app.game;
  if (!g || app.animating || g.pending) return;
  if (g.godPick) {
    const at = g.godPick.what === 'hole' ? g.S.hole : g.godPick.ref;
    if (at.x === x && at.y === y) { g.godPick = null; sfx('select'); labAction(() => true); return; } // (la misma: se suelta)
    if (!canDrop(g, x, y)) { sfx('bad'); toast(t('lab.cantDrop'), 'warn'); return; }
    labAction(gg => gg.godClick(x, y));
    sfx('woodTick');
    return;
  }
  if (labAction(gg => gg.godClick(x, y))) sfx('select');
}

export function bindLab() {
  $('labPanel').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b || b.disabled || !isLab()) return;
    if (b.dataset.give) {
      labAction(g => { g.giveCard(0, b.dataset.give); return true; });
      sfx('card');
      return;
    }
    switch (b.dataset.lab) {
      case 'toggle': { const open = $('labPanel').classList.toggle('open'); b.setAttribute('aria-expanded', String(open)); sfx('select'); break; }
      case 'undo': labAction(g => g.undo()); break;
      case 'god': labAction(g => { g.toggleGod(); return true; }); sfx('select'); if (app.game.godMode) toast(t('lab.godOn')); break;
      case 'clear': labAction(g => { g.pushHistory(); g.S.hands[0] = []; return true; }); sfx('card'); break;
    }
  });
  // la rueda del ratón (botón central) elige una pieza y la suelta en otra casilla
  const board = $('board');
  board.addEventListener('mousedown', e => { if (e.button === 1 && isLab()) e.preventDefault(); }); // (sin el desplazamiento automático)
  board.addEventListener('auxclick', e => {
    if (e.button !== 1 || !isLab()) return;
    const c = e.target.closest('.cell');
    if (!c) return;
    e.preventDefault();
    godAt(+c.dataset.x, +c.dataset.y);
  });
}
// con "Mover piezas" activo, el clic normal hace lo mismo (lo usa el controlador)
export const labGodClick = godAt;
