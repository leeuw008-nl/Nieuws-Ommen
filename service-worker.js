// RESTORE WEEK-OLD EXTERNAL SCRIPT 1786215185
const CACHE_NAME='nieuws-ommen-external-1786215185';
self.addEventListener('install', e=>{self.skipWaiting();});
self.addEventListener('activate', e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.map(x=>caches.delete(x)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch', e=>{
  const url=e.request.url;
  // NEVER cache script.js and index.html - always fresh
  if(url.includes('script.js') || url.includes('index.html') || url.includes('service-worker')){
    e.respondWith(fetch(e.request, {cache:'no-store'}));
    return;
  }
  e.respondWith(fetch(e.request).then(r=>r).catch(()=>caches.match(e.request)));
});
