/* service-worker.js v7 - FIX notification icon + badge */
const CACHE_NAME = 'nieuws-ommen-v7-FIX-ICON';

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    await self.clients.claim();
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));
    console.log('SW v7: all caches cleared');
  })());
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.includes('/api/') || url.pathname.includes('/proxy')) return;
  if (url.pathname.endsWith('app.js')) {
    e.respondWith(fetch(e.request, {cache: 'no-store'}).then(r=>{
      return r;
    }).catch(()=>caches.match(e.request)));
    return;
  }
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
  let data = { title: 'Nieuws Ommen', body: 'Nieuw artikel beschikbaar', url: '/', source: '' };
  try { if (event.data) { const json = event.data.json(); data = { ...data, ...json }; } } catch {}
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: 'icons/notification-icon-solid-192.png',
      badge: 'icons/badge-simple-N-96.png',
      data: { url: data.url || '/', source: data.source || '', articleUrl: data.url || '/' },
      vibrate: [100, 50, 100]
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const articleUrl = event.notification.data?.articleUrl || event.notification.data?.url || '/';
  const source = event.notification.data?.source || '';
  const baseUrl = self.registration.scope;
  const focusUrl = `${baseUrl}?focus=${encodeURIComponent(articleUrl)}&src=${encodeURIComponent(source)}`;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url.includes('Nieuws-Ommen') && 'focus' in c) {
          c.navigate(focusUrl);
          return c.focus();
        }
      }
      return clients.openWindow(focusUrl);
    })
  );
});
