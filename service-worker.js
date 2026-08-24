/* service-worker v236 - FIX DUBBEL + CLICK NAAR APP + GEEN FILTER BLOKKADE + SNEL
 * - Fix dubbel: zelfde id = zelfde tag, renotify false
 * - Fix click: gaat naar app met ?highlight=id
 * - Geen client-side filter blokkade meer (performance)
 */
const CACHE_NAME='ommen-v236-final';
const STATIC_ASSETS=['./','./index.html','./icon-192.png','./icon-512.png'];
self.addEventListener('install', e=>{self.skipWaiting(); e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(STATIC_ASSETS.map(u=>new Request(u,{cache:'no-cache'}))).catch(()=>{})));});
self.addEventListener('activate', e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch', e=>{
  const u=new URL(e.request.url);
  if(u.pathname.includes('app.js')||u.pathname.includes('push.js')||u.pathname.includes('informatie.html')){
    e.respondWith(fetch(e.request).then(r=>{const clone=r.clone();caches.open(CACHE_NAME).then(ca=>ca.put(e.request,clone));return r;}).catch(()=>caches.match(e.request)));
    return;
  }
  e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request)));
});
const PUSH_WORKER_URL='https://ommen-push-v2.leeuw008.workers.dev';
self.addEventListener('push', e=>{
  e.waitUntil((async()=>{
    let title='Nieuws Ommen', body='Er is nieuw nieuws uit Ommen', link='/', source='', id='';
    if(e.data){try{const d=e.data.json();title=d.title||title;body=d.body||d.title||body;link=d.link||d.url||link;source=d.source||'';id=d.id||d.articleId||'';if(source)body=`${source}: ${title}`;}catch{try{const txt=e.data.text();if(txt)body=txt;}catch{}}}
    else{try{const r=await fetch(`${PUSH_WORKER_URL}/last`,{cache:'no-store'});if(r.ok){const j=await r.json();title=j.title||title;link=j.link||link;source=j.source||'';id=j.id||'';body=source?`${source}: ${j.title}`:j.title;}}catch{}}
    const tag = id ? `ommen-${id}` : `ommen-${(source||'algemeen').toLowerCase().replace(/\s+/g,'-')}`;
    const options={body, icon:'./icon-192.png', badge:'./icon-192.png', data:{url:link, source, id}, tag, renotify:false, vibrate:[100,50,100]};
    return self.registration.showNotification(title, options);
  })());
});
self.addEventListener('notificationclick', e=>{
  e.notification.close();
  const data=e.notification.data||{};
  const id=data.id||'';
  const externalUrl=data.url||'/';
  const source=data.source||'';
  const appUrl = id ? `/?highlight=${encodeURIComponent(id)}&src=${encodeURIComponent(source)}` : '/';
  e.waitUntil((async()=>{
    try{
      const all=await clients.matchAll({type:'window', includeUncontrolled:true});
      for(const c of all){
        if((c.url.includes('nieuwommen')||c.url.includes('Nieuws-Ommen')||c.url.includes('localhost')) && 'focus' in c){
          try{c.postMessage({type:'NOTIFICATION_CLICK', id, url:externalUrl, source});}catch{}
          await c.navigate(appUrl);
          return c.focus();
        }
      }
      if(clients.openWindow) return clients.openWindow(appUrl);
    }catch{
      if(clients.openWindow) return clients.openWindow(appUrl);
    }
  })());
});
self.addEventListener('message', e=>{if(e.data && e.data.type==='SET_FILTERS'){console.log('[v236] Filters:', e.data.sources);}});
