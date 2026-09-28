// Pestañas del juego y enlaces con un nivel (…#nivel=CÓDIGO). Si el enlace se abre con el juego ya
// abierto en otra pestaña, la nueva le pasa el nivel (BroadcastChannel) y se cierra: el aviso de
// "te han pasado un nivel" sale donde ya estabas. Solo se pasa a una pestaña que se vaya a ver al
// cerrar esta (la que estaba delante hasta que se abrió el enlace, o una visible en otra ventana);
// si no, el nivel se abre aquí. Con la app instalada, el manifiesto (launch_handler: focus-existing)
// lleva el enlace a la ventana abierta y llega por launchQueue.
import { LINK_KEY } from '../content/levels/share.js';

const me = Math.random().toString(36).slice(2);
const chan = typeof BroadcastChannel === 'function' ? new BroadcastChannel('chaoticgolf-tabs') : null;
const RECENT = 5000; // una pestaña que dejó de verse hace menos que esto es la que el navegador vuelve a mostrar
let hiddenAt = document.hidden ? Date.now() : null;
document.addEventListener('visibilitychange', () => { hiddenAt = document.hidden ? Date.now() : null; });

// código del nivel de un enlace (o null)
export function linkedCode(url = location.href) {
  try { return new RegExp('[#&]' + LINK_KEY + '=([^&]+)').exec(new URL(url).hash)?.[1] ?? null; }
  catch (e) { return null; }
}
// el de esta página, que se quita de la barra de direcciones (recargar no lo vuelve a ofrecer)
export function takeLinkedCode() {
  const code = linkedCode();
  if (code) try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* sin history */ }
  return code;
}

// esta pestaña, ya en marcha: responde a las que traen un enlace y recoge el nivel → onCode(código)
export function bindLinkInbox(onCode) {
  const base = document.title;
  const got = code => {
    if (document.hidden) { // (1) en el título hasta que se vuelva a ella
      document.title = '(1) ' + base;
      document.addEventListener('visibilitychange', () => { document.title = base; }, { once: true });
    }
    onCode(code);
  };
  chan?.addEventListener('message', ({ data: m }) => {
    if (m?.t === 'ping') chan.postMessage({ t: 'pong', to: m.from, from: me, hiddenAt });
    else if (m?.t === 'level' && m.to === me) { chan.postMessage({ t: 'ack', to: m.from, from: me }); got(m.code); }
  });
  window.launchQueue?.setConsumer(p => { const code = p.targetURL && linkedCode(p.targetURL); if (code) got(code); });
}

// esta pestaña se ha abierto con un enlace: ¿hay otra del juego que lo recoja? true si se lo ha quedado
export function handOffLink(code, wait = 300) {
  if (!chan) return Promise.resolve(false);
  return new Promise(resolve => {
    const pongs = [];
    let target = null, timer;
    const finish = ok => { chan.removeEventListener('message', onMsg); clearTimeout(timer); resolve(ok); };
    const onMsg = ({ data: m }) => {
      if (m?.to !== me) return;
      if (m.t === 'pong' && !target) pongs.push(m);
      if (m.t === 'ack' && m.from === target) finish(true);
    };
    chan.addEventListener('message', onMsg);
    chan.postMessage({ t: 'ping', from: me });
    timer = setTimeout(() => {
      const now = Date.now();
      const seen = pongs.filter(p => p.hiddenAt == null || now - p.hiddenAt < RECENT);
      if (!seen.length) return finish(false);
      // la visible (otra ventana) o, si no, la que estaba delante justo antes
      target = seen.reduce((a, b) => ((b.hiddenAt ?? Infinity) > (a.hiddenAt ?? Infinity) ? b : a)).from;
      chan.postMessage({ t: 'level', to: target, from: me, code });
      timer = setTimeout(() => finish(false), 1500);
    }, wait);
  });
}
