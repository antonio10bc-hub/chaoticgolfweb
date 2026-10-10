// Mis niveles: la lista de niveles del creador, propios y recibidos. Guardar, eliminar (con
// deshacer: no hay diálogo de confirmación), compartir por código o enlace y recibir un nivel
// (pegando el código o abriendo un enlace …#nivel=CÓDIGO; ver también link-tabs.js). La usan el creador y "Tus niveles".
import { track } from './analytics.js';
import { esc } from './dom.js';
import { t } from '../i18n/index.js';
import { loadLevels, saveLevels, loadProgress, saveProgress } from '../storage.js';
import { updateRecords } from './records.js';
import { encodeLevel, decodeLevel, levelLink, levelKey } from '../content/levels/share.js';
import { openDialog, confirmDialog } from './dialog.js';
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
  const gi = j; // (su índice: el progreso y los récords de tus niveles van por él)
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
// eliminar un nivel: primero se confirma (y, aun así, el aviso deja deshacerlo)
export async function deleteWithUndo(j, after) {
  const L = loadLevels()[j];
  if (!L) return;
  const name = L.name || t('story.untitled');
  if (!await confirmDialog(t('lib.deleteConfirm', { name }), t('lib.delete'), true, t('lib.deleteTitle'))) return;
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

async function copy(text) {
  try { await navigator.clipboard.writeText(text); sfx('select'); return true; } catch (e) { toast(t('lib.copyFailed'), 'warn'); return false; }
}
const icon = id => `<svg class="i" aria-hidden="true"><use href="#${id}"/></svg>`;

// compartir: lo importante es el enlace (quien lo abre tiene el nivel listo para jugar); el código, debajo
// y en pequeño, por si prefieren pegarlo a mano. La confirmación sale en el propio botón
export async function shareLevelDialog(L) {
  track('compartir', { que: 'nivel' });
  const code = await encodeLevel(L), link = levelLink(code);
  const p = openDialog({ title: t('lib.shareTitle'), cls: 'lvDlg lvShareDlg', body: previewBlock(L) +
    `<div class="lvLinkBox"><p class="lvLead">${esc(t('lib.shareLead'))}</p>` +
    `<button type="button" class="btn-primary btn-lg lvCopyLink" data-copy="link">${icon('i-copy')}<span>${esc(t('lib.copyLink'))}</span></button>` +
    `<input readonly id="lvLink" class="lvField" value="${esc(link)}" aria-label="${esc(t('lib.linkLabel'))}" hidden></div>` + // (solo si no se puede copiar)
    `<div class="lvCodeBox"><span class="lvCodeHead"><b>${esc(t('lib.codeAlt'))}</b> ${esc(t('lib.codeHint'))}</span>` +
    `<span class="lvCode"><input readonly id="lvCode" class="lvField" value="${esc(code)}" aria-label="${esc(t('lib.codeLabel'))}">` +
    `<button type="button" class="lvCopyCode" data-copy="code" title="${esc(t('lib.copyCode'))}" aria-label="${esc(t('lib.copyCode'))}">${icon('i-copy')}</button></span></div>`,
    buttons: [{ value: 'close', label: t('common.close') }] });
  const box = document.getElementById('dialog');
  const linkBtn = box.querySelector('[data-copy="link"]'), codeBtn = box.querySelector('[data-copy="code"]');
  box.querySelectorAll('.lvField').forEach(i => i.addEventListener('focus', () => i.select()));
  const flash = (btn, html, ms = 2000) => {
    const was = btn.innerHTML;
    btn.classList.add('copied'); btn.innerHTML = html;
    clearTimeout(btn._t); btn._t = setTimeout(() => { btn.classList.remove('copied'); btn.innerHTML = was; }, ms);
  };
  linkBtn.addEventListener('click', async () => {
    if (linkBtn.classList.contains('copied')) return;
    if (await copy(link)) flash(linkBtn, icon('i-check') + `<span>${esc(t('lib.linkCopiedBtn'))}</span>`);
    else { const f = box.querySelector('#lvLink'); f.hidden = false; f.focus(); } // a mano
  });
  codeBtn.addEventListener('click', async () => { if (!codeBtn.classList.contains('copied') && await copy(code)) flash(codeBtn, icon('i-check')); });
  linkBtn.focus({ focusVisible: false }); // (el foco, en lo importante, no en el campo del código; sin aro al abrir)
  await p;
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

// si hay otro diálogo abierto (el enlace llega a una pestaña en uso), se cierra antes de abrir el del nivel
function freeDialog() {
  const dlg = document.getElementById('dialog');
  if (!dlg.open) return null;
  return new Promise(r => { dlg.addEventListener('close', () => setTimeout(r), { once: true }); dlg.close('cancel'); });
}

// enlace con un nivel (código de …#nivel=CÓDIGO): se ofrece guardarlo; onPlay(idx) si elige jugarlo ya.
// Si ya lo tenías guardado se avisa, y se puede guardar otra copia igualmente
let offering = null; // (el mismo enlace puede llegar a la vez por el hash y por launchQueue)
export async function offerLinkedLevel(code, onPlay) {
  if (!code || code === offering) return;
  offering = code;
  try {
    const L = await decodeLevel(decodeURIComponent(code));
    if (!L) { toast(t('lib.badCode'), 'warn'); return; }
    await freeDialog();
    const name = L.name || t('story.untitled'), key = levelKey(L);
    const saved = loadLevels().find(x => levelKey(x) === key);
    if (saved) {
      const other = (saved.name || '') !== (L.name || '') ? `<p class="dlgHint">${esc(t('lib.dupAs', { name: saved.name || t('story.untitled') }))}</p>` : '';
      const v = await openDialog({ title: t('lib.dupTitle'), cls: 'lvDlg', body: previewBlock(L) + other,
        buttons: [{ value: 'no', label: t('common.close') }, { value: 'copy', label: t('lib.saveAnyway') }] });
      if (v === 'copy') { storeLevel({ ...L, origin: 'received' }); toast(t('lib.added', { name })); }
      return;
    }
    const v = await openDialog({ title: t('lib.gotTitle'), cls: 'lvDlg', body: previewBlock(L) + `<p class="dlgHint">${esc(t('lib.gotHint'))}</p>`,
      buttons: [{ value: 'no', label: t('lib.notNow') }, { value: 'save', label: t('lib.save') }, { value: 'play', label: t('lib.saveAndPlay') }] });
    if (v !== 'save' && v !== 'play') return;
    const r = receiveLevel(L);
    toast(t(r.dup ? 'lib.already' : 'lib.added', { name }));
    if (v === 'play') onPlay?.(r.idx);
  } finally { offering = null; }
}

export { sizeLabel };
