/* service-worker v231 - FILTER FIX + NO-PAYLOAD
 * Werkt met worker-v20-FIXED-ENCRYPT + v2
 * - Bevat app.js fix (geen script.js meer)
 * - No-payload: haalt zelf /last op als push geen data heeft
 * - NIEUW: respecteert filterpagina voor zowel weergave als notifications
 *   (zoals bedoeld in info-pagina)
 */

const CACHE_NAME = 'ommen-v231';
const STATIC_ASSETS = [
  './',
  './index.html',
  './icon-192.png',
  './icon-512.png'
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

// Network-first voor app.js (v230 fix), cache-first voor rest
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

// Probeer filters op te halen uit open tabs (app.js moet message listener hebben)
async function getFiltersFromClients() {
  try {
    const allClients = await self.clients.matchAll({type: 'window', includeUncontrolled: true});
    if (allClients.length === 0) return null;
    for (const client of allClients) {
      const filters = await new Promise(resolve => {
        const channel = new MessageChannel();
        let done = false;
        channel.port1.onmessage = (e) => {
          if (!done) { done = true; resolve(e.data); }
        };
        try {
          client.postMessage({type: 'GET_FILTERS'}, [channel.port2]);
        } catch (err) {
          resolve(null);
        }
        setTimeout(() => { if (!done) { done = true; resolve(null); } }, 400);
      });
      if (filters && filters.sources) {
        return filters.sources;
      }
    }
    return null;
  } catch (e) {
    return null;
  }
}

async function getFiltersFromIDB() {
  try {
    const dbNames = ['nieuws-ommen', 'ommen-news', 'ommen-nieuws'];
    for (const dbName of dbNames) {
      try {
        const db = await new Promise((resolve, reject) => {
          const req = indexedDB.open(dbName);
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });
        if (!db.objectStoreNames.contains('settings')) { db.close(); continue; }
        const tx = db.transaction('settings', 'readonly');
        const store = tx.objectStore('settings');
        const result = await new Promise(res => {
          const q = store.get('selectedSources');
          q.onsuccess = () => res(q.result);
          q.onerror = () => res(null);
        });
        db.close();
        if (result && Array.isArray(result) && result.length > 0) return result;
        if (result && result.sources) return result.sources;
      } catch (e) {}
    }
    return null;
  } catch (e) {
    return null;
  }
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
    let title = 'Nieuws Ommen';
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
      } catch(e) {
        try {
          const txt = event.data.text();
          if (txt) body = txt;
        } catch {}
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
      } catch(e) {
        console.log('last fetch failed', e);
      }
    }

    try {
      const allowedSources = await getAllowedSources();
      if (allowedSources && allowedSources.length > 0 && source) {
        const normAllowed = allowedSources.map(s => String(s).toLowerCase());
        const normSource = String(source).toLowerCase();
        const isAllowed = normAllowed.some(a => normSource.includes(a) || a.includes(normSource) || normSource === a);
        if (!isAllowed) {
          console.log(`[v231] Push geblokkeerd door filter: bron "${source}" niet in [${allowedSources.join(', ')}]`);
          return;
        }
      }
    } catch (filterErr) {
      console.log('Filter check failed, toch tonen', filterErr);
    }

    const options = {
      body: body,
      icon: './icon-192.png',
      badge: './icon-192.png',
      data: { url: link, source: source, id: articleId },
      tag: articleId ? `ommen-${articleId}` : `ommen-${source || 'algemeen'}-${Date.now()}`,
      renotify: true,
      vibrate: [100, 50, 100]
    };

    return self.registration.showNotification(title, options);
  })());
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(windowClients => {
      for (const client of windowClients) {
        if ((client.url.includes('Nieuws-Ommen') || client.url.includes('nieuwommen')) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SET_FILTERS') {
    console.log('[v231] Filters ontvangen van app:', event.data.sources);
  }
});
