/* service-worker.js - SCHOON + FIX VOOR showNotification pending */
const CACHE_NAME = 'nieuws-ommen-v4';

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    await self.clients.claim();
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
  })());
});

// GEEN fetch handler die alles onderschept! 
// Laat browser gewoon network doen, alleen cache voor eigen shell
self.addEventListener('fetch', (e) => {
  // Alleen GET en alleen same-origin cachen, geen corsproxy.io etc.
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return; // laat corsproxy.io en rss feeds met rust -> fixt 526
  if (url.pathname.includes('/api/') || url.pathname.includes('/proxy')) return;
  
  e.respondWith(
    caches.open(CACHE_NAME).then(cache => 
      cache.match(e.request).then(cached => {
        const fetched = fetch(e.request).then(network => {
          if (network.ok) cache.put(e.request, network.clone());
          return network;
        }).catch(() => cached);
        return cached || fetched;
      })
    )
  );
});

self.addEventListener('push', (event) => {
  let data = { title: 'Nieuws Ommen', body: 'Nieuw artikel beschikbaar', url: '/' };
  try {
    if (event.data) {
      const json = event.data.json();
      data = { ...data, ...json };
    }
  } catch {}
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: 'icons/icon-192x192.png',
      badge: 'icons/badge-72.png',
      data: { url: data.url || '/' },
      vibrate: [100, 50, 100]
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(list => {
      for (const c of list) {
        if (c.url.includes('Nieuws-Ommen') && 'focus' in c) return c.focus();
      }
      return clients.openWindow(url);
    })
  );
});
