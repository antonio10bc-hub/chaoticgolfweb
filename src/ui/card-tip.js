// Tooltip de carta: al pasar el ratón (o enfocar con teclado) explica qué hace,
// de qué tipo es y, si ahora no se puede jugar, por qué.
import { app } from './app.js';
import { $, esc } from './dom.js';
import { CARDS } from '../content/cards/index.js';
import { blockedReason } from './reasons.js';
import { t } from '../i18n/index.js';

let timer = null, current = null;

function show(el) {
  const g = app.game, key = el.dataset.key, def = CARDS[key];
  if (!g || !def) return;
  const p = +el.dataset.p, idx = +el.dataset.idx;
  const discarding = g.pending?.kind === 'discard' && g.pending.p === p;
  const why = !discarding && !g.canPlay(p, key) ? blockedReason(g, p, key) : null;
  const tip = $('cardTip');
  tip.className = 'visible ' + def.color;
  tip.innerHTML = `<b>${esc(def.name)}</b><span class="kind">${esc(t('cardKind.' + def.color))}</span>` +
    `<p>${esc(t(`cards.${key}.desc`))}</p>` + (why ? `<p class="why">${esc(why)}</p>` : '');
  const r = el.getBoundingClientRect(), tr = tip.getBoundingClientRect();
  let x = r.left + r.width / 2 - tr.width / 2, y = r.top - tr.height - 12;
  x = Math.max(8, Math.min(window.innerWidth - tr.width - 8, x));
  if (y < 8) y = r.bottom + 12;
  tip.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  current = { p, idx };
}
export function hideCardTip() { clearTimeout(timer); $('cardTip').className = ''; current = null; }

// tras re-renderizar las manos: si el ratón sigue sobre la misma carta, se mantiene
export function refreshCardTip() {
  if (!current) return;
  const el = document.querySelector(`.card[data-p="${current.p}"][data-idx="${current.idx}"][data-key]`);
  if (el && el.matches(':hover, :focus-visible')) show(el); else hideCardTip();
}

export function bindCardTip() {
  const onEnter = e => {
    const el = e.target.closest?.('.card[data-key]');
    if (!el) return;
    clearTimeout(timer);
    timer = setTimeout(() => show(el), current ? 60 : 380);
  };
  const onLeave = e => {
    const el = e.target.closest?.('.card[data-key]');
    if (el && !el.contains(e.relatedTarget)) hideCardTip();
  };
  for (const id of ['dock', 'seats']) {
    $(id).addEventListener('mouseover', onEnter);
    $(id).addEventListener('mouseout', onLeave);
    $(id).addEventListener('focusin', onEnter);
    $(id).addEventListener('focusout', hideCardTip);
  }
  // inclinación 3D de la carta del dock bajo el ratón (sensación táctil)
  $('hands').addEventListener('mousemove', e => {
    const el = e.target.closest('.card');
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--ry', ((e.clientX - r.left) / r.width - .5) * 16 + 'deg');
    el.style.setProperty('--rx', (.5 - (e.clientY - r.top) / r.height) * 12 + 'deg');
  });
  window.addEventListener('pointerdown', hideCardTip, true);
  window.addEventListener('scroll', hideCardTip, true);
}
