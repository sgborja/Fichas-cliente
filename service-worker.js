const CACHE_NAME = 'lua-azul-fichas-v1';
const APP_SHELL = [
  './',
  './index.html',
  './css/styles.css',
  './js/data-flores.js',
  './js/db.js',
  './js/app.js',
  './manifest.json',
  './assets/lua-azul-logo-transparente.png',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-maskable-192.png',
  './assets/icons/icon-maskable-512.png',
  './assets/fonts/Poppins-Regular.ttf',
  './assets/fonts/Poppins-Medium.ttf',
  './assets/fonts/Poppins-SemiBold.ttf',
  './assets/fonts/Poppins-Bold.ttf',
  './assets/fonts/GreatVibes-Regular.ttf'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((nombres) =>
      Promise.all(nombres.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cacheada) => {
      const red = fetch(event.request).then((respuesta) => {
        if (respuesta && respuesta.ok) {
          const copia = respuesta.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copia));
        }
        return respuesta;
      }).catch(() => cacheada);
      return cacheada || red;
    })
  );
});
