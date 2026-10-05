// Presentación de la mesa al empezar una partida contra la máquina (partida rápida, multijugador
// local, reto diario, desafíos): con el tablero ya cargado y antes de que juegue nadie, dice
// quién eres, contra quién juegas, quién empieza y en qué orden van los turnos. Mientras está
// abierta la partida espera (la máquina no juega y no se pasa el móvil); "Empezar" la arranca.
import { app } from './app.js';
import { $, esc } from './dom.js';
import { t } from '../i18n/index.js';
import { humansOf, multiHuman, displayName, avatarHTML, isBot } from './players.js';
import { pColor } from '../art.js';
import { skinBall, equippedSkin, skinSeat } from './skins.js';
import { REDUCED } from '../fx/juice.js';
import { sfx } from '../audio/sfx.js';
import { hidePass } from './hotseat.js';

let onStart = null, timers = [];
const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };
export const lineupOpen = () => app.paused === 'lineup';

// orden de juego desde quien empieza (los turnos van de asiento en asiento: S.turn + 1)
export const turnOrder = S => Array.from({ length: S.nPlayers }, (_, i) => (S.turn + i) % S.nPlayers);

// tag: el modo (texto de la etiqueta) · variant: para su color · start: lo que arranca la partida (la máquina)
export function showLineup({ tag = '', variant = null, start } = {}) {
  const S = app.game?.S;
  if (!S || S.nPlayers < 2) { start?.(); return; }
  clearTimers();
  onStart = start;
  app.paused = 'lineup'; // (la máquina, los avisos y los atajos esperan; ver pause.js y ai-driver.js)
  if (app.passFor != null) hidePass(); // (multijugador local: el móvil se pasa al pulsar Empezar)
  const local = multiHuman(), me = local ? null : humansOf(S)[0], order = turnOrder(S);
  const chip = (p, i) => {
    const sub = p === me ? t('lineup.you') : isBot(p) ? t('persona.style.' + S.aiStyles[p]) : t('lineup.person');
    return `<li class="luSeat${p === me ? ' me' : ''}${i === 0 ? ' first' : ''}" style="--pc:${pColor(p)};--i:${i}">` +
      (i === 0 ? `<span class="luFirst"><svg class="i" aria-hidden="true"><use href="#i-flag"/></svg>${esc(t('lineup.starts'))}</span>` : '') +
      `<span class="luN">${i + 1}</span>${avatarHTML(p)}<b>${esc(displayName(p))}</b><small>${esc(sub)}</small></li>`;
  };
  const hero = local
    ? `<h2>${esc(t('lineup.titleLocal', { n: humansOf(S).length }))}</h2>`
    : `<div class="luHero"><div class="luMe">${skinBall(skinSeat() === me ? equippedSkin() : null, { size: 64, color: pColor(me) })}</div><div class="luWho">` +
      `<h2>${esc(S.playerNames?.[me] ? t('lineup.youAre', { name: S.playerNames[me] }) : t('lineup.youAreAnon'))}</h2>` +
      `<p class="luSub${order[0] === me ? ' mine' : ''}">${esc(t(order[0] === me ? 'lineup.youStart' : 'lineup.theyStart', { name: displayName(order[0]) }))}</p></div></div>`;
  const el = $('lineup');
  el.className = (variant ? 'v-' + variant : local ? 'v-local' : 'v-quick') + (REDUCED ? ' still' : '');
  el.innerHTML = `<div class="luBox">` +
    (tag ? `<span class="luTag">${esc(tag)}</span>` : '') + hero +
    `<div class="luOrder"><span class="luH">${esc(t('lineup.order'))}</span>` +
    `<ol class="luTrack" style="--n:${order.length}">${order.map(chip).join('')}</ol></div>` +
    `<button class="btn-primary btn-lg" data-lineup="go">${esc(t('lineup.go'))}</button></div>`;
  el.classList.add('visible');
  el.querySelector('[data-lineup="go"]').focus({ preventScroll: true });
  sfx('select');
  if (REDUCED) { el.classList.add('lit'); return; }
  // el turno recorre la mesa en orden y vuelve a quien empieza
  const seats = [...el.querySelectorAll('.luSeat')], step = 170, t0 = 380 + order.length * 70;
  seats.forEach((s, i) => timers.push(setTimeout(() => { seats.forEach(x => x.classList.toggle('on', x === s)); sfx('deal'); }, t0 + i * step)));
  timers.push(setTimeout(() => { seats.forEach((x, i) => x.classList.toggle('on', i === 0)); el.classList.add('lit'); sfx('turn'); }, t0 + seats.length * step));
}

// la quita sin arrancar nada (al salir de la partida)
export function hideLineup() {
  clearTimers();
  onStart = null;
  $('lineup')?.classList.remove('visible');
}

export function bindLineup() {
  $('lineup').addEventListener('click', e => {
    if (!e.target.closest('[data-lineup="go"]')) return;
    const go = onStart;
    hideLineup();
    if (app.paused === 'lineup') app.paused = false;
    go?.();
  });
}
