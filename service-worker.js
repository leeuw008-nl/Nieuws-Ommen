const CACHE_NAME = 'ommen-nieuws-v3';
const urlsToCache = ['./', './index.html'];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache)));
});

self.addEventListener('activate', event => {
  event.waitUntil(clients.claim());
});

// FIX: push met echte payload (titel/body/url)
self.addEventListener('push', event => {
  let data = { title: "Nieuw Ommen nieuws!", body: "Er is een nieuw artikel", url: "https://leeuw008-nl.github.io/Nieuws-Ommen/" };
  try {
    if (event.data) {
      const json = event.data.json();
      data = { ...data, ...json };
    }
  } catch (e) {
    // fallback zonder icon zodat hij altijd toont
  }
  const options = {
    body: data.body,
    data: { url: data.url },
    // geen icon/badge zodat hij nooit faalt op ontbrekend bestand
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

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});
