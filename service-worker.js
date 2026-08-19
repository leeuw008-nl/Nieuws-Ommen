const CACHE_NAME = 'nieuws-ommen-v228-white-poppetje-fix';
const urlsToCache = [
  './',
  './index.html',
  './informatie.html',
  './app.js',
  './push.js',
  './manifest.json',
  './icons/icon-192x192.png',
  './icons/icon-512x512.png'
];
// Let op: styles.css expres NIET in precache, die doen we network-first

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
            console.log('[SW v228] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = event.request.url;
  // Voor styles.css en app.js altijd netwerk eerst, dan cache (zodat nieuwe kleuren direct zichtbaar zijn)
  if (url.includes('styles.css') || url.includes('app.js') || url.includes('push.js')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }
  if (event.request.mode === 'navigate' || url.includes('index.html')) {
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

self.addEventListener('push', event => {
  console.log('[SW v228] Push ontvangen', event);
  let data = {};
  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (e) {
    try {
      data = { title: 'Nieuw(s)Ommen', body: event.data ? event.data.text() : 'Nieuw artikel beschikbaar' };
    } catch {
      data = { title: 'Nieuw(s)Ommen', body: 'Nieuw artikel beschikbaar' };
    }
  }

  const title = data.title || '📰 Nieuw(s)Ommen';
  const options = {
    body: data.body || data.message || 'Er is nieuw nieuws uit Ommen!',
    // geen icon/badge pad dat kan 404'en - dat blokkeerde vorige week alle pushes
    tag: data.tag || 'ommen-nieuws-' + Date.now(),
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
  event.notification.close();
  const urlToOpen = event.notification.data && event.notification.data.url ? event.notification.data.url : './';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      for (let client of windowClients) {
        if (client.url.includes('Nieuws-Ommen') || client.url.includes('nieuwommen') || client.url.includes('leeuw008')) {
          client.focus();
          if (urlToOpen !== './') {
            client.navigate(urlToOpen);
          }
          return;
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
