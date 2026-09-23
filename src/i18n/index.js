// i18n mínimo: t('clave.anidada', { param }) con sustitución de {param}.
// Añadir un idioma = copiar es.js a otro archivo y registrarlo en LANGS.
// Si una clave no existe en el idioma activo, se usa la española.
import es from './es.js';
import en from './en.js';

export const LANGS = { es, en };
let dict = es;
let lang = 'es';
const LS_LANG = 'chaoticgolf_lang';
// zonas horarias de España (península, Ceuta/Melilla y Canarias)
const SPAIN_TZ = ['Europe/Madrid', 'Africa/Ceuta', 'Atlantic/Canary'];

export function setLang(code) {
  if (!LANGS[code]) return;
  dict = LANGS[code]; lang = code;
  if (typeof document !== 'undefined') document.documentElement.lang = code;
}
export const getLang = () => lang;

// idioma inicial: el elegido por el jugador; si no hay, español en España e inglés fuera
export function detectLang() {
  try { const saved = localStorage.getItem(LS_LANG); if (LANGS[saved]) return saved; } catch (e) { /* sin storage */ }
  let tz = '';
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { /* sin Intl */ }
  return SPAIN_TZ.includes(tz) ? 'es' : 'en';
}
export function saveLang(code) { try { localStorage.setItem(LS_LANG, code); } catch (e) { /* sin storage */ } }

const lookupIn = (d, key) => key.split('.').reduce((o, k) => (o == null ? o : o[k]), d);

export function t(key, params) {
  let s = lookupIn(dict, key);
  if (typeof s !== 'string' && dict !== es) s = lookupIn(es, key);
  if (typeof s !== 'string') return key; // clave ausente: se ve en pantalla y es fácil de detectar
  return params ? s.replace(/\{(\w+)\}/g, (m, k) => (params[k] !== undefined ? params[k] : m)) : s;
}

// lista "A y B y C" tal y como la escribía el juego original
export const joinAnd = items => items.join(t('common.and'));

// aplica los textos a los elementos con data-i18n / data-i18n-title / data-i18n-aria
export function applyStaticTexts(root = document) {
  root.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-html]').forEach(el => { el.innerHTML = t(el.dataset.i18nHtml); });
  root.querySelectorAll('[data-i18n-title]').forEach(el => { el.title = t(el.dataset.i18nTitle); });
  root.querySelectorAll('[data-i18n-aria]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
}
