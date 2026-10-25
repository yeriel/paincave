const CACHE_NAME = 'pain-cave-v7';
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
  // Planes Fondo Z2
  './planes/fondo_z2/principiante.csv',
  './planes/fondo_z2/amateur.csv',
  './planes/fondo_z2/elite.csv',
  './planes/fondo_z2/pro.csv',
  // Planes Adaptación Aero
  './planes/adaptacion_aero/principiante.csv',
  './planes/adaptacion_aero/amateur.csv',
  './planes/adaptacion_aero/elite.csv',
  './planes/adaptacion_aero/pro.csv',
  // Planes Intervalos Umbral Z4
  './planes/intervalos_umbral/principiante.csv',
  './planes/intervalos_umbral/amateur.csv',
  './planes/intervalos_umbral/elite.csv',
  './planes/intervalos_umbral/pro.csv',
  // Planes Sweet Spot 88-93%
  './planes/sweet_spot/principiante.csv',
  './planes/sweet_spot/amateur.csv',
  './planes/sweet_spot/elite.csv',
  './planes/sweet_spot/pro.csv',
  // Planes Recuperación Activa
  './planes/recuperacion_activa/principiante.csv',
  './planes/recuperacion_activa/amateur.csv',
  './planes/recuperacion_activa/elite.csv',
  './planes/recuperacion_activa/pro.csv'
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