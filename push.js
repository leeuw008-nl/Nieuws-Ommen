// push.js - GEISOLEERDE push logica, raakt script.js NIET aan
// Plaats dit als apart bestand naast script.js en laad het in index.html na script.js: <script src="./push.js"></script>
   const PUSH_WORKER_URL = 'https://ommen-push-v2.leeuw008.workers.dev';

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
  const bell = document.getElementById('push-bell') || document.getElementById('push-toggle');
  if(!bell) return;
  if(!('Notification' in window) || !('serviceWorker' in navigator)){ bell.textContent='🔕'; return; }
  if(Notification.permission==='denied'){ bell.textContent='🔕'; bell.title='Meldingen geblokkeerd'; return; }
  try{
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    bell.textContent = sub ? '🔔' : '🔕';
    bell.style.opacity = sub ? '1' : '0.6';
    bell.title = sub ? 'Meldingen aan' : 'Meldingen uit';
  }catch{}
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
    // bronnen uit localStorage of alles
    let sources = [];
    try{ const s = JSON.parse(localStorage.getItem('ommen_selected_sources')||'[]'); if(Array.isArray(s)) sources=s; }catch{}
    if(sources.length===0) sources=["De Stentor","Gemeente Ommen","Ommen City","OudOmmen","RTV Oost","RTV Vechtdal","Vechtdal Centraal"];
    await fetch(`${PUSH_WORKER_URL}/subscribe`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({endpoint:sub.endpoint, keys:{p256dh:btoa(String.fromCharCode(...new Uint8Array(sub.getKey('p256dh')))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''), auth:btoa(String.fromCharCode(...new Uint8Array(sub.getKey('auth')))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}, sources})});
    localStorage.setItem('ommen_push_subscribed','1');
    alert('Meldingen aangezet! 🔔');
    updatePushBell();
  }catch(e){ console.error(e); alert('Fout: '+e.message); }
}

// init - wacht tot service worker klaar is
window.addEventListener('load', ()=>{
  if('serviceWorker' in navigator){
    navigator.serviceWorker.ready.then(()=>updatePushBell()).catch(()=>{});
  }
  const bell = document.getElementById('push-bell') || document.getElementById('push-toggle');
  if(bell) bell.addEventListener('click', togglePushIsolated);
});
window.togglePush = togglePushIsolated; // voor compatibiliteit
