/* service-worker.js v241 - network-first voor proxy */
const SW_VERSION = 'v241-netfirst-proxy';
const WORKER = 'https://ommen-push-v2.leeuw008.workers.dev';
const CACHE_NAME = 'ommen-v241';

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // FIX v241: proxy + check + sync altijd network-first, nooit uit cache
  if (url.includes('/proxy') || url.includes('/check') || url.includes('/sync') || url.includes(WORKER)) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .then((res) => {
          // optioneel: clone naar cache voor offline fallback
          return res;
        })
        .catch(() => {
          // fallback naar cache als offline
          return caches.match(event.request);
        })
    );
    return;
  }

  // rest: cache-first voor static assets
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request);
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SET_FILTERS') {
    console.log('[SW v241] filters updated', event.data.sources);
  }
});
