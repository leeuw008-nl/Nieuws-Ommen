const CACHE_NAME = 'ommen-nieuws-v7';
const CORE = ['./', './index.html', './style.css'];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(CORE)));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))).then(() => self.clients.claim())
  );
});

// Network-first voor script.js zodat updates direct komen, cache-first voor rest
self.addEventListener('fetch', event => {
  const url = event.request.url;
  if (url.includes('script.js')) {
    event.respondWith(fetch(event.request, {cache:'no-store'}).then(r => { const clone=r.clone(); caches.open(CACHE_NAME).then(c=>c.put(event.request, clone)); return r; }).catch(()=>caches.match(event.request)));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(r => { const clone=r.clone(); caches.open(CACHE_NAME).then(c=>c.put(event.request, clone)); return r; })));
});

self.addEventListener('push', event => {
  let data = { title: "Nieuw Ommen nieuws!", body: "Er is een nieuw artikel", url: "https://leeuw008-nl.github.io/Nieuws-Ommen/" };
  try {
    if (event.data) {
      const json = event.data.json();
      data = { ...data, ...json };
    }
  } catch (e) {}
  const options = {
    body: data.body,
    data: { url: data.url },
    vibrate: [200, 100, 200],
    tag: 'ommen-nieuws',
  };
  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || "https://leeuw008-nl.github.io/Nieuws-Ommen/";
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientsList => {
      for (const client of clientsList) {
        if (client.url.includes('Nieuws-Ommen') && 'focus' in client) return client.focus();
      }
      return clients.openWindow(url);
    })
  );
});
