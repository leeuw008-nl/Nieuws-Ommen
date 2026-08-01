const CACHE_NAME = 'ommen-nieuws-v6-fix-cache-issue';
const urlsToCache = ['./', './index.html'];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))).then(() => self.clients.claim())
  );
});

// FIX: nooit script.js, index.html cachen - altijd netwerk
self.addEventListener('fetch', event => {
  const url = event.request.url;
  if (url.includes('script.js') || url.includes('index.html')) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' }).catch(() => caches.match(event.request))
    );
    return;
  }
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
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
    tag: 'ommen-nieuws'
  };
  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data && event.notification.data.url ? event.notification.data.url : "https://leeuw008-nl.github.io/Nieuws-Ommen/";
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(windowClients => {
      for (let client of windowClients) {
        if (client.url.includes('Nieuws-Ommen') && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
