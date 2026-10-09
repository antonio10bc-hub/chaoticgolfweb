// Primera vez en cada modo: una tarjeta corta que explica de qué va (reto diario, contrarreloj,
// desafíos, desafío semanal) antes de empezar. Se enseña una sola vez; "Repetir el tutorial"
// (Ajustes) las vuelve a mostrar.
import { $, esc } from './dom.js';
import { t } from '../i18n/index.js';

const KEY = 'chaoticgolf_intros';
const ICON = { daily: 'i-calendar', rush: 'i-timer', challenge: 'i-crown' };
// versión de cada presentación: si cambian las reglas del modo, se vuelve a enseñar una vez (contrarreloj 2: los cazadores)
const VER = { rush: 3 }; // (3: la serie de la semana y sus medallas)
const seenKey = id => VER[id] ? id + VER[id] : id;
const seen = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } };
const markSeen = id => { try { localStorage.setItem(KEY, JSON.stringify({ ...seen(), [seenKey(id)]: true })); } catch (e) { /* sin storage */ } };
export const resetModeIntros = () => { try { localStorage.removeItem(KEY); } catch (e) { /* sin storage */ } };

// true = seguir (ya vista, o aceptada); false = la ha cerrado sin jugar
export function modeIntro(id) {
  if (!ICON[id] || seen()[seenKey(id)]) return Promise.resolve(true);
  return new Promise(resolve => {
    const dlg = $('dialog');
    const points = t(`intro.${id}.points`).split('|');
    dlg.innerHTML = `<form method="dialog" class="dlgBox intro ${id}">
      <span class="introIco"><svg class="i" aria-hidden="true"><use href="#${ICON[id]}"/></svg></span>
      <h3>${esc(t(`intro.${id}.title`))}</h3>
      <ul class="introList">${points.map(p => `<li>${esc(p)}</li>`).join('')}</ul>
      <div class="dlgBtns"><button value="ok" class="btn-primary">${esc(t('intro.go'))}</button></div>
    </form>`;
    const done = () => {
      dlg.removeEventListener('close', done);
      const ok = dlg.returnValue === 'ok';
      if (ok) markSeen(id);
      resolve(ok);
    };
    dlg.addEventListener('close', done);
    dlg.returnValue = '';
    dlg.showModal();
    dlg.querySelector('button').focus();
  });
}
