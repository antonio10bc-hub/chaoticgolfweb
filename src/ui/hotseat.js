// Multijugador local (varias personas en el mismo dispositivo): pantalla de "pasa el móvil".
//   · al empezar el turno de una persona distinta de la que tiene el dispositivo
//   · cuando alguien fuera de turno pide el dispositivo para reaccionar con una naranja
//     (y al terminar, de vuelta a quien tiene el turno)
// Mientras se muestra, las manos de las personas quedan boca abajo.
import { app } from './app.js';
import { $, esc } from './dom.js';
import { t } from '../i18n/index.js';
import { humansOf, multiHuman, displayName, avatarHTML } from './players.js';
import * as ctl from './controller.js';
import { saveGame } from './save.js';
import { sfx } from '../audio/sfx.js';

const over = () => { const S = app.game?.S; return !S || (S.winner !== null && !S.jaque); };

// se llama al principio de cada render: decide si hay que pasar el dispositivo
export function passCheck() {
  if (!app.game || !multiHuman() || over()) { if (app.passFor != null) hidePass(); return; }
  if (app.passFor != null || app.reacting != null) return;
  const S = app.game.S;
  if (humansOf().includes(S.turn) && app.viewer !== S.turn) showPass(S.turn, 'turn');
}

function showPass(p, reason) {
  app.passFor = p;
  const el = $('passScreen');
  el.style.setProperty('--pc', getPc(p));
  const name = esc(displayName(p));
  const title = reason === 'react' ? t('hotseat.reactTitle', { name }) : t('hotseat.turnTitle', { name });
  el.innerHTML = `<div class="passCard">${avatarHTML(p, 'lg')}` +
    `<h2>${title}</h2><p>${esc(t('hotseat.passTo', { name: displayName(p) }))}</p>` +
    `<button class="btn-primary btn-lg" data-pass="ok">${esc(t('hotseat.show', { name: displayName(p) }))}</button>` +
    (reason === 'react' ? `<button class="btn-text" data-pass="cancel">${esc(t('common.cancel'))}</button>` : '') + `</div>`;
  el.classList.add('visible');
  el.querySelector('[data-pass="ok"]')?.focus({ preventScroll: true });
  sfx('turn');
}
function getPc(p) {
  const S = app.game.S;
  return S.colorMap ? S.colorMap[p] : '';
}
function hidePass() { app.passFor = null; $('passScreen').classList.remove('visible'); }

// otra persona pide el dispositivo para reaccionar
export function startReaction(p) {
  if (!multiHuman() || app.passFor != null || app.game?.pending) return;
  app.reacting = p;
  showPass(p, 'react');
  ctl.render();
}
// devuelve el dispositivo a quien tiene el turno
export function endReaction() {
  app.reacting = null;
  ctl.render();
}

export function bindHotseat() {
  $('passScreen').addEventListener('click', e => {
    const b = e.target.closest('[data-pass]');
    if (!b) return;
    const p = app.passFor;
    hidePass();
    if (b.dataset.pass === 'ok') app.viewer = p;
    else app.reacting = null;
    ctl.render();
    saveGame();
  });
}
