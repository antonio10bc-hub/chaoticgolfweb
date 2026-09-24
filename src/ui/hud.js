// HUD de la partida: píldora de turno, pilas (mazo / descartes / última jugada),
// botones de turno, historial, avisos y bocadillos de tutorial.
import { app } from './app.js';
import { $, esc } from './dom.js';
import { CARDS } from '../content/cards/index.js';
import { pColor } from '../art.js';
import { cardArtHTML, cardFaceHTML } from './card-art.js';
import { dockOwner, hasPlayable, isBotSeat } from './hands.js';
import { t } from '../i18n/index.js';
import { viewer, multiHuman, displayName, avatarHTML, handRevealed } from './players.js';
import { prefs } from './prefs.js';

const set = (el, html) => { if (el._html !== html) { el.innerHTML = html; el._html = html; } };

export function renderTopbar() {
  const g = app.game, S = g.S;
  // --- de quién es el turno ---
  const p = S.turn, col = pColor(p);
  const mine = app.mode === 'pve' ? p === viewer() : !isBotSeat(p);
  const pill = $('turnPill');
  pill.style.setProperty('--pc', col);
  pill.classList.toggle('mine', mine && app.mode === 'pve');
  pill.classList.toggle('bot', isBotSeat(p));
  const title = S.winner !== null && !S.jaque ? t('turn.over')
    : (app.mode === 'pve' && mine && !multiHuman()) || S.nPlayers === 1 ? t('turn.yours') : t('turn.ofName', { name: displayName(p) });
  const sub = isBotSeat(p) && app.ai.thinkingOf === p ? t('turn.thinking') : t('turn.blacksLeft');
  const left = Math.max(0, 2 - S.blackPlayed);
  const pips = `<span class="pips" aria-label="${esc(t('turn.blacksAria', { n: left }))}">` +
    [0, 1].map(i => `<i class="${i < left ? 'on' : ''}"></i>`).join('') + `</span>`;
  set(pill, `${avatarHTML(p)}<span class="tpText"><b>${esc(title)}</b>` +
    `<small>${esc(sub)}${isBotSeat(p) && app.ai.thinkingOf === p ? '<span class="thinkDots"><i></i><i></i><i></i></span>' : ''}</small></span>${pips}`);

  // --- botones de turno ---
  const owner = dockOwner(g);
  const notMine = app.mode === 'pve' && (S.turn !== viewer() || !handRevealed(S.turn)); // en PVE los botones solo en tu turno
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
    const who = app.lastActor != null ? avatarHTML(app.lastActor, 'xs') : '';
    set(lp, `<small>${t('hud.lastPlay')}</small><div class="lastRow">${who}<span class="hintCard ${def.color}">${cardArtHTML(def)}</span><b>${esc(S.lastCardLabel)}</b></div>`);
  } else set(lp, '');
}

// historial, popover del mazo
export function renderHud() {
  const S = app.game.S;
  set($('logList'), logHTML(S));
  const counts = {};
  S.deck.forEach(k => counts[k] = (counts[k] || 0) + 1);
  set($('deckPop'), `<h5>${t('hud.deckLeft')}</h5>` + (Object.keys(CARDS).filter(k => counts[k]).map(k => {
    const def = CARDS[k];
    return `<div class="row ${def.color}"><span class="hintCard ${def.color}">${cardArtHTML(def)}</span><span>${esc(def.short || def.name)}</span><span class="n">×${counts[k]}</span></div>`;
  }).join('') || `<div class="row">${t('hud.deckEmpty')}</div>`));
}

/* ---------- historial legible: agrupado por turnos, con icono y color de cada jugador ---------- */
const LOG_ICON = {
  plays: 'i-hand', collision: 'i-burst', collisionDedo: 'i-burst', ballPortal: 'i-spiral', holePortal: 'i-spiral', holeInitPortal: 'i-spiral',
  ballFell: 'i-out', holeFell: 'i-out', ballHoled: 'i-flag', holeSwallows: 'i-flag', jaque: 'i-flag', tieInPlay: 'i-flag',
  ballTrapped: 'i-sand', ballStaysTrap: 'i-sand', transferTrap: 'i-sand', cantLeaveTrap: 'i-sand', holeTrapped: 'i-sand',
  ballLeavesTrap: 'i-sand', holeLeavesTrap: 'i-sand', ballMoved: 'i-arrow-r', holeMoved: 'i-hole', holeEmerges: 'i-hole',
  ballLeavesHole: 'i-arrow-r', ballExtracted: 'i-arrow-r', endTurn: 'i-check', discards: 'i-reset', cancelEffects: 'i-rewind',
  jaqueCancelled: 'i-x', chainStops: 'i-chain-break', tilePlaced: 'i-grid',
};
export let logMine = false;
export const setLogMine = v => { logMine = v; };
function logHTML(S) {
  const meta = S.logK && S.logK.length === S.log.length ? S.logK : null;
  const n = Math.min(S.log.length, 90);
  if (!meta) return S.log.slice(0, 60).map(x => `<div class="lg">${esc(x)}</div>`).join(''); // partidas antiguas: texto plano
  const me = dockOwner(app.game);
  const line = i => {
    const [k, ...pl] = meta[i];
    const who = pl[0];
    const col = who != null && who < S.nPlayers ? pColor(who) : '';
    return `<div class="lg${who != null ? ' who' : ''}"${col ? ` style="--pc:${col}"` : ''}>` +
      `<svg class="i" aria-hidden="true"><use href="#${LOG_ICON[k] || 'i-list'}"/></svg><span>${esc(S.log[i])}</span></div>`;
  };
  // de lo más nuevo a lo más viejo: cada "Turno de …" cierra el grupo de su turno
  const groups = []; let cur = [];
  for (let i = 0; i < n; i++) {
    if (meta[i][0] === 'turnOf') { groups.push({ head: i, items: cur }); cur = []; }
    else cur.push(i);
  }
  if (cur.length) groups.push({ head: null, items: cur });
  return groups.map(({ head, items }) => {
    const shown = logMine ? items.filter(i => meta[i].slice(1).includes(me)) : items;
    if (logMine && !shown.length) return '';
    const p = head != null ? meta[head][1] : null;
    const h = head != null ? `<div class="lgHead" style="--pc:${pColor(p)}">${avatarHTML(p, 'xs')}<b>${esc(S.log[head])}</b></div>` : '';
    return `<div class="lgGroup">${h}${shown.map(line).join('')}</div>`;
  }).join('') || `<div class="lg muted">${esc(t('hud.logNone'))}</div>`;
}
export function bindLogFilter() {
  $('logMine').addEventListener('click', () => {
    logMine = !logMine;
    $('logMine').setAttribute('aria-pressed', logMine);
    if (app.game) renderHud();
  });
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
  updateIdleNudge();
}

// aviso tras un rato sin jugar (ajuste "Avisos de jugada"): en tu turno y sin nada en curso,
// las cartas que puedes jugar se mueven y la barra dice cuáles son; si no hay, pide terminar
export const IDLE_NUDGE_MS = 9000;
let nudging = false;
function updateIdleNudge() {
  const g = app.game, S = g?.S;
  const owner = g ? dockOwner(g) : -1;
  const on = !!(S && prefs.hints && app.screen === 'game' && app.mode !== 'free' && !app.paused && !app.animating && !g.pending && !S.jaque
    && S.winner === null && owner === S.turn && !isBotSeat(owner) && handRevealed(owner)
    && !document.querySelector('#coach.visible, #passScreen.visible, dialog[open]')
    && Date.now() - Math.max(app.lastPlayAt, app.lastInputAt || 0) > IDLE_NUDGE_MS);
  if (!on) {
    if (nudging) { // se acabó el aviso: limpiar
      document.querySelectorAll('#hands .card.nudge').forEach(el => el.classList.remove('nudge'));
      $('actionBar').querySelector('.hint.nudgeHint')?.remove(); $('actionBar')._html = null;
    }
    nudging = false; return;
  }
  nudging = true;
  const playable = S.hands[owner].map((k, i) => g.canPlay(owner, k) ? i : -1).filter(i => i >= 0);
  if (!playable.length) { $('endTurnBtn').classList.add('ctaEndTurn'); return; }
  // idempotente: el render puede haber rehecho la mano o la barra
  playable.forEach(i => document.querySelector(`#hands .card[data-p="${owner}"][data-idx="${i}"]`)?.classList.add('nudge'));
  const bar = $('actionBar');
  if (bar.querySelector('.nudgeHint')) return;
  const names = [...new Set(playable.map(i => CARDS[S.hands[owner][i]].short || CARDS[S.hands[owner][i]].name))];
  bar.innerHTML = `<div class="hint idle nudgeHint">${esc(t('hint.idle', { cards: names.join(', ') }))}</div>`;
  bar._html = null; // el próximo render la sustituye
}
