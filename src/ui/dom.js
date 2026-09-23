// Acceso al DOM centralizado: nada de variables globales implícitas por id.
export const $ = id => document.getElementById(id);
export const $$ = (sel, root = document) => root.querySelectorAll(sel);

export const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// reinicia una animación CSS de clase (quitar → reflow → poner)
export function restartClass(el, cls) {
  if (!el) return;
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

export const wait = ms => new Promise(r => setTimeout(r, ms));
