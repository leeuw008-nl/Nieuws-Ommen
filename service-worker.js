// service-worker v242-hangfix - FIX voor hangen op "Bezig met laden..."
// CACHE_NAME = 'ommen-v242-hangfix' -> forceert oude caches te verwijderen
const CACHE_NAME = 'ommen-v242-hangfix';
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

const NETWORK_FIRST_KEYWORDS = [
  'app.js',
  '/proxy',
  '/check',
  '/last',
  '/sync',
  '/rss',
  '/feed',
  '.xml',
  'ommen-push-v2.leeuw008.workers.dev'
];

self.addEventListener('install', (event) => {
  console.log('[SW v242-hangfix] Install');
  // @ts-ignore
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  console.log('[SW v242-hangfix] Activate - oude caches opruimen');
  // @ts-ignore
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW v242-hangfix] Verwijder oude cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

function isNetworkFirst(url) {
  const u = url.toLowerCase();
  return NETWORK_FIRST_KEYWORDS.some(k => u.includes(k));
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // Network-first voor kritieke bestanden
  if (isNetworkFirst(req.url)) {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req, { cache: 'no-store' });
          // Alleen cachen als het geen proxy/check response is die dynamisch is
          // Voor app.js wél cachen zodat offline nog werkt, maar altijd eerst netwerk proberen
          if (req.url.includes('app.js')) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(req, fresh.clone());
          }
          return fresh;
        } catch (e) {
          console.warn('[SW v242-hangfix] Netwerk mislukt, fallback naar cache:', req.url);
          const cached = await caches.match(req);
          if (cached) return cached;
          throw e;
        }
      })()
    );
    return;
  }

  // Cache-first voor overige assets (images, css, fonts)
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        // Alleen succesvolle GETs cachen
        if (res.ok && req.url.startsWith(self.location.origin)) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, clone));
        }
        return res;
      });
    })
  );
});
