// Menú de depuración del fondo de los menús: el color (selector de colores), el tamaño de las pelotas de la trama y la
// velocidad a la que se desliza (0: quieta). Se abre con …/#fondo o con Alt+Mayús+B; los cambios se ven en directo, se
// recuerdan en este navegador (chaoticgolf_bgDebug) y "Copiar valores" los deja en el portapapeles para fijarlos en
// styles/screens.css. Cambia las variables --menu-bg, --ballTile, --ballDur y --ballPlay (styles/screens.css).
import { toast } from './hud.js';

const KEY = 'chaoticgolf_bgDebug', TILE = 132;
export const BG_DEFAULT = { color: '#5B4BA8', size: 15, speed: +(TILE / 16).toFixed(2) }; // (size: radio de la pelota; speed: px/s)
const load = () => { try { return { ...BG_DEFAULT, ...JSON.parse(localStorage.getItem(KEY)) }; } catch (e) { return { ...BG_DEFAULT }; } };
const save = v => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { /* sin storage */ } };

// la baldosa de la trama: dos pelotas al tresbolillo con sus hoyuelos, del radio pedido
export function ballTile(r) {
  const k = r / 15, dimples = [[-6, -5], [1, -8], [7, -3], [-4, 3], [4, 5]];
  const ball = (cx, cy) => `<circle cx='${cx}' cy='${cy}' r='${r}'/>`;
  const dots = (cx, cy) => dimples.map(([x, y]) => `<circle cx='${(cx + x * k).toFixed(1)}' cy='${(cy + y * k).toFixed(1)}' r='${(1.7 * k).toFixed(2)}'/>`).join('');
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${TILE}' height='${TILE}'><g fill='%23F1F1DC' fill-opacity='.055'>${ball(33, 33)}${ball(99, 99)}</g>` +
    `<g fill='%23000' fill-opacity='.14'>${dots(33, 33)}${dots(99, 99)}</g></svg>`;
  return `url("data:image/svg+xml;utf8,${svg}")`;
}
export function applyBg(v = load()) {
  const st = document.documentElement.style;
  st.setProperty('--menu-bg', v.color);
  if (v.size !== BG_DEFAULT.size) st.setProperty('--ballTile', ballTile(v.size)); else st.removeProperty('--ballTile');
  st.setProperty('--ballDur', v.speed > 0 ? (TILE / v.speed).toFixed(2) + 's' : '16s');
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
