/* service-worker v245 FINAL - 20 aug versie + alle fixes
 * - Cache: ommen-v245-final (forceert oude v240 cache weg)
 * - Icons: RELATIEF ./icons/... + fallback ./icon-192.png (geen /icons/ met slash = witte blokjes fix)
 * - Focus mode: klik op push = alleen dat artikel omlijnd + knop "Toon alle artikelen"
 * - Bron-filter: leest selectedSources uit IndexedDB + postMessage
 * - Snel: app.js / push.js altijd network-first
 */
const CACHE_NAME = 'ommen-v245-final';
const ICON_192 = './icons/icon-192x192.png';
const ICON_512 = './icons/icon-512x512.png';
const ICON_96 = './icons/icon-96x96.png';
const FALLBACK_ICON = './icon-192.png';
const BADGE = './icons/badge-simple-N-96.png';

const STATIC_ASSETS = [
  './',
  './index.html',
  ICON_192,
  ICON_512,
  ICON_96,
  FALLBACK_ICON,
  './manifest.json'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS.map(url => new Request(url, {cache: 'no-cache'}))).catch(()=>{});
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
  // Altijd vers voor app.js, push.js, informatie.html = snel laden fix
  if (url.pathname.includes('app.js') || url.pathname.includes('push.js') || url.pathname.includes('informatie.html') || url.pathname.includes('sw.js')) {
    event.respondWith(
      fetch(event.request, {cache: 'no-store'}).then(r => {
        const clone = r.clone();
        caches.open(CACHE_NAME).then(c => c.put(event.request, clone)).catch(()=>{});
        return r;
      }).catch(() => caches.match(event.request))
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request, {cache: 'no-store'}).catch(()=>cached))
  );
});

const PUSH_WORKER_URL = 'https://ommen-push-v2.leeuw008.workers.dev';

async function getFiltersFromClients() {
  try {
    const allClients = await self.clients.matchAll({type: 'window', includeUncontrolled: true});
    for (const client of allClients) {
      const filters = await new Promise(resolve => {
        const channel = new MessageChannel();
        let done = false;
        channel.port1.onmessage = (e) => { if (!done) { done = true; resolve(e.data); } };
        try { client.postMessage({type: 'GET_FILTERS'}, [channel.port2]); } catch { resolve(null); }
        setTimeout(() => { if (!done) { done = true; resolve(null); } }, 300);
      });
      if (filters && filters.sources && filters.sources.length > 0) return filters.sources;
    }
    return null;
  } catch { return null; }
}

async function getFiltersFromIDB() {
  try {
    const dbNames = ['nieuws-ommen', 'ommen-news', 'ommen-nieuws'];
    for (const dbName of dbNames) {
      try {
        const db = await new Promise((resolve, reject) => { const req = indexedDB.open(dbName); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
        if (!db.objectStoreNames.contains('settings')) { db.close(); continue; }
        const tx = db.transaction('settings', 'readonly'); const store = tx.objectStore('settings');
        const result = await new Promise(res => { const q = store.get('selectedSources'); q.onsuccess = () => res(q.result); q.onerror = () => res(null); });
        db.close();
        if (result && Array.isArray(result) && result.length > 0) return result;
        if (result && result.sources) return result.sources;
      } catch {}
    }
    return null;
  } catch { return null; }
}

async function getAllowedSources() {
  const fromClients = await getFiltersFromClients();
  if (fromClients && fromClients.length > 0) return fromClients;
  const fromIDB = await getFiltersFromIDB();
  if (fromIDB && fromIDB.length > 0) return fromIDB;
  return null;
}

self.addEventListener('push', event => {
  event.waitUntil((async () => {
    let title = 'Nieuw(s)Ommen';
    let body = 'Er is nieuw nieuws uit Ommen';
    let link = '/';
    let source = '';
    let articleId = '';

    if (event.data) {
      try {
        const data = event.data.json();
        title = data.title || title;
        body = data.body || data.title || body;
        link = data.link || data.url || link;
        source = data.source || '';
        articleId = data.id || data.articleId || '';
        if (source) body = `${source}: ${title}`;
      } catch {
        try { const txt = event.data.text(); if (txt) body = txt; } catch {}
      }
    } else {
      try {
        const r = await fetch(`${PUSH_WORKER_URL}/last`, { cache: 'no-store' });
        if (r.ok) {
          const j = await r.json();
          title = j.title || title;
          link = j.link || link;
          source = j.source || '';
          articleId = j.id || '';
          body = source ? `${source}: ${j.title}` : j.title;
        }
      } catch(e) { console.log('last fetch failed', e); }
    }

    try {
      const allowedSources = await getAllowedSources();
      if (allowedSources && allowedSources.length > 0 && source) {
        const normAllowed = allowedSources.map(s => String(s).toLowerCase());
        const normSource = String(source).toLowerCase();
        const isAllowed = normAllowed.some(a => normSource.includes(a) || a.includes(normSource) || normSource === a);
        if (!isAllowed) {
          console.log(`[v245] Push geblokkeerd door filter: "${source}" niet in [${allowedSources.join(', ')}]`);
          return;
        }
      }
    } catch {}

    // Icon fallback chain - voorkomt witte blokjes
    let iconToUse = ICON_192;
    const options = {
      body: body,
      icon: iconToUse,
      badge: ICON_96,
      data: { url: link, source: source, id: articleId },
      tag: articleId ? `ommen-${articleId}` : `ommen-${(source || 'algemeen').toLowerCase().replace(/\s+/g,'-')}-${Date.now()}`,
      renotify: false,
      vibrate: [100, 50, 100]
    };

    try {
      return await self.registration.showNotification(title, options);
    } catch (e) {
      console.log('Icon 192 fail, retry met fallback', e);
      try {
        options.icon = FALLBACK_ICON;
        options.badge = FALLBACK_ICON;
        return await self.registration.showNotification(title, options);
      } catch (e2) {
        console.log('Fallback ook fail, zonder icon', e2);
        delete options.icon;
        delete options.badge;
        return await self.registration.showNotification(title, options);
      }
    }
  })());
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const data = event.notification.data||{};
  const id = data.id||'';
  const externalUrl = data.url||'/';
  const source = data.source||'';
  const appUrl = `/?highlight=${encodeURIComponent(id)}&src=${encodeURIComponent(source)}&url=${encodeURIComponent(externalUrl)}`;
  event.waitUntil((async()=>{
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

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SET_FILTERS') {
    console.log('[v245] Filters ontvangen:', event.data.sources);
  }
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
