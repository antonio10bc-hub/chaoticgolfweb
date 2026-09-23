// Personalidad visible de los bots: nombre, cara (SVG plano que cambia de humor)
// y bocadillos cortos cuando juegan, les golpean, se caen o embocan.
// Todo es decorativo: nunca toca el estado del juego.
import { app } from './app.js';
import { t } from '../i18n/index.js';
import { REDUCED } from '../fx/juice.js';

// nombres por personalidad (agresivo / tramposo); se reparten sin repetir en la partida
const NAMES = {
  aggro: ['Rocco', 'Bruno', 'Duke', 'Tank', 'Brutus'],
  trick: ['Lola', 'Pixie', 'Vito', 'Nina', 'Coco'],
};

// nombre de cada bot de la partida en curso (cacheado por partida)
let nameCache = { game: null, names: {} };
export function botName(p) {
  const g = app.game, S = g?.S;
  if (!S?.aiStyles?.[p]) return null;
  if (nameCache.game !== g) {
    const used = new Set(), names = {};
    const off = (g.seed ?? 7) % 5;
    for (let i = 0; i < S.nPlayers; i++) {
      const st = S.aiStyles[i];
      if (!st) continue;
      const list = NAMES[st] || NAMES.trick;
      let k = (off + i) % list.length;
      while (used.has(list[k])) k = (k + 1) % list.length;
      used.add(list[k]); names[i] = list[k];
    }
    nameCache = { game: g, names };
  }
  return nameCache.names[p] || null;
}

/* ---------- humor ---------- */
const moods = {}; // p -> { m, until }
export function moodOf(p) {
  if (app.ai.thinkingOf === p) return 'think';
  const md = moods[p];
  return md && md.until > Date.now() ? md.m : 'idle';
}
export function setMood(p, m, ms = 2400) {
  moods[p] = { m, until: Date.now() + ms };
  refreshFaces(p);
  clearTimeout(setMood['t' + p]);
  setMood['t' + p] = setTimeout(() => refreshFaces(p), ms + 30);
}
export const resetMoods = () => { for (const k of Object.keys(moods)) delete moods[k]; };

// cara plana: ojos, cejas y boca según personalidad y humor (viewBox 40×40, sobre el círculo de color)
export function faceSVG(p) {
  const style = app.game?.S.aiStyles?.[p] || 'trick', m = moodOf(p);
  const ink = '#242424';
  // cejas: el agresivo las lleva fruncidas por defecto
  const browsBy = {
    angry: 'M11 13.5l7 2.6M29 13.5l-7 2.6',
    sad: 'M11 15.5l7-2.2M29 15.5l-7-2.2',
    think: 'M11 13.5l7 .8M22 12.5l7 2',
    happy: 'M11 13.5q3.5-2.4 7 0M22 13.5q3.5-2.4 7 0',
    smug: 'M11 14l7 .2M22 12.8l7 1.4',
    idle: style === 'aggro' ? 'M11 13.6l7 2M29 13.6l-7 2' : 'M11 14q3.5-1.6 7 0M22 14q3.5-1.6 7 0',
  };
  const mouthBy = {
    happy: '<path d="M13 25q7 7 14 0z" fill="#242424"/>',
    sad: '<path d="M14 29q6-5 12 0" fill="none" stroke="#242424" stroke-width="2.2" stroke-linecap="round"/>',
    angry: '<path d="M14 28.5h12" stroke="#242424" stroke-width="2.4" stroke-linecap="round"/><path d="M16 28.5v-1.4M20 28.5v-1.6M24 28.5v-1.4" stroke="#242424" stroke-width="1.4"/>',
    think: '<circle cx="23" cy="27.5" r="2" fill="#242424"/>',
    smug: '<path d="M15 26.5q6 3.5 11-1.5" fill="none" stroke="#242424" stroke-width="2.2" stroke-linecap="round"/>',
    idle: style === 'aggro'
      ? '<path d="M15 27.5q5 1.6 10 0" fill="none" stroke="#242424" stroke-width="2.2" stroke-linecap="round"/>'
      : '<path d="M15 26.5q5.5 3.6 11 0" fill="none" stroke="#242424" stroke-width="2.2" stroke-linecap="round"/>',
  };
  const eyeY = m === 'think' ? 18.4 : 19;
  const eyes = m === 'happy'
    ? `<path d="M12 19.5q2.6-3 5.2 0M22.8 19.5q2.6-3 5.2 0" fill="none" stroke="${ink}" stroke-width="2.2" stroke-linecap="round"/>`
    : `<circle cx="14.6" cy="${eyeY}" r="2.4" fill="${ink}"/><circle cx="25.4" cy="${eyeY}" r="2.4" fill="${ink}"/>` +
      `<circle cx="15.3" cy="${eyeY - .8}" r=".8" fill="#fff"/><circle cx="26.1" cy="${eyeY - .8}" r=".8" fill="#fff"/>`;
  return `<svg class="face" viewBox="0 0 40 40" aria-hidden="true" data-mood="${m}">` +
    `<path d="${browsBy[m] || browsBy.idle}" fill="none" stroke="${ink}" stroke-width="2.2" stroke-linecap="round"/>` +
    eyes + (mouthBy[m] || mouthBy.idle) + `</svg>`;
}

// actualiza en sitio las caras de un bot (sin re-renderizar la mesa)
export function refreshFaces(p) {
  document.querySelectorAll(`.avatar[data-face="${p}"]`).forEach(el => {
    const f = el.querySelector('.face');
    if (f) f.outerHTML = faceSVG(p);
  });
}

/* ---------- bocadillos ---------- */
const lastSaid = {};
let live = 0;
// el ancla es el avatar del asiento del bot (o su pastilla de turno si es quien juega)
function anchorOf(p) {
  const cands = [...document.querySelectorAll(`.seat[data-player="${p}"] .avatar, #turnPill .avatar[data-face="${p}"]`)];
  return cands.find(el => el.getBoundingClientRect().width > 0) || null;
}

// dice una frase del grupo `kind` (textos en persona.lines.<kind>, separados por |)
export function say(p, kind, { chance = 1, force = false } = {}) {
  if (app.screen !== 'game' || !botName(p) || Math.random() > chance) return;
  const now = Date.now();
  if (!force && (now - (lastSaid[p] || 0) < 1800 || live >= 2)) return;
  const el = anchorOf(p);
  if (!el) return;
  const lines = t('persona.lines.' + kind).split('|');
  const text = lines[Math.floor(Math.random() * lines.length)];
  lastSaid[p] = now;
  const r = el.getBoundingClientRect();
  const seatR = el.closest('.seat')?.getBoundingClientRect(); // fuera de la tarjeta del asiento, para no tapar su nombre
  const b = document.createElement('div');
  b.className = 'bubble ' + kind + (REDUCED ? ' still' : '');
  b.textContent = text;
  b.style.setProperty('--pc', getComputedStyle(el).getPropertyValue('--pc'));
  document.body.appendChild(b);
  // a la derecha del avatar si cabe; si no, encima
  const bw = b.offsetWidth, bh = b.offsetHeight;
  let x = (seatR ? seatR.right : r.right) + 10, y = r.top + r.height / 2 - bh / 2, side = 'right';
  if (seatR && window.innerWidth <= 760) { // móvil: los asientos van en fila arriba; el bocadillo, debajo
    x = Math.max(8, Math.min(window.innerWidth - bw - 8, seatR.left + 12)); y = seatR.bottom + 8; side = 'below';
  }
  if (x + bw > window.innerWidth - 8) { x = Math.max(8, r.left + r.width / 2 - bw / 2); y = r.top - bh - 10; side = 'top'; }
  if (y < 6) y = r.bottom + 10;
  b.dataset.side = side;
  b.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  live++;
  setTimeout(() => { b.classList.add('out'); }, 2000);
  setTimeout(() => { b.remove(); live--; }, 2350);
}
export function clearBubbles() { document.querySelectorAll('.bubble').forEach(b => b.remove()); live = 0; }
