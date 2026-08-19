/* service-worker v233 - DYNAMISCHE CHECK + ICON FALLBACK + FILTER FIX
 * - Geen harde v230 check meer, elke versie met app.js is OK
 * - Icons in /icons/ map, met fallback naar github URL als 404
 * - Filter fix: respecteert filterpagina
 * - No-payload: haalt /last op
 */

const CACHE_NAME = 'ommen-v233';
const STATIC_ASSETS = [
  './',
  './index.html',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS.map(url => new Request(url, {cache: 'no-cache'}))).catch(() => {});
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.pathname.includes('app.js') || url.pathname.includes('push.js')) {
    event.respondWith(
      fetch(event.request).then(r => {
        const clone = r.clone();
        caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        return r;
      }).catch(() => caches.match(event.request))
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});

const PUSH_WORKER_URL = 'https://ommen-push-v2.leeuw008.workers.dev';

async function getFiltersFromClients() {
  try {
    const allClients = await self.clients.matchAll({type: 'window', includeUncontrolled: true});
    if (allClients.length === 0) return null;
    for (const client of allClients) {
      const filters = await new Promise(resolve => {
        const channel = new MessageChannel();
        let done = false;
        channel.port1.onmessage = (e) => { if (!done) { done = true; resolve(e.data); } };
        try { client.postMessage({type: 'GET_FILTERS'}, [channel.port2]); } catch { resolve(null); }
        setTimeout(() => { if (!done) { done = true; resolve(null); } }, 400);
      });
      if (filters && filters.sources) return filters.sources;
    }
    return null;
  } catch { return null; }
}
async function getFiltersFromIDB() {
  try {
    for (const dbName of ['nieuws-ommen','ommen-news','ommen-nieuws']) {
      try {
        const db = await new Promise((res,rej)=>{ const req=indexedDB.open(dbName); req.onsuccess=()=>res(req.result); req.onerror=()=>rej(req.error); });
        if (!db.objectStoreNames.contains('settings')) { db.close(); continue; }
        const tx=db.transaction('settings','readonly'); const store=tx.objectStore('settings');
        const result=await new Promise(r=>{ const q=store.get('selectedSources'); q.onsuccess=()=>r(q.result); q.onerror=()=>r(null); });
        db.close();
        if (result && Array.isArray(result) && result.length>0) return result;
        if (result && result.sources) return result.sources;
      } catch {}
    }
    return null;
  } catch { return null; }
}
async function getAllowedSources() {
  const fromClients=await getFiltersFromClients(); if(fromClients && fromClients.length>0) return fromClients;
  const fromIDB=await getFiltersFromIDB(); if(fromIDB && fromIDB.length>0) return fromIDB;
  return null;
}

self.addEventListener('push', event => {
  event.waitUntil((async () => {
    let title='Nieuws Ommen'; let body='Er is nieuw nieuws uit Ommen'; let link='/'; let source=''; let articleId='';
    if (event.data) {
      try { const data=event.data.json(); title=data.title||title; body=data.body||data.title||body; link=data.link||data.url||link; source=data.source||''; articleId=data.id||data.articleId||''; if(source) body=`${source}: ${title}`; }
      catch { try { body=event.data.text()||body; } catch {} }
    } else {
      try { const r=await fetch(`${PUSH_WORKER_URL}/last`,{cache:'no-store'}); if(r.ok){ const j=await r.json(); title=j.title||title; link=j.link||link; source=j.source||''; articleId=j.id||''; body=source?`${source}: ${j.title}`:j.title; } } catch(e){ console.log('last fetch failed',e); }
    }
    try {
      const allowed=await getAllowedSources();
      if(allowed && allowed.length>0 && source){
        const normAllowed=allowed.map(s=>String(s).toLowerCase()); const normSource=String(source).toLowerCase();
        const isAllowed=normAllowed.some(a=>normSource.includes(a)||a.includes(normSource)||normSource===a);
        if(!isAllowed){ console.log(`[v233] Push geblokkeerd door filter: bron "${source}" niet in [${allowed.join(', ')}]`); return; }
      }
    } catch(e){ console.log('Filter check failed, toch tonen',e); }

    // ICON FIX v233: probeer icons/ map, fallback naar github URL, fallback naar geen icon
    let iconUrl='./icons/icon-192.png';
    let badgeUrl='./icons/icon-192.png';
    try {
      // check of icon bestaat in cache of via fetch HEAD
      const test=await fetch(iconUrl,{method:'HEAD',cache:'no-store'}).catch(()=>null);
      if(!test || !test.ok){
        // fallback naar absolute github URL die altijd werkt
        iconUrl='https://leeuw008-nl.github.io/Nieuws-Ommen/icons/icon-192.png';
        badgeUrl='https://leeuw008-nl.github.io/Nieuws-Ommen/icons/icon-192.png';
      }
    } catch { /* keep original */ }

    const options={
      body: body,
      icon: iconUrl,
      badge: badgeUrl,
      data: { url: link, source: source, id: articleId },
      tag: articleId ? `ommen-${articleId}` : `ommen-${source||'algemeen'}-${Date.now()}_v233`,
      renotify: true,
      vibrate: [100,50,100]
    };
    try {
      return await self.registration.showNotification(title, options);
    } catch(err){
      // Fallback zonder icon als icon URL 404 geeft en showNotification faalt
      console.log('showNotification met icon faalde, probeer zonder icon', err);
      delete options.icon; delete options.badge;
      return await self.registration.showNotification(title, options);
    }
  })());
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url=event.notification.data?.url||'/';
  event.waitUntil(
    clients.matchAll({type:'window'}).then(clientsList=>{
      for(const c of clientsList){ if((c.url.includes('Nieuws-Ommen')||c.url.includes('nieuwommen')) && 'focus' in c){ c.navigate(url); return c.focus(); } }
      if(clients.openWindow) return clients.openWindow(url);
    })
  );
});

self.addEventListener('message', event => {
  if(event.data && event.data.type==='SET_FILTERS'){ console.log('[v233] Filters ontvangen:',event.data.sources); }
  if(event.data && event.data.type==='SYNC_UPDATED'){
    self.registration.showNotification('Nieuws Ommen',{body:'✓ Filters gesynchroniseerd',icon:'./icons/icon-192.png',badge:'./icons/icon-192.png',tag:'ommen-sync',renotify:false}).catch(()=>{ self.registration.showNotification('Nieuws Ommen',{body:'✓ Filters gesynchroniseerd',tag:'ommen-sync'}); });
  }
});
