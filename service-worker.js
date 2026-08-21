/* service-worker v241 - FIX SYNC + Nieuw(s)Ommen + ICON FIX
 * - Fix: /proxy/rss/feed network-first (was cache-first in v240 -> sync traag)
 * - Alleen filter syncen, artikelen haalt app zelf op
 */
const CACHE_NAME = 'ommen-v241-syncfix';
const ICON_192 = '/icons/icon-192x192.png';
const ICON_512 = '/icons/icon-512x512.png';
const ICON_96 = '/icons/icon-96x96.png';
const BADGE = '/icons/badge-simple-N-96.png';
const STATIC_ASSETS = ['./','./index.html',ICON_192,ICON_512,ICON_96];
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS.map(url => new Request(url, {cache: 'no-cache'}))).catch(()=>{})));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.pathname.includes('app.js') || url.pathname.includes('push.js') || url.pathname.includes('informatie.html') || url.pathname.includes('/proxy') || url.pathname.includes('/check') || url.pathname.includes('/last') || url.pathname.includes('/debug') || url.href.includes('rss') || url.href.includes('feed') || url.href.includes('.xml')) {
    event.respondWith(fetch(event.request, {cache: 'no-store'}).then(r => {const clone=r.clone();caches.open(CACHE_NAME).then(c=>c.put(event.request,clone));return r;}).catch(()=>caches.match(event.request)));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request)));
});
const PUSH_WORKER_URL='https://ommen-push-v2.leeuw008.workers.dev';
async function getFiltersFromClients(){try{const all=await self.clients.matchAll({type:'window',includeUncontrolled:true});for(const c of all){const f=await new Promise(res=>{const ch=new MessageChannel();let d=false;ch.port1.onmessage=e=>{if(!d){d=true;res(e.data);}};try{c.postMessage({type:'GET_FILTERS'},[ch.port2]);}catch{res(null);}setTimeout(()=>{if(!d){d=true;res(null);}},300);});if(f&&f.sources&&f.sources.length>0)return f.sources;}return null;}catch{return null;}}
async function getFiltersFromIDB(){try{for(const dbName of ['nieuws-ommen','ommen-news','ommen-nieuws']){try{const db=await new Promise((res,rej)=>{const r=indexedDB.open(dbName);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});if(!db.objectStoreNames.contains('settings')){db.close();continue;}const tx=db.transaction('settings','readonly');const store=tx.objectStore('settings');const result=await new Promise(res=>{const q=store.get('selectedSources');q.onsuccess=()=>res(q.result);q.onerror=()=>res(null);});db.close();if(result&&Array.isArray(result)&&result.length>0)return result;if(result&&result.sources)return result.sources;}catch{}}return null;}catch{return null;}}
async function getAllowedSources(){const a=await getFiltersFromClients();if(a&&a.length>0)return a;const b=await getFiltersFromIDB();if(b&&b.length>0)return b;return null;}
self.addEventListener('push', event => {
  event.waitUntil((async () => {
    let title='Nieuw(s)Ommen',body='Er is nieuw nieuws uit Ommen',link='/',source='',articleId='';
    if(event.data){try{const d=event.data.json();title=d.title||title;body=d.body||d.title||body;link=d.link||d.url||link;source=d.source||'';articleId=d.id||d.articleId||'';if(source)body=`${source}: ${title}`;}catch{try{const txt=event.data.text();if(txt)body=txt;}catch{}}}
    else{try{const r=await fetch(`${PUSH_WORKER_URL}/last`,{cache:'no-store'});if(r.ok){const j=await r.json();title=j.title||title;link=j.link||link;source=j.source||'';articleId=j.id||'';body=source?`${source}: ${j.title}`:j.title;}}catch{}}
    try{const allowed=await getAllowedSources();if(allowed&&allowed.length>0&&source){const na=allowed.map(s=>String(s).toLowerCase());const ns=String(source).toLowerCase();if(!na.some(a=>ns.includes(a)||a.includes(ns)||ns===a))return;}}catch{}
    const options={body,icon:ICON_192,badge:ICON_96,data:{url:link,source,id:articleId},tag:articleId?`ommen-${articleId}`:`ommen-${source||'algemeen'}-${Date.now()}`,renotify:false,vibrate:[100,50,100]};
    try{return await self.registration.showNotification(title,options);}catch{delete options.badge;return await self.registration.showNotification(title,options);}
  })());
});
self.addEventListener('notificationclick', event => {
  event.notification.close();const data=event.notification.data||{};const id=data.id||'';const externalUrl=data.url||'/';const source=data.source||'';const appUrl=`/?highlight=${encodeURIComponent(id)}&src=${encodeURIComponent(source)}&url=${encodeURIComponent(externalUrl)}`;
  event.waitUntil((async()=>{try{const all=await clients.matchAll({type:'window',includeUncontrolled:true});for(const c of all){if((c.url.includes('nieuwommen')||c.url.includes('Nieuws-Ommen')||c.url.includes('localhost'))&&'focus' in c){try{c.postMessage({type:'NOTIFICATION_CLICK',id,url:externalUrl,source});}catch{}await c.navigate(appUrl);return c.focus();}}if(clients.openWindow)return clients.openWindow(appUrl);}catch{if(clients.openWindow)return clients.openWindow(appUrl);}})());
});
self.addEventListener('message', event => {if(event.data&&event.data.type==='SET_FILTERS'){console.log('[v241] Filters:',event.data.sources);}});
