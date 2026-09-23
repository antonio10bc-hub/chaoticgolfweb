// HUD de la partida: píldora de turno, pilas (mazo / descartes / última jugada),
// botones de turno, historial, avisos y bocadillos de tutorial.
import { playerTag } from '../engine/game.js';
import { app } from './app.js';
import { $, esc } from './dom.js';
import { CARDS } from '../content/cards/index.js';
import { pColor } from '../art.js';
import { cardArtHTML, cardFaceHTML } from './card-art.js';
import { dockOwner, hasPlayable, isBotSeat } from './hands.js';
import { t } from '../i18n/index.js';

const set = (el, html) => { if (el._html !== html) { el.innerHTML = html; el._html = html; } };

export function renderTopbar() {
  const g = app.game, S = g.S;
  // --- de quién es el turno ---
  const p = S.turn, col = pColor(p);
  const mine = app.mode === 'pve' ? p === S.human : !isBotSeat(p);
  const pill = $('turnPill');
  pill.style.setProperty('--pc', col);
  pill.classList.toggle('mine', mine && app.mode === 'pve');
  pill.classList.toggle('bot', isBotSeat(p));
  const title = S.winner !== null && !S.jaque ? t('turn.over')
    : (app.mode === 'pve' && mine) || S.nPlayers === 1 ? t('turn.yours') : t('turn.of', { n: p + 1 });
  const sub = isBotSeat(p) && app.ai.thinkingOf === p ? t('turn.thinking') : t('turn.blacksLeft');
  const left = Math.max(0, 2 - S.blackPlayed);
  const pips = `<span class="pips" aria-label="${esc(t('turn.blacksAria', { n: left }))}">` +
    [0, 1].map(i => `<i class="${i < left ? 'on' : ''}"></i>`).join('') + `</span>`;
  set(pill, `<span class="avatar">${playerTag(p)}</span><span class="tpText"><b>${esc(title)}</b>` +
    `<small>${esc(sub)}${isBotSeat(p) && app.ai.thinkingOf === p ? '<span class="thinkDots"><i></i><i></i><i></i></span>' : ''}</small></span>${pips}`);

  // --- botones de turno ---
  const owner = dockOwner(g);
  const notMine = app.mode === 'pve' && S.turn !== S.human; // en PVE los botones solo en tu turno
  const blocked = S.winner !== null || !!g.pending || g.godMode || notMine;
  const end = $('endTurnBtn'), disc = $('discardBtn');
  end.disabled = blocked;
  disc.disabled = blocked || S.playedThisTurn > 0;
  disc.title = S.playedThisTurn > 0 ? t('notice.cantDiscard') : t('game.discardTitle');
  end.title = t('game.endTurnTitle');
  // nada más que hacer: el botón de terminar turno pide atención
  end.classList.toggle('cta', !blocked && owner === S.turn && !hasPlayable(g, owner));
  renderPiles();
}

function renderPiles() {
  const S = app.game.S;
  $('deckCount').textContent = S.deck.length;
  $('discardCount').textContent = S.discard.length;
  $('deckPile').classList.toggle('empty', !S.deck.length);
  const top = S.discard[S.discard.length - 1];
  const dt = $('discardTop');
  dt.classList.toggle('empty', !top);
  set(dt, top ? `<div class="card mini ${CARDS[top].color}">${cardFaceHTML(CARDS[top])}</div>` : '');
  // última carta jugada (con quién la jugó)
  const lp = $('lastPlay');
  if (S.lastCardKey) {
    const def = CARDS[S.lastCardKey];
    const who = app.lastActor != null ? `<span class="avatar xs" style="--pc:${pColor(app.lastActor)}">${playerTag(app.lastActor)}</span>` : '';
    set(lp, `<small>${t('hud.lastPlay')}</small><div class="lastRow">${who}<span class="hintCard ${def.color}">${cardArtHTML(def)}</span><b>${esc(S.lastCardLabel)}</b></div>`);
  } else set(lp, '');
}

// historial, popover del mazo
export function renderHud() {
  const S = app.game.S;
  set($('logList'), S.log.slice(0, 60).map(s => `<div>${esc(s)}</div>`).join(''));
  const counts = {};
  S.deck.forEach(k => counts[k] = (counts[k] || 0) + 1);
  set($('deckPop'), `<h5>${t('hud.deckLeft')}</h5>` + (Object.keys(CARDS).filter(k => counts[k]).map(k => {
    const def = CARDS[k];
    return `<div class="row ${def.color}"><span class="hintCard ${def.color}">${cardArtHTML(def)}</span><span>${esc(def.short || def.name)}</span><span class="n">×${counts[k]}</span></div>`;
  }).join('') || `<div class="row">${t('hud.deckEmpty')}</div>`));
}

let toastTimer = null;
export function toast(msg, kind = '') {
  const el = $('toast');
  el.textContent = msg;
  el.className = 'visible' + (kind ? ' ' + kind : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('visible'), 2400);
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
  el._t = setTimeout(() => el.classList.remove('visible'), 3000);
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
