/* service-worker v229 - NO-PAYLOAD FIX
 * Werkt met worker-v20-FIXED-ENCRYPT
 * Als push geen payload heeft, haalt hij zelf laatste artikel op via /last
 */

const CACHE_NAME = 'ommen-v229';
const STATIC_ASSETS = [
  './',
  './index.html',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // faalt niet meer op / -> fix voor "no active Service Worker"
      return cache.addAll(STATIC_ASSETS.map(url => new Request(url, {cache: 'no-cache'}))).catch(() => {});
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network-first voor script.js, cache-first voor rest
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.pathname.includes('script.js')) {
    event.respondWith(
      fetch(event.request).then(r => {
        const clone = r.clone();
        caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        return r;
      }).catch(() => caches.match(event.request))
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});

const PUSH_WORKER_URL = 'https://ommen-push-v2.leeuw008.workers.dev';

self.addEventListener('push', event => {
  event.waitUntil((async () => {
    let title = 'Nieuws Ommen';
    let body = 'Er is nieuw nieuws uit Ommen';
    let link = '/';
    let source = '';

    // 1. Probeer echte payload (als v21 encrypt wel werkt)
    if (event.data) {
      try {
        const data = event.data.json();
        title = data.title || title;
        body = data.body || data.title || body;
        link = data.link || data.url || link;
        source = data.source || '';
        if (source) body = `${source}: ${title}`;
      } catch(e) {
        try {
          const txt = event.data.text();
          if (txt) body = txt;
        } catch {}
      }
    } else {
      // 2. NO-PAYLOAD MODE: haal zelf laatste artikel op
      try {
        const r = await fetch(`${PUSH_WORKER_URL}/last`, { cache: 'no-store' });
        if (r.ok) {
          const j = await r.json();
          title = j.title || title;
          link = j.link || link;
          source = j.source || '';
          // mooie body: "Ommen City: Titel..."
          body = source ? `${source}: ${j.title}` : j.title;
        }
      } catch(e) {
        console.log('last fetch failed, using generic', e);
      }
    }

    const options = {
      body: body,
      icon: './icon-192.png',
      badge: './icon-192.png',
      data: { url: link },
      tag: 'ommen-nieuws-v229', // vervangt vorige melding
      renotify: true,
      vibrate: [100, 50, 100]
    };

    return self.registration.showNotification(title, options);
  })());
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(windowClients => {
      for (const client of windowClients) {
        if (client.url.includes('Nieuws-Ommen') && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});
