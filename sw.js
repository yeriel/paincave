const CACHE_NAME = 'pain-cave-v8';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './assets/css/tailwind.min.css',
  './assets/css/tabler-icons.min.css',
  './assets/css/fonts/tabler-icons.woff2',
  './assets/css/fonts/tabler-icons.woff',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/favicon-32.png',
  './js/constants.js',
  './js/audio.js',
  './js/bluetooth.js',
  './js/gamification.js',
  './js/workouts.js',
  './js/exporter.js',
  './js/engine.js',
  './js/ui.js',
  './js/app.js',
  // Lunes: Fondo Aero Z2
  './planes/lunes_fondo_aero/fase1.csv',
  './planes/lunes_fondo_aero/fase2.csv',
  './planes/lunes_fondo_aero/fase3.csv',
  // Martes: Sweet Spot
  './planes/martes_sweet_spot/fase1.csv',
  './planes/martes_sweet_spot/fase2.csv',
  './planes/martes_sweet_spot/fase3.csv',
  // Miércoles: Recuperación Z1
  './planes/miercoles_recuperacion/fase1.csv',
  './planes/miercoles_recuperacion/fase2.csv',
  './planes/miercoles_recuperacion/fase3.csv',
  // Jueves: Fondo Z2 Continuo
  './planes/jueves_fondo_z2/fase1.csv',
  './planes/jueves_fondo_z2/fase2.csv',
  './planes/jueves_fondo_z2/fase3.csv',
  // Viernes: Intervalos Umbral Z4
  './planes/viernes_umbral_z4/fase1.csv',
  './planes/viernes_umbral_z4/fase2.csv',
  './planes/viernes_umbral_z4/fase3.csv',
  // Sábado: Fondo Aero Extendido
  './planes/sabado_fondo_extendido/fase1.csv',
  './planes/sabado_fondo_extendido/fase2.csv',
  './planes/sabado_fondo_extendido/fase3.csv'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        fetch(event.request).then(networkResponse => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, networkResponse));
          }
        }).catch(() => {});
        return cachedResponse;
      }
      return fetch(event.request).then(networkResponse => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseToCache);
        });
        return networkResponse;
      }).catch(() => {
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});