
const CACHE_NAME = 'nieuws-ommen-v112d-CLEAN';
self.addEventListener('install', e=>{
  self.skipWaiting();
});
self.addEventListener('activate', e=>{
  e.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.map(k=>caches.delete(k)))).then(()=>self.clients.claim())
  );
});
self.addEventListener('fetch', e=>{
  const url = e.request.url;
  if(url.includes('script.js') || url.includes('index.html') || url.includes('service-worker')){
    e.respondWith(fetch(e.request, {cache:'no-store'}).catch(()=>caches.match(e.request)));
    return;
  }
  e.respondWith(fetch(e.request).then(r=>{ return r; }).catch(()=>caches.match(e.request)));
});
