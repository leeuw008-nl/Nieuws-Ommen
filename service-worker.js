const CACHE_NAME = 'ommen-nieuws-v9-final';
const CORE = ['./', './index.html', './style.css', './script.js'];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(CORE).catch(() => {});
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => 
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  // Nooit script.js of service-worker cachen
  if (event.request.url.includes('script.js') || event.request.url.includes('service-worker')) {
    event.respondWith(fetch(event.request, {cache:'no-store'}));
    return;
  }
  event.respondWith(
    fetch(event.request).then(r => {
      // Cache alleen basis files
      if (event.request.method === 'GET' && event.request.url.includes('ommen')) {
        const clone = r.clone();
        caches.open(CACHE_NAME).then(c => c.put(event.request, clone)).catch(()=>{});
      }
      return r;
    }).catch(() => caches.match(event.request).then(cached => cached || caches.match('./index.html')))
  );
});

self.addEventListener('push', event => {
  console.log('Push received!', event.data ? event.data.text() : 'no data');
  let data = { title: "Nieuw Ommen nieuws!", body: "Er is een nieuw artikel", url: "https://leeuw008-nl.github.io/Nieuws-Ommen/" };
  try { 
    if (event.data) { 
      const txt = event.data.text();
      try {
        const json = JSON.parse(txt);
        data = { ...data, ...json };
      } catch {
        data.body = txt.slice(0,100);
      }
    } 
  } catch(e){
    console.error('Push parse error', e);
  }
  const options = {
    body: data.body,
    icon: './favicon.ico',
    badge: './favicon.ico',
    data: { url: data.url },
    vibrate: [200, 100, 200],
    tag: 'ommen-nieuws',
    requireInteraction: false
  };
  event.waitUntil(
    self.registration.showNotification(data.title, options).catch(err => {
      console.error('showNotification failed', err);
      // Fallback zonder icon
      return self.registration.showNotification(data.title, { body: data.body, data: { url: data.url } });
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || "https://leeuw008-nl.github.io/Nieuws-Ommen/";
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for(const c of list){ if(c.url.includes('Nieuws-Ommen') && 'focus' in c) return c.focus(); }
      return clients.openWindow(url);
    })
  );
});
