// Menú de depuración del fondo de los menús: el color (selector de colores), el tamaño de las pelotas de la trama y la
// velocidad a la que se desliza (0: quieta). Se abre con …/#fondo o con Alt+Mayús+B; los cambios se ven en directo, se
// recuerdan en este navegador (chaoticgolf_bgDebug) y "Copiar valores" los deja en el portapapeles para fijarlos en
// styles/screens.css. Cambia las variables --menu-bg, --ballTile, --ballDur y --ballPlay (styles/screens.css).
import { toast } from './hud.js';

const KEY = 'chaoticgolf_bgDebug', TILE = 132;
export const BG_DEFAULT = { color: '#3F5A3A', size: 25, speed: 18 }; // (size: radio de la pelota; speed: px/s: 7,3 s por vuelta)
const load = () => { try { return { ...BG_DEFAULT, ...JSON.parse(localStorage.getItem(KEY)) }; } catch (e) { return { ...BG_DEFAULT }; } };
const save = v => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { /* sin storage */ } };

// la baldosa de la trama: dos pelotas de golf al tresbolillo, del radio pedido, planas como el menú: la bola, su media
// luna en sombra, los hoyuelos en una trama hexagonal (recortados a la bola) y un brillo pequeño
export function ballTile(r) {
  const f = n => +n.toFixed(2), d = r * .34, dr = r * .085, dots = [];
  for (let row = -4; row <= 4; row++) for (let col = -4; col <= 4; col++) {
    const x = (col + (row & 1 ? .5 : 0)) * d, y = row * d * .866;
    if (Math.hypot(x, y) < r * .92) dots.push(`<circle cx='${f(x)}' cy='${f(y)}' r='${f(dr * (1 - Math.hypot(x, y) / r * .35))}'/>`);
  }
  const ball = `<g id='b'><circle r='${r}' fill='%23F1F1DC' fill-opacity='.1'/>` +
    `<g clip-path='url(%23c)'><path fill-rule='evenodd' fill='%23000' fill-opacity='.08' d='M${-r} 0a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z` +
    `M${f(-r * 1.12)} ${f(-r * .16)}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z'/>` +
    `<g fill='%23000' fill-opacity='.13'>${dots.join('')}</g></g>` +
    `<ellipse cx='${f(-r * .4)}' cy='${f(-r * .44)}' rx='${f(r * .2)}' ry='${f(r * .12)}' transform='rotate(-35 ${f(-r * .4)} ${f(-r * .44)})' fill='%23F1F1DC' fill-opacity='.22'/></g>`;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${TILE}' height='${TILE}'><defs><clipPath id='c'><circle r='${r}'/></clipPath></defs>` +
    `<g transform='translate(33 33)'>${ball}</g><use href='%23b' x='99' y='99'/></svg>`;
  return `url("data:image/svg+xml;utf8,${svg}")`;
}
export function applyBg(v = load()) {
  const st = document.documentElement.style;
  st.setProperty('--menu-bg', v.color);
  if (v.size !== BG_DEFAULT.size) st.setProperty('--ballTile', ballTile(v.size)); else st.removeProperty('--ballTile'); // (la de siempre ya está en el CSS)
  st.setProperty('--ballDur', v.speed > 0 ? (TILE / v.speed).toFixed(2) + 's' : '7.33s');
  st.setProperty('--ballPlay', v.speed > 0 ? 'running' : 'paused');
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', v.color);
}

function open() {
  if (document.getElementById('bgDebug')) return;
  const v = load(), el = document.createElement('div');
  el.id = 'bgDebug'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Fondo (depuración)');
  el.innerHTML = `<header><b>Fondo</b><small>depuración</small><button type="button" data-bg="close" aria-label="Cerrar">✕</button></header>` +
    `<label><span>Color</span><input type="color" data-bg="color" value="${v.color}"><code data-bgv="color">${v.color}</code></label>` +
    `<label><span>Pelota</span><input type="range" data-bg="size" min="4" max="30" step="1" value="${v.size}"><code data-bgv="size">${v.size} px</code></label>` +
    `<label><span>Velocidad</span><input type="range" data-bg="speed" min="0" max="40" step="0.5" value="${v.speed}"><code data-bgv="speed">${v.speed} px/s</code></label>` +
    `<footer><button type="button" class="btn-light btn-sm" data-bg="copy">Copiar valores</button><button type="button" class="btn-text btn-sm" data-bg="reset">Restablecer</button></footer>`;
  document.body.appendChild(el);
  const cur = () => ({ color: el.querySelector('[data-bg="color"]').value.toUpperCase(), size: +el.querySelector('[data-bg="size"]').value, speed: +el.querySelector('[data-bg="speed"]').value });
  const paint = val => {
    el.querySelector('[data-bgv="color"]').textContent = val.color;
    el.querySelector('[data-bgv="size"]').textContent = val.size + ' px';
    el.querySelector('[data-bgv="speed"]').textContent = val.speed ? val.speed + ' px/s' : 'quieta';
  };
  paint(v);
  el.addEventListener('input', () => { const val = cur(); paint(val); applyBg(val); save(val); });
  el.addEventListener('click', async e => {
    const act = e.target.closest('[data-bg]')?.dataset.bg;
    if (act === 'close') el.remove();
    if (act === 'reset') {
      try { localStorage.removeItem(KEY); } catch (err) { /* sin storage */ }
      const d = { ...BG_DEFAULT };
      el.querySelector('[data-bg="color"]').value = d.color; el.querySelector('[data-bg="size"]').value = d.size; el.querySelector('[data-bg="speed"]').value = d.speed;
      paint(d); applyBg(d);
    }
    if (act === 'copy') {
      const val = cur(), txt = `Fondo: color ${val.color} · pelota ${val.size} px de radio · velocidad ${val.speed} px/s (${val.speed ? (TILE / val.speed).toFixed(1) + ' s por vuelta' : 'quieta'})`;
      try { await navigator.clipboard.writeText(txt); toast('Valores copiados'); } catch (err) { toast(txt); }
    }
  });
}

export function bindBgDebug() {
  applyBg();
  const fromHash = () => { if (location.hash === '#fondo') { open(); history.replaceState(null, '', location.pathname + location.search); } };
  fromHash();
  window.addEventListener('hashchange', fromHash);
  window.addEventListener('keydown', e => { if (e.altKey && e.shiftKey && e.code === 'KeyB') { e.preventDefault(); document.getElementById('bgDebug') ? document.getElementById('bgDebug').remove() : open(); } });
}
