// ¿Móvil o tableta? La interfaz táctil (html.phone) se decide por el DISPOSITIVO, no por el ancho de la
// ventana: una ventana pequeña en el ordenador sigue con el diseño adaptable de siempre, y un móvil
// (o un iPad) tiene su propia partida: tablero al máximo y la interfaz superpuesta (styles/phone.css).
//   · automática: pantalla táctil sin ratón (móviles, tabletas, iPad con iPadOS)
//   · Ajustes → Interfaz la fuerza ('touch' / 'desktop'); ?ui=phone|desktop en la URL, solo esa carga
// La orientación la llevan las media queries de phone.css (vertical / horizontal).

const root = () => document.documentElement;

function touchDevice() {
  const ua = navigator.userAgent || '';
  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches && matchMedia('(hover: none)').matches;
  const ipad = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1; // iPadOS se presenta como un Mac
  const mobileUA = navigator.userAgentData?.mobile || /Android|iPhone|iPad|iPod|Mobile|Silk|Kindle/i.test(ua);
  return !!(coarse || ipad || mobileUA);
}

const urlChoice = (() => {
  try { const v = new URLSearchParams(location.search).get('ui'); return v === 'phone' ? 'touch' : v === 'desktop' ? 'desktop' : null; }
  catch (e) { return null; }
})();

// modo: 'auto' | 'touch' | 'desktop' (preferencia de Ajustes)
export function applyDevice(mode = 'auto') {
  const m = urlChoice || mode;
  const on = m === 'touch' || (m !== 'desktop' && touchDevice());
  root().classList.toggle('phone', on);
  // en táctil el contenido llega a los bordes (muesca, barra de gestos): phone.css deja los márgenes seguros
  const vp = document.querySelector('meta[name="viewport"]');
  if (vp) vp.content = 'width=device-width, initial-scale=1.0' + (on ? ', viewport-fit=cover' : '');
  return on;
}

export const isPhone = () => root().classList.contains('phone');
export const isPortrait = () => innerHeight >= innerWidth;
// Vibración breve (Android; iOS no la admite y no pasa nada)
export function buzz(ms = 12) {
  if (!isPhone() || !navigator.vibrate) return;
  try { navigator.vibrate(ms); } catch (e) { /* sin permiso */ }
}
