// Foil holográfico (styles/holo.css): en el ordenador, el brillo y el espectro de las cartas .holo siguen al puntero y
// la carta se inclina hacia él (máx. 4°): --hx/--hy (de -1 a 1), --mx/--my (el centro del cónico) y --rx/--ry; un
// fotograma por movimiento como mucho. En el móvil o sin puntero fino, nada: allí el foil deriva solo. Con movimiento
// reducido, tampoco. El fondo de la partida (.holo--subtle) nunca reacciona. Al arrancar genera el brillo
// (--holo-specular).
const r3 = n => +n.toFixed(3);
// un trazo de luz como campana (gaussiana) de un color: muchas paradas suaves en lugar de una dura, que en diagonal se
// pinta a escalones. c: centro y s: anchura (sigma), en % de la línea del degradado; a: opacidad en el centro
function bell(rgb, c, s, a) {
  const stops = [];
  for (let i = -14; i <= 14; i++) { const d = i / 14 * 3.2 * s; stops.push(`rgba(${rgb},${r3(a * Math.exp(-((d / s) ** 2) / 2))}) ${r3(c + d)}%`); }
  return `linear-gradient(125deg, transparent ${r3(c - 3.2 * s)}%, ${stops.join(', ')}, transparent ${r3(c + 3.2 * s)}%)`;
}
// el brillo: una luz ancha y suave, sin trazo blanco, con el espectro fundido a los lados (cielo, rosa | mantequilla, menta)
const W = '255,255,255';
export const HOLO_SPECULAR = [bell(W, 50, 7, .34), bell('245,191,214', 45.5, 2.8, .26), bell('166,214,240', 41, 3.4, .22),
  bell('251,234,166', 54.5, 2.8, .26), bell('201,239,207', 59, 3.4, .22)].join(', ');
const still = () => document.documentElement.classList.contains('reduceMotion') || matchMedia('(prefers-reduced-motion: reduce)').matches;

export function bindHolo() {
  document.documentElement.style.setProperty('--holo-specular', HOLO_SPECULAR);
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  let live = null, last = null, raf = 0;
  const reset = el => { el.classList.remove('is-live'); ['--hx', '--hy', '--mx', '--my', '--rx', '--ry'].forEach(k => el.style.removeProperty(k)); };
  const paint = () => {
    raf = 0;
    if (!live || !last) return;
    const r = live.getBoundingClientRect(), x = Math.min(1, Math.max(0, (last.clientX - r.left) / r.width)), y = Math.min(1, Math.max(0, (last.clientY - r.top) / r.height));
    const st = live.style, hx = x * 2 - 1, hy = y * 2 - 1;
    st.setProperty('--hx', hx.toFixed(3)); st.setProperty('--hy', hy.toFixed(3));
    st.setProperty('--mx', (x * 100).toFixed(1) + '%'); st.setProperty('--my', (y * 100).toFixed(1) + '%');
    st.setProperty('--rx', (-hy * 3).toFixed(2) + 'deg'); st.setProperty('--ry', (hx * 4).toFixed(2) + 'deg');
  };
  document.addEventListener('pointermove', e => {
    const el = e.pointerType === 'mouse' && !still() ? e.target.closest?.('.holo:not(.holo--subtle)') : null;
    if (live && live !== el) reset(live);
    live = el; last = e;
    if (!el) return;
    el.classList.add('is-live');
    if (!raf) raf = requestAnimationFrame(paint);
  }, { passive: true });
  document.addEventListener('pointerleave', () => { if (live) reset(live); live = null; });
}
