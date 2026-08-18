const CACHE_NAME = 'nieuws-ommen-v227-fix-push';
const urlsToCache = [
  './',
  './index.html',
  './informatie.html',
  './styles.css',
  './app.js',
  './push.js',
  './article-focus.js',
  './manifest.json',
  './icons/icon-192x192.png',
  './icons/icon-512x512.png'
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
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  // Voor index.html en navigatie altijd netwerk eerst
  if (event.request.mode === 'navigate' || event.request.url.includes('index.html')) {
    event.respondWith(
      fetch(event.request)
        .then(response => response)
        .catch(() => caches.match('./index.html'))
    );
    return;
  }
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});

// ===== PUSH NOTIFICATIES - DIT MISTE =====
self.addEventListener('push', event => {
  console.log('[SW] Push ontvangen', event);
  let data = {};
  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (e) {
    data = { title: 'Nieuw(s)Ommen', body: event.data ? event.data.text() : 'Nieuw artikel beschikbaar' };
  }

  const title = data.title || '📰 Nieuw(s)Ommen';
  const options = {
    body: data.body || data.message || 'Er is nieuw nieuws uit Ommen!',
    icon: './icons/icon-192x192.png',
    badge: './icons/icon-192x192.png',
    tag: data.tag || 'ommen-nieuws',
    data: {
      url: data.url || data.link || './',
      source: data.source || ''
    },
    vibrate: [200, 100, 200],
    requireInteraction: false
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', event => {
  console.log('[SW] Notification click', event);
  event.notification.close();

  const urlToOpen = event.notification.data && event.notification.data.url ? event.notification.data.url : './';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      // Als er al een venster open is, focus die
      for (let client of windowClients) {
        if (client.url.includes('Nieuws-Ommen') || client.url.includes('nieuwommen') || client.url.includes('leeuw008')) {
          client.focus();
          if (urlToOpen !== './') {
            client.navigate(urlToOpen);
          }
          return;
        }
      }
      // Anders nieuw venster openen
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

self.addEventListener('notificationclose', event => {
  console.log('[SW] Notification closed', event);
});
