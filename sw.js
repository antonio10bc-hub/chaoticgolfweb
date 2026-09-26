// Service worker: permite jugar sin conexión.
// Estrategia "primero red": online siempre se sirve la última versión (nada de
// cachés rancias al desarrollar); cada respuesta buena se guarda, y sin red se
// sirve la copia guardada. Subir CACHE si se quiere vaciar la caché antigua.
const CACHE = 'chaoticgolf-v38';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'assets/icons/icon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('index.html')))
  );
});
