// push.js - GEISOLEERDE push logica - v12 - 9 BRONNEN - GEEN opmaak wijziging
const PUSH_WORKER_URL = 'https://ommen-push-v2.leeuw008.workers.dev';
const ALLE_BRONNEN = ["De Stentor","Gemeente Ommen","Ommen City","OudOmmen","RondOmmen","RTV Oost","RTV Vechtdal","Salland Centraal","Vechtdal Centraal"];

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
  const target = document.getElementById('bell-slot')?.querySelector('button') || document.getElementById('push-bell') || document.getElementById('push-toggle');
  if(!target) return;
  if(!('Notification' in window) || !('serviceWorker' in navigator)){ target.textContent='🔕'; return; }
  if(Notification.permission==='denied'){ target.textContent='🔕'; target.title='Meldingen geblokkeerd'; return; }
  try{
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    target.textContent = sub ? '🔔' : '🔕';
    target.style.opacity = sub ? '1' : '0.6';
    target.title = sub ? `Meldingen aan (${ALLE_BRONNEN.length} bronnen)` : 'Meldingen uit';
  }catch{}
}
function getSelectedSources(){
  try{
    const v2 = JSON.parse(localStorage.getItem('nieuwsommen_bronnen_v2')||'{}');
    if(v2 && typeof v2 === 'object' && !Array.isArray(v2) && Object.keys(v2).length>0){
      const aan = Object.keys(v2).filter(id=> v2[id]?.aan);
      if(aan.length>0) return aan;
    }
  }catch{}
  try{
    const s = JSON.parse(localStorage.getItem('ommen_selected_sources')||'[]');
    if(Array.isArray(s) && s.length>0){
      // als oude lijst 7 bevat, upgrade naar 9 als alles aan was
      if(s.length===7 && !s.includes('RondOmmen')){
        return [...ALLE_BRONNEN];
      }
      return s;
    }
  }catch{}
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
    await fetch(`${PUSH_WORKER_URL}/subscribe`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({endpoint:sub.endpoint, keys:{p256dh:btoa(String.fromCharCode(...new Uint8Array(sub.getKey('p256dh')))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''), auth:btoa(String.fromCharCode(...new Uint8Array(sub.getKey('auth')))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}, sources})});
    localStorage.setItem('ommen_push_subscribed','1');
    localStorage.setItem('ommen_selected_sources', JSON.stringify(sources));
    alert(`Meldingen aangezet! 🔔 (${sources.length} bronnen)`);
    updatePushBell();
  }catch(e){ console.error(e); alert('Fout: '+e.message); }
}
function syncPushSources(){
  try{
    const sources = getSelectedSources();
    localStorage.setItem('ommen_selected_sources', JSON.stringify(sources));
    navigator.serviceWorker.ready.then(async reg=>{
      const sub = await reg.pushManager.getSubscription();
      if(!sub) return;
      fetch(`${PUSH_WORKER_URL}/subscribe`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({endpoint:sub.endpoint, keys:{p256dh:btoa(String.fromCharCode(...new Uint8Array(sub.getKey('p256dh')))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''), auth:btoa(String.fromCharCode(...new Uint8Array(sub.getKey('auth')))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}, sources})}).catch(()=>{});
    }).catch(()=>{});
  }catch{}
}
window.addEventListener('load', ()=>{
  if('serviceWorker' in navigator){
    navigator.serviceWorker.ready.then(()=>updatePushBell()).catch(()=>{});
  }
  const bell = document.getElementById('push-bell') || document.getElementById('push-toggle');
  if(bell) bell.addEventListener('click', togglePushIsolated);
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
    setTimeout(()=>{
      const btn = slot.querySelector('button');
      if(btn && !btn._pushBound){
        btn._pushBound = true;
        btn.addEventListener('click', (e)=>{ e.stopPropagation(); togglePushIsolated(); });
      }
    }, 500);
  }
});
window.togglePush = togglePushIsolated;
window.syncPushSources = syncPushSources;
window.ALLE_BRONNEN = ALLE_BRONNEN;
