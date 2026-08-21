// service-worker.js v243 FINAL - COMPLETE VERVANGING
// Gebaseerd op v241-focus-fix (die prachtig werkte) + fixes voor witte blokken en bron
// CACHE_NAME = ommen-v243-final
const CACHE_NAME = 'ommen-v243-final';

// --- ICONS - ALLEEN RELATIEF, GEEN ABSOLUTE / PATHS DIE WITTE BLOKKEN GEVEN ---
const ICON_192 = './icons/icon-192x192.png';
const ICON_512 = './icons/icon-512x512.png';
const ICON_96 = './icons/icon-96x96.png';
const BADGE_ICON = './icons/badge-simple-N-96.png';

// Fallbacks - chain voor notificatie icon
const FALLBACK_ICON = './icon-192.png';
const FALLBACK_ICON2 = './icons/icon-192x192.png';
const FALLBACK_ABS = 'https://nieuwommen.leeuw008.nl/icons/icon-192x192.png';
const FALLBACK_ABS_512 = 'https://nieuwommen.leeuw008.nl/icons/icon-512x512.png';

// Alleen bestanden die 100% bestaan
const STATIC_ASSETS = [
  './',
  './index.html',
  ICON_192,
  ICON_512,
  ICON_96
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS).catch(() => cache.addAll(['./', './index.html'])))
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

// ---- FOCUS MODE INJECTIE - v243 FINAL (werkt zonder app.js te editen) ----
const FOCUS_STYLE = `<style id="ommen-focus-style">
.hl-om{outline:3px solid #0b5bd3 !important; outline-offset:3px; background:#eff6ff !important; box-shadow:0 0 0 6px rgba(11,91,211,.15), 0 8px 24px rgba(0,0,0,.12) !important; border-radius:12px; position:relative; transition: all .2s ease;}
.hl-om::after{content:attr(data-src-badge); position:absolute; top:-10px; right:-8px; background:#0b5bd3; color:#fff; font-size:11px; font-weight:800; padding:3px 8px; border-radius:999px; letter-spacing:.02em; box-shadow:0 2px 8px rgba(0,0,0,.2); z-index:2;}
#backToAll{position:sticky; top:72px; z-index:50; margin:12px auto; display:block; padding:12px 22px; background:#0b5bd3; color:#fff; border:0; border-radius:24px; font-weight:800; cursor:pointer; box-shadow:0 4px 16px rgba(11,91,211,.35);}
#backToAll:hover{background:#0948a8;}
</style>`;

const FOCUS_SCRIPT = `<script>(()=>{try{
const p=new URLSearchParams(location.search);
const hid=p.get('highlight');
const src=p.get('src');
const urlParam=p.get('url');
if(!hid) return;
const run=()=>{
  let el=null;
  try{ el=document.querySelector('[data-id="'+CSS.escape(hid)+'"]'); }catch{}
  if(!el) el=document.getElementById(hid)||document.querySelector('[data-id="'+hid+'"]');
  if(!el){
    // fallback: zoek op titel bevat id (voor oude artikelen)
    const all=document.querySelectorAll('[data-id]');
    for(const a of all){ if(a.getAttribute('data-id') && hid.includes(a.getAttribute('data-id').slice(0,10))){ el=a; break; } }
  }
  if(!el){ setTimeout(run,400); return; }
  el.classList.add('hl-om');
  if(src){ el.setAttribute('data-src-badge', src); }
  el.scrollIntoView({behavior:'smooth', block:'center'});
  if(document.getElementById('backToAll')) return;
  const b=document.createElement('button');
  b.id='backToAll';
  b.textContent='← Terug naar alle bronnen';
  b.addEventListener('click',()=>{
    el.classList.remove('hl-om');
    b.remove();
    const u=new URL(location.href);
    u.searchParams.delete('highlight');
    u.searchParams.delete('src');
    u.searchParams.delete('url');
    history.replaceState(null,'',u.pathname+(u.search?u.search:'')+u.hash);
    // optioneel: scroll naar top
    window.scrollTo({top:0, behavior:'smooth'});
  });
  (document.querySelector('main')||document.body).prepend(b);
  // Als er een urlParam is, highlight ook visueel dat dit het push-artikel is
  if(urlParam){ console.log('[SW Focus] highlight', hid, src, urlParam); }
};
if(document.readyState==='loading'){ document.addEventListener('DOMContentLoaded', run); }else{ run(); }
}catch(e){ console.warn('[SW Focus] error', e); }})();<\/script>`;

// ---- FETCH HANDLER ----
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const accept = req.headers.get('Accept') || '';
  const isNav = req.mode === 'navigate' || accept.includes('text/html');
  const isIndex = url.origin === self.location.origin && (
    url.pathname === '/' ||
    url.pathname.endsWith('/index.html') ||
    url.pathname.endsWith('/Nieuws-Ommen/') ||
    url.pathname.endsWith('/Nieuws-Ommen')
  );

  // 1) Index navigatie: injecteer focus style + script, altijd network-first
  if (isIndex && isNav) {
    event.respondWith(
      fetch(req).then(async (res) => {
        if (!res.ok) return res;
        const clone = res.clone();
        const text = await clone.text();
        if (!text.includes('</body>')) return res;
        if (text.includes('ommen-focus-style')) return res; // al geinjecteerd
        const injected = text.replace('</body>', FOCUS_STYLE + FOCUS_SCRIPT + '</body>');
        return new Response(injected, {
          status: res.status,
          statusText: res.statusText,
          headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' }
        });
      }).catch(() => caches.match('./index.html').then(r => r || caches.match('/index.html')))
    );
    return;
  }

  // 2) Dynamische app bestanden: network-first (voorkomt oude cache)
  if (url.origin === self.location.origin) {
    const path = url.pathname;
    if (path.endsWith('/app.js') || path.endsWith('/push.js') || path.includes('app.js') || path.includes('push.js') || path.endsWith('informatie.html')) {
      event.respondWith(
        fetch(req).then((r) => {
          if (r.ok) {
            const c = r.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, c));
          }
          return r;
        }).catch(() => caches.match(req))
      );
      return;
    }
  }

  // 3) Static assets: cache-first met fallback
  const isStatic = STATIC_ASSETS.some(a => url.pathname.endsWith(a.replace('./',''))) ||
                   url.pathname.includes('/icons/');

  if (isStatic) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((r) => {
          if (r.ok) {
            const c = r.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, c));
          }
          return r;
        }).catch(() => cached || caches.match(ICON_192) || caches.match(FALLBACK_ICON));
      })
    );
    return;
  }

  // 4) Rest: network, fallback cache
  event.respondWith(fetch(req).catch(() => caches.match(req)));
});

// ---- FILTERS - v243: check 4 mogelijke IDB namen + client cache ----
let cachedFilters = null;

async function getFiltersFromClients() {
  if (cachedFilters && Array.isArray(cachedFilters) && cachedFilters.length) return cachedFilters;
  try {
    // We kunnen geen directe data uit clients lezen zonder message, dus gebruik cache
    await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
    return cachedFilters;
  } catch { return cachedFilters; }
}

function openIDB(dbName) {
  return new Promise((resolve) => {
    try {
      const open = indexedDB.open(dbName, 1);
      open.onupgradeneeded = () => {
        const db = open.result;
        if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings');
      };
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
}

async function getFiltersFromIDB() {
  const dbNames = ['nieuws-ommen', 'ommen-news', 'ommen-nieuws', 'ommen-filters'];
  for (const dbName of dbNames) {
    try {
      const db = await openIDB(dbName);
      if (!db) continue;
      if (!db.objectStoreNames.contains('settings')) { db.close(); continue; }
      const result = await new Promise((resolve) => {
        try {
          const tx = db.transaction('settings', 'readonly');
          const store = tx.objectStore('settings');
          const req = store.get('filters');
          req.onsuccess = () => resolve(req.result || null);
          req.onerror = () => resolve(null);
        } catch { resolve(null); }
      });
      db.close();
      if (result) {
        if (Array.isArray(result)) return result;
        if (result.allowed && Array.isArray(result.allowed)) return result.allowed;
        if (result.sources && Array.isArray(result.sources)) return result.sources;
      }
    } catch { /* next db */ }
  }
  return null;
}

async function getAllowedSources() {
  const fromClients = await getFiltersFromClients();
  if (fromClients && Array.isArray(fromClients) && fromClients.length) return fromClients;
  const fromIDB = await getFiltersFromIDB();
  if (fromIDB && fromIDB.length) return fromIDB;
  return null; // null = alles toegestaan
}

// ---- PUSH: BRON FIX + ICON FALLBACK CHAIN v243 ----
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; }
  catch {
    try { data = { title: event.data ? event.data.text() : 'Nieuw bericht' }; }
    catch { data = {}; }
  }

  const source = (data.source || data.src || data.bron || data.feed || '').toString().trim();
  const originalTitle = (data.title || data.body || 'Nieuw bericht').toString().trim();
  const linkUrl = (data.url || data.link || data.href || '').toString();
  const pushId = (data.id || data.dataId || data.guid || originalTitle || Date.now()).toString();

  // BRON FIX: titel = bron, body = "Bron: Titel" - precies zoals v241 focus fix deed
  let notifTitle = source ? source : originalTitle;
  let notifBody = source ? `${source}: ${originalTitle}` : originalTitle;
  if (source) {
    const lowBody = originalTitle.toLowerCase();
    const lowSrc = source.toLowerCase();
    if (lowBody.startsWith(lowSrc)) {
      notifBody = originalTitle; // voorkom dubbel "RTV Oost: RTV Oost: ..."
    }
  }

  event.waitUntil((async () => {
    const allowed = await getAllowedSources();
    if (allowed && allowed.length > 0 && source && !allowed.includes(source)) {
      console.log('[SW Push] Geblokkeerd door filter:', source, 'allowed:', allowed);
      return;
    }

    const baseOptions = {
      body: notifBody,
      badge: BADGE_ICON,
      data: { id: pushId, source: source, url: linkUrl, originalTitle: originalTitle },
      tag: `ommen-${pushId}`,
      renotify: true,
      requireInteraction: false,
      vibrate: [100,50,100]
    };

    // Icon fallback chain - voorkomt witte blokken
    try {
      return await self.registration.showNotification(notifTitle, { ...baseOptions, icon: ICON_192 });
    } catch (e) {
      console.warn('[SW] icon 192 failed, fallback', e);
      try {
        return await self.registration.showNotification(notifTitle, { ...baseOptions, icon: FALLBACK_ICON });
      } catch (e2) {
        try {
          return await self.registration.showNotification(notifTitle, { ...baseOptions, icon: FALLBACK_ABS });
        } catch (e3) {
          try {
            return await self.registration.showNotification(notifTitle, { ...baseOptions, icon: FALLBACK_ABS_512 });
          } catch (e4) {
            // Laatste redmiddel: zonder icon - voorkomt falen op sommige launchers
            return await self.registration.showNotification(notifTitle, { ...baseOptions });
          }
        }
      }
    }
  })());
});

// ---- NOTIFICATION CLICK: focus met highlight + bron badge ----
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const d = event.notification.data || {};
  const id = d.id || '';
  const src = d.source || '';
  const urlParam = d.url || '';

  const targetUrl = `./?highlight=${encodeURIComponent(id)}&src=${encodeURIComponent(src)}&url=${encodeURIComponent(urlParam)}`;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.includes(self.location.origin) && 'focus' in c) {
          // bestaande tab focusen + navigeren
          if ('navigate' in c) c.navigate(targetUrl);
          return c.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// ---- MESSAGE HANDLER ----
self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data) return;

  if (data === 'SKIP_WAITING' || (data.type && data.type === 'SKIP_WAITING')) {
    self.skipWaiting();
  }

  if (data.type === 'SET_FILTERS') {
    // Vanuit app.js: filters live updaten zonder IDB te wachten
    if (Array.isArray(data.filters)) {
      cachedFilters = data.filters;
      console.log('[SW] Filters geupdate via message:', cachedFilters);
    } else if (data.filters && Array.isArray(data.filters.allowed)) {
      cachedFilters = data.filters.allowed;
    }
  }

  if (data.type === 'GET_CACHE_NAME') {
    if (event.ports && event.ports[0]) {
      event.ports[0].postMessage({ cacheName: CACHE_NAME, version: 'v243-final' });
    }
  }

  if (data.type === 'GET_VERSION') {
    if (event.ports && event.ports[0]) {
      event.ports[0].postMessage({ version: 'ommen-v243-final', cache: CACHE_NAME });
    }
  }
});

console.log('[SW] Ommen SW v243 FINAL geladen -', CACHE_NAME);
