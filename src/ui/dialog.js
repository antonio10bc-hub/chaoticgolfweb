// Diálogos modales propios (<dialog>) en lugar de prompt()/confirm() del navegador.
import { $, esc } from './dom.js';
import { t } from '../i18n/index.js';

function open({ title, body, buttons }) {
  return new Promise(resolve => {
    const dlg = $('dialog');
    dlg.innerHTML = `<form method="dialog" class="dlgBox">
      ${title ? `<h3>${esc(title)}</h3>` : ''}${body}
      <div class="dlgBtns">${buttons.map(b =>
        `<button value="${b.value}"${b.danger ? ' class="danger"' : ''}${b.type ? ` type="${b.type}"` : ''}>${esc(b.label)}</button>`).join('')}</div>
    </form>`;
    const done = () => { dlg.removeEventListener('close', done); resolve(dlg.returnValue); };
    dlg.addEventListener('close', done);
    dlg.returnValue = '';
    dlg.showModal();
    (dlg.querySelector('textarea, input') || dlg.querySelector('button'))?.focus();
  });
}

export async function confirmDialog(message, okLabel = t('common.ok'), danger = false) {
  const v = await open({ body: `<p>${esc(message)}</p>`, buttons: [
    { value: 'cancel', label: t('common.cancel') },
    { value: 'ok', label: okLabel, danger },
  ] });
  return v === 'ok';
}

// muestra un texto para copiar (y descargar) — exportar niveles
export async function showTextDialog(title, text, filename) {
  const v = await open({ title,
    body: `<textarea readonly rows="10">${esc(text)}</textarea>`,
    buttons: [
      { value: 'download', label: t('dialog.download') },
      { value: 'copy', label: t('dialog.copy') },
      { value: 'close', label: t('common.close') },
    ] });
  if (v === 'copy') {
    try { await navigator.clipboard.writeText(text); return 'copied'; } catch (e) { return 'copyFailed'; }
  }
  if (v === 'download') {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  return v;
}

// pide un texto (pegar JSON o cargar un archivo) — importar niveles
export async function askTextDialog(title, hint) {
  const v = await open({ title,
    body: `<p class="dlgHint">${esc(hint)}</p><textarea rows="10" id="dlgText"></textarea>
      <label class="dlgFile">${esc(t('dialog.fromFile'))} <input type="file" accept=".json,application/json" id="dlgFile"></label>`,
    buttons: [
      { value: 'cancel', label: t('common.cancel') },
      { value: 'ok', label: t('dialog.import') },
    ] });
  return v === 'ok' ? $('dlgText')?.value ?? '' : null;
}

export function bindDialog() {
  // cargar un archivo rellena el área de texto
  $('dialog').addEventListener('change', async e => {
    if (e.target.id !== 'dlgFile' || !e.target.files[0]) return;
    $('dlgText').value = await e.target.files[0].text();
  });
}
