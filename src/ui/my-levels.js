// Mis niveles: la lista de niveles del creador, propios y recibidos. Guardar, eliminar (con
// deshacer: no hay diálogo de confirmación), compartir por código o enlace y recibir un nivel
// (pegando el código o abriendo un enlace …#nivel=CÓDIGO). La usan el creador y "Tus niveles".
import { app } from './app.js';
import { esc } from './dom.js';
import { t } from '../i18n/index.js';
import { loadLevels, saveLevels, loadProgress, saveProgress } from '../storage.js';
import { updateRecords } from './records.js';
import { encodeLevel, decodeLevel, levelLink, levelKey, LINK_KEY } from '../content/levels/share.js';
import { openDialog } from './dialog.js';
import { toast, actionToast } from './hud.js';
import { sfx } from '../audio/sfx.js';
import { levelPreviewSVG } from './screen-story.js';

export const listLevels = () => loadLevels();

// guarda el nivel en su sitio (idx) o al final; devuelve dónde ha quedado
export function storeLevel(L, idx = null) {
  const levels = loadLevels(), copy = { ...JSON.parse(JSON.stringify(L)), at: Date.now() };
  if (idx != null && idx < levels.length) levels[idx] = { ...copy, origin: levels[idx].origin || copy.origin };
  else { levels.push(copy); idx = levels.length - 1; }
  saveLevels(levels);
  return idx;
}

// claves que se tocan al eliminar (para poder deshacerlo tal cual)
const RAW_KEYS = ['chaoticgolf_levels', 'chaoticgolf_progress', 'chaoticgolf_stats', 'chaoticgolf_save_story'];
const rawGet = () => Object.fromEntries(RAW_KEYS.map(k => { try { return [k, localStorage.getItem(k)]; } catch (e) { return [k, null]; } }));
const rawSet = snap => { for (const [k, v] of Object.entries(snap)) try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) { /* sin storage */ } };

// elimina el nivel j; el progreso, los récords y el nivel a medias de los siguientes se renumeran.
// Devuelve la función que lo deshace
export function deleteLevelAt(j) {
  const snap = rawGet(), levels = loadLevels();
  if (!levels[j]) return () => {};
  levels.splice(j, 1);
  saveLevels(levels);
  const gi = app.storyLevels.length + j; // índice global (los integrados van delante)
  const shift = obj => { const out = {}; for (const [k, v] of Object.entries(obj || {})) { const i = +k; if (i < gi) out[i] = v; else if (i > gi) out[i - 1] = v; } return out; };
  saveProgress(shift(loadProgress()));
  updateRecords(d => { d.levels = shift(d.levels); });
  try {
    const sv = JSON.parse(localStorage.getItem('chaoticgolf_save_story'));
    if (sv && sv.levelIndex === gi) localStorage.removeItem('chaoticgolf_save_story');
    else if (sv && sv.levelIndex > gi) { sv.levelIndex--; localStorage.setItem('chaoticgolf_save_story', JSON.stringify(sv)); }
  } catch (e) { /* sin guardado */ }
  return () => rawSet(snap);
}

// elimina con aviso "Deshacer"; after() repinta quien lo haya pedido (también al deshacer)
export function deleteWithUndo(j, after) {
  const L = loadLevels()[j];
  if (!L) return;
  const undo = deleteLevelAt(j);
  sfx('card');
  after?.({ deleted: j });
  actionToast(t('lib.deleted', { name: L.name || t('story.untitled') }), t('lib.undo'), () => { undo(); after?.({ restored: j }); });
}

// un nivel recibido: se guarda (si no lo tenías ya) y devuelve su posición
export function receiveLevel(L) {
  const levels = loadLevels(), key = levelKey(L);
  const dup = levels.findIndex(x => levelKey(x) === key);
  if (dup >= 0) return { idx: dup, dup: true };
  return { idx: storeLevel({ ...L, origin: 'received' }), dup: false };
}

const sizeLabel = L => {
  const par = L.parCells?.length ? Math.max(...L.parCells.map(p => p.n)) : 0;
  return t('lib.size', { c: L.cols, r: L.rows }) + (par ? ' · PAR ' + par : '');
};
const previewBlock = L => `<div class="lvShare"><span class="lvPrev">${levelPreviewSVG(L)}</span>` +
  `<span class="lvMeta"><b>${esc(L.name || t('story.untitled'))}</b><small>${esc(sizeLabel(L))}</small></span></div>`;

async function copy(text, okKey) {
  try { await navigator.clipboard.writeText(text); toast(t(okKey)); sfx('select'); } catch (e) { toast(t('lib.copyFailed'), 'warn'); }
}

// compartir: el código (y el enlace) para copiar, o la hoja de compartir del sistema
export async function shareLevelDialog(L) {
  const code = await encodeLevel(L), link = levelLink(code);
  const canShare = typeof navigator.share === 'function';
  const p = openDialog({ title: t('lib.shareTitle'), cls: 'lvDlg', body: previewBlock(L) +
    `<p class="dlgHint">${esc(t('lib.shareHint'))}</p>` +
    `<div class="lvCode"><input readonly id="lvCode" value="${esc(code)}" aria-label="${esc(t('lib.codeLabel'))}">` +
    `<button type="button" class="btn-light" data-copy="code"><svg class="i" aria-hidden="true"><use href="#i-copy"/></svg>${esc(t('lib.copyCode'))}</button></div>` +
    `<div class="lvCode"><input readonly id="lvLink" value="${esc(link)}" aria-label="${esc(t('lib.linkLabel'))}">` +
    `<button type="button" class="btn-light" data-copy="link"><svg class="i" aria-hidden="true"><use href="#i-copy"/></svg>${esc(t('lib.copyLink'))}</button></div>`,
    buttons: [...(canShare ? [{ value: 'share', label: t('lib.shareSys') }] : []), { value: 'close', label: t('common.close') }] });
  const box = document.getElementById('dialog');
  box.querySelector('[data-copy="code"]').addEventListener('click', () => copy(code, 'lib.codeCopied'));
  box.querySelector('[data-copy="link"]').addEventListener('click', () => copy(link, 'lib.linkCopied'));
  box.querySelectorAll('.lvCode input').forEach(i => i.addEventListener('focus', () => i.select()));
  if (await p === 'share') {
    try { await navigator.share({ title: L.name || 'Chaotic Golf', text: t('lib.shareText', { name: L.name || t('story.untitled') }), url: link }); } catch (e) { /* cancelado */ }
  }
}

// pegar un código recibido: devuelve la posición del nivel guardado (o null)
export async function addCodeDialog() {
  const v = await openDialog({ title: t('lib.addTitle'), cls: 'lvDlg',
    body: `<p class="dlgHint">${esc(t('lib.addHint'))}</p><textarea rows="4" id="lvPaste" spellcheck="false" placeholder="CG1…"></textarea>`,
    buttons: [{ value: 'cancel', label: t('common.cancel') }, { value: 'ok', label: t('lib.addOk') }] });
  if (v !== 'ok') return null;
  const L = await decodeLevel(document.getElementById('lvPaste')?.value || '');
  if (!L) { toast(t('lib.badCode'), 'warn'); return null; }
  const r = receiveLevel(L);
  toast(t(r.dup ? 'lib.already' : 'lib.added', { name: L.name || t('story.untitled') }));
  return r.idx;
}

// enlace con un nivel (…#nivel=CÓDIGO): se ofrece guardarlo. onPlay(idx) si elige jugarlo ya
export async function checkLinkLevel(onPlay) {
  const m = new RegExp('[#&?]' + LINK_KEY + '=([^&]+)').exec(location.hash || '');
  if (!m) return;
  try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* sin history */ }
  const L = await decodeLevel(decodeURIComponent(m[1]));
  if (!L) { toast(t('lib.badCode'), 'warn'); return; }
  const v = await openDialog({ title: t('lib.gotTitle'), cls: 'lvDlg', body: previewBlock(L) + `<p class="dlgHint">${esc(t('lib.gotHint'))}</p>`,
    buttons: [{ value: 'no', label: t('lib.notNow') }, { value: 'save', label: t('lib.save') }, { value: 'play', label: t('lib.saveAndPlay') }] });
  if (v !== 'save' && v !== 'play') return;
  const r = receiveLevel(L);
  toast(t(r.dup ? 'lib.already' : 'lib.added', { name: L.name || t('story.untitled') }));
  if (v === 'play') onPlay?.(r.idx);
}

export { sizeLabel };
