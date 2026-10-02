// Regalo para los early testers: en el menú aparece un aviso pequeño con un regalo; al tocarlo, una ventana cuenta que
// por probar el juego tan pronto puedes congelar tu racha del reto diario (no se pierde aunque pases días sin jugar) y
// que se puede descongelar cuando quieras en Ajustes. Se enseña hasta que se abre (una vez abierto, el ajuste se queda).
import { app } from './app.js';
import { $, esc } from './dom.js';
import { t } from '../i18n/index.js';
import { setStreakFrozen, streakFrozen } from './records.js';
import { dateKey } from '../content/levels/generate.js';
import { toast } from './hud.js';
import { sfx } from '../audio/sfx.js';
import { track } from './analytics.js';

const KEY = 'chaoticgolf_gift';
export const giftOpened = () => { try { return /^"?open"?$/.test(localStorage.getItem(KEY) || ''); } catch (e) { return false; } };
const markOpened = () => { try { localStorage.setItem(KEY, 'open'); } catch (e) { /* sin storage */ } };

// la caja con su lazo (abierta: la tapa salta y sale un copo con la llama de la racha)
export const GIFT_SVG = (open = false) => `<svg class="giftSvg${open ? ' open' : ''}" viewBox="0 0 64 64" aria-hidden="true">` +
  '<ellipse cx="33" cy="58" rx="20" ry="3.4" fill="rgba(20,40,20,.18)"/>' +
  '<rect x="12" y="28" width="40" height="28" rx="4" fill="#E0566F"/><rect x="12" y="28" width="40" height="6" fill="#C8435C"/>' +
  '<rect x="28.5" y="28" width="7" height="28" fill="#F2C14E"/>' +
  `<g class="giftLid"><rect x="9" y="20" width="46" height="10" rx="3.4" fill="#EE6A82"/><rect x="28.5" y="20" width="7" height="10" fill="#F7D774"/>` +
  '<path d="M32 20C26 10 16 12 19 18C21 21 28 21 32 20Z" fill="#F2C14E"/><path d="M32 20C38 10 48 12 45 18C43 21 36 21 32 20Z" fill="#F2C14E"/>' +
  '<circle cx="32" cy="19.6" r="2.6" fill="#E8A93A"/></g>' +
  (open ? '<g class="giftOut"><circle cx="32" cy="10" r="8.6" fill="#E9F4FA" stroke="#8CC6DA" stroke-width="1.4"/>' +
    '<path d="M32.4 4.2c.3 2 3.1 3.3 3.1 6.6a3.4 3.4 0 0 1-6.8 0c0-1.5.8-2.6 1.7-3.3-.05 1.1.3 1.9 1.1 2.3-.2-2.1.1-4 .9-5.6z" fill="#5FA9D6"/></g>' : '') +
  '</svg>';

// el aviso pequeño del menú (si aún no se ha abierto el regalo)
export function maybeShowGift() {
  if (giftOpened() || app.screen !== 'menu' || $('dialog').open || $('giftPop')) return;
  const b = document.createElement('button');
  b.id = 'giftPop'; b.type = 'button';
  b.innerHTML = `${GIFT_SVG()}<span><b>${esc(t('gift.pop'))}</b><small>${esc(t('gift.popSub'))}</small></span>`;
  b.addEventListener('click', () => { b.remove(); openGift(); });
  document.body.appendChild(b);
}
export const hideGift = () => $('giftPop')?.remove();

function openGift() {
  markOpened();
  sfx('season');
  const dlg = $('dialog'), frozen = streakFrozen();
  dlg.innerHTML = `<form method="dialog" class="dlgBox giftBox">${GIFT_SVG(true)}` +
    `<h3>${esc(t('gift.title'))}</h3><p>${esc(t('gift.text'))}</p><p class="dlgHint">${esc(t('gift.hint'))}</p>` +
    `<div class="dlgBtns"><button value="later" class="btn-light">${esc(t('gift.later'))}</button>` +
    `<button value="freeze" class="btn-primary">${esc(t(frozen ? 'gift.already' : 'gift.freeze'))}</button></div></form>`;
  const done = () => {
    dlg.removeEventListener('close', done);
    const freeze = dlg.returnValue === 'freeze';
    track('regalo', { congelar: freeze });
    if (freeze && !frozen) { setStreakFrozen(true, dateKey()); toast(t('gift.done')); app.onStreakChange?.(); }
  };
  dlg.addEventListener('close', done);
  dlg.returnValue = '';
  dlg.showModal();
  dlg.querySelector('button[value="freeze"]').focus();
}
