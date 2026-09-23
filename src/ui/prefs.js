// Preferencias del jugador (pantalla de Ajustes): velocidad, tema del campo,
// accesibilidad y pista de música. Se guardan en localStorage y se aplican al arrancar.
import { SPEEDS, setSpeed, setReduced } from '../fx/juice.js';

const KEY = 'chaoticgolf_prefs';
export const THEMES = ['classic', 'autumn', 'snow', 'night'];
export const TRACKS = ['auto', 'fairway', 'breeze', 'lounge'];
const DEFAULTS = { speed: 'normal', theme: 'classic', reduce: false, shapes: false, hints: true, track: 'auto' };

export const prefs = { ...DEFAULTS };

export function loadPrefs() {
  try { Object.assign(prefs, JSON.parse(localStorage.getItem(KEY)) || {}); } catch (e) { /* sin storage */ }
  if (!SPEEDS[prefs.speed]) prefs.speed = 'normal';
  if (!THEMES.includes(prefs.theme)) prefs.theme = 'classic';
  if (!TRACKS.includes(prefs.track)) prefs.track = 'auto';
  applyPrefs();
}
export function setPref(k, v) {
  prefs[k] = v;
  try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch (e) { /* sin storage */ }
  applyPrefs();
}
export function applyPrefs() {
  setSpeed(SPEEDS[prefs.speed]);
  setReduced(prefs.reduce);
  const root = document.documentElement;
  root.dataset.course = prefs.theme;                // colores del campo (styles/themes.css)
  root.classList.toggle('cbShapes', !!prefs.shapes); // formas por jugador en bolas y avatares
}
