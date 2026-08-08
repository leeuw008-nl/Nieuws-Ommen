// v112g - 2026-08-08 11:07:06 - 1786212426
const CACHE_NAME = 'nieuws-ommen-v112g-1786212426';
self.addEventListener('install', e=>{ self.skipWaiting(); });
self.addEventListener('activate', e=>{ e.waitUntil(caches.keys().then(k=>Promise.all(k.map(x=>caches.delete(x)))).then(()=>self.clients.claim())); });
self.addEventListener('fetch', e=>{
  if(e.request.url.includes('script.js') || e.request.url.includes('index.html') || e.request.url.includes('service-worker')){
    e.respondWith(fetch(e.request, {cache:'no-store'}).catch(()=>caches.match(e.request))); return;
  }
  e.respondWith(fetch(e.request).then(r=>r).catch(()=>caches.match(e.request)));
});
