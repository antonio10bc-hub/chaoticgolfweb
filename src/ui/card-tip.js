// Tooltip de carta: al pasar el ratón (o enfocar con teclado) explica qué hace,
// de qué tipo es y, si ahora no se puede jugar, por qué. En la interfaz táctil, manteniendo pulsada
// la carta (ese toque no la juega); se cierra al tocar cualquier otra cosa.
import { app } from './app.js';
import { $, esc } from './dom.js';
import { CARDS } from '../content/cards/index.js';
import { blockedReason } from './reasons.js';
import { t } from '../i18n/index.js';
import { isPhone, buzz } from './device.js';

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
  if (el && (isPhone() || el.matches(':hover, :focus-visible'))) show(el); else hideCardTip();
}

export function bindCardTip() {
  const onEnter = e => {
    if (isPhone()) return; // (en táctil, mantener pulsado)
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
  // táctil: mantener pulsada una carta = qué hace (sin jugarla)
  let press = null, heldAt = 0;
  const release = () => { if (press) { clearTimeout(press.t); press = null; } };
  for (const id of ['dock', 'seats']) {
    const box = $(id);
    box.addEventListener('pointerdown', e => {
      heldAt = 0; // (cada toque nuevo empieza de cero)
      if (!isPhone()) return;
      const el = e.target.closest('.card[data-key]');
      if (!el) return;
      release();
      press = { x: e.clientX, y: e.clientY, t: setTimeout(() => { press = null; heldAt = Date.now(); show(el); buzz(10); }, 430) };
    });
    box.addEventListener('pointermove', e => { if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 10) release(); });
    box.addEventListener('pointerup', release);
    box.addEventListener('pointercancel', release);
    box.addEventListener('click', e => { // el toque que ha abierto la explicación no juega la carta
      if (heldAt && Date.now() - heldAt < 1500) { heldAt = 0; e.stopPropagation(); e.preventDefault(); }
    }, true);
    box.addEventListener('contextmenu', e => { if (isPhone() && e.target.closest('.card')) e.preventDefault(); });
  }
  window.addEventListener('scroll', hideCardTip, true);
}
