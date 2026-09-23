// Cartas de los jugadores:
//   · dock   — la mano de quien juega en este dispositivo (en PVE tú; en modo libre, el jugador en turno)
//   · asientos — el resto de jugadores, compactos a un lado del tablero (avatar, estado y cartas en miniatura)
//   · barra de acción — qué hay que hacer ahora (sustituye a los popups)
import { playerTag } from '../engine/game.js';
import { app } from './app.js';
import { $, esc } from './dom.js';
import { pColor } from '../art.js';
import { CARDS } from '../content/cards/index.js';
import { cardFaceHTML, cardArtHTML } from './card-art.js';
import { fxDealFrom } from '../fx/effects.js';
import { t } from '../i18n/index.js';
import * as ctl from './controller.js';
import { refreshCardTip } from './card-tip.js';
import { isBot, viewer, multiHuman, handRevealed, displayName, avatarHTML } from './players.js';
import { startReaction, endReaction } from './hotseat.js';
import { previewCard, hidePreview } from './preview.js';

let prevHands = []; // tamaños de mano en el último render (para el robo animado)
let prevOwner = -1;
export const resetDealAnim = () => { prevHands = []; prevOwner = -1; };

const BAR_KINDS = ['move', 'placeTile', 'pickBall', 'serpent', 'dedoAmount', 'pickHoled', 'discard'];
const SEL_KINDS = ['move', 'placeTile', 'pickBall', 'serpent'];

// ¿de quién es la mano grande del dock?
export function dockOwner(g = app.game) {
  const S = g.S;
  if (app.mode === 'pve') return viewer(); // tú (o, en multijugador local, quien tiene el dispositivo)
  if (S.nPlayers === 1) return 0;
  return S.turn; // modo libre (varios jugadores en el mismo dispositivo): el jugador en turno
}
// dueño de la acción pendiente (el dedo en curso no guarda p: es el de la pelota)
export const pendingOwner = pd => !pd ? -1 : (pd.p !== undefined ? pd.p : (pd.kind === 'serpent' ? pd.ball.player : -1));

export const isBotSeat = p => isBot(p);
// manos tapadas: las de los bots (salvo debug) y, en multijugador local, las de las
// personas que no tienen ahora el dispositivo
const hiddenFor = p => isBotSeat(p) ? !app.pveShowHands : (app.mode === 'pve' && multiHuman() && !handRevealed(p));

// naranjas que p puede jugar ahora mismo durante un JAQUE (para pedirle acción)
function jaqueCta(g, p) {
  const S = g.S;
  return S.jaque && S.winner !== null && !S.winners.includes(p) && !isBotSeat(p) && !hiddenFor(p) // (manos tapadas: no se delata)
    && S.hands[p].some(k => CARDS[k].color === 'orange' && g.canPlay(p, k));
}

function cardHTML(g, p, idx, { mini = false } = {}) {
  const S = g.S, pd = g.pending, k = S.hands[p][idx], def = CARDS[k];
  const dealing = idx >= (prevHands[p] || 0);
  const base = 'card' + (mini ? ' mini' : '') + (dealing ? ' dealing' : '');
  if (hiddenFor(p)) { // dorso: se ve cuántas cartas tienen, no cuáles
    return `<div class="${base} back" data-p="${p}" data-idx="${idx}" title="${esc(t('hands.hidden'))}"></div>`;
  }
  const discarding = pd?.kind === 'discard' && pd.p === p;
  const selected = pd && pd.p === p && pd.idx === idx && SEL_KINDS.includes(pd.kind);
  const playable = discarding || selected || g.canPlay(p, k);
  let c = `${base} ${def.color}` + (playable ? '' : pd ? ' dimmed' : ' unplayable');
  if (jaqueCta(g, p) && def.color === 'orange' && g.canPlay(p, k)) c += ' ctaJaque';
  if (discarding && pd.selected.includes(idx)) c += ' discardSel';
  if (selected) c += ' cardSel';
  const label = def.name + (playable ? '' : ` (${t('a11y.unplayable')})`);
  return `<div class="${c}" role="button" tabindex="0" data-p="${p}" data-idx="${idx}" data-key="${k}" aria-label="${esc(label)}">${cardFaceHTML(def)}</div>`;
}

/* ---------- barra de acción (qué hay que hacer ahora) ---------- */
function hintFor(g, p) {
  const pd = g.pending, S = g.S;
  switch (pd.kind) {
    case 'move': return t('hands.hint.move', { card: CARDS[S.hands[p][pd.idx]].name });
    case 'placeTile': return t('hands.hint.placeTile', { card: CARDS[pd.tileType].name });
    case 'pickBall': return t('hands.hint.pickBall', { card: CARDS.oPalo1.name,
      extra: S.jaque && S.balls.some(b => b.holed) ? t('hands.hint.pickBallJaque') : '' });
    case 'serpent': return t('hands.hint.serpent', { card: CARDS.dedo.name, n: pd.stepsLeft });
    case 'dedoAmount': return t('hands.hint.dedoAmount', { card: CARDS.dedo.name });
    case 'pickHoled': return t('hands.hint.pickHoled', { card: CARDS.oPalo1.name });
    case 'discard': return t('hands.hint.discard');
  }
  return '';
}
function barButtons(g) {
  const pd = g.pending, S = g.S;
  let html = '';
  if (pd.kind === 'dedoAmount') {
    const trapped = g.inTrap(pd.ball);
    for (const n of [1, 2, 3]) {
      const dis = trapped && n === 1;
      html += `<button class="btn-light btn-sm stepBtn" data-act="amount" data-n="${n}"${dis ? ` disabled title="${esc(t('hands.cantLeaveTrap'))}"` : ''}>${n}</button>`;
    }
  } else if (pd.kind === 'pickHoled') {
    for (const hb of S.balls.filter(b => b.holed)) html += `<button class="btn-light btn-sm" data-act="pickHoled" data-n="${hb.player}">${playerTag(hb.player)}</button>`;
  } else if (pd.kind === 'discard') {
    const n = pd.selected.length;
    html += `<button class="btn-secondary btn-sm" data-act="confirmDiscard"${n ? '' : ' disabled'}>${n ? t('hands.discardN', { n }) : t('hands.confirm')}</button>`;
  }
  if (pd.kind !== 'serpent') html += `<button class="btn-ghost btn-sm" data-act="cancel">${t('common.cancel')}</button>`; // el dedo ya gastado no se puede cancelar
  return html;
}
// carta que está en juego en la acción pendiente (para mostrarla en la barra)
function pendingCard(g) {
  const pd = g.pending, S = g.S;
  if (pd.kind === 'serpent' || pd.kind === 'dedoAmount') return CARDS.dedo;
  if (pd.kind === 'placeTile') return CARDS[pd.tileType];
  if (pd.kind === 'pickBall' || pd.kind === 'pickHoled' || (pd.kind === 'move' && pd.extract)) return CARDS.oPalo1;
  if (pd.kind === 'move') return CARDS[S.hands[pd.p][pd.idx]];
  return null;
}

// ¿le queda alguna carta jugable al dueño del dock?
export const hasPlayable = (g, p) => g.S.hands[p].some(k => g.canPlay(p, k));

function renderActionBar(g, owner) {
  const S = g.S, pd = g.pending, bar = $('actionBar');
  const pendP = pendingOwner(pd);
  let html = '', kind = '';
  if (pd && BAR_KINDS.includes(pd.kind) && pendP >= 0) {
    const interactive = app.mode !== 'pve' || pendP === viewer(); // en PVE solo se interactúa con tus acciones
    const card = pendingCard(g);
    const who = pendP !== owner ? `<span class="hintWho" style="--pc:${pColor(pendP)}">${playerTag(pendP)}</span>` : '';
    kind = pd.kind === 'discard' ? 'discard' : 'act';
    html = `<div class="hint ${kind}${interactive ? '' : ' passive'}">` +
      (card ? `<span class="hintCard ${card.color}">${cardArtHTML(card)}</span>` : '') +
      `${who}<span class="hintText">${esc(hintFor(g, pendP))}</span>` +
      (interactive ? `<span class="hintBtns">${barButtons(g)}</span>` : '') + `</div>`;
  } else if (!pd && app.reacting != null && app.reacting === owner && handRevealed(owner)) {
    // multijugador local: alguien fuera de turno tiene el dispositivo para reaccionar
    kind = 'act';
    html = `<div class="hint act"><span class="hintText">${esc(t('hotseat.reactHint'))}</span>` +
      `<span class="hintBtns"><button class="btn-light btn-sm" data-act="endReact">${esc(t('hotseat.giveBack'))}</button></span></div>`;
  } else if (!pd && !S.jaque && S.winner === null && owner === S.turn && !isBotSeat(owner) && handRevealed(owner)) {
    // consejo suave cuando es tu turno y no hay nada en curso
    const left = 2 - S.blackPlayed;
    const txt = !hasPlayable(g, owner) ? t('hint.noMoves')
      : S.blackPlayed === 0 ? t(S.nPlayers === 1 ? 'hint.startSolo' : 'hint.start') : t('hint.more', { n: left });
    kind = 'idle';
    html = `<div class="hint idle">${esc(txt)}</div>`;
  }
  if (bar._html !== html) { bar.innerHTML = html; bar._html = html; bar.dataset.kind = kind; }
}

/* ---------- dock ---------- */
function renderDock(g, owner) {
  const S = g.S, dock = $('dock');
  const col = pColor(owner);
  const myTurn = owner === S.turn && S.winner === null;
  dock.style.setProperty('--pc', col);
  dock.classList.toggle('myTurn', myTurn);
  dock.classList.toggle('waiting', !myTurn);
  dock.classList.toggle('cta', jaqueCta(g, owner));
  const name = app.mode === 'pve' && multiHuman() ? displayName(owner)
    : app.mode === 'pve' || S.nPlayers === 1 ? t('hands.yours') : t('player.name', { n: owner + 1 });
  const status = S.winners.includes(owner) ? t('seat.inHole')
    : jaqueCta(g, owner) ? t('seat.canReact')
    : myTurn ? t('seat.yourTurn') : t('seat.waitName', { name: displayName(S.turn) });
  $('dockOwner').innerHTML = avatarHTML(owner) +
    `<span class="ownerTxt"><b>${esc(name)}</b><small>${esc(status)}</small></span>`;
  const hand = $('hands');
  hand.innerHTML = S.hands[owner].map((_, i) => cardHTML(g, owner, i)).join('') ||
    `<div class="emptyHand">${esc(t('hands.empty'))}</div>`;
  if (prevOwner !== owner && prevOwner !== -1) { hand.classList.remove('swap'); void hand.offsetWidth; hand.classList.add('swap'); }
}

/* ---------- asientos ---------- */
function renderSeats(g, owner) {
  const S = g.S, seats = $('seats');
  const list = [];
  for (let p = 0; p < S.nPlayers; p++) if (p !== owner) list.push(p);
  $('table').classList.toggle('noSeats', !list.length);
  seats.innerHTML = list.map(p => {
    const col = pColor(p), active = p === S.turn && S.winner === null;
    const thinking = app.ai.thinkingOf === p;
    const won = S.winners.includes(p);
    const cta = jaqueCta(g, p);
    const cls = 'seat' + (active ? ' active' : '') + (thinking ? ' thinking' : '') + (won ? ' won' : '') + (cta ? ' cta' : '') + (isBotSeat(p) ? ' bot' : '');
    const status = won ? t('seat.inHole') : cta ? t('seat.canReact')
      : active ? (isBotSeat(p) ? t('seat.thinking') : t('seat.playing')) : t('seat.waiting');
    const dots = thinking ? '<span class="thinkDots"><i></i><i></i><i></i></span>' : '';
    const cards = S.hands[p].map((_, i) => cardHTML(g, p, i, { mini: true })).join('');
    // multijugador local: otra persona puede pedir el dispositivo para reaccionar con una naranja
    const canAsk = multiHuman() && !isBotSeat(p) && app.reacting == null && app.passFor == null && S.hands[p].length
      && !(S.winner !== null && !S.jaque) && !S.winners.includes(p);
    const react = canAsk ? `<button class="btn-light btn-sm seatReact" data-act="react" data-n="${p}">${esc(t('hotseat.react'))}</button>` : '';
    const tag = isBotSeat(p) ? ` <span class="botTag">${esc(t('seat.bot'))} · ${playerTag(p)}</span>` : '';
    return `<div class="${cls}" data-player="${p}" style="--pc:${col}">` +
      avatarHTML(p) +
      `<div class="seatBody"><div class="seatName">${esc(displayName(p))}${tag}</div>` +
      `<div class="seatStatus">${esc(status)}${dots}</div>` +
      `<div class="seatCards">${cards || `<span class="noCards">${esc(t('seat.noCards'))}</span>`}</div>${react}</div></div>`;
  }).join('');
}

export function renderHands() {
  const g = app.game, S = g.S;
  const owner = dockOwner(g);
  renderActionBar(g, owner);
  renderDock(g, owner);
  renderSeats(g, owner);
  fxDealFrom('deckPile', document.querySelectorAll('#hands .card.dealing, #seats .card.dealing'));
  prevHands = S.hands.map(h => h.length);
  prevOwner = owner;
  refreshCardTip();
}

// un único listener para dock, asientos y barra de acción
export function bindHands() {
  const activate = target => {
    const btn = target.closest('button[data-act]');
    if (btn) {
      if (btn.disabled) return;
      const n = +btn.dataset.n;
      switch (btn.dataset.act) {
        case 'amount': ctl.chooseAmount(n); break;
        case 'pickHoled': ctl.pickHoled(n); break;
        case 'confirmDiscard': ctl.confirmDiscard(); break;
        case 'cancel': ctl.cancel(); break;
        case 'react': startReaction(n); break;
        case 'endReact': endReaction(); break;
      }
      return;
    }
    const card = target.closest('.card[data-p]:not(.back)');
    if (card) ctl.clickCard(+card.dataset.p, +card.dataset.idx);
  };
  // cartas de efecto inmediato (hoyo…): al pasar por encima se ve en el tablero qué harán
  $('hands').addEventListener('mouseover', e => {
    const c = e.target.closest('.card[data-p]:not(.back)');
    if (c) previewCard(+c.dataset.p, +c.dataset.idx);
  });
  $('hands').addEventListener('mouseleave', hidePreview);
  for (const id of ['dock', 'seats']) {
    const el = $(id);
    el.addEventListener('click', e => activate(e.target));
    el.addEventListener('keydown', e => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.card[data-p]')) {
        e.preventDefault();
        const { p, idx } = e.target.dataset;
        activate(e.target);
        requestAnimationFrame(() => document.querySelector(`.card[data-p="${p}"][data-idx="${idx}"]`)?.focus());
      }
    });
  }
}
