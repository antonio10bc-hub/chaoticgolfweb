// Diálogos modales propios (<dialog>) en lugar de prompt()/confirm() del navegador.
import { $, esc } from './dom.js';
import { t } from '../i18n/index.js';

// diálogo con el cuerpo y los botones que se quieran (lo usan también Mis niveles y compartir)
export function openDialog(opts) { return open(opts); }
function open({ title, body, buttons, cls = '' }) {
  return new Promise(resolve => {
    const dlg = $('dialog');
    dlg.innerHTML = `<form method="dialog" class="dlgBox ${cls}">
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

// confirmación centrada (título opcional + mensaje + Cancelar / Aceptar)
export async function confirmDialog(message, okLabel = t('common.ok'), danger = false, title = '') {
  const v = await open({ title, cls: 'center', body: `<p>${esc(message)}</p>`, buttons: [
    { value: 'cancel', label: t('common.cancel') },
    { value: 'ok', label: okLabel, danger },
  ] });
  return v === 'ok';
}
