const CACHE_NAME = 'nieuws-ommen-v228-white-poppetje-fix';
const urlsToCache = [
  './',
  './index.html',
  './informatie.html',
  './manifest.json',
  './icons/icon-192x192.png',
  './icons/icon-512x512.png'
];
// styles.css, app.js, push.js NIET precachen - network-first

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(urlsToCache)));
});
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => {
      if(k !== CACHE_NAME){ console.log('[SW v228] delete',k); return caches.delete(k); }
    }))).then(()=>self.clients.claim())
  );
});
self.addEventListener('fetch', event => {
  const url = event.request.url;
  if(url.includes('styles.css')||url.includes('app.js')||url.includes('push.js')){
    event.respondWith(fetch(event.request).then(r=>{
      const cl=r.clone(); caches.open(CACHE_NAME).then(c=>c.put(event.request,cl)); return r;
    }).catch(()=>caches.match(event.request)));
    return;
  }
  if(event.request.mode==='navigate'||url.includes('index.html')){
    event.respondWith(fetch(event.request).catch(()=>caches.match('./index.html')));
    return;
  }
  event.respondWith(caches.match(event.request).then(r=>r||fetch(event.request)));
});
self.addEventListener('push', event => {
  console.log('[SW v228] Push',event);
  let data={}; try{ if(event.data) data=event.data.json(); }catch(e){ try{ data={title:'Nieuw(s)Ommen',body:event.data?event.data.text():'Nieuw artikel'} }catch{ data={title:'Nieuw(s)Ommen',body:'Nieuw artikel'} } }
  const title=data.title||'📰 Nieuw(s)Ommen';
  const options={
    body:data.body||data.message||'Er is nieuw nieuws uit Ommen!',
    tag:data.tag||'ommen-'+Date.now(),
    data:{url:data.url||data.link||'./',source:data.source||''},
    vibrate:[200,100,200]
  };
  event.waitUntil(self.registration.showNotification(title,options));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const u=event.notification.data&&event.notification.data.url?event.notification.data.url:'./';
  event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(clients=>{
    for(let c of clients){ if(c.url.includes('nieuwommen')||c.url.includes('leeuw008')){ c.focus(); if(u!=='./') c.navigate(u); return; } }
    if(clients.openWindow) return clients.openWindow(u);
  }));
});
