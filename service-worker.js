const CACHE_NAME = 'nieuws-ommen-v228-white-poppetje-fix';
const urlsToCache = [
  './',
  './index.html',
  './informatie.html',
  './manifest.json',
  './icons/icon-192x192.png',
  './icons/icon-512x512.png'
];
self.addEventListener('install', e=>{ self.skipWaiting(); e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(urlsToCache))); });
self.addEventListener('activate', e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.map(k=>{ if(k!==CACHE_NAME) return caches.delete(k); }))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch', e=>{
  const url=e.request.url;
  if(url.includes('styles.css')||url.includes('app.js')||url.includes('push.js')){
    e.respondWith(fetch(e.request).then(r=>{ const cl=r.clone(); caches.open(CACHE_NAME).then(c=>c.put(e.request,cl)); return r; }).catch(()=>caches.match(e.request)));
    return;
  }
  if(e.request.mode==='navigate'||url.includes('index.html')){
    e.respondWith(fetch(e.request).catch(()=>caches.match('./index.html'))); return;
  }
  e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));
});
self.addEventListener('push', e=>{
  console.log('[SW v228] Push',e);
  let data={}; try{ if(e.data) data=e.data.json(); }catch{ try{ data={title:'Nieuw(s)Ommen',body:e.data?e.data.text():'Nieuw'} }catch{ data={title:'Nieuw(s)Ommen',body:'Nieuw'} } }
  const title=data.title||'📰 Nieuw(s)Ommen';
  const options={ body:data.body||'Nieuw nieuws!', tag:data.tag||'ommen-'+Date.now(), data:{url:data.url||'./'}, vibrate:[200,100,200] };
  e.waitUntil(self.registration.showNotification(title,options));
});
self.addEventListener('notificationclick', e=>{
  e.notification.close();
  const u=e.notification.data?.url||'./';
  e.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(cs=>{ for(let c of cs){ if(c.url.includes('nieuwommen')||c.url.includes('leeuw008')){ c.focus(); if(u!=='./') c.navigate(u); return; } } return clients.openWindow(u); }));
});
