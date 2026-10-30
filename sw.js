const CACHE_NAME = 'pain-cave-v12';
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
  './js/trainingTracker.js',
  './js/workouts.js',
  './js/exporter.js',
  './js/engine.js',
  './js/ui.js',
  './js/app.js',
  // Día 1: Fondo Z2 (60 min)
  './planes/dia1_fondo_z2/fase1.csv',
  './planes/dia1_fondo_z2/fase2.csv',
  './planes/dia1_fondo_z2/fase3.csv',
  // Día 2: Sweet Spot (158-170 BPM)
  './planes/dia2_sweet_spot/fase1.csv',
  './planes/dia2_sweet_spot/fase2.csv',
  './planes/dia2_sweet_spot/fase3.csv',
  // Día 3: Recuperación Activa Z1
  './planes/dia3_recuperacion/fase1.csv',
  './planes/dia3_recuperacion/fase2.csv',
  './planes/dia3_recuperacion/fase3.csv',
  // Calidad Opcional: Umbral FTP Z4
  './planes/opcional_umbral_z4/fase1.csv',
  './planes/opcional_umbral_z4/fase2.csv',
  './planes/opcional_umbral_z4/fase3.csv'
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