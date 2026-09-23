// HUD de la partida: barra superior, historial, última carta, mazo, avisos y bocadillos.
import { app } from './app.js';
import { $, esc } from './dom.js';
import { CARDS } from '../content/cards/index.js';
import { pColor } from '../art.js';
import { t } from '../i18n/index.js';

export function renderTopbar() {
  const g = app.game, S = g.S;
  const mine = app.mode === 'pve' && S.turn === S.human;
  $('turnInfo').innerHTML = `<span class="dot" style="background:${pColor(S.turn)}"></span> ` +
    `${mine ? t('turn.yours') : t('turn.of', { n: S.turn + 1 })} · ${t('turn.blacks', { n: S.blackPlayed })}`;
  $('deckInfo').textContent = t('hud.deck', { deck: S.deck.length, discard: S.discard.length });
  const notMine = app.mode === 'pve' && S.turn !== S.human; // en PVE los botones solo en tu turno
  const blocked = S.winner !== null || !!g.pending || g.godMode || notMine;
  $('endTurnBtn').disabled = blocked;
  $('discardBtn').disabled = blocked || S.playedThisTurn > 0;
}

// historial plegable, última carta jugada y conteo del mazo por tipo
export function renderHud() {
  const S = app.game.S;
  $('logList').innerHTML = S.log.slice(0, 40).map(s => `<div>${esc(s)}</div>`).join('');
  const lc = $('lastCard');
  if (S.lastCardKey) {
    const def = CARDS[S.lastCardKey];
    lc.className = def.color === 'orange' ? 'org' : '';
    lc.innerHTML = `${def.icon}<span>${t('hud.lastCard', { card: esc(S.lastCardLabel) })}</span>`;
  } else lc.innerHTML = '';
  const counts = {};
  S.deck.forEach(k => counts[k] = (counts[k] || 0) + 1);
  $('deckPop').innerHTML = Object.keys(CARDS).filter(k => counts[k]).map(k => {
    const def = CARDS[k];
    return `<div class="row ${def.color === 'orange' ? 'org' : ''}">${def.icon}<span>${def.short || def.name}</span><span class="n">×${counts[k]}</span></div>`;
  }).join('') || `<div class="row">${t('hud.deckEmpty')}</div>`;
}

let toastTimer = null;
export function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('visible'), 2200);
}

// bocadillos de tutorial: los define cada nivel de historia en su JSON ("tips")
export function storyTip(key) {
  if (app.mode !== 'story' || !app.level?.tips) return;
  const textKey = app.level.tips[key];
  if (!textKey || app.tipShown[key]) return;
  app.tipShown[key] = true;
  const el = $('storyTip');
  el.textContent = t(textKey);
  el.classList.add('visible');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('visible'), 2800);
}
export const hideStoryTip = () => $('storyTip').classList.remove('visible');

export function updateMenuBtn() {
  $('menuBtn').textContent = app.mode === 'test' ? t('nav.toEditor') : app.mode === 'story' ? t('nav.toLevels') : t('nav.toMenu');
}

// en los niveles de historia, el botón de fin de turno pide atención cuando no
// quedan cartas en la mano o llevas más de 5 s sin jugar una
export function updateEndTurnHint() {
  const g = app.game, S = g?.S;
  const on = !!(S && app.mode === 'story' && app.level?.builtIn && S.winner === null && !g.pending
    && S.hands[0] && (S.hands[0].length === 0 || Date.now() - app.lastPlayAt > 5000));
  $('endTurnBtn').classList.toggle('ctaEndTurn', on);
}
