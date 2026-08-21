\const CACHE_NAME='ommen-v244-nocors-fix';
const WORKER='https://ommen-push-v2.leeuw008.workers.dev';

self.addEventListener('install', e=>{
  self.skipWaiting();
});

self.addEventListener('activate', e=>{
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e=>{
  const url = e.request.url;

  // === FIX v244: BYPASS ALLES WAT PROXY / API / RSS IS ===
  // Laat browser direct fetchen, niet via SW. Voorkomt cache-control header issue.
  if (
    url.includes('/proxy') ||
    url.includes('/check') ||
    url.includes('/sync') ||
    url.includes('/last') ||
    url.includes('rss') ||
    url.includes('feed') ||
    url.includes('.xml') ||
    url.includes(WORKER) ||
    url.includes('allorigins') ||
    url.includes('corsproxy') ||
    url.includes('thingproxy') ||
    url.includes('rss2json')
  ) {
    return; // bypass service worker completely
  }

  // Alleen statische app assets cachen
  if (
    url.includes('app.js') ||
    url.includes('push.js') ||
    url.includes('informatie.html') ||
    url.includes('index.html')
  ) {
    e.respondWith(
      fetch(e.request, { cache: 'no-store' })
        .then(r => {
          const clone = r.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
          return r;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Overige: cache-first fallback
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});

// === PUSH HANDLING (same as v240) ===
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Nieuws Ommen';
  const options = {
    body: data.body || 'Nieuw bericht',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: data.url || '/' }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientList => {
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
