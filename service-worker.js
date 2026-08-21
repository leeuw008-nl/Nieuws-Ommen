const CACHE_NAME = 'ommen-v243-nocache';

// === INSTALL: meteen actief worden ===
self.addEventListener('install', e => {
  self.skipWaiting();
});

// === ACTIVATE: ALLE oude caches slopen ===
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => 
      Promise.all(keys.map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// === FETCH: app.js en data NOOIT cachen ===
self.addEventListener('fetch', e => {
  const url = e.request.url;
  
  const isNoCache = 
    url.includes('app.js') || 
    url.includes('push.js') || 
    url.includes('/proxy') || 
    url.includes('/check') || 
    url.includes('rss') || 
    url.includes('feed') || 
    url.includes('.xml');

  if (isNoCache) {
    // ALTIJD netwerk, no-store, nooit in cache zetten
    e.respondWith(
      fetch(e.request, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' }
      }).catch(err => {
        // Alleen als echt offline: geen cache fallback voor app.js
        console.warn('[SW v243] network fail for', url, err);
        return new Response('Offline - geen netwerk', { status: 503 });
      })
    );
    return;
  }

  // Voor overige assets (icons, index.html): netwerk eerst, fallback cache
  e.respondWith(
    fetch(e.request).then(res => {
      // Niet cachen als het app.js was (extra check)
      if (url.includes('app.js')) return res;
      const clone = res.clone();
      caches.open(CACHE_NAME).then(c => c.put(e.request, clone)).catch(()=>{});
      return res;
    }).catch(() => caches.match(e.request))
  );
});

// === PUSH - zelfde als v240 ===
self.addEventListener('push', e => {
  let data = {};
  try {
    data = e.data ? e.data.json() : {};
  } catch {
    data = { title: 'Nieuws Ommen', body: e.data ? e.data.text() : 'Nieuw bericht' };
  }
  const title = data.title || 'Nieuws Ommen';
  const options = {
    body: data.body || data.message || 'Er is nieuw lokaal nieuws',
    icon: './icon-192.png',
    badge: './icon-192.png',
    data: { url: data.url || '/' }
  };
  e.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window' }).then(list => {
      for (const c of list) {
        if (c.url.includes(self.location.origin) && 'focus' in c) return c.focus();
      }
      if (clients.openWindow) return clients.openWindow(e.notification.data.url || '/');
    })
  );
});
