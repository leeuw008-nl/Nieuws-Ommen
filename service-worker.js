// v111h MINIMAL 2026-08-08 11:18:02 1786213082
const CACHE_NAME = 'nieuws-ommen-v111h-1786213082';
self.addEventListener('install', e=>{ self.skipWaiting(); });
self.addEventListener('activate', e=>{ e.waitUntil(caches.keys().then(k=>Promise.all(k.map(x=>caches.delete(x)))).then(()=>self.clients.claim())); });
self.addEventListener('fetch', e=>{
  if(e.request.url.includes('index.html') || e.request.url.includes('service-worker')){
    e.respondWith(fetch(e.request, {cache:'no-store'}).catch(()=>caches.match(e.request))); return;
  }
  e.respondWith(fetch(e.request).then(r=>r).catch(()=>caches.match(e.request)));
});
