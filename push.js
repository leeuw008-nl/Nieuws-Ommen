/* push.js v205 - FIX guard was kapot, nu hele file beschermd + popup direct */
if (!window._ommenPushLoaded) {
window._ommenPushLoaded = true;

const PUSH_WORKER_URL='https://ommen-push-v2.leeuw008.workers.dev';
const ALLE_BRONNEN=["De Stentor","Gemeente Ommen","Natuurlijk Ommen","Ommen City","OudOmmen","RondOmmen","RTV Oost","RTV Vechtdal","Vechtdal Centraal"];

function urlBase64ToUint8Array(b64){ const p='='.repeat((4-b64.length%4)%4); const base=(b64+p).replace(/-/g,'+').replace(/_/g,'/'); const raw=atob(base); const out=new Uint8Array(raw.length); for(let i=0;i<raw.length;++i) out[i]=raw.charCodeAt(i); return out; }

function ensureBellButton(){
  const slot=document.getElementById('bell-slot'); if(!slot){ console.error('geen bell-slot'); return null; }
  let btn=slot.querySelector('button');
  if(!btn){ btn=document.createElement('button'); btn.type='button'; btn.id='push-bell-btn'; slot.appendChild(btn); }
  btn.id='push-bell-btn';
  btn.style.pointerEvents='auto'; btn.style.cursor='pointer'; btn.style.textDecoration='none';
  btn.onclick = (e)=>{ e.preventDefault(); e.stopPropagation(); console.log('BEL CLICK'); togglePush(); };
  return btn;
}

async function updatePushBell(){
  const btn=ensureBellButton(); if(!btn) return;
  btn.style.textDecoration='none';
  try{
    if(!('Notification' in window)||!('serviceWorker' in navigator)){
      btn.textContent='🔕'; btn.classList.remove('enabled'); return;
    }
    if(Notification.permission==='denied'){
      btn.textContent='🔕'; btn.classList.remove('enabled'); return;
    }
    const reg=await navigator.serviceWorker.ready.catch(()=>null);
    if(!reg){ btn.textContent='🔕'; btn.classList.remove('enabled'); return; }
    const sub=await reg.pushManager.getSubscription();
    btn.textContent=sub?'🔔':'🔕';
    btn.classList.toggle('enabled', !!sub);
  }catch(e){ console.error(e); }
}

async function togglePush(){
  console.log('=== TOGGLE ===', location.href, 'secure=', window.isSecureContext, 'perm=', Notification.permission);

  if(!window.isSecureContext){
    alert('Geen HTTPS - geen popup mogelijk: ' + location.protocol);
    return;
  }

  let perm = Notification.permission;

  if(perm==='denied'){
    alert('⛔ GEBLOKKEERD\n\nSlotje 🔒 > Site-instellingen > Meldingen > Toestaan\nDaarna Ctrl+Shift+R');
    return;
  }

  // Vraag DIRECT toestemming, zonder fetch ervoor!
  if(perm==='default'){
    alert('DEBUG: permission=default, secure='+window.isSecureContext+'\nNu komt de browser-popup...');
    const result = await Notification.requestPermission();
    console.log('requestPermission result:', result);
    alert('Resultaat popup: ' + result);
    perm = result;
    if(result!=='granted'){ await updatePushBell(); return; }
  }

  try{
    const btn=document.getElementById('push-bell-btn');
    if(btn) btn.textContent='⏳';
    const reg=await navigator.serviceWorker.ready;
    let sub=await reg.pushManager.getSubscription();
    if(sub){
      await fetch(PUSH_WORKER_URL+'/unsubscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({endpoint:sub.endpoint})}).catch(()=>{});
      await sub.unsubscribe();
      localStorage.removeItem('ommen_push_subscribed');
      await updatePushBell();
      return;
    }
    const vapidResp=await fetch(PUSH_WORKER_URL+'/vapidPublicKey',{cache:'no-store'});
    const vapidKey=(await vapidResp.text()).trim();
    sub=await reg.pushManager.subscribe({userVisibleOnly:true, applicationServerKey:urlBase64ToUint8Array(vapidKey)});
    const sources=(()=>{ try{ const v=JSON.parse(localStorage.getItem('nieuwsommen_bronnen_v2')||'{}'); const aan=Object.keys(v).filter(id=>v[id]?.aan); if(aan.length) return aan; }catch{} return ALLE_BRONNEN; })();
    const p256dhKey=sub.getKey('p256dh'), authKey=sub.getKey('auth');
    const p256dh=btoa(String.fromCharCode(...new Uint8Array(p256dhKey))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    const auth=btoa(String.fromCharCode(...new Uint8Array(authKey))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    await fetch(PUSH_WORKER_URL+'/subscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({endpoint:sub.endpoint, keys:{p256dh, auth}, sources})});
    localStorage.setItem('ommen_push_subscribed','1');
    await updatePushBell();
  }catch(e){ console.error(e); alert('Fout: '+e.message); await updatePushBell(); }
}

document.addEventListener('DOMContentLoaded', ()=>{ ensureBellButton(); updatePushBell(); setTimeout(updatePushBell,800); });
window.togglePush=togglePush; window.updatePushBell=updatePushBell;

} // einde guard
