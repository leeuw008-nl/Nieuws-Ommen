// Ommen Service Worker v16.3 - FIXED met bron weergave
const CACHE_NAME = 'nieuws-ommen-v226';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192x192.png',
  './icons/icon-512x512.png'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache).catch(()=>{}))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))).then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request).catch(()=>caches.match('./index.html'));
    })
  );
});

self.addEventListener('push', event => {
  let data = {};
  try {
    if(event.data){
      data = event.data.json();
    }
  } catch {
    try{
      const text = event.data.text();
      data = { title: 'Nieuws Ommen', body: text };
    }catch{
      data = { title: 'Nieuws Ommen', body: 'Nieuw artikel beschikbaar' };
    }
  }

  const source = data.source || '';
  let title = data.title || 'Nieuws Ommen';
  let body = data.body || 'Nieuw artikel beschikbaar';

  if(source && source !== 'Algemeen' && !title.toLowerCase().includes(source.toLowerCase())){
    if(title.startsWith('Test:') || source === data.source){
      title = `${source}: ${title}`;
    }
  }

  const options = {
    body: body,
    icon: './icons/icon-192x192.png',
    badge: './icons/icon-192x192.png',
    tag: data.tag || 'ommen-news',
    renotify: true,
    requireInteraction: false,
    vibrate: [200, 100, 200],
    data: {
      url: data.url || './',
      source: source
    },
    actions: [
      { action: 'open', title: 'Openen' },
      { action: 'close', title: 'Sluiten' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const action = event.action;
  if(action === 'close') return;
  
  const url = event.notification.data?.url || './';
  const fullUrl = url.startsWith('http') ? url : new URL(url, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({type:'window', includeUncontrolled:true}).then(clientList => {
      for(const client of clientList){
        if(client.url.includes('Nieuws-Ommen') && 'focus' in client){
          client.navigate(fullUrl);
          return client.focus();
        }
      }
      if(clients.openWindow){
        return clients.openWindow(fullUrl);
      }
    })
  );
});
