// Personalidad visible de los bots: nombre, cara (SVG plano que cambia de humor)
// y bocadillos cortos cuando juegan, les golpean, se caen o embocan.
// Todo es decorativo: nunca toca el estado del juego.
import { app } from './app.js';
import { t } from '../i18n/index.js';
import { REDUCED } from '../fx/juice.js';

// catálogo de rivales: cada bot tiene nombre y personalidad (el estilo de juego de src/ai/bot.js)
export const PERSONAS = [
  { id: 'rocco', name: 'Rocco', style: 'aggro' }, { id: 'bruno', name: 'Bruno', style: 'aggro' }, { id: 'tank', name: 'Tank', style: 'aggro' },
  { id: 'lola', name: 'Lola', style: 'trick' }, { id: 'pixie', name: 'Pixie', style: 'trick' }, { id: 'vito', name: 'Vito', style: 'trick' },
  { id: 'vera', name: 'Vera', style: 'cautious' }, { id: 'tito', name: 'Tito', style: 'cautious' }, { id: 'olga', name: 'Olga', style: 'cautious' },
  { id: 'chispa', name: 'Chispa', style: 'chaos' }, { id: 'zas', name: 'Zas', style: 'chaos' }, { id: 'kiko', name: 'Kiko', style: 'chaos' },
];
export const personaById = id => PERSONAS.find(p => p.id === id) || null;

// reparte personajes a los asientos de bots: los elegidos (ids) y, para el resto, otros al azar
// sin repetir. Escribe su estilo y su nombre en el estado (metadatos: no afectan a las reglas).
export function assignPersonas(S, botSeats, chosen = [], rand = Math.random) {
  const used = new Set(chosen.filter(id => personaById(id)));
  const pool = PERSONAS.filter(p => !used.has(p.id));
  S.playerNames = S.playerNames || Array(S.nPlayers).fill(null);
  S.personas = S.personas || Array(S.nPlayers).fill(null);
  botSeats.forEach((seat, i) => {
    let pr = personaById(chosen[i]);
    if (!pr) { const k = Math.floor(rand() * pool.length); pr = pool.splice(k, 1)[0] || PERSONAS[i % PERSONAS.length]; }
    S.aiStyles[seat] = pr.style; S.playerNames[seat] = pr.name; S.personas[seat] = pr.id;
  });
}

// nombre de un bot sin personaje asignado (partidas antiguas): uno de su estilo, sin repetir
let nameCache = { game: null, names: {} };
export function botName(p) {
  const g = app.game, S = g?.S;
  if (!S?.aiStyles?.[p]) return null;
  if (nameCache.game !== g) {
    const used = new Set(), names = {};
    const off = (g.seed ?? 7) % 3;
    for (let i = 0; i < S.nPlayers; i++) {
      const st = S.aiStyles[i];
      if (!st) continue;
      const list = PERSONAS.filter(pp => pp.style === st);
      let k = (off + i) % list.length, tries = 0;
      while (used.has(list[k].name) && tries++ < list.length) k = (k + 1) % list.length;
      used.add(list[k].name); names[i] = list[k].name;
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
export function faceSVG(p, forceStyle = null, forceMood = null) {
  const style = forceStyle || app.game?.S.aiStyles?.[p] || 'trick', m = forceMood || moodOf(p);
  const ink = '#242424';
  // cejas: el agresivo las lleva fruncidas por defecto
  const browsBy = {
    angry: 'M11 13.5l7 2.6M29 13.5l-7 2.6',
    sad: 'M11 15.5l7-2.2M29 15.5l-7-2.2',
    think: 'M11 13.5l7 .8M22 12.5l7 2',
    happy: 'M11 13.5q3.5-2.4 7 0M22 13.5q3.5-2.4 7 0',
    smug: 'M11 14l7 .2M22 12.8l7 1.4',
    idle: style === 'aggro' ? 'M11 13.6l7 2M29 13.6l-7 2'
      : style === 'cautious' ? 'M11 14.5l7-1.6M29 14.5l-7-1.6'      // cejas de preocupación
      : style === 'chaos' ? 'M11 12.5l7 2.5M22 15q3.5-3 7-1'         // una ceja arriba, otra abajo
      : 'M11 14q3.5-1.6 7 0M22 14q3.5-1.6 7 0',
  };
  const mouthBy = {
    happy: '<path d="M13 25q7 7 14 0z" fill="#242424"/>',
    sad: '<path d="M14 29q6-5 12 0" fill="none" stroke="#242424" stroke-width="2.2" stroke-linecap="round"/>',
    angry: '<path d="M14 28.5h12" stroke="#242424" stroke-width="2.4" stroke-linecap="round"/><path d="M16 28.5v-1.4M20 28.5v-1.6M24 28.5v-1.4" stroke="#242424" stroke-width="1.4"/>',
    think: '<circle cx="23" cy="27.5" r="2" fill="#242424"/>',
    smug: '<path d="M15 26.5q6 3.5 11-1.5" fill="none" stroke="#242424" stroke-width="2.2" stroke-linecap="round"/>',
    idle: style === 'aggro'
      ? '<path d="M15 27.5q5 1.6 10 0" fill="none" stroke="#242424" stroke-width="2.2" stroke-linecap="round"/>'
      : style === 'cautious' ? '<path d="M17 28h6" stroke="#242424" stroke-width="2.2" stroke-linecap="round"/>'
      : style === 'chaos' ? '<path d="M13 26l3 2.5 3-2.5 3 2.5 3-2.5 2 1.5" fill="none" stroke="#242424" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'
      : '<path d="M15 26.5q5.5 3.6 11 0" fill="none" stroke="#242424" stroke-width="2.2" stroke-linecap="round"/>',
  };
  const eyeY = m === 'think' ? 18.4 : 19;
  // ojos: el caótico los tiene desiguales; el cauteloso lleva gafas redondas
  const rL = style === 'chaos' ? 3.1 : 2.4, rR = style === 'chaos' ? 1.9 : 2.4;
  const eyes = m === 'happy'
    ? `<path d="M12 19.5q2.6-3 5.2 0M22.8 19.5q2.6-3 5.2 0" fill="none" stroke="${ink}" stroke-width="2.2" stroke-linecap="round"/>`
    : `<circle cx="14.6" cy="${eyeY}" r="${rL}" fill="${ink}"/><circle cx="25.4" cy="${eyeY}" r="${rR}" fill="${ink}"/>` +
      `<circle cx="15.3" cy="${eyeY - .8}" r=".8" fill="#fff"/><circle cx="26.1" cy="${eyeY - .8}" r=".8" fill="#fff"/>`;
  const glasses = style === 'cautious'
    ? `<circle cx="14.6" cy="19" r="4.6" fill="rgba(255,255,255,.28)" stroke="${ink}" stroke-width="1.4"/><circle cx="25.4" cy="19" r="4.6" fill="rgba(255,255,255,.28)" stroke="${ink}" stroke-width="1.4"/><path d="M19.2 19h1.6" stroke="${ink}" stroke-width="1.4"/>` : '';
  return `<svg class="face" viewBox="0 0 40 40" aria-hidden="true" data-mood="${m}">` +
    `<path d="${browsBy[m] || browsBy.idle}" fill="none" stroke="${ink}" stroke-width="2.2" stroke-linecap="round"/>` +
    eyes + glasses + (mouthBy[m] || mouthBy.idle) + `</svg>`;
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
  // un bot solo dice una cosa a la vez: la frase nueva sustituye a la anterior
  document.querySelectorAll(`.bubble[data-p="${p}"]`).forEach(o => { o.remove(); live--; });
  const b = document.createElement('div');
  b.dataset.p = p;
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
  setTimeout(() => { if (b.isConnected) { b.remove(); live--; } }, 2350);
}
export function clearBubbles() { document.querySelectorAll('.bubble').forEach(b => b.remove()); live = 0; }
