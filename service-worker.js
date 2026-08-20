/* v235 - selected sources werken via worker, SW blokkeert nooit */
const CACHE_NAME='ommen-v235-selected';
self.addEventListener('install',e=>{self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==CACHE_NAME).map(x=>caches.delete(x)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(u.pathname.includes('app.js')||u.pathname.includes('push.js')||u.pathname.includes('informatie.html')){
    e.respondWith(fetch(e.request).then(r=>{const c=r.clone();caches.open(CACHE_NAME).then(ca=>ca.put(e.request,c));return r;}).catch(()=>caches.match(e.request)));
    return;
  }
  e.respondWith(caches.match(e.request).then(c=>c||fetch(e.request)));
});
const PUSH_WORKER_URL='https://ommen-push-v2.leeuw008.workers.dev';
self.addEventListener('push',e=>{
  e.waitUntil((async()=>{
    let title='Nieuws Ommen',body='Er is nieuw nieuws',link='/';
    if(e.data){try{const d=e.data.json();title=d.title||title;body=d.body||d.title||body;link=d.link||d.url||link;}catch{try{const t=e.data.text();if(t)body=t;}catch{}}}
    else{try{const r=await fetch(`${PUSH_WORKER_URL}/last`,{cache:'no-store'});if(r.ok){const j=await r.json();title=j.title||title;link=j.link||link;body=j.title;}}catch{}}
    return self.registration.showNotification(title,{body,data:{url:link},tag:`ommen-${Date.now()}`,renotify:true});
  })());
});
self.addEventListener('notificationclick',e=>{
  e.notification.close();
  const url=e.notification.data?.url||'/';
  e.waitUntil(clients.matchAll({type:'window'}).then(wc=>{
    for(const c of wc){if((c.url.includes('nieuwommen')||c.url.includes('Nieuws-Ommen'))&&'focus' in c){c.navigate(url);return c.focus();}}
    if(clients.openWindow) return clients.openWindow(url);
  }));
});
