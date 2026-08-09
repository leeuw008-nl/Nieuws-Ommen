/* push.js v203 - FIX popup komt niet: requestPermission MOET als eerste, zonder await ervoor */
if (!window._ommenPushLoaded) {
window._ommenPushLoaded = true;

const PUSH_WORKER_URL='https://ommen-push-v2.leeuw008.workers.dev';
const ALLE_BRONNEN=["De Stentor","Gemeente Ommen","Natuurlijk Ommen","Ommen City","OudOmmen","RondOmmen","RTV Oost","RTV Vechtdal","Vechtdal Centraal"];

function urlBase64ToUint8Array(b64){ const p='='.repeat((4-b64.length%4)%4); const base=(b64+p).replace(/-/g,'+').replace(/_/g,'/'); const raw=atob(base); const out=new Uint8Array(raw.length); for(let i=0;i<raw.length;++i) out[i]=raw.charCodeAt(i); return out; }
async function getVapidPublicKey(){ try{ const r=await fetch(PUSH_WORKER_URL+'/vapidPublicKey',{cache:'no-store'}); if(!r.ok) throw new Error(); return (await r.text()).trim(); }catch{ return null; } }

function ensureBellButton(){
  const slot=document.getElementById('bell-slot'); if(!slot) return null;
  let btn=slot.querySelector('button');
  if(!btn){ btn=document.createElement('button'); btn.type='button'; btn.id='push-bell-btn'; btn.textContent='🔔'; slot.appendChild(btn); }
  btn.onclick = (e)=>{ e.preventDefault(); e.stopPropagation(); togglePush(); };
  return btn;
}

async function updatePushBell(){
  const btn=ensureBellButton(); if(!btn) return;
  btn.style.textDecoration='none';
  try{
    if(!('Notification' in window)||!('serviceWorker' in navigator)){
      btn.textContent='🔕'; btn.classList.remove('enabled'); btn.title='Geen ondersteuning'; return;
    }
    if(Notification.permission==='denied'){
      btn.textContent='🔕'; btn.classList.remove('enabled'); btn.title='Geblokkeerd - klik voor uitleg'; return;
    }
    const reg=await navigator.serviceWorker.ready.catch(()=>null);
    if(!reg){ btn.textContent='🔕'; btn.classList.remove('enabled'); return; }
    const sub=await reg.pushManager.getSubscription();
    btn.textContent=sub?'🔔':'🔕';
    btn.classList.toggle('enabled', !!sub);
    btn.title=sub?'Meldingen AAN (lichtgroen) - klik om uit te zetten':'Meldingen UIT (wit) - klik om aan te zetten';
  }catch(e){ console.error(e); }
}

function getSelectedSourcesLocal(){ try{ const v=JSON.parse(localStorage.getItem('nieuwsommen_bronnen_v2')||'{}'); const aan=Object.keys(v).filter(id=>v[id]?.aan); if(aan.length) return aan; }catch{} return [...ALLE_BRONNEN]; }

async function togglePush(){
  // BELANGRIJK: toestemming DIRECT vragen, zonder await ervoor, anders blokkeert browser de popup!
  let currentPerm = Notification.permission;
  console.log('togglePush start, permission:', currentPerm);

  if(currentPerm==='denied'){
    alert('Meldingen zijn geblokkeerd.\n\nFix: klik op slotje 🔒 in adresbalk > Site-instellingen > Meldingen > Toestaan > daarna pagina verversen.');
    return;
  }

  // Als nog niet gevraagd, vraag NU meteen toestemming (nog steeds in user gesture)
  if(currentPerm==='default'){
    const perm = await Notification.requestPermission();
    console.log('permission result direct:', perm);
    currentPerm = perm;
    if(perm!=='granted'){
      alert('Toestemming geweigerd.');
      await updatePushBell();
      return;
    }
    // nu verder met subscriben
  }

  // Vanaf hier hebben we permission granted
  try{
    const btn=document.getElementById('push-bell-btn');
    if(btn) btn.textContent='⏳';

    const reg=await navigator.serviceWorker.ready;
    let sub=await reg.pushManager.getSubscription();

    if(sub){
      // uitzetten
      await fetch(PUSH_WORKER_URL+'/unsubscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({endpoint:sub.endpoint})}).catch(()=>{});
      await sub.unsubscribe();
      localStorage.removeItem('ommen_push_subscribed');
      await updatePushBell();
      return;
    }

    // aanzetten - permission is al granted
    const vapidKey=await getVapidPublicKey();
    if(!vapidKey){ alert('Server niet bereikbaar (VAPID)'); await updatePushBell(); return; }

    sub=await reg.pushManager.subscribe({userVisibleOnly:true, applicationServerKey:urlBase64ToUint8Array(vapidKey)});
    const sources=getSelectedSourcesLocal();
    const p256dhKey=sub.getKey('p256dh'), authKey=sub.getKey('auth');
    const p256dh=btoa(String.fromCharCode(...new Uint8Array(p256dhKey))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    const auth=btoa(String.fromCharCode(...new Uint8Array(authKey))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    await fetch(PUSH_WORKER_URL+'/subscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({endpoint:sub.endpoint, keys:{p256dh, auth}, sources})});
    localStorage.setItem('ommen_push_subscribed','1');
    await updatePushBell();
  }catch(e){
    console.error('togglePush error:', e);
    alert('Fout bij inschakelen: '+e.message);
    await updatePushBell();
  }
}

document.addEventListener('DOMContentLoaded', ()=>{
  ensureBellButton();
  if('serviceWorker' in navigator){ navigator.serviceWorker.ready.then(()=>updatePushBell()).catch(()=>{ ensureBellButton(); }); } else { ensureBellButton(); }
  setTimeout(updatePushBell,600);
  setTimeout(updatePushBell,1800);
});
window.togglePush=togglePush; window.updatePushBell=updatePushBell;
}
