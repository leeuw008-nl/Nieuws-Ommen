/* service-worker v249 - FIX lion badge + tijd - LED rechts + telling - CACHE BUST DEFINITIEF */
const CACHE_NAME='ommen-v249-lion-badge-tijd';
const STATIC_ASSETS=[
  './',
  './index.html',
  './styles.css',
  './manifest.json',
  './icons/icon-192x192.png',
  './icons/icon-512x512.png'
];
self.addEventListener('install', e=>{
  self.skipWaiting(); 
  e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(STATIC_ASSETS.map(u=>new Request(u,{cache:'no-store'}))).catch(()=>{})));
});
self.addEventListener('activate', e=>{
  e.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))).then(()=>self.clients.claim())
  );
});
self.addEventListener('fetch', e=>{
  const u=new URL(e.request.url);
  if(u.hostname.includes('workers.dev') || u.hostname.includes('allorigins') || u.hostname.includes('rss2json') || u.pathname.includes('/proxy')){
    return;
  }
  // CRITICAL: app.js + index.html NEVER from old cache
  if(u.pathname.includes('app.js') || u.pathname.includes('index.html')){
    e.respondWith(
      fetch(e.request, {cache:'no-store'}).then(r=>{
        const clone=r.clone();
        caches.open(CACHE_NAME).then(ca=>ca.put(e.request,clone)).catch(()=>{});
        return r;
      }).catch(()=>caches.match(e.request).then(c=>c||fetch(e.request)))
    );
    return;
  }
  if(u.pathname.includes('push.js')||u.pathname.includes('article-focus.js')||u.pathname.includes('styles.css')){
    e.respondWith(
      fetch(e.request, {cache:'no-store'}).then(r=>{const clone=r.clone(); caches.open(CACHE_NAME).then(ca=>ca.put(e.request,clone)).catch(()=>{}); return r;}).catch(()=>caches.match(e.request))
    );
    return;
  }
  if(STATIC_ASSETS.some(a=>u.pathname.endsWith(a.replace('./','')) ) || u.pathname.endsWith('/') || u.pathname.endsWith('index.html')){
    e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request).then(r=>{const clone=r.clone(); caches.open(CACHE_NAME).then(ca=>ca.put(e.request,clone)); return r;})));
    return;
  }
});
const PUSH_WORKER_URL='https://ommen-push-v2.leeuw008.workers.dev';
self.addEventListener('push', e=>{
  e.waitUntil((async()=>{
    let title='Nieuw(s)Ommen', body='Er is nieuw nieuws uit Ommen', link='/', source='', id='';
    if(e.data){try{const d=e.data.json();title=d.title||title;body=d.body||d.title||body;link=d.link||d.url||link;source=d.source||'';id=d.id||d.articleId||'';if(source)body=`${source}: ${title}`;}catch{try{const txt=e.data.text();if(txt)body=txt;}catch{}}}
    else{try{const r=await fetch(`${PUSH_WORKER_URL}/last`,{cache:'no-store'});if(r.ok){const j=await r.json();title=j.title||title;link=j.link||link;source=j.source||'';id=j.id||'';body=source?`${source}: ${j.title}`:j.title;}}catch{}}
    const tag = id ? `ommen-${id}` : `ommen-${(source||'algemeen').toLowerCase().replace(/\s+/g,'-')}`;
    const options={body, icon:'./icons/icon-192x192.png', badge:'./icons/badge-lion-96x96.png', data:{url:link, source, id}, tag, renotify:false, vibrate:[100,50,100]};
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
self.addEventListener('message', e=>{if(e.data && e.data.type==='SET_FILTERS'){console.log('[v247] Filters:', e.data.sources);}});
