// Preferencias del jugador (pantalla de Ajustes): velocidad, tema del campo,
// accesibilidad y pista de música. Se guardan en localStorage y se aplican al arrancar.
import { SPEEDS, setSpeed, setReduced, SPEED } from '../fx/juice.js';

const KEY = 'chaoticgolf_prefs';
export const THEMES = ['classic', 'autumn', 'snow', 'night'];
export const TRACKS = ['auto', 'fairway', 'breeze', 'lounge'];
const DEFAULTS = {
  speed: 'normal', theme: 'classic', reduce: false, shapes: false, hints: true, track: 'auto',
  botFast: false,     // acelerar solo los turnos de la máquina
  bigText: false,     // interfaz con texto grande
  contrast: false,    // alto contraste
  leftHand: false,    // botones de turno a la izquierda (zurdos)
};

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
// todo a los valores de fábrica (el idioma y el perfil no se tocan)
export function resetPrefs() {
  Object.assign(prefs, DEFAULTS);
  try { localStorage.removeItem(KEY); } catch (e) { /* sin storage */ }
  applyPrefs();
}

// ritmo efectivo: la velocidad elegida y, si se pide, x2 mientras juega la máquina
let botTempo = false;
export function setBotTempo(on) {
  botTempo = !!on;
  const mult = SPEEDS[prefs.speed] * (botTempo && prefs.botFast ? .5 : 1);
  if (mult !== SPEED) setSpeed(mult);
}

export function applyPrefs() {
  setSpeed(SPEEDS[prefs.speed]);
  setBotTempo(botTempo);
  setReduced(prefs.reduce);
  const root = document.documentElement;
  root.dataset.course = prefs.theme;                   // colores del campo (styles/themes.css)
  root.classList.toggle('cbShapes', !!prefs.shapes);   // formas por jugador en bolas y avatares
  root.classList.toggle('bigText', !!prefs.bigText);   // texto grande en la interfaz
  root.classList.toggle('hiContrast', !!prefs.contrast);
  root.classList.toggle('leftHand', !!prefs.leftHand);
}
