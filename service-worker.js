const CACHE_NAME = 'ommen-nieuws-v8';
const CORE = ['./index.html', './style.css'];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(CORE).catch(err => {
        console.log('Cache addAll failed, continue anyway', err);
      });
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = event.request.url;
  // Nooit script.js cachen agressief
  if (url.includes('script.js')) {
    event.respondWith(fetch(event.request, {cache:'no-store'}).catch(()=>caches.match(event.request)));
    return;
  }
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).catch(()=>caches.match('./index.html')))
  );
});

self.addEventListener('push', event => {
  let data = { title: "Nieuw Ommen nieuws!", body: "Er is een nieuw artikel", url: "https://leeuw008-nl.github.io/Nieuws-Ommen/" };
  try { if (event.data) { const json = event.data.json(); data = { ...data, ...json }; } } catch(e){}
  event.waitUntil(self.registration.showNotification(data.title, { body: data.body, data: { url: data.url }, vibrate:[200,100,200], tag:'ommen-nieuws' }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || "https://leeuw008-nl.github.io/Nieuws-Ommen/";
  event.waitUntil(clients.matchAll({type:'window'}).then(list => {
    for(const c of list){ if(c.url.includes('Nieuws-Ommen') && 'focus' in c) return c.focus(); }
    return clients.openWindow(url);
  }));
});
