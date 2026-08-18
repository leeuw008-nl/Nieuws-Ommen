// Service Worker v16.4 - ROBUST - toont ALTIJD notificatie, ook bij decrypt errors
const CACHE_NAME = 'nieuws-ommen-v164';
const ICON_URL = 'https://leeuw008-nl.github.io/Nieuws-Ommen/icons/icon-192x192.png';

self.addEventListener('install', e => {
  console.log('[SW v16.4] Install');
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  console.log('[SW v16.4] Activate - clearing old caches');
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => { if(k !== CACHE_NAME) return caches.delete(k); }))).then(()=>self.clients.claim())
  );
});

self.addEventListener('push', event => {
  console.log('[SW v16.4] Push received', event.data ? 'with data' : 'NO DATA');
  
  let title = 'Nieuws Ommen';
  let body = 'Nieuw artikel beschikbaar';
  let url = './';
  let source = '';
  let tag = 'ommen-'+Date.now();

  try {
    if (event.data) {
      let data;
      try {
        data = event.data.json();
        console.log('[SW v16.4] Data json:', data);
      } catch (e) {
        try {
          const text = event.data.text();
          console.log('[SW v16.4] Data text:', text);
          try { data = JSON.parse(text); } catch { data = { body: text }; }
        } catch (e2) {
          console.log('[SW v16.4] No parsable data', e2);
        }
      }
      
      if (data) {
        // Bron zit nu al in titel bij v16.3: "Natuurlijk Ommen: Test: Ommen Push"
        title = data.title || title;
        body = data.body || body;
        url = data.url || url;
        source = data.source || '';
        tag = data.tag || tag;
        
        // Als bron niet in titel, toch toevoegen voor duidelijkheid
        if (source && source !== 'Algemeen' && !title.toLowerCase().includes(source.toLowerCase())) {
          body = `[${source}] ${body}`;
        }
      }
    } else {
      console.log('[SW v16.4] event.data is NULL - using defaults');
    }
  } catch (err) {
    console.error('[SW v16.4] Error parsing push data', err);
  }

  console.log('[SW v16.4] Showing notification:', title, body);

  const options = {
    body: body,
    // Gebruik geen lokaal icon maar absolute URL - voorkomt 404 crash
    icon: ICON_URL,
    badge: ICON_URL,
    tag: tag,
    renotify: true,
    vibrate: [200, 100, 200],
    data: { url: url, source: source },
    // Geen actions - sommige browsers crashen daarop
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
      .then(()=>console.log('[SW v16.4] Notification shown OK'))
      .catch(err=>{
        console.error('[SW v16.4] showNotification FAILED', err);
        // Fallback zonder icon/badge als dat de crash veroorzaakt
        return self.registration.showNotification(title, { body: body, tag: tag, data: { url: url } });
      })
  );
});

self.addEventListener('notificationclick', event => {
  console.log('[SW v16.4] Click', event.notification.data);
  event.notification.close();
  const url = event.notification.data?.url || './';
  const fullUrl = url.startsWith('http') ? url : new URL(url, self.location.origin).href;
  event.waitUntil(
    clients.matchAll({type:'window', includeUncontrolled:true}).then(list=>{
      for(const c of list){ if(c.url.includes('Nieuws-Ommen')){ c.navigate(fullUrl); return c.focus(); } }
      return clients.openWindow(fullUrl);
    })
  );
});
