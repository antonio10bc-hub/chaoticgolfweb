// Logros ligeros: se desbloquean una vez por dispositivo y avisan con una notificación pequeña.
// Los comprueban el controlador, la reproducción de animaciones y el final de partida.
import { $, esc } from './dom.js';
import { t } from '../i18n/index.js';
import { sfx } from '../audio/sfx.js';

const KEY = 'chaoticgolf_achievements';
// orden de la lista en Estadísticas; icono del sprite de index.html
export const ACHIEVEMENTS = [
  { id: 'firstWin', icon: 'i-trophy' },     // gana una partida
  { id: 'jaqueSaved', icon: 'i-x' },        // evita un JAQUE con una naranja
  { id: 'combo3', icon: 'i-burst' },        // 3 choques en una sola jugada
  { id: 'portalSink', icon: 'i-spiral' },   // emboca después de cruzar un portal
  { id: 'holeInOne', icon: 'i-hole' },      // completa un nivel en el primer turno
  { id: 'basicsAll', icon: 'i-check' },     // completa todos los niveles de Lo básico
  { id: 'winHard', icon: 'i-bolt' },        // gana a la máquina en difícil
  { id: 'streak3', icon: 'i-flag' },        // 3 victorias seguidas en partida rápida
  { id: 'localGame', icon: 'i-users' },     // termina una partida de multijugador local
  { id: 'loop', icon: 'i-chain-break' },    // provoca un bucle entre portales
];

export const loadAchievements = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } };
export const resetAchievements = () => { try { localStorage.removeItem(KEY); } catch (e) { /* sin storage */ } };

const queue = [];
let showing = false;
export function unlock(id) {
  const got = loadAchievements();
  if (got[id] || !ACHIEVEMENTS.some(a => a.id === id)) return false;
  got[id] = Date.now();
  try { localStorage.setItem(KEY, JSON.stringify(got)); } catch (e) { /* sin storage */ }
  queue.push(id);
  if (!showing) next();
  return true;
}

// notificación: arriba a la derecha, una detrás de otra
function next() {
  const id = queue.shift();
  if (!id) { showing = false; return; }
  showing = true;
  const a = ACHIEVEMENTS.find(x => x.id === id);
  const el = document.createElement('div');
  el.className = 'achToast';
  el.setAttribute('role', 'status');
  el.innerHTML = `<span class="achIco"><svg class="i" aria-hidden="true"><use href="#${a.icon}"/></svg></span>` +
    `<span class="achTxt"><small>${esc(t('ach.unlocked'))}</small><b>${esc(t('ach.' + id + '.name'))}</b></span>`;
  document.body.appendChild(el);
  sfx('win');
  setTimeout(() => el.classList.add('out'), 3000);
  setTimeout(() => { el.remove(); next(); }, 3400);
}

// lista para Estadísticas
export function achievementsHTML() {
  const got = loadAchievements();
  const n = ACHIEVEMENTS.filter(a => got[a.id]).length;
  return `<p class="muted achCount">${esc(t('ach.count', { n, total: ACHIEVEMENTS.length }))}</p><div class="achGrid">` +
    ACHIEVEMENTS.map(a => `<div class="ach${got[a.id] ? ' got' : ''}"><span class="achIco"><svg class="i" aria-hidden="true"><use href="#${a.icon}"/></svg></span>` +
      `<span class="achTxt"><b>${esc(t('ach.' + a.id + '.name'))}</b><small>${esc(t('ach.' + a.id + '.desc'))}</small></span></div>`).join('') + `</div>`;
}
