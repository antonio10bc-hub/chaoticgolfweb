// Ilustraciones de las cartas: estilo plano/lineal de club de golf visto desde arriba
// (trazo fino en tinta, colores planos de la paleta, sombras cortas a 45°, sin contornos gruesos).
// Cada carta declara en su módulo `face: { art, value, dir? }`; aquí se dibuja.
// Si hay arte bitmap (assets/art, clave def.art) se usa en lugar del SVG.
import { ART } from '../art.js';

const INK = '#242424', CREAM = '#F1F1DC', ACC = '#E8873A', NAVY = '#2D4F7C', SAND = '#ECE6CC';
const G_MID = '#5C9854', G_PUTT = '#8DB05F', G_LIGHT = '#A3C173', SH = 'rgba(20,40,20,.22)';

const ball = (cx, cy, r = 7) =>
  `<circle cx="${cx + 3}" cy="${cy + 3}" r="${r}" fill="${SH}"/>` +
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#fff" stroke="${INK}" stroke-width="1.8"/>`;

// palo de hierro en diagonal
const club = (grip = NAVY) =>
  `<path d="M74 12 L44 74" stroke="${SH}" stroke-width="4" stroke-linecap="round" transform="translate(4 4)"/>` +
  `<path d="M74 12 L44 74" stroke="${INK}" stroke-width="3.2" stroke-linecap="round"/>` +
  `<path d="M76 8 L69 22" stroke="${grip}" stroke-width="8" stroke-linecap="round"/>` +
  `<path d="M33 70 Q40 67 48 72 L46 82 Q34 85 25 81 Q22 74 33 70 Z" fill="${INK}"/>` +
  `<path d="M29 77 L41 78" stroke="${CREAM}" stroke-width="1.6" stroke-linecap="round" opacity=".6"/>`;

const ARROW_ROT = { up: 0, right: 90, down: 180, left: 270 };
// madera del minigolf
const WD = { hi: '#E2B77E', mid: '#C99257', side: '#A8743F', dark: '#7A5230' };
const woodGrain = (x, y, w, n) => Array.from({ length: n }, (_, i) => `<path d="M${x + 4} ${y + (i + 1) * 9}q${w * .22} -3 ${w * .45} 0t${w * .45} 0" fill="none" stroke="rgba(122,82,48,.35)" stroke-width="1.3" stroke-linecap="round"/>`).join('');
// degradado iridiscente (Ultimate)
let iriSeq = 0;
const IRI = id => `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF9ECF"/><stop offset=".3" stop-color="#A8C8FF"/><stop offset=".55" stop-color="#9DF2D6"/><stop offset=".8" stop-color="#FFE59A"/><stop offset="1" stop-color="#C9A6FF"/></linearGradient></defs>`;

const ARTS = {
  palo: () => `<circle cx="50" cy="54" r="40" fill="${G_LIGHT}" opacity=".35"/>` + club() + ball(68, 76),
  // palo iridiscente: el palo y la estela brillan con los colores del arcoíris
  // (id único por dibujo: si el primero está oculto, Chrome no pinta el degradado en los demás)
  paloIri: () => { const id = 'iri' + (++iriSeq); return IRI(id) + `<circle cx="50" cy="54" r="40" fill="url(#${id})" opacity=".35"/>` +
    `<path d="M74 12 L44 74" stroke="${SH}" stroke-width="4" stroke-linecap="round" transform="translate(4 4)"/>` +
    `<path d="M74 12 L44 74" stroke="url(#${id})" stroke-width="4.2" stroke-linecap="round"/>` +
    `<path d="M76 8 L69 22" stroke="${INK}" stroke-width="8" stroke-linecap="round"/>` +
    `<path d="M33 70 Q40 67 48 72 L46 82 Q34 85 25 81 Q22 74 33 70 Z" fill="url(#${id})" stroke="${INK}" stroke-width="1.6"/>` +
    `<path d="M60 78 H92" stroke="url(#${id})" stroke-width="3" stroke-linecap="round" stroke-dasharray="2 5"/>` + ball(56, 78) +
    `<path d="M18 22l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#FFF6C9"/><path d="M84 40l1.4 3.6 3.6 1.4-3.6 1.4-1.4 3.6-1.4-3.6-3.6-1.4 3.6-1.4z" fill="#FFF6C9"/>`; },
  block: () => `<rect x="24" y="24" width="56" height="60" rx="7" fill="${SH}"/>` +
    `<rect x="20" y="18" width="58" height="62" rx="7" fill="${WD.side}"/><rect x="20" y="18" width="58" height="54" rx="7" fill="${WD.mid}"/>` +
    `<rect x="27" y="24" width="44" height="42" rx="4" fill="${WD.hi}"/>` + woodGrain(27, 24, 44, 4) +
    `<path d="M14 50 H4 M10 44 L4 50 L10 56" fill="none" stroke="${ACC}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`,
  corner: () => `<polygon points="24,24 84,24 24,84" fill="${SH}"/>` +
    `<polygon points="18,18 80,18 18,80" fill="${WD.side}" stroke="${WD.dark}" stroke-width="1.8" stroke-linejoin="round"/>` +
    `<polygon points="26,26 62,26 26,62" fill="${WD.hi}"/><line x1="80" y1="18" x2="18" y2="80" stroke="#F6E2BE" stroke-width="3" stroke-linecap="round"/>` +
    `<path d="M60 92 V66 H86" fill="none" stroke="${ACC}" stroke-width="2.6" stroke-dasharray="1 5" stroke-linecap="round"/>` + ball(60, 92, 5),
  tunnel: () => `<rect x="24" y="24" width="56" height="60" rx="9" fill="${SH}"/>` +
    `<rect x="20" y="18" width="60" height="62" rx="9" fill="${WD.side}"/><rect x="20" y="18" width="60" height="56" rx="9" fill="${WD.mid}"/>` +
    `<rect x="28" y="25" width="44" height="42" rx="5" fill="${WD.hi}"/>` +
    `<path d="M41 18a9 9 0 0 1 18 0Z M41 74a9 9 0 0 0 18 0Z M20 37a9 9 0 0 1 0 18Z M80 37a9 9 0 0 0 0 18Z" fill="#3A2614"/>` +
    `<text x="50" y="53" text-anchor="middle" font-size="20" font-weight="700" fill="${WD.side}">?</text>`,
  launcher: () => `<circle cx="53" cy="58" r="34" fill="${SH}"/><circle cx="50" cy="54" r="34" fill="${WD.side}"/><circle cx="50" cy="51" r="32" fill="${WD.mid}"/>` +
    `<circle cx="50" cy="51" r="24" fill="${WD.hi}"/><path d="M50 28L64 46H55V70H45V46H36Z" fill="${ACC}" stroke="${WD.dark}" stroke-width="1.8" stroke-linejoin="round"/>` +
    `<path d="M50 8 V2 M44 10 L40 5 M56 10 L60 5" stroke="${ACC}" stroke-width="2.2" stroke-linecap="round"/>`,
  paloReactivo: () => `<circle cx="50" cy="54" r="40" fill="${ACC}" opacity=".16"/>` + club(ACC) + ball(68, 76) +
    `<path d="M24 12 16 26h7l-3 12 10-15h-7l3-11z" fill="${ACC}"/>`,
  dedo: () => `<circle cx="50" cy="54" r="40" fill="${G_LIGHT}" opacity=".35"/>` +
    // camino en zigzag hasta la bola
    `<path d="M22 84 V68 H36 V54" fill="none" stroke="${ACC}" stroke-width="2.6" stroke-dasharray="1 6" stroke-linecap="round"/>` +
    ball(22, 84, 6) +
    // mano con el índice apuntando (plana, trazo fino)
    `<path d="M50 90 Q40 90 40 79 L40 64 Q40 57 47 57 L50 57 L50 26 Q50 18 57 18 Q64 18 64 26 L64 53 L69 53 Q78 53 78 62 L78 77 Q78 90 66 90 Z"
       transform="translate(4 4)" fill="${SH}"/>` +
    `<path d="M50 90 Q40 90 40 79 L40 64 Q40 57 47 57 L50 57 L50 26 Q50 18 57 18 Q64 18 64 26 L64 53 L69 53 Q78 53 78 62 L78 77 Q78 90 66 90 Z"
       fill="#F2CBA2" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>` +
    `<path d="M64 62v5M71 62v5M50 64v7" stroke="${INK}" stroke-width="1.6" stroke-linecap="round" opacity=".45"/>`,
  hoyo: face =>
    // green con agujero y bandera en el centro + flecha de dirección en tinta
    `<circle cx="50" cy="54" r="30" fill="${G_PUTT}"/>` +
    `<path d="M46 62 L66 78" stroke="${SH}" stroke-width="3" stroke-linecap="round"/>` +
    `<ellipse cx="46" cy="62" rx="8" ry="5.5" fill="${INK}"/>` +
    `<path d="M46 62 V36" stroke="${CREAM}" stroke-width="2.6" stroke-linecap="round"/>` +
    `<path d="M47 37 L62 42 L47 48 Z" fill="${ACC}"/>` +
    `<g transform="rotate(${ARROW_ROT[face.dir] || 0} 50 54)">` +
      `<path d="M50 4 L61 16 L54 16 L54 22 L46 22 L46 16 L39 16 Z" fill="${INK}"/>` +
    `</g>`,
  bunker: () =>
    // búnker en riñón con collar, labio sombreado, brillo y marcas de rastrillo
    `<path d="M6 64C3 44 20 31 39 33c13 1 17 9 28 7 15-3 28 5 27 21-1 22-23 34-46 33C23 93 8 82 6 64z" fill="${G_MID}"/>` +
    `<path d="M12 64c-2-16 11-26 26-24 11 1 15 8 26 6 12-2 23 4 22 17-1 18-19 28-39 27-18-1-33-10-35-26z" fill="${SAND}"/>` +
    `<path d="M12 64c-2-16 11-26 26-24 11 1 15 8 26 6 12-2 23 4 22 17-6-9-15-11-23-9-11 2-17-4-27-5-11-1-20 5-24 15z" fill="#DDD5B4"/>` +
    `<path d="M21 76c10 8 31 10 47 5 8-2 13-7 15-12-5 11-27 18-46 15-8-1-13-4-16-8z" fill="#F6F2E0"/>` +
    `<path d="M25 62c10-4 22-3 32 1M23 70c12-4 26-3 38 2M33 78c9-2 18-1 26 2" fill="none" stroke="#D4CBA6" stroke-width="1.4" stroke-linecap="round"/>` +
    `<path d="M76 10 L64 44" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/><path d="M55 42 L73 48" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>`,
  portal: () =>
    // vórtice plano: disco azul con anillos que nacen del centro y crecen sin salirse (igual que en el tablero)
    `<circle cx="55" cy="59" r="34" fill="${SH}"/>` +
    `<circle cx="50" cy="54" r="39" fill="#A9C3E6" opacity=".45"/>` +
    `<circle cx="50" cy="54" r="34" fill="#2D4F7C"/><circle cx="50" cy="54" r="23" fill="#34598A"/><circle cx="50" cy="54" r="12" fill="#3F6798"/>` +
    `<g class="portalRings"><circle class="portalRing" cx="50" cy="54" r="30" fill="none" stroke="#A9C3E6" stroke-width="2.2"/><circle class="portalRing" cx="50" cy="54" r="30" fill="none" stroke="#A9C3E6" stroke-width="2.2"/><circle class="portalRing" cx="50" cy="54" r="30" fill="none" stroke="#A9C3E6" stroke-width="2.2"/></g>` +
    `<circle cx="50" cy="54" r="34" fill="none" stroke="#A9C3E6" stroke-width="1.4" opacity=".7"/>` +
    `<circle class="portalCore" cx="50" cy="54" r="5" fill="#fff"/>`,
  river: () =>
    // río: franja de agua clara de arriba abajo, con chevrones que bajan (la corriente) y orillas de césped
    // (el SVG recorta lo que se sale: ver .cardSvg:has(.riverFlow) en board.css)
    `<path d="M29 -2C33 30 27 62 32 102H68C63 62 71 30 67 -2Z" fill="${G_MID}"/>` +
    `<path d="M36 -2C39 30 34 62 38 102H62C58 62 64 30 60 -2Z" fill="#5BB6D6"/>` +
    `<path d="M40 0C42 30 39 60 41 100" stroke="rgba(255,255,255,.35)" stroke-width="2" fill="none" stroke-linecap="round"/>` +
    `<g class="riverFlow">` + [0, 1, 2, 3, 4].map(i => `<path d="M42 ${i * 30 - 26}l8 7 8-7" fill="none" stroke="#F1FBFF" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>`).join('') + `</g>`,
  lake: () =>
    // lago: agua profunda y quieta, redondeada, con reflejos y un nenúfar
    `<ellipse cx="54" cy="58" rx="40" ry="30" fill="${SH}"/>` +
    `<ellipse cx="50" cy="54" rx="42" ry="32" fill="${G_MID}"/>` +
    `<ellipse cx="50" cy="54" rx="36" ry="26" fill="#2E7E8C"/>` +
    `<ellipse cx="50" cy="56" rx="30" ry="20" fill="#3A93A2" opacity=".6"/>` +
    `<ellipse class="lakeShine a" cx="36" cy="44" rx="11" ry="3" fill="rgba(255,255,255,.3)"/>` +
    `<ellipse class="lakeShine b" cx="60" cy="68" rx="8" ry="2.4" fill="rgba(255,255,255,.22)"/>` +
    `<g transform="translate(60 50)"><path d="M0 0L12 -3A12 12 0 1 1 11 5Z" fill="#5E9A58" transform="rotate(-20)"/><circle r="2.4" fill="#F2B6C8"/></g>`,
  no: () =>
    // carta tachada: anula la última jugada
    `<rect x="32" y="22" width="36" height="50" rx="6" fill="#fff" stroke="${INK}" stroke-width="1.8" transform="rotate(-8 50 47)"/>` +
    `<path d="M41 40h18M41 49h13" stroke="${INK}" stroke-width="1.8" stroke-linecap="round" opacity=".35" transform="rotate(-8 50 47)"/>` +
    `<circle cx="50" cy="48" r="32" fill="none" stroke="#D9603A" stroke-width="5"/>` +
    `<path d="M28 26 L72 70" stroke="#D9603A" stroke-width="5" stroke-linecap="round"/>`,
};

export function cardArtSVG(def) {
  const face = def.face || {};
  const draw = ARTS[face.art];
  if (!draw) return def.icon || '';
  return `<svg class="cardSvg" viewBox="0 0 100 100" aria-hidden="true">${draw(face)}</svg>`;
}

// ilustración (bitmap si existe, si no SVG)
export function cardArtHTML(def) {
  const url = def.art && ART[def.art];
  return url
    ? `<img class="cardArt" src="${url}" alt="" style="transform:rotate(${def.artRot || 0}deg)">`
    : cardArtSVG(def);
}

// cara completa de la carta: esquina con valor, ilustración y nombre
export function cardFaceHTML(def) {
  const v = def.face?.value;
  return `<span class="cardCorner">${v ?? ''}</span>` +
    (def.color === 'orange' ? `<svg class="cardBolt" aria-hidden="true"><use href="#i-bolt"/></svg>` : '') +
    `<span class="cardPic">${cardArtHTML(def)}</span>` +
    `<span class="cardName">${def.short || def.name}</span>`;
}
