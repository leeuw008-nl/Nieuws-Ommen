// Service Worker v9 - FIX: open in app, niet direct naar bron + 1 notificatie per artikel
const APP_BASE = 'https://leeuw008-nl.github.io/Nieuws-Ommen/';

self.addEventListener('push', function(event){
  let data = {};
  try{ data = event.data.json(); }catch(e){ data = {title:'Nieuw Ommen nieuws', body:event.data.text(), url:APP_BASE}; }
  const title = data.title || 'Nieuw Ommen nieuws';
  const options = {
    body: data.body || 'Nieuw artikel',
    icon: APP_BASE + 'icon-192.png',
    badge: APP_BASE + 'badge-72.png',
    data: {
      url: data.url,
      appUrl: data.appUrl || (APP_BASE + '?open=' + encodeURIComponent(data.url||'') + '&src=' + encodeURIComponent(data.source||'')),
      source: data.source
    },
    tag: data.url || data.title, // FIX: zelfde tag = vervangt vorige, geen stapel dubbele meldingen
    renotify: false,
    requireInteraction: false,
    vibrate: [100,50,100]
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function(event){
  event.notification.close();
  const d = event.notification.data || {};
  const target = d.appUrl || d.url || APP_BASE;
  event.waitUntil(
    clients.matchAll({type:'window', includeUncontrolled:true}).then(function(windowClients){
      // Bestaat app al? focus + navigate naar artikel in app
      for(let i=0;i<windowClients.length;i++){
        const client = windowClients[i];
        if(client.url.includes('Nieuws-Ommen') || client.url.includes('leeuw008')){
          client.navigate(target);
          return client.focus();
        }
      }
      // Anders nieuw venster openen IN DE APP
      return clients.openWindow(target);
    })
  );
});

self.addEventListener('install', e=>self.skipWaiting());
self.addEventListener('activate', e=>e.waitUntil(self.clients.claim()));
