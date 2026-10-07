/* =========================================================
   PIXELIZADOR: las ilustraciones SVG del juego (cartas, losetas, hoyo, caras, barajas, modos…)
   se ven como pixel art de verdad: cada SVG se pinta a muy baja resolución en un lienzo, se le
   quita la transparencia a medias (bordes duros), se le pone un contorno oscuro de un píxel y se
   muestra ampliado sin suavizado como fondo del propio <svg>, cuyo contenido queda oculto.
   El <svg> sigue en su sitio (mismo tamaño, mismos nodos): el código que lo busca o lo cambia
   no se entera. Un observador procesa los que van apareciendo; el resultado se guarda por su
   marcado, así una carta o una loseta que se repinta igual no se vuelve a calcular.
   Lo que se anima dentro de un SVG (anillos del portal, corriente…) queda como una foto fija.
   ========================================================= */

// [selector, píxeles de arte a lo ancho del viewBox]
const TARGETS = [
  ['svg.cardSvg', 30],
  ['svg.tilePic', 30],
  ['svg.holeSvg', 30],
  ['svg.face', 30],
  ['svg.dkArt', 30],
  ['svg.mdArt', 30],
  ['svg.ndArt', 150],
  ['svg.twArt', 60],
  ['svg.giftSvg', 26],
  ['svg.snowSvg', 26],
  ['svg.trainSvg', 22],
  ['.mArt > svg', 230],
];
const SEL = TARGETS.map(t => t[0]).join(',');
const EDGE = [11, 17, 20];          // contorno (--edge)
const PROPS = ['fill', 'stroke', 'stroke-width', 'opacity', 'fill-opacity', 'stroke-opacity', 'display',
  'transform', 'transform-origin', 'transform-box', 'stroke-dasharray', 'stroke-linecap', 'stroke-linejoin',
  'font-family', 'font-size', 'font-weight', 'text-anchor', 'dominant-baseline', 'mix-blend-mode'];

const cache = new Map();            // clave -> Promise<url | null>
const SVGNS = 'http://www.w3.org/2000/svg';

const gridOf = svg => { for (const [s, g] of TARGETS) if (svg.matches(s)) return g; return 30; };
// clave de caché: el marcado sin los números de los id generados (degradados con contador…)
const keyOf = (svg, g) => g + '|' + svg.outerHTML.replace(/(id="|#)([A-Za-z_-]+)\d+/g, '$1$2');

// copia en la réplica los estilos calculados de cada nodo (lo que ponen las hojas de estilo y las variables)
function inlineStyles(src, dst) {
  const a = src.querySelectorAll('*'), b = dst.querySelectorAll('*');
  for (let i = 0; i < a.length && i < b.length; i++) {
    if (a[i].namespaceURI !== SVGNS) continue;
    const cs = getComputedStyle(a[i]);
    let st = '';
    for (const p of PROPS) {
      let v = cs.getPropertyValue(p);
      if (!v) continue;
      if (p === 'transform' && v === 'none') continue;
      v = v.replace(/url\("?[^#")]*(#[^")]+)"?\)/g, 'url($1)');
      st += `${p}:${v};`;
    }
    b[i].setAttribute('style', st + 'animation:none;transition:none;');
  }
}

// los <use href="#…"> y url(#…) que apuntan al sprite de la página: se copian dentro (si no, la imagen no los ve)
function addDeps(clone) {
  const defs = document.createElementNS(SVGNS, 'defs');
  const seen = new Set();
  const scan = el => {
    const html = el.outerHTML;
    for (const m of html.matchAll(/(?:href="#|url\(#|url\("#)([^")]+)/g)) {
      const id = m[1];
      if (seen.has(id) || clone.querySelector(`[id="${CSS.escape(id)}"]`)) continue;
      seen.add(id);
      const ref = document.getElementById(id);
      if (!ref) continue;
      const c = ref.cloneNode(true);
      defs.appendChild(c);
      scan(c);
    }
  };
  scan(clone);
  if (defs.childNodes.length) clone.insertBefore(defs, clone.firstChild);
}

function rasterize(svg, grid) {
  const vb = svg.viewBox?.baseVal;
  const vw = vb && vb.width ? vb.width : svg.clientWidth || 100, vh = vb && vb.height ? vb.height : svg.clientHeight || 100;
  // un margen alrededor: lo que asoma del viewBox (sombras, overflow visible) también se pinta
  const pad = svg.matches('.mArt > svg, svg.ndArt') ? 0 : .06; // (styles/casino.css lo compensa con scale)
  const W = Math.max(8, Math.round(grid * (1 + 2 * pad))), H = Math.max(8, Math.round(W * vh / vw));
  const clone = svg.cloneNode(true);
  inlineStyles(svg, clone);
  addDeps(clone);
  clone.setAttribute('xmlns', SVGNS);
  clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  if (vb && vb.width) clone.setAttribute('viewBox', `${vb.x - vw * pad} ${vb.y - vh * pad} ${vw * (1 + 2 * pad)} ${vh * (1 + 2 * pad)}`);
  clone.setAttribute('width', W); clone.setAttribute('height', H);
  clone.removeAttribute('class'); clone.removeAttribute('style');
  clone.style.overflow = 'visible';
  // trazos de al menos un píxel de arte: las líneas finas no se pierden ni se quedan grises
  const upp = vw / grid;
  clone.querySelectorAll('[style*="stroke-width"]').forEach(el => {
    const m = /stroke-width:\s*([\d.]+)px/.exec(el.getAttribute('style'));
    if (m && +m[1] > 0 && +m[1] < upp * .9) el.style.strokeWidth = (upp * .9) + 'px';
  });
  const xml = new XMLSerializer().serializeToString(clone);
  const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);
  return new Promise(res => {
    const img = new Image();
    img.onload = () => {
      try {
        const c = document.createElement('canvas'); c.width = W; c.height = H;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, W, H);
        const d = ctx.getImageData(0, 0, W, H), px = d.data;
        // bordes duros: cada píxel, opaco o vacío
        const solid = new Uint8Array(W * H);
        for (let i = 0; i < W * H; i++) {
          const a = px[i * 4 + 3];
          if (a >= 110) {
            // (el color de un píxel a medias, sin premultiplicar: no se oscurece)
            solid[i] = 1; px[i * 4 + 3] = 255;
          } else px[i * 4 + 3] = 0;
        }
        // contorno oscuro de un píxel alrededor de la silueta
        if (!svg.matches('.mArt > svg, svg.ndArt, svg.face')) {
          for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
            const i = y * W + x;
            if (solid[i]) continue;
            if ((x > 0 && solid[i - 1]) || (x < W - 1 && solid[i + 1]) || (y > 0 && solid[i - W]) || (y < H - 1 && solid[i + W])) {
              px[i * 4] = EDGE[0]; px[i * 4 + 1] = EDGE[1]; px[i * 4 + 2] = EDGE[2]; px[i * 4 + 3] = 255;
            }
          }
        }
        ctx.putImageData(d, 0, 0);
        res({ url: c.toDataURL(), pad });
      } catch (e) { res(null); }
    };
    img.onerror = () => res(null);
    img.src = url;
  });
}

function apply(svg, r) {
  if (!r) { svg.classList.add('pxFail'); return; }
  const fit = (svg.getAttribute('preserveAspectRatio') || '').includes('slice') ? 'cover'
    : (svg.getAttribute('preserveAspectRatio') || '').includes('none') ? '100% 100%' : 'contain';
  svg.style.backgroundImage = `url("${r.url}")`;
  svg.style.backgroundSize = fit;
  svg.classList.add('pxOn');
  svg.classList.toggle('pxPad', r.pad > 0);
}

function process(svg) {
  if (!svg.isConnected) return;
  const g = gridOf(svg), key = keyOf(svg, g);
  if (svg.__pxKey === key) return;
  svg.__pxKey = key;
  let p = cache.get(key);
  if (p && p.done) { apply(svg, p.value); return; }
  if (!p) {
    p = rasterize(svg, g).then(v => { p.done = true; p.value = v; return v; });
    cache.set(key, p);
    if (cache.size > 600) cache.delete(cache.keys().next().value);
  }
  p.then(v => { if (svg.__pxKey === key) apply(svg, v); });
}

function scan(root) {
  if (root.nodeType !== 1) return;
  if (root.matches?.(SEL)) process(root);
  root.querySelectorAll?.(SEL).forEach(process);
  // (un cambio dentro de un SVG ya procesado: se vuelve a pintar entero)
  const host = root.closest?.(SEL);
  if (host && host !== root) process(host);
}

let observer = null;
export function startPixelize() {
  document.documentElement.classList.add('px');
  scan(document.body);
  observer ||= new MutationObserver(list => {
    for (const m of list) {
      if (m.type === 'childList') { m.addedNodes.forEach(scan); if (m.target.closest?.(SEL)) scan(m.target); }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}
// vuelta al estilo original: cada SVG recupera su dibujo
export function stopPixelize() {
  observer?.disconnect();
  document.documentElement.classList.remove('px');
  document.querySelectorAll('svg.pxOn, svg.pxFail').forEach(svg => {
    svg.classList.remove('pxOn', 'pxPad', 'pxFail');
    svg.style.backgroundImage = ''; svg.style.backgroundSize = '';
    delete svg.__pxKey;
  });
}
