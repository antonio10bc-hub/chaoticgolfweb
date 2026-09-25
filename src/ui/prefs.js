// Preferencias del jugador (pantalla de Ajustes): velocidad, tema del campo,
// accesibilidad y pista de música. Se guardan en localStorage y se aplican al arrancar.
import { SPEEDS, setSpeed, setReduced, SPEED } from '../fx/juice.js';

const KEY = 'chaoticgolf_prefs';
export const THEMES = ['classic', 'autumn', 'snow', 'night', 'ocean', 'ember', 'sunset'];
// cada modo tiene su color de campo por defecto para reconocerlo de un vistazo (se puede cambiar
// en Ajustes y cada modo recuerda el suyo): contrarreloj azul, desafíos rojo, reto diario naranja
// y el resto (Lo básico, partida rápida…) verde
export const MODE_THEME = { rush: 'ocean', challenge: 'ember', weekly: 'ember', daily: 'sunset' };
export const TRACKS = ['auto', 'fairway', 'breeze', 'lounge'];
const DEFAULTS = {
  speed: 'normal', theme: 'classic', themes: {}, reduce: false, shapes: false, hints: true, track: 'auto',
  botFast: false,     // acelerar solo los turnos de la máquina
  bigText: false,     // interfaz con texto grande
  contrast: false,    // alto contraste
  leftHand: false,    // botones de turno a la izquierda (zurdos)
  caddie: true,       // botón de consejo del caddie en la partida
};

export const prefs = { ...DEFAULTS };

export function loadPrefs() {
  try { Object.assign(prefs, JSON.parse(localStorage.getItem(KEY)) || {}); } catch (e) { /* sin storage */ }
  if (!SPEEDS[prefs.speed]) prefs.speed = 'normal';
  if (!THEMES.includes(prefs.theme)) prefs.theme = 'classic';
  prefs.themes = Object.fromEntries(Object.entries(prefs.themes || {}).filter(([k, v]) => MODE_THEME[k] && THEMES.includes(v)));
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

// tema del campo del modo en pantalla ('default' = Lo básico, partida rápida, editor…)
let courseSlot = 'default';
export const themeFor = slot => MODE_THEME[slot] ? prefs.themes[slot] || MODE_THEME[slot] : prefs.theme;
export const currentTheme = () => themeFor(courseSlot);
export const currentThemeSlot = () => courseSlot;
export function setCourseSlot(slot) {
  const s = MODE_THEME[slot] ? slot : 'default';
  if (s === courseSlot) return;
  courseSlot = s;
  applyPrefs();
}
// elegir tema en Ajustes: se guarda para el modo en pantalla
export function setTheme(th) {
  if (courseSlot === 'default') setPref('theme', th);
  else setPref('themes', { ...prefs.themes, [courseSlot]: th });
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
  root.dataset.course = currentTheme();                // colores del campo del modo (styles/themes.css)
  root.classList.toggle('cbShapes', !!prefs.shapes);   // formas por jugador en bolas y avatares
  root.classList.toggle('bigText', !!prefs.bigText);   // texto grande en la interfaz
  root.classList.toggle('hiContrast', !!prefs.contrast);
  root.classList.toggle('leftHand', !!prefs.leftHand);
}
