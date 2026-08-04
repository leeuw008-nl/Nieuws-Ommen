// push.js - GEISOLEERDE push logica, raakt script.js NIET aan - v11 - 9 bronnen
// Plaats dit als apart bestand naast script.js en laad het in index.html na script.js: <script src="./push.js"></script>
const PUSH_WORKER_URL = 'https://ommen-push-v2.leeuw008.workers.dev';

// ALLE 9 BRONNEN - moet gelijk zijn aan BRONNEN in index_final.html
const ALLE_BRONNEN = [
  "De Stentor",
  "Gemeente Ommen",
  "Ommen City",
  "OudOmmen",
  "RondOmmen",
  "RTV Oost",
  "RTV Vechtdal",
  "Salland Centraal",
  "Vechtdal Centraal"
];

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

async function getVapidPublicKey() {
  try {
    const r = await fetch(`${PUSH_WORKER_URL}/vapidPublicKey`, {cache:'no-store'});
    if(!r.ok) throw new Error('no key');
    return (await r.text()).trim();
  } catch(e){ console.error(e); return null; }
}

async function updatePushBell() {
  const bell = document.getElementById('push-bell') || document.getElementById('push-toggle') || document.getElementById('bell-slot')?.firstElementChild;
  const bellSlot = document.getElementById('bell-slot');
  // zoek echte bell button binnen slot
  const realBell = bellSlot?.querySelector('button') || document.getElementById('push-bell') || document.getElementById('push-toggle');
  if(!realBell && !bell) return;
  const target = realBell || bell;
  if(!('Notification' in window) || !('serviceWorker' in navigator)){ target.textContent='🔕'; return; }
  if(Notification.permission==='denied'){ target.textContent='🔕'; target.title='Meldingen geblokkeerd'; return; }
  try{
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    target.textContent = sub ? '🔔' : '🔕';
    target.style.opacity = sub ? '1' : '0.6';
    target.title = sub ? 'Meldingen aan (9 bronnen)' : 'Meldingen uit';
  }catch{}
}

function getSelectedSources(){
  // 1. probeer nieuwe v2 structuur uit index_final.html
  try{
    const v2 = JSON.parse(localStorage.getItem('nieuwsommen_bronnen_v2')||'{}');
    if(v2 && typeof v2 === 'object' && !Array.isArray(v2)){
      const aan = Object.keys(v2).filter(id=> v2[id]?.aan);
      if(aan.length>0) return aan;
    }
  }catch{}
  // 2. oude ommen_selected_sources
  try{
    const s = JSON.parse(localStorage.getItem('ommen_selected_sources')||'[]');
    if(Array.isArray(s) && s.length>0) return s;
  }catch{}
  // 3. fallback = alle 9 bronnen
  return [...ALLE_BRONNEN];
}

async function togglePushIsolated(){
  try{
    const vapidKey = await getVapidPublicKey();
    if(!vapidKey){ alert('VAPID key niet beschikbaar'); return; }
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if(sub){
      await fetch(`${PUSH_WORKER_URL}/unsubscribe`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({endpoint:sub.endpoint})});
      await sub.unsubscribe();
      localStorage.removeItem('ommen_push_subscribed');
      alert('Meldingen uitgezet');
      updatePushBell(); return;
    }
    const perm = await Notification.requestPermission();
    if(perm!=='granted'){ alert('Toestemming geweigerd'); return; }
    sub = await reg.pushManager.subscribe({userVisibleOnly:true, applicationServerKey:urlBase64ToUint8Array(vapidKey)});
    let sources = getSelectedSources();
    // zorg dat nieuwe bronnen ook meegenomen worden als user eerder alleen 7 had
    if(sources.length===7 && !sources.includes('RondOmmen')){
      // als oude 7, upgrade naar 9 automatisch? Nee, respecteer keuze maar voeg nieuwe toe als alles aan was
      // check of oude 7 allemaal aan waren = user had alles aan, dan ook nieuwe toevoegen
      if(sources.includes('De Stentor') && sources.includes('Vechtdal Centraal')){
        sources = [...ALLE_BRONNEN];
      }
    }
    await fetch(`${PUSH_WORKER_URL}/subscribe`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({endpoint:sub.endpoint, keys:{p256dh:btoa(String.fromCharCode(...new Uint8Array(sub.getKey('p256dh')))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''), auth:btoa(String.fromCharCode(...new Uint8Array(sub.getKey('auth')))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}, sources})});
    localStorage.setItem('ommen_push_subscribed','1');
    localStorage.setItem('ommen_selected_sources', JSON.stringify(sources));
    alert(`Meldingen aangezet! 🔔 (${sources.length} bronnen: ${sources.join(', ')})`);
    updatePushBell();
  }catch(e){ console.error(e); alert('Fout: '+e.message); }
}

// sync sources wanneer user bronnen aan/uit zet in de app
function syncPushSources(){
  try{
    const sources = getSelectedSources();
    localStorage.setItem('ommen_selected_sources', JSON.stringify(sources));
    // als al subscribed, update worker met nieuwe lijst (fire and forget)
    navigator.serviceWorker.ready.then(async reg=>{
      const sub = await reg.pushManager.getSubscription();
      if(!sub) return;
      fetch(`${PUSH_WORKER_URL}/subscribe`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({endpoint:sub.endpoint, keys:{p256dh:btoa(String.fromCharCode(...new Uint8Array(sub.getKey('p256dh')))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''), auth:btoa(String.fromCharCode(...new Uint8Array(sub.getKey('auth')))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}, sources})}).catch(()=>{});
    }).catch(()=>{});
  }catch{}
}

// init
window.addEventListener('load', ()=>{
  if('serviceWorker' in navigator){
    navigator.serviceWorker.ready.then(()=>updatePushBell()).catch(()=>{});
  }
  const bell = document.getElementById('push-bell') || document.getElementById('push-toggle');
  if(bell) bell.addEventListener('click', togglePushIsolated);
  // bell-slot kan later gevuld worden via moveOldBell, dus observer
  const slot = document.getElementById('bell-slot');
  if(slot){
    const obs = new MutationObserver(()=>{
      const btn = slot.querySelector('button');
      if(btn && !btn._pushBound){
        btn._pushBound = true;
        btn.addEventListener('click', (e)=>{ e.stopPropagation(); togglePushIsolated(); });
        updatePushBell();
      }
    });
    obs.observe(slot, {childList:true});
    // ook direct proberen
    setTimeout(()=>{
      const btn = slot.querySelector('button');
      if(btn){
        btn.addEventListener('click', (e)=>{ e.stopPropagation(); togglePushIsolated(); });
      }
    }, 500);
  }
  // sync bij wijziging bronnen
  window.addEventListener('storage', (e)=>{
    if(e.key==='nieuwsommen_bronnen_v2') syncPushSources();
  });
});
window.togglePush = togglePushIsolated;
window.syncPushSources = syncPushSources;
window.ALLE_BRONNEN = ALLE_BRONNEN;
