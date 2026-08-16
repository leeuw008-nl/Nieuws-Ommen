// Ommen Nieuws - Service Worker v9 - Push + Live Sync Notification
const CACHE_NAME = 'ommen-nieuws-v9';
const URLS_TO_CACHE = ['./', './index.html', './app.js', './manifest.json'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(URLS_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.url.includes('/proxy') || event.request.url.includes('/sync/') || event.request.url.includes('/auth/')) {
    return;
  }
  event.respondWith(
    caches.match(event.request).then(resp => resp || fetch(event.request))
  );
});

// Push notificaties (bestaand)
self.addEventListener('push', event => {
  let data = {title: 'Nieuw(s)Ommen', body: 'Er is nieuw nieuws!', url: '/'};
  try {
    if (event.data) data = {...data, ...event.data.json()};
  } catch {}
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: {url: data.url},
      vibrate: [100,50,100]
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({type: 'window'}).then(list => {
      for (const c of list) {
        if (c.url.includes(self.location.origin) && 'focus' in c) return c.focus();
      }
      return clients.openWindow(url);
    })
  );
});

// Nieuw: luister naar berichten vanuit app.js voor live sync melding
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SYNC_UPDATED') {
    const time = new Date().toLocaleTimeString('nl-NL', {hour:'2-digit', minute:'2-digit'});
    event.waitUntil(
      self.registration.showNotification('Filters gesynchroniseerd', {
        body: `Je instellingen zijn bijgewerkt om ${time} vanaf een ander apparaat.`,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: 'ommen-sync',
        renotify: true,
        silent: false,
        data: {url: '/'}
      })
    );
  }
});
