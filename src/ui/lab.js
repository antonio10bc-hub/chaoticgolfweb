// Laboratorio del creador de niveles: el nivel se juega con cualquier carta a mano. Tocar una carta
// del panel la añade a tu mano; se puede deshacer cualquier jugada (también de turnos anteriores) y
// mover piezas a mano (el modo libre del motor: toca una pieza y luego su nuevo sitio).
// Es el modo 'test' con variante 'lab': termina, se reinicia y vuelve al editor igual que Probar.
import { app } from './app.js';
import { $, esc } from './dom.js';
import { CARDS, CARD_KEYS } from '../content/cards/index.js';
import { cardArtHTML } from './card-art.js';
import { t } from '../i18n/index.js';
import { labAction } from './controller.js';
import { sfx } from '../audio/sfx.js';
import { toast } from './hud.js';

export const isLab = () => app.mode === 'test' && app.variant === 'lab';
const HAND_MAX = 8;
const ORDER = () => [...CARD_KEYS.filter(k => CARDS[k].color !== 'orange'), ...CARD_KEYS.filter(k => CARDS[k].color === 'orange')];

let built = '';
function build(el) {
  el.innerHTML = `<button class="labToggle btn-light btn-icon" data-lab="toggle" aria-expanded="false"><svg class="i" aria-hidden="true"><use href="#i-flask"/></svg><span>${esc(t('lab.title'))}</span></button>` +
    `<div class="labBody"><div class="labHead"><svg class="i" aria-hidden="true"><use href="#i-flask"/></svg><b>${esc(t('lab.title'))}</b></div>` +
    `<p class="labHint">${esc(t('lab.hint'))}</p><div class="labCards">` +
    ORDER().map(k => `<button class="labCard ${CARDS[k].color}" data-give="${k}" title="${esc(CARDS[k].name)}"><span class="ecArt">${cardArtHTML(CARDS[k])}</span><span class="ecName">${esc(CARDS[k].short || CARDS[k].name)}</span></button>`).join('') +
    `</div><div class="labActs">` +
    `<button class="btn-light btn-sm btn-icon" data-lab="undo"><svg class="i" aria-hidden="true"><use href="#i-undo"/></svg>${esc(t('lab.undo'))}</button>` +
    `<button class="btn-light btn-sm btn-icon" data-lab="clear"><svg class="i" aria-hidden="true"><use href="#i-trash"/></svg>${esc(t('lab.clear'))}</button>` +
    `<button class="btn-light btn-sm btn-icon" data-lab="god" aria-pressed="false"><svg class="i" aria-hidden="true"><use href="#i-hand"/></svg>${esc(t('lab.god'))}</button>` +
    `</div><p class="labGod" aria-live="polite"></p></div>`;
  built = document.documentElement.lang || 'x';
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
  el.querySelector('.labGod').textContent = g.godMode ? t(g.godPick ? 'lab.godPlace' : 'lab.godPick', { what: g.godPick?.kind || '' }) : full ? t('lab.full', { n: HAND_MAX }) : '';
  // la pieza elegida en el modo libre, marcada en el tablero
  document.querySelectorAll('#board .cell.godPicked').forEach(c => c.classList.remove('godPicked'));
  const gp = g.godPick, at = gp && (gp.what === 'hole' ? S.hole : gp.ref);
  if (at) document.querySelector(`#board .cell[data-x="${at.x}"][data-y="${at.y}"]`)?.classList.add('godPicked');
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
}
