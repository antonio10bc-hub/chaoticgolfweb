// Ultimate, el combinador: la combinación de barajas que está activada (se recuerda en este dispositivo), el historial de
// combinaciones jugadas (una fila por combinación, con su balance) y compartirlas: un enlace (…#ultimate=CÓDIGO) con la
// combinación y el mismo reparto (la semilla, los rivales y la dificultad de la última partida), para jugar exactamente la
// misma partida. Las combinaciones recibidas por enlace también entran en el historial, marcadas.
import { app } from './app.js';
import { $, esc } from './dom.js';
import { t, getLang } from '../i18n/index.js';
import { ALL_COMBO, ULT_DECKS, comboIds, comboSize, validCombo, deckById, comboCode, parseComboCode } from '../content/decks.js';
export { comboCode, parseComboCode };
import { toast } from './hud.js';

const KEY = 'chaoticgolf_ultimate';
const load = () => { try { const d = JSON.parse(localStorage.getItem(KEY)); return d && typeof d === 'object' ? d : {}; } catch (e) { return {}; } };
const save = d => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { /* sin storage */ } };

/* ---------- la combinación activada ---------- */
export const currentCombo = () => { const m = load().combo; return validCombo(m) ? m : ALL_COMBO; };
export function setCombo(mask) { if (!validCombo(mask)) return; const d = load(); d.combo = mask; save(d); app.pveCfg.combo = mask; }
// activar / desactivar una baraja (siempre queda al menos una): devuelve la nueva o null si no se puede
export function toggleDeck(id) {
  const bit = 1 << ULT_DECKS.indexOf(id), m = currentCombo() ^ bit;
  if (!m) return null;
  setCombo(m);
  return m;
}
export const comboLabel = mask => { const s = comboSize(mask); return t('ult.size', { c: s.cols, r: s.rows, par: s.par }); };

/* ---------- historial ---------- */
// una partida nueva con esta combinación (cfg: la de la partida, para poder compartir el mismo reparto)
export function recordCombo(mask, { seed, opps, diff, recv = false } = {}) {
  if (!validCombo(mask)) return;
  const d = load(), h = d.history ||= {}, e = h[mask] ||= { p: 0, w: 0 };
  e.p++; e.last = Date.now();
  if (seed != null) Object.assign(e, { seed, opps, diff });
  if (recv) e.recv = true;
  save(d);
}
export function comboWon(mask) {
  const d = load(), e = d.history?.[mask];
  if (!e) return;
  e.w = (e.w || 0) + 1;
  save(d);
}
export const comboHistory = () => Object.entries(load().history || {}).map(([m, e]) => ({ mask: +m, ...e })).sort((a, b) => (b.last || 0) - (a.last || 0));

/* ---------- compartir ---------- */
const comboLink = e => location.origin + location.pathname + '#ultimate=' + comboCode(e);
async function shareCombo(e) {
  const link = comboLink(e);
  try { await navigator.clipboard.writeText(link); toast(t('ult.copied')); }
  catch (err) { prompt(t('ult.copyPrompt'), link); }
}
// el enlace con la que han compartido: (…#ultimate=CÓDIGO) → la partida, tal cual
export function takeComboLink() {
  const m = /^#ultimate=([\w.]+)$/.exec(location.hash);
  if (!m) return null;
  try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* sin history */ }
  return parseComboCode(m[1]);
}

/* ---------- la ventana del historial ---------- */
// deckArt: el icono de cada baraja (lo pone Modos de juego) · onPick(mask): activar esa combinación · onPlay(e): jugarla
export function openComboHistory({ deckArt, onPick }) {
  const dlg = $('dialog'), rows = comboHistory();
  const date = ts => ts ? new Date(ts).toLocaleDateString(getLang() === 'es' ? 'es-ES' : 'en-GB', { day: 'numeric', month: 'short' }) : '';
  const row = e => `<li class="ultRow"><button type="button" class="ultPick" data-pick="${e.mask}" title="${esc(t('ult.pick'))}">` +
    `<span class="ultIcons">${comboIds(e.mask).map(id => `<i title="${esc(t('decks.' + id + '.name'))}">${deckArt(deckById(id))}</i>`).join('')}</span>` +
    `<span class="ultInfo"><b>${esc(t(e.p === 1 ? 'ult.record1' : 'ult.record', { p: e.p, w: e.w || 0 }))}</b><small>${esc(comboLabel(e.mask))} · ${esc(date(e.last))}${e.recv ? ` · <em>${esc(t('ult.received'))}</em>` : ''}</small></span></button>` +
    (e.seed != null ? `<button type="button" class="btn-light btn-sm ultShare" data-share="${e.mask}"><svg class="i" aria-hidden="true"><use href="#i-share"/></svg>${esc(t('ult.share'))}</button>` : '') + `</li>`;
  dlg.innerHTML = `<form method="dialog" class="dlgBox ultHistory"><h3>${esc(t('ult.historyTitle'))}</h3>` +
    (rows.length ? `<p class="ultLead">${esc(t('ult.historyLead'))}</p><ul class="ultList">${rows.map(row).join('')}</ul>` : `<p class="ultLead">${esc(t('ult.historyEmpty'))}</p>`) +
    `<div class="dlgBtns"><button value="ok" class="btn-primary">${esc(t('common.close'))}</button></div></form>`;
  dlg.onclick = e => {
    const pk = e.target.closest('[data-pick]'), sh = e.target.closest('[data-share]');
    if (sh) { e.preventDefault(); shareCombo(rows.find(r => r.mask === +sh.dataset.share)); return; }
    if (pk) { e.preventDefault(); onPick(+pk.dataset.pick); dlg.close('ok'); }
  };
  dlg.addEventListener('close', () => { dlg.onclick = null; }, { once: true });
  dlg.returnValue = '';
  dlg.showModal();
  dlg.querySelector('.ultPick, button[value="ok"]')?.focus();
}
