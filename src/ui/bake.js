// Texturas precocinadas: lo que es caro de pintar se pinta UNA vez en un lienzo y se usa como imagen.
//   · grano fino: era un filtro SVG (feTurbulence) dentro de --grain, que el navegador recalculaba en cada
//     panel, carta y casilla (en el móvil, lo que más tardaba en pintarse al cambiar de pantalla). Ahora es
//     el mismo SVG rasterizado a un PNG de 180×180 al arrancar: idéntico, y se pinta como una imagen más.
//   · fondo de los menús: la ilustración aérea desenfocada (antes blur(18px) en vivo sobre un SVG a pantalla
//     completa, que se volvía a pintar entero al volver de la partida). Ahora un mapa de bits pequeño ya
//     desenfocado (el desenfoque no necesita resolución) y guardado para el siguiente arranque.
// Si el navegador no deja leer el lienzo, todo sigue como antes (los estilos originales hacen de respaldo).
import { $ } from './dom.js';
import { ART } from '../art.js';

const loadImg = src => new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = src; });
const svgURL = svg => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);

/* ---------- grano ---------- */
const GRAIN_SVG = "<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='.07'/></svg>";
export async function bakeGrain() {
  try {
    const img = await loadImg(svgURL(GRAIN_SVG.replace('%23', '#')));
    const c = document.createElement('canvas'); c.width = c.height = 180;
    c.getContext('2d').drawImage(img, 0, 0);
    const url = c.toDataURL('image/png');
    document.documentElement.style.setProperty('--grain', `url(${url})`);
    // la ilustración aérea (menú) usa el mismo grano, como trama en lugar de filtro
    const im = document.getElementById('grainImg');
    const rect = document.getElementById('aerialGrain');
    if (im && rect) { // (el PNG ya lleva la opacidad del grano)
      im.setAttribute('href', url);
      rect.removeAttribute('filter'); rect.setAttribute('opacity', '1'); rect.setAttribute('fill', 'url(#grainP)');
    }
  } catch (e) { /* sin lienzo legible: se queda el filtro SVG */ }
}

/* ---------- fondo desenfocado de los menús ---------- */
const SCENE_KEY = 'chaoticgolf_sceneBg', SCENE_VER = 'v1';
const W = 400, H = 280;      // 0,4 px por unidad de la ilustración (1000×700)
const BLUR = 5.4;            // = blur(18px) en pantalla: la ilustración se ve a ~1,33 px por unidad
function useScene(url) {
  const scene = $('scene'), svg = $('menuScene');
  if (!scene || !svg) return;
  scene.style.background = `var(--grass-dark) url(${url}) center / cover no-repeat`;
  svg.style.display = 'none';
}
// al arrancar, sin esperar: la copia guardada (si la hay)
export function sceneFromCache() {
  try {
    const v = JSON.parse(localStorage.getItem(SCENE_KEY));
    if (v?.ver === SCENE_VER && v.url) { useScene(v.url); return true; }
  } catch (e) { /* sin storage */ }
  return false;
}
export async function bakeScene() {
  if (ART['menu.bg'] || sceneFromCache()) return; // (con arte propio de fondo, manda ese)
  try {
    const sp = $('sprite');
    const defs = [...sp.querySelectorAll('defs > pattern:not(#grainP), defs > clipPath')].map(e => e.outerHTML).join('');
    const art = $('aerial').cloneNode(true);
    art.querySelector('#aerialGrain')?.remove(); // (el grano se pierde en el desenfoque)
    const body = art.innerHTML + ($('aerialBall')?.innerHTML || '');
    const img = await loadImg(svgURL(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 700" width="1000" height="700"><defs>${defs}</defs>${body}</svg>`));
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#4F8A4B'; ctx.fillRect(0, 0, W, H);
    const m = BLUR * 3; // un poco más grande que el lienzo: los bordes no se aclaran al desenfocar
    if ('filter' in ctx) {
      ctx.filter = `blur(${BLUR}px) saturate(.9) brightness(.82)`;
      ctx.drawImage(img, -m, -m * H / W, W + 2 * m, H + 2 * m * H / W);
    } else { // (navegadores sin filtros en el lienzo: desenfoque reduciendo y ampliando, y oscurecido a mano)
      const s = document.createElement('canvas'); s.width = W / 8; s.height = H / 8;
      const sx = s.getContext('2d'); sx.imageSmoothingQuality = 'high';
      sx.drawImage(img, 0, 0, s.width, s.height);
      ctx.imageSmoothingQuality = 'high'; ctx.drawImage(s, -m, -m * H / W, W + 2 * m, H + 2 * m * H / W);
      const d = ctx.getImageData(0, 0, W, H), p = d.data;
      for (let i = 0; i < p.length; i += 4) {
        const l = .2126 * p[i] + .7152 * p[i + 1] + .0722 * p[i + 2];
        for (let k = 0; k < 3; k++) p[i + k] = (l + (p[i + k] - l) * .9) * .82;
      }
      ctx.putImageData(d, 0, 0);
    }
    const url = c.toDataURL('image/jpeg', .85);
    useScene(url);
    try { localStorage.setItem(SCENE_KEY, JSON.stringify({ ver: SCENE_VER, url })); } catch (e) { /* sin sitio */ }
  } catch (e) { /* sin lienzo legible: se queda el desenfoque en vivo */ }
}
