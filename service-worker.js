const CACHE_NAME = 'ommen-v241-focus-fix';
const ICON_192 = '/icons/icon-192x192.png';
const ICON_512 = '/icons/icon-512x512.png';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/app.js',
  '/styles.css',
  '/manifest.json',
  ICON_192,
  ICON_512
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ---- Focus Mode Injectie (zonder app.js te editen) ----
const FOCUS_STYLE = `<style id="ommen-focus-style">.hl-om{outline:3px solid #0b5bd3 !important; outline-offset:3px; background:#eff6ff !important; box-shadow:0 0 0 6px rgba(11,91,211,.15), 0 8px 24px rgba(0,0,0,.12) !important; border-radius:12px;} #backToAll{position:sticky; top:72px; z-index:20; margin:12px auto; display:block; padding:12px 22px; background:#0b5bd3; color:#fff; border:0; border-radius:24px; font-weight:800; cursor:pointer;}</style>`;

const FOCUS_SCRIPT = `<script>(()=>{const p=new URLSearchParams(location.search);const hid=p.get('highlight');const src=p.get('src');if(!hid)return;const run=()=>{let el=null;try{el=document.querySelector('[data-id="'+CSS.escape(hid)+'"]')}catch{}if(!el)el=document.getElementById(hid)||document.querySelector('[data-id="'+hid+'"]');if(!el){setTimeout(run,350);return;}el.classList.add('hl-om');el.scrollIntoView({behavior:'smooth',block:'center'});if(document.getElementById('backToAll'))return;const b=document.createElement('button');b.id='backToAll';b.textContent='← Terug naar alle bronnen';b.addEventListener('click',()=>{el.classList.remove('hl-om');b.remove();const u=new URL(location.href);u.searchParams.delete('highlight');u.searchParams.delete('src');u.searchParams.delete('url');history.replaceState(null,'',u.pathname+(u.search?u.search:'')+u.hash);});(document.querySelector('main')||document.body).prepend(b);};if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',run);}else{run();}})();<\/script>`;

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const isIndex = url.origin === self.location.origin && (url.pathname === '/' || url.pathname === '/index.html' || url.pathname.endsWith('/index.html'));
  const accept = req.headers.get('Accept') || '';
  const isNav = req.mode === 'navigate' || accept.includes('text/html');

  if (isIndex && isNav) {
    event.respondWith(
      fetch(req).then(async (res) => {
        if (!res.ok) return res;
        // only inject for html
        const ct = res.headers.get('Content-Type') || '';
        if (!ct.includes('text/html') && !accept.includes('text/html') && req.mode !== 'navigate') {
          // still try to inject if it's index, but check body
        }
        const clone = res.clone();
        const text = await clone.text();
        if (!text.includes('</body>')) return res;
        if (text.includes('ommen-focus-style')) return res;
        const injected = text.replace('</body>', FOCUS_STYLE + FOCUS_SCRIPT + '</body>');
        return new Response(injected, {
          status: res.status,
          statusText: res.statusText,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-cache'
          }
        });
      }).catch(() => caches.match('/index.html'))
    );
    return;
  }

  if (STATIC_ASSETS.includes(url.pathname)) {
    event.respondWith(
      caches.match(req).then((cached) => cached || fetch(req).then((r) => {
        if (r.ok) {
          const c = r.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, c));
        }
        return r;
      }))
    );
    return;
  }

  event.respondWith(fetch(req).catch(() => caches.match(req)));
});

// ---- Filters (zelfde als v240) ----
async function getFiltersFromClients() {
  try {
    const all = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
    return null; // IDB is leading, clients kunnen via message syncen
  } catch {
    return null;
  }
}

function getFiltersFromIDB() {
  return new Promise((resolve) => {
    try {
      const open = indexedDB.open('ommen-filters', 1);
      open.onupgradeneeded = () => {
        const db = open.result;
        if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings');
      };
      open.onsuccess = () => {
        const db = open.result;
        if (!db.objectStoreNames.contains('settings')) { resolve(null); return; }
        const tx = db.transaction('settings', 'readonly');
        const store = tx.objectStore('settings');
        const req = store.get('filters');
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      };
      open.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function getAllowedSources() {
  const fromClients = await getFiltersFromClients();
  if (fromClients && Array.isArray(fromClients) && fromClients.length) return fromClients;

  const fromIDB = await getFiltersFromIDB();
  if (fromIDB) {
    if (Array.isArray(fromIDB)) return fromIDB;
    if (fromIDB.allowed && Array.isArray(fromIDB.allowed)) return fromIDB.allowed;
    if (fromIDB.sources && Array.isArray(fromIDB.sources)) return fromIDB.sources;
  }
  return null;
}

// ---- Push: BRON FIX ----
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    try { data = { title: event.data ? event.data.text() : 'Nieuw bericht' }; }
    catch { data = {}; }
  }

  const source = (data.source || data.src || data.bron || '').toString().trim();
  const originalTitle = (data.title || data.body || 'Nieuw bericht').toString().trim();
  const linkUrl = (data.url || data.link || data.href || '').toString();
  const pushId = (data.id || data.dataId || originalTitle || Date.now()).toString();

  // 1. Bron altijd tonen: title = source, body = title (prefix met source als nog niet aanwezig)
  let notifTitle = source ? source : originalTitle;
  let notifBody = originalTitle;

  if (source) {
    const lowBody = originalTitle.toLowerCase();
    const lowSrc = source.toLowerCase();
    if (!lowBody.startsWith(lowSrc)) {
      notifBody = `${source}: ${originalTitle}`;
    }
  }

  event.waitUntil((async () => {
    const allowed = await getAllowedSources();
    if (allowed && allowed.length > 0 && source && !allowed.includes(source)) {
      return; // gefilterd
    }

    const options = {
      body: notifBody,
      icon: ICON_192,
      badge: ICON_192,
      data: {
        id: pushId,
        source: source,
        url: linkUrl,
        originalTitle: originalTitle
      },
      tag: `ommen-${pushId}`,
      renotify: true
    };

    return self.registration.showNotification(notifTitle, options);
  })());
});

// ---- Click: highlight met bron + omlijning ----
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const d = event.notification.data || {};
  const id = d.id || '';
  const src = d.source || '';
  const urlParam = d.url || '';

  const targetUrl = `/?highlight=${encodeURIComponent(id)}&src=${encodeURIComponent(src)}&url=${encodeURIComponent(urlParam)}`;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.includes(self.location.origin) && 'focus' in c) {
          c.navigate(targetUrl);
          return c.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// ---- Messages ----
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING' || (event.data && event.data.type === 'SKIP_WAITING')) {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'GET_CACHE_NAME') {
    event.ports && event.ports[0] && event.ports[0].postMessage({ cacheName: CACHE_NAME });
  }
});
