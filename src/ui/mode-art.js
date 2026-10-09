// Juegos especiales (Modos de juego): iconos ilustrados con el mismo estilo de carta que los de las barajas
// (screen-modes.js, DECK_ART) y las cabeceras de cada sección y de cada grupo de dificultad.
//   rush       el cronómetro del contrarreloj (la aguja gira al pasar por la tarjeta)
//   challenge  el trofeo de los desafíos · weekly  el calendario del desafío semanal
//   puzzle     dos piezas que encajan · yours  el taller del creador (alfombrilla, lápiz y un tablero)
//   basics     (Lo básico: palos y hoyo) el palo, la pelota y el hoyo con su bandera, en una carta clara (la de la clásica es verde)
import { esc } from './dom.js';
import { t } from '../i18n/index.js';

const base = (id, top, bottom) => `<defs><linearGradient id="md-${id}-g" x1="0" y1="0" x2=".6" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient>` +
  `<clipPath id="md-${id}-c"><rect x="11" y="5" width="38" height="50" rx="7"/></clipPath></defs><rect x="11" y="5" width="38" height="50" rx="7" fill="url(#md-${id}-g)"/>`;
const frame = '<rect x="14" y="8" width="32" height="44" rx="5" fill="none" stroke="rgba(241,241,220,.55)" stroke-width="1.2"/>';
const ticks = (cx, cy, r0, r1, n = 12) => Array.from({ length: n }, (_, i) => { const a = i * 2 * Math.PI / n; return `<path d="M${(cx + Math.sin(a) * r0).toFixed(1)} ${(cy - Math.cos(a) * r0).toFixed(1)}L${(cx + Math.sin(a) * r1).toFixed(1)} ${(cy - Math.cos(a) * r1).toFixed(1)}"/>`; }).join('');

const ART = {
  rush: () => base('rush', '#5B8BC8', '#1F3A63') +
    `<g clip-path="url(#md-rush-c)"><g stroke="rgba(255,255,255,.1)" stroke-width="2.4" stroke-linecap="round"><path d="M4 22h9M2 28h8M5 34h7"/></g></g>` +
    `<rect x="27.5" y="12" width="5" height="4.5" rx="1" fill="#F1F1DC"/><rect x="26" y="10.5" width="8" height="2.6" rx="1.2" fill="#FFD84A"/>` +
    `<path d="M40.5 19.5l2.2-2.2" stroke="#F1F1DC" stroke-width="2.2" stroke-linecap="round"/>` +
    `<circle cx="30" cy="32" r="12.5" fill="#F1F1DC"/><circle cx="30" cy="32" r="10.2" fill="#fff" stroke="rgba(31,58,99,.25)" stroke-width="1"/>` +
    `<g stroke="#2D4F7C" stroke-width="1.2" stroke-linecap="round">${ticks(30, 32, 8.4, 9.8)}</g>` +
    `<path d="M30 32 L30 27" stroke="#2D4F7C" stroke-width="1.6" stroke-linecap="round"/>` +
    `<g class="mdHand"><path d="M30 32 L35.5 35" stroke="#E8733A" stroke-width="1.6" stroke-linecap="round"/></g><circle cx="30" cy="32" r="1.5" fill="#2D4F7C"/>` +
    `<path d="M39 40 l-4 7 h3.4 l-1.4 5 5.4-7.6 h-3.4 l1.4-4.4z" fill="#FFD84A" stroke="#fff" stroke-width=".6" stroke-linejoin="round"/>` + frame,
  challenge: () => base('ch', '#E07064', '#8E2E28') +
    `<defs><linearGradient id="md-ch-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFE9A0"/><stop offset=".5" stop-color="#E6B94A"/><stop offset="1" stop-color="#B8862A"/></linearGradient></defs>` +
    `<g clip-path="url(#md-ch-c)"><g class="mdRays" fill="rgba(255,236,190,.16)">${Array.from({ length: 8 }, (_, i) => `<path d="M30 27 L${(30 + Math.sin(i * .785 - .12) * 40).toFixed(1)} ${(27 - Math.cos(i * .785 - .12) * 40).toFixed(1)} L${(30 + Math.sin(i * .785 + .12) * 40).toFixed(1)} ${(27 - Math.cos(i * .785 + .12) * 40).toFixed(1)}Z"/>`).join('')}</g></g>` +
    `<path d="M22 16 h16 v6 a8 8 0 0 1-16 0z" fill="url(#md-ch-gold)" stroke="#8C6A1C" stroke-width=".9"/>` +
    `<path d="M22 18 h-3 a4 4 0 0 0 4 6 M38 18 h3 a4 4 0 0 1-4 6" fill="none" stroke="#E6B94A" stroke-width="1.6"/>` +
    `<path d="M28.5 29.5 h3 v5 h-3z" fill="#C9962E"/><rect x="24" y="34.5" width="12" height="3.2" rx="1" fill="url(#md-ch-gold)"/><rect x="22" y="37.5" width="16" height="4" rx="1.2" fill="#7A2A24"/>` +
    `<path d="M30 18.2l1.3 2.6 2.8.4-2 2 .5 2.8-2.6-1.4-2.6 1.4.5-2.8-2-2 2.8-.4z" fill="#fff"/>` +
    `<path class="mdShine" d="M25 16.5 L27.5 16.5 L24.5 27 L23 25z" fill="rgba(255,255,255,.55)"/>` + frame,
  weekly: () => base('wk', '#E07064', '#8E2E28') +
    `<rect x="17" y="15" width="26" height="28" rx="4" fill="#F1F1DC"/><path d="M17 19 a4 4 0 0 1 4-4 h18 a4 4 0 0 1 4 4 v4 H17z" fill="#B5473F"/>` +
    `<g fill="#7A2A24"><rect x="22" y="12" width="2.6" height="6" rx="1.2"/><rect x="35.4" y="12" width="2.6" height="6" rx="1.2"/></g>` +
    `<g fill="rgba(36,36,36,.18)">${[0, 1, 2, 3].map(c => [0, 1, 2].map(r => `<rect x="${20 + c * 5.4}" y="${26 + r * 5}" width="3.6" height="3.2" rx=".8"/>`).join('')).join('')}</g>` +
    `<rect x="36.2" y="36" width="3.6" height="3.2" rx=".8" fill="#E8873A"/><circle cx="38" cy="37.6" r="4.6" fill="none" stroke="#E8873A" stroke-width="1.2"/>` + frame,
  puzzle: () => base('pz', '#48B3A4', '#1E6B63') +
    `<path d="M16 17 h7 a3.2 3.2 0 1 1 6 0 h7 v7 a3.2 3.2 0 1 0 0 6 v7 h-7 a3.2 3.2 0 1 1-6 0 h-7z" fill="#F1F1DC" stroke="rgba(30,107,99,.4)" stroke-width="1"/>` +
    `<g class="mdPiece"><path d="M33 27 h5 a3 3 0 1 1 5.6 0 h2.4 v12 h-2.4 a3 3 0 1 0-5.6 0 h-5 v-4 a3 3 0 1 1 0-5.6z" fill="#E8873A" stroke="#fff" stroke-width="1" transform="translate(-5 5)"/></g>` +
    `<circle cx="22" cy="23" r="1.6" fill="#1E6B63"/><path d="M20 30 h7" stroke="rgba(30,107,99,.35)" stroke-width="1.4" stroke-linecap="round"/>` + frame,
  basics: () => base('bs', '#F6F1DE', '#CFC6A3') +
    `<g clip-path="url(#md-bs-c)"><g stroke="rgba(120,100,50,.08)" stroke-width="5">${[0, 10, 20, 30, 40].map(i => `<path d="M${i - 10} 60 L${i + 22} 0"/>`).join('')}</g></g>` +
    `<ellipse cx="37" cy="43" rx="4.2" ry="2.2" fill="#242424"/><path d="M37 43V27" stroke="#4A4A4A" stroke-width="1.4" stroke-linecap="round"/><path d="M37.4 27 L44 29.4 L37.4 31.8Z" fill="#E8873A"/>` +
    `<g class="mdPiece"><path d="M18 12 L24.2 37" stroke="#3A3A3A" stroke-width="2" stroke-linecap="round"/><path d="M22.4 36.6 h6.2 a1.7 1.7 0 0 1 0 3.4 h-6.6z" fill="#9AA3AA" stroke="#3A3A3A" stroke-width=".8"/></g>` +
    `<circle cx="28" cy="45" r="2.8" fill="#fff" stroke="rgba(20,40,20,.35)" stroke-width=".7"/>` +
    '<rect x="14" y="8" width="32" height="44" rx="5" fill="none" stroke="rgba(120,100,50,.35)" stroke-width="1.2"/>',
  yours: () => base('yo', '#5B6E7C', '#2F3B44') +
    `<g clip-path="url(#md-yo-c)" stroke="rgba(226,236,240,.16)" stroke-width=".8">${[15, 21, 27, 33, 39, 45].map(v => `<path d="M${v} 0V60M0 ${v}H60"/>`).join('')}</g>` +
    `<rect x="17" y="18" width="18" height="22" rx="2.5" fill="#4F8A4B" stroke="#F1F1DC" stroke-width="1.4"/>` +
    `<g fill="#5C9854">${[0, 1, 2].map(c => [0, 1, 2, 3].map(r => `<rect x="${19.5 + c * 5}" y="${20.5 + r * 4.6}" width="3.6" height="3.4" rx=".6"/>`).join('')).join('')}</g>` +
    `<circle cx="26" cy="22.3" r="1.4" fill="#242424"/><circle cx="31" cy="36.5" r="1.4" fill="#fff"/>` +
    `<g class="mdPencil"><path d="M44 16 l-13 17 -1 4.5 4-2.2 13-17z" fill="#FFD84A" stroke="#7A5230" stroke-width=".8" stroke-linejoin="round"/><path d="M44 16 l3 2.3" stroke="#E8733A" stroke-width="2.4"/><path d="M30 37.5 l1-4.5 3 2.3z" fill="#7A5230"/></g>` + frame,
};
export const modeArt = (kind, cls = 'mdArt') => `<svg class="${cls}" viewBox="0 0 60 60" aria-hidden="true">${ART[kind]()}</svg>`;

// cabecera de sección: icono, título, "4 de 18" y su barra (o, sin total, solo el número)
export function sectionHead({ art, title, done = null, total = null, extra = '', sub = null }) {
  const pct = total ? Math.round(100 * done / total) : 0;
  const count = total ? `<span class="lvlCount">${done}/${total}</span>` : done != null ? `<span class="lvlCount">${done}</span>` : '';
  return `<h3 class="spHead"><span class="spArt">${modeArt(art)}</span><span class="spTitle"><b>${esc(title)}</b>` +
    (sub ? `<small>${esc(sub)}</small>` : '') + (total ? `<span class="spBar" aria-hidden="true"><i style="width:${pct}%"></i></span>` : '') +
    `</span>${count}${extra}</h3>`;
}
// grupo de dificultad (calentamiento · intermedio · experto): sus marcas (1, 2 o 3), el nombre, x/y y su barra
const LEVEL = { warmup: 1, mid: 2, expert: 3 };
export function groupHead(g, done, total) {
  const n = LEVEL[g] || 1, pct = total ? Math.round(100 * done / total) : 0;
  return `<h4 class="lvlGroup g-${g}"><span class="gPips" aria-hidden="true">${[1, 2, 3].map(i => `<i${i <= n ? ' class="on"' : ''}></i>`).join('')}</span>` +
    `${esc(t('modes.groups.' + g))} <span>${done}/${total}</span><span class="gBar" aria-hidden="true"><i style="width:${pct}%"></i></span></h4>`;
}
