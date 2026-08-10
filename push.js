/* push.js - DEFINITIEF met systeem-bevestiging + werkt ook als icon faalt */
if (!window._ommenPushLoaded) {
window._ommenPushLoaded = true;

const PUSH_WORKER_URL='https://ommen-push-v2.leeuw008.workers.dev';
const ALLE_BRONNEN=["De Stentor","Gemeente Ommen","Natuurlijk Ommen","Ommen City","OudOmmen","RondOmmen","RTV Oost","RTV Vechtdal","Vechtdal Centraal"];
const SW_FILE = 'service-worker.js';

function urlBase64ToUint8Array(b64){ const p='='.repeat((4-b64.length%4)%4); const base=(b64+p).replace(/-/g,'+').replace(/_/g,'/'); const raw=atob(base); const out=new Uint8Array(raw.length); for(let i=0;i<raw.length;++i) out[i]=raw.charCodeAt(i); return out; }
async function getVapidPublicKey(){ try{ const r=await fetch(PUSH_WORKER_URL+'/vapidPublicKey',{cache:'no-store'}); if(!r.ok) throw new Error(); return (await r.text()).trim(); }catch{ return null; } }

function ensureBellButton(){
  const slot=document.getElementById('bell-slot'); if(!slot) return null;
  let btn=slot.querySelector('button');
  if(!btn){ btn=document.createElement('button'); btn.type='button'; btn.id='push-bell-btn'; btn.textContent='🔔'; slot.appendChild(btn); }
  btn.onclick = (e)=>{ e.stopPropagation(); console.log('BELL CLICK!'); togglePush(); };
  return btn;
}

async function ensureServiceWorker(){
  if(!('serviceWorker' in navigator)) throw new Error('ServiceWorker niet ondersteund');
  let reg = await navigator.serviceWorker.getRegistration();
  if(!reg){ reg = await navigator.serviceWorker.register(SW_FILE); }
  await navigator.serviceWorker.ready;
  return reg;
}

async function updatePushBell(){
  const btn=ensureBellButton(); if(!btn) return;
  try{
    if(!('Notification' in window)||!('serviceWorker' in navigator)){ btn.textContent='🔕'; btn.classList.remove('enabled'); return; }
    if(Notification.permission==='denied'){ btn.textContent='🔕'; btn.classList.remove('enabled'); btn.title='Geblokkeerd'; return; }
    const reg = await navigator.serviceWorker.ready.catch(()=>null);
    if(!reg){ btn.textContent='🔕'; btn.classList.remove('enabled'); return; }
    const sub=await reg.pushManager.getSubscription();
    btn.textContent=sub?'🔔':'🔕'; btn.classList.toggle('enabled', !!sub);
    btn.title=sub?'Meldingen AAN (lichtgroen) - klik om uit te zetten':'Meldingen UIT (wit) - klik om aan te zetten';
  }catch(e){ }
}
function getSelectedSourcesLocal(){ try{ const v=JSON.parse(localStorage.getItem('nieuwsommen_bronnen_v2')||'{}'); const aan=Object.keys(v).filter(id=>v[id]?.aan); if(aan.length) return aan; }catch{} return [...ALLE_BRONNEN]; }

async function togglePush(){
  try{
    if(Notification.permission==='denied'){ alert('Meldingen geblokkeerd. Slotje in adresbalk > Site-instellingen > Meldingen > Toestaan'); return; }
    const reg = await ensureServiceWorker();
    let sub=await reg.pushManager.getSubscription();
    if(sub){
      await fetch(PUSH_WORKER_URL+'/unsubscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({endpoint:sub.endpoint})}).catch(()=>{});
      await sub.unsubscribe(); 
      localStorage.removeItem('ommen_push_subscribed'); 
      await updatePushBell();
      try{ 
        // GEEN icon/badge hier -> kan niet falen met 526
        await reg.showNotification('🔕 Meldingen uit',{body:'Je ontvangt geen pushberichten meer'}); 
      }catch(e){ console.log('notif uit mislukt', e); }
      return;
    }
    const vapidKey=await getVapidPublicKey(); if(!vapidKey){ alert('VAPID key niet beschikbaar'); return; }
    const perm=await Notification.requestPermission(); 
    if(perm!=='granted'){ alert('Toestemming geweigerd'); updatePushBell(); return; }
    sub=await reg.pushManager.subscribe({userVisibleOnly:true, applicationServerKey:urlBase64ToUint8Array(vapidKey)});
    const sources=getSelectedSourcesLocal();
    const p256dhKey=sub.getKey('p256dh'), authKey=sub.getKey('auth');
    const p256dh=btoa(String.fromCharCode(...new Uint8Array(p256dhKey))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    const auth=btoa(String.fromCharCode(...new Uint8Array(authKey))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    await fetch(PUSH_WORKER_URL+'/subscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({endpoint:sub.endpoint, keys:{p256dh, auth}, sources})});
    localStorage.setItem('ommen_push_subscribed','1'); await updatePushBell();
    
    // ECHTE FIX: zonder icon/badge, kan niet falen door 526
    try{
      await reg.showNotification('🔔 Meldingen aan!',{
        body:'Je ontvangt nu nieuws uit Ommen'
      });
      console.log('BEVESTIGING GETOOND');
    }catch(e){
      console.error('BEVESTIGING FOUT', e);
      alert('✅ Meldingen aan! (systeem-melding geblokkeerd door OS, maar je bent wel geabonneerd)');
    }
    
  }catch(e){ console.error(e); alert('Fout: '+e.message); }
}

document.addEventListener('DOMContentLoaded', ()=>{
  ensureBellButton();
  if('serviceWorker' in navigator){ navigator.serviceWorker.register(SW_FILE).catch(()=>{}).then(()=>updatePushBell()); }
  setTimeout(updatePushBell,500);
  setTimeout(updatePushBell,1500);
});
window.togglePush=togglePush; window.updatePushBell=updatePushBell;
}
