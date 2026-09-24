// Hoja de reglas y cartas, siempre a mano (botón "?" de la partida, tecla H y menú de pausa).
// Se construye con los textos y el registro de cartas: una carta nueva aparece sola.
import { app } from './app.js';
import { $, esc } from './dom.js';
import { t } from '../i18n/index.js';
import { CARDS } from '../content/cards/index.js';
import { cardArtHTML } from './card-art.js';
import { pauseGame, resumePlay } from './pause.js';
import { ensureGuard } from './back.js';

let lastFocus = null;

function cardsHTML() {
  const seen = new Set(), rows = [];
  for (const def of Object.values(CARDS)) {
    // las cuatro direcciones de las cartas de hoyo se explican juntas
    const group = def.id.startsWith('oHoyo') ? 'oHoyo' : def.id.startsWith('hoyo') ? 'hoyo' : def.id;
    if (seen.has(group)) continue;
    seen.add(group);
    const name = group === 'hoyo' || group === 'oHoyo' ? `${def.short} (${t('rules.anyDir')})` : def.name;
    rows.push(`<div class="rlCard ${def.color}"><span class="hintCard ${def.color}">${cardArtHTML(def)}</span>` +
      `<span><b>${esc(name)}</b><small>${esc(t('tutorial.card.' + group))}</small></span></div>`);
  }
  return rows.join('');
}

function html() {
  const sec = (k, icon) => `<section><h4><svg class="i" aria-hidden="true"><use href="#${icon}"/></svg>${esc(t(`rules.${k}H`))}</h4><p>${esc(t(`rules.${k}`))}</p></section>`;
  return `<header><h2 id="rulesTitle">${esc(t('rules.title'))}</h2>` +
    `<button class="btn-ghost btn-sm btn-icon setClose" data-rules="close" aria-label="${esc(t('common.close'))}"><svg class="i" aria-hidden="true"><use href="#i-x"/></svg></button></header>` +
    `<div class="setBody">` +
    sec('goal', 'i-hole') + sec('turn', 'i-arrow-r') + sec('colors', 'i-bolt') + sec('jaque', 'i-flag') +
    sec('edges', 'i-out') + sec('tiles', 'i-sand') +
    `<section><h4><svg class="i" aria-hidden="true"><use href="#i-hand"/></svg>${esc(t('rules.cardsH'))}</h4><div class="rlCards">${cardsHTML()}</div></section>` +
    `<section><h4><svg class="i" aria-hidden="true"><use href="#i-grid"/></svg>${esc(t('rules.keysH'))}</h4><p class="rlKeys">${t('rules.keys')}</p></section>` +
    `</div>`;
}

export function openRules() {
  lastFocus = document.activeElement;
  $('rulesBox').innerHTML = html();
  $('rulesOverlay').classList.add('visible');
  $('rulesBox').querySelector('[data-rules="close"]')?.focus({ preventScroll: true });
  if (app.screen === 'game') pauseGame('rules');
  ensureGuard();
}
export function closeRules() {
  $('rulesOverlay').classList.remove('visible');
  resumePlay('rules');
  lastFocus?.focus?.({ preventScroll: true });
}
export const rulesOpen = () => $('rulesOverlay').classList.contains('visible');

export function bindRules() {
  $('rulesBtn').addEventListener('click', openRules);
  $('rulesOverlay').addEventListener('click', e => {
    if (e.target === $('rulesOverlay') || e.target.closest('[data-rules="close"]')) closeRules();
  });
}
