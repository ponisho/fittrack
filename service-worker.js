// service-worker.js
// Cachea el "app shell" para que el dashboard funcione sin conexión
// una vez que se ha abierto al menos una vez.

const CACHE_NAME = 'fitdays-dashboard-v1';

// Lista de archivos que forman el "esqueleto" de la app.
// Si agregas archivos nuevos al proyecto, añádelos aquí.
const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './icon.svg',
  './body-wireframe.png'
];

// Instala el service worker y precachea el app shell.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// Limpia caches de versiones anteriores.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Estrategia: cache-first para el app shell, con fallback a la red.
// Esto permite que la app cargue 100% offline (los datos viven en LocalStorage,
// nunca se piden a un servidor).
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request)
        .then((response) => {
          // Solo cacheamos respuestas válidas del mismo origen.
          if (response && response.status === 200 && response.type === 'basic') {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Si no hay red y no está en caché (p.ej. primera carga de un CDN externo
          // como Chart.js), simplemente falla; la app sigue funcionando sin gráficas.
          return caches.match('./index.html');
        });
    })
  );
});