// Menú de depuración del fondo de los menús: el color base (selector de colores), la escala del mapa de curvas de nivel,
// lo que se marcan sus líneas y la velocidad a la que se desliza (0: quieto). Se abre con …/#fondo o con Alt+Mayús+B;
// los cambios se ven en directo, se recuerdan en este navegador (chaoticgolf_bgTopo) y "Copiar valores" los deja en el
// portapapeles para fijarlos aquí (BG_DEFAULT). Cambia --bg-base, --bg-tile, --bg-size y --bg-dur (styles/screens.css).
import { toast } from './hud.js';
import { topoTile } from './topo.js';

const KEY = 'chaoticgolf_bgTopo';
// (lines: opacidad de las curvas, en %, las maestras 1,6 veces más; speed: px/s, 4 = una vuelta cada 160 s)
export const BG_DEFAULT = { color: '#3F5A3A', scale: 640, lines: 5, speed: 4 };
const load = () => { try { return { ...BG_DEFAULT, ...JSON.parse(localStorage.getItem(KEY)) }; } catch (e) { return { ...BG_DEFAULT }; } };
const save = v => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { /* sin storage */ } };

let painted = '';
export function applyBg(v = load()) {
  const st = document.documentElement.style, tile = v.scale + '/' + v.lines;
  st.setProperty('--bg-base', v.color);
  if (tile !== painted) { painted = tile; st.setProperty('--bg-tile', topoTile({ size: v.scale, alpha: v.lines / 100 })); }
  st.setProperty('--bg-size', v.scale + 'px');
  st.setProperty('--bg-dur', v.speed > 0 ? (v.scale / v.speed).toFixed(1) + 's' : '0s');
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', v.color);
}

function open() {
  if (document.getElementById('bgDebug')) return;
  const v = load(), el = document.createElement('div');
  el.id = 'bgDebug'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Fondo (depuración)');
  el.innerHTML = `<header><b>Fondo</b><small>depuración</small><button type="button" data-bg="close" aria-label="Cerrar">✕</button></header>` +
    `<label><span>Color</span><input type="color" data-bg="color" value="${v.color}"><code data-bgv="color">${v.color}</code></label>` +
    `<label><span>Escala</span><input type="range" data-bg="scale" min="320" max="1200" step="40" value="${v.scale}"><code data-bgv="scale">${v.scale} px</code></label>` +
    `<label><span>Líneas</span><input type="range" data-bg="lines" min="0" max="12" step="0.5" value="${v.lines}"><code data-bgv="lines">${v.lines} %</code></label>` +
    `<label><span>Velocidad</span><input type="range" data-bg="speed" min="0" max="20" step="0.5" value="${v.speed}"><code data-bgv="speed">${v.speed} px/s</code></label>` +
    `<footer><button type="button" class="btn-light btn-sm" data-bg="copy">Copiar valores</button><button type="button" class="btn-text btn-sm" data-bg="reset">Restablecer</button></footer>`;
  document.body.appendChild(el);
  const cur = () => ({ color: el.querySelector('[data-bg="color"]').value.toUpperCase(), scale: +el.querySelector('[data-bg="scale"]').value, lines: +el.querySelector('[data-bg="lines"]').value, speed: +el.querySelector('[data-bg="speed"]').value });
  const paint = val => {
    el.querySelector('[data-bgv="color"]').textContent = val.color;
    el.querySelector('[data-bgv="scale"]').textContent = val.scale + ' px';
    el.querySelector('[data-bgv="lines"]').textContent = val.lines + ' %';
    el.querySelector('[data-bgv="speed"]').textContent = val.speed ? val.speed + ' px/s' : 'quieto';
  };
  paint(v);
  el.addEventListener('input', () => { const val = cur(); paint(val); applyBg(val); save(val); });
  el.addEventListener('click', async e => {
    const act = e.target.closest('[data-bg]')?.dataset.bg;
    if (act === 'close') el.remove();
    if (act === 'reset') {
      try { localStorage.removeItem(KEY); } catch (err) { /* sin storage */ }
      const d = { ...BG_DEFAULT };
      el.querySelector('[data-bg="color"]').value = d.color; el.querySelector('[data-bg="scale"]').value = d.scale; el.querySelector('[data-bg="lines"]').value = d.lines; el.querySelector('[data-bg="speed"]').value = d.speed;
      paint(d); applyBg(d);
    }
    if (act === 'copy') {
      const val = cur(), txt = `Fondo: color ${val.color} · escala ${val.scale} px · líneas ${val.lines} % · velocidad ${val.speed} px/s (${val.speed ? Math.round(val.scale / val.speed) + ' s por vuelta' : 'quieto'})`;
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
