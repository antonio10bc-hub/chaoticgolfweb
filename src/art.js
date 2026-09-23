/* =========================================================
   ASSETS — todo el markup y color de piezas en un solo sitio.
   Junto con el registro de cartas (iconos) y las variables de
   styles/base.css (paleta), es el único punto que hay que tocar
   para cambiar el aspecto del juego.

   ARTE BITMAP: al arrancar se lee assets/art/manifest.json (lo genera
   `npm run art-manifest` a partir de los PNG presentes en assets/art/).
   Las claves que aparezcan sustituyen al fallback emoji/CSS. Sin
   manifiesto no se pide ningún PNG (cero peticiones 404).
   ========================================================= */
import { app } from './ui/app.js';
import { PLAYER_COLORS } from './engine/game.js';
import { tileDef } from './content/tiles/index.js';
import { t } from './i18n/index.js';

// clave de arte -> nombre de archivo esperado en assets/art/ (ver tools/build-art-manifest.mjs)
export const ART_FILES = {
  'icon.palo': 'icon_palo.png',
  'icon.dedo': 'icon_dedo.png',
  'icon.hoyo2': 'icon_hoyo2.png',  // flecha hacia ARRIBA: el juego la rota
  'icon.hoyo1': 'icon_hoyo1.png',  // flecha hacia ARRIBA: el juego la rota
  'icon.bunker': 'icon_bunker.png',
  'icon.portal': 'icon_portal.png',
  'icon.no': 'icon_no.png',
  'tile.hole': 'tile_hole.png',
  'tile.bunker': 'tile_bunker.png',
  'tile.portal': 'tile_portal.png',
  'ball.1': 'ball_j1.png', 'ball.2': 'ball_j2.png', 'ball.3': 'ball_j3.png',
  'ball.4': 'ball_j4.png', 'ball.5': 'ball_j5.png', 'ball.6': 'ball_j6.png',
  'cell.grass': 'cell_grass.png',
  'cell.sand': 'cell_sand.png',
  'cell.cement': 'cell_cement.png',
  'menu.bg': 'menu_bg.png',
  'menu.logo': 'menu_logo.png',
};
export const ART = {}; // clave -> url, solo del arte que realmente existe

export async function loadArt() {
  let manifest;
  try {
    const r = await fetch('assets/art/manifest.json', { cache: 'no-cache' });
    if (!r.ok) return;
    manifest = await r.json();
  } catch (e) { return; }
  await Promise.all(Object.entries(manifest).map(([key, file]) => new Promise(done => {
    const url = 'assets/art/' + file;
    const img = new Image();
    img.onload = () => { ART[key] = url; done(); };
    img.onerror = done;
    img.src = url;
  })));
}

// color visible de un jugador (en PVE cada quien elige/asigna color)
export function pColor(p) {
  const S = app.game?.S;
  return (S && S.colorMap) ? S.colorMap[p] : PLAYER_COLORS[p % PLAYER_COLORS.length];
}

// hoyo visto desde arriba: green circular con agujero, bandera naranja y su sombra larga a 45°
const HOLE_SVG = `<svg class="holeSvg" viewBox="0 0 100 140" aria-hidden="true">` +
  `<circle cx="50" cy="72" r="47" fill="#79A456"/><circle cx="50" cy="72" r="42" fill="#8DB05F"/>` +
  `<path d="M46 84 L80 112" stroke="rgba(20,40,20,.3)" stroke-width="4" stroke-linecap="round"/>` +
  `<ellipse cx="46" cy="84" rx="10" ry="7" fill="#242424"/>` +
  `<path d="M46 84 V36" stroke="#F1F1DC" stroke-width="3.4" stroke-linecap="round"/>` +
  `<path d="M47.5 37 L72 45 L47.5 54 Z" fill="#E8873A"/></svg>`;

export const ASSETS = {
  holeHTML: () => ART['tile.hole']
    ? `<div class="cardOnCell tile-hole artCard"><img class="fill" src="${ART['tile.hole']}" alt=""></div>`
    : `<div class="cardOnCell tile-hole">${HOLE_SVG}</div>`,
  ballHTML: pl => ART['ball.' + (pl + 1)]
    ? `<div class="cardOnCell artCard"><img class="fill" src="${ART['ball.' + (pl + 1)]}" alt=""><div class="ballTag" style="background:${PLAYER_COLORS[pl]}">J${pl + 1}</div></div>`
    : `<div class="cardOnCell tile-ball"><div class="circ" style="background:${pColor(pl)}">J${pl + 1}</div></div>`,
  tileHTML: (type, extra = '') => {
    const d = tileDef(type);
    return ART[d.tileArt]
      ? `<div class="cardOnCell artCard${extra}"><img class="fill" src="${ART[d.tileArt]}" alt=""></div>`
      : `<div class="cardOnCell ${d.tileClass}${extra}">${d.pic}<div class="sub">${t(`tiles.${type}.label`)}</div></div>`;
  },
  trapBadgeHTML: () => `<div class="badge"><svg class="i" aria-hidden="true"><use href="#i-sand"/></svg></div>`,
  parLabelHTML: n => `<div class="parLabel">PAR ${n}</div>`,
  handCardHTML: def => {
    const url = def.art && ART[def.art];
    const icon = url
      ? `<img class="cardArt" src="${url}" alt="" style="transform:rotate(${def.artRot || 0}deg)">`
      : def.icon;
    return `${icon}<div class="name">${def.short || def.name}</div>`;
  },
  // arte bitmap de fondo de una casilla (null si no hay PNG)
  cellArt: (tile, par) => tile ? (ART[tileDef(tile.type)?.cellArt] || null) : (!par ? (ART['cell.grass'] || null) : null),
};
