// i18n mínimo: t('clave.anidada', { param }) con sustitución de {param}.
// Añadir un idioma = copiar es.js a otro archivo y registrarlo en LANGS.
import es from './es.js';

const LANGS = { es };
let dict = es;
let lang = 'es';

export function setLang(code) {
  if (LANGS[code]) { dict = LANGS[code]; lang = code; }
}
export const getLang = () => lang;

const lookup = key => key.split('.').reduce((o, k) => (o == null ? o : o[k]), dict);

export function t(key, params) {
  const s = lookup(key);
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
