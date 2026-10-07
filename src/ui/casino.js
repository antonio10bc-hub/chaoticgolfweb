// Estilo visual (Ajustes → Estilo): el original (por defecto) o "Salón pixel": la clase html.casino activa
// styles/casino.css y las variables de styles/base.css, y aquí se encienden el tapete animado con la tele CRT
// (src/fx/casino-bg.js) y el pixel art de las ilustraciones (src/ui/pixelize.js). Al volver al original se
// apaga todo y las ilustraciones recuperan su dibujo.
import { startCasinoBg, stopCasinoBg } from '../fx/casino-bg.js';
import { startPixelize, stopPixelize } from './pixelize.js';

let on = false;
export const casinoOn = () => on;

export function setCasinoStyle(v) {
  v = !!v;
  if (v === on) return; // (src/boot-watch.js ya puede haber puesto la clase antes de arrancar: aquí se enciende el resto)
  on = v;
  document.documentElement.classList.toggle('casino', v);
  if (v) { startCasinoBg(); startPixelize(); }
  else { stopCasinoBg(); stopPixelize(); }
}
