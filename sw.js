// Service worker: permite jugar sin conexión.
// Estrategia "primero red": online siempre se sirve la última versión (nada de
// cachés rancias al desarrollar); cada respuesta buena se guarda, y sin red (o si la
// red no contesta en NET_WAIT y hay copia) se sirve la copia guardada. Subir CACHE si
// se quiere vaciar la caché antigua.
// La página, al arrancar, manda la lista de archivos que ha cargado (mensaje "warm"):
// así la caché tiene el juego entero desde la primera visita y tras cada versión nueva
// (esas cargas no pasan por aquí). Sin eso, un arranque con la red caída o lenta se
// quedaba en la pantalla de carga: faltaban módulos en la caché.
const CACHE = 'chaoticgolf-v67';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'assets/icons/icon.svg'];
const NET_WAIT = 3000;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// completar la caché con lo que la página ya ha cargado (solo lo que falte)
self.addEventListener('message', e => {
  if (e.data?.t !== 'warm' || !Array.isArray(e.data.urls)) return;
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(e.data.urls.map(u => {
    const url = new URL(u, self.registration.scope);
    if (url.origin !== location.origin || url.pathname.startsWith('/_vercel/')) return null;
    url.hash = '';
    return c.match(url.href).then(hit => hit || fetch(url.href).then(res => res.ok && c.put(url.href, res))).catch(() => {});
  }))));
});

// la red acaba de fallar o de no contestar: durante un rato, primero la copia (sin esperar en cada
// archivo: el juego son muchos módulos en cadena)
let badNetUntil = 0;
const badNet = () => { badNetUntil = Date.now() + 15000; };

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  // (analíticas y Speed Insights de Vercel, siempre a la red y sin guardar)
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/_vercel/')) return;
  const cached = () => caches.match(req, { ignoreSearch: true })
    .then(r => r || (req.mode === 'navigate' ? caches.match('index.html') : undefined));
  const net = fetch(req).then(res => {
    badNetUntil = 0;
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  });
  e.respondWith(new Promise((resolve, reject) => {
    let done = false;
    const give = r => { if (!done && r) { done = true; resolve(r); } };
    // la red tarda: la copia guardada, si la hay (la red sigue y actualiza la caché)
    const slow = setTimeout(() => { badNet(); cached().then(give); }, Date.now() < badNetUntil ? 0 : NET_WAIT);
    net.then(res => { clearTimeout(slow); give(res); })
      .catch(() => {
        clearTimeout(slow); badNet();
        cached().then(r => { if (r) give(r); else if (!done) { done = true; reject(new TypeError('sin red ni copia')); } });
      });
  }));
});
