// Manos de los jugadores + barra de acción pendiente (sustituye a los popups).
import { app } from './app.js';
import { $, esc } from './dom.js';
import { ASSETS, pColor } from '../art.js';
import { CARDS } from '../content/cards/index.js';
import { JUICE } from '../fx/juice.js';
import { t } from '../i18n/index.js';
import * as ctl from './controller.js';

let prevHands = []; // tamaños de mano en el último render (para el robo escalonado)
export const resetDealAnim = () => { prevHands = []; };

const BAR_KINDS = ['move', 'placeTile', 'pickBall', 'serpent', 'dedoAmount', 'pickHoled', 'discard'];
const SEL_KINDS = ['move', 'placeTile', 'pickBall', 'serpent'];

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
      html += `<button data-act="amount" data-n="${n}"${dis ? ` disabled title="${esc(t('hands.cantLeaveTrap'))}"` : ''}>${n}</button>`;
    }
  } else if (pd.kind === 'pickHoled') {
    for (const hb of S.balls.filter(b => b.holed)) html += `<button data-act="pickHoled" data-n="${hb.player}">J${hb.player + 1}</button>`;
  } else if (pd.kind === 'discard') {
    const n = pd.selected.length;
    html += `<button data-act="confirmDiscard"${n ? '' : ' disabled'}>${n ? t('hands.discardN', { n }) : t('hands.confirm')}</button>`;
  }
  if (pd.kind !== 'serpent') html += `<button class="danger" data-act="cancel">${t('common.cancel')}</button>`; // el dedo ya gastado no se puede cancelar
  return html;
}

export function renderHands() {
  const g = app.game, S = g.S, pd = g.pending;
  const el = $('hands');
  const pve = app.mode === 'pve';
  el.classList.toggle('pveSolo', pve || app.mode === 'story' || app.mode === 'test'); // mano centrada también en historia y al probar niveles
  // jugador dueño de la acción pendiente
  const pendP = !pd ? -1 : (pd.p !== undefined ? pd.p : (pd.kind === 'serpent' ? pd.ball.player : -1));
  let html = '';
  for (let p = 0; p < S.nPlayers; p++) {
    const hidden = pve && p !== S.human && !app.pveShowHands; // manos rivales tapadas salvo debug
    const col = pColor(p), active = p === S.turn, mine = pve && p === S.human;
    const cls = 'hand' + (active ? ' active' : '') + (pve && p !== S.human ? ' aiHand' : '') + (mine ? ' mine' : '');
    const style = `border-color:${active ? col : col + '55'}` + (active ? `;box-shadow:0 4px 14px ${col}55` : '');
    const tag = mine ? t('hands.yours') : t('player.name', { n: p + 1 });
    const badge = mine ? `<span class="tuBadge" style="background:${col}">${t('hands.youBadge')}</span>` : '';
    const think = app.ai.thinkingOf === p ? `<span class="thinkDots" aria-label="${esc(t('hands.thinking'))}"><i></i><i></i><i></i></span>` : '';
    // JAQUE: si tengo naranja usable, mi mano pide acción a gritos
    const jaqueCta = S.jaque && S.winner !== null && !S.winners.includes(p) && (!pve || p === S.human) && !hidden
      && S.hands[p].some(k => CARDS[k].color === 'orange' && g.canPlay(p, k));
    const ctaTag = jaqueCta ? `<span class="jaqueCtaTag">${t('hands.useIt')}</span>` : '';
    html += `<div class="${cls}" style="${style}" data-player="${p}">` +
      `<h3><span class="dot" style="background:${col}"></span>${tag} <span class="handCount">${S.hands[p].length}</span>${think}${ctaTag}${badge}</h3>`;
    // barra de acción pendiente: sustituye a los antiguos popups para TODOS los diálogos
    if (pendP === p && BAR_KINDS.includes(pd.kind)) {
      const interactive = app.mode !== 'pve' || p === S.human; // en PVE solo se interactúa con tus acciones
      html += `<div class="cancelBar" role="status"><span>${esc(hintFor(g, p))}</span>${interactive ? barButtons(g) : ''}</div>`;
    }
    const discarding = pd?.kind === 'discard' && pd.p === p;
    const prevLen = prevHands[p] || 0;
    html += `<div class="handCards">`;
    S.hands[p].forEach((k, idx) => {
      const def = CARDS[k];
      const dealing = idx >= prevLen; // robo con entrada escalonada (decorativo)
      const dealCls = dealing ? ' dealIn' : '';
      const dealStyle = dealing ? ` style="animation-delay:${(idx - prevLen) * JUICE.dealStaggerMs}ms"` : '';
      if (hidden) { // dorso: se ve cuántas cartas tienen, no cuáles
        html += `<div class="card back${dealCls}"${dealStyle} title="${esc(t('hands.hidden'))}" aria-label="${esc(t('hands.hidden'))}"></div>`;
        return;
      }
      const playable = discarding || g.canPlay(p, k);
      let c = `card ${def.color}` + (playable || def.color === 'orange' ? '' : ' unplayable'); // las naranjas siempre encendidas
      if (jaqueCta && def.color === 'orange' && g.canPlay(p, k)) c += ' ctaJaque'; // tu naranja: quítale el apagado
      if (discarding && pd.selected.includes(idx)) c += ' discardSel';
      if (pd && pd.p === p && pd.idx === idx && SEL_KINDS.includes(pd.kind)) c += ' cardSel';
      const label = def.name + (playable ? '' : ` (${t('a11y.unplayable')})`);
      html += `<div class="${c}${dealCls}"${dealStyle} role="button" tabindex="0" data-p="${p}" data-idx="${idx}" aria-label="${esc(label)}">${ASSETS.handCardHTML(def)}</div>`;
    });
    html += `</div></div>`;
  }
  el.innerHTML = html;
  prevHands = S.hands.map(h => h.length);
}

// un único listener para todas las manos (cartas y botones de la barra)
export function bindHands() {
  const el = $('hands');
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
      }
      return;
    }
    const card = target.closest('.card[data-p]');
    if (card) ctl.clickCard(+card.dataset.p, +card.dataset.idx);
  };
  el.addEventListener('click', e => activate(e.target));
  el.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.card[data-p]')) {
      e.preventDefault();
      const { p, idx } = e.target.dataset;
      activate(e.target);
      requestAnimationFrame(() => document.querySelector(`#hands .card[data-p="${p}"][data-idx="${idx}"]`)?.focus());
    }
  });
}
