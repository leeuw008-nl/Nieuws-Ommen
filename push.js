/* push.js v204 - ULTRA DEBUG popup - logt alles */
if (!window._ommenPushLoaded) { window._ommenPushLoaded = true; }

const PUSH_WORKER_URL='https://ommen-push-v2.leeuw008.workers.dev';
const ALLE_BRONNEN=["De Stentor","Gemeente Ommen","Natuurlijk Ommen","Ommen City","OudOmmen","RondOmmen","RTV Oost","RTV Vechtdal","Vechtdal Centraal"];

function urlBase64ToUint8Array(b64){ const p='='.repeat((4-b64.length%4)%4); const base=(b64+p).replace(/-/g,'+').replace(/_/g,'/'); const raw=atob(base); const out=new Uint8Array(raw.length); for(let i=0;i<raw.length;++i) out[i]=raw.charCodeAt(i); return out; }

function ensureBellButton(){
  const slot=document.getElementById('bell-slot'); if(!slot) return null;
  let btn=slot.querySelector('button');
  if(!btn){ btn=document.createElement('button'); btn.type='button'; btn.id='push-bell-btn'; slot.appendChild(btn); }
  btn.id='push-bell-btn';
  btn.style.pointerEvents='auto'; btn.style.cursor='pointer'; btn.style.textDecoration='none';
  btn.onclick = (e)=>{ e.preventDefault(); e.stopPropagation(); console.log('%c BEL CLICK ', 'background:yellow;color:black;font-size:20px'); togglePush(); };
  return btn;
}

async function updatePushBell(){
  const btn=ensureBellButton(); if(!btn) return;
  try{
    const perm = Notification.permission;
    console.log('[update] permission=', perm, 'secure=', window.isSecureContext, 'SW=', !!navigator.serviceWorker);
    if(!('Notification' in window)){ btn.textContent='🔕'; btn.classList.remove('enabled'); return; }
    if(perm==='denied'){ btn.textContent='🔕'; btn.classList.remove('enabled'); btn.title='GEBLOKKEERD - zie console'; return; }
    const reg=await navigator.serviceWorker.ready.catch(()=>null);
    if(!reg){ btn.textContent='🔕'; btn.classList.remove('enabled'); btn.title='Geen SW'; return; }
    const sub=await reg.pushManager.getSubscription();
    btn.textContent=sub?'🔔':'🔕';
    btn.classList.toggle('enabled', !!sub);
  }catch(e){ console.error(e); }
}

async function togglePush(){
  console.clear();
  console.log('=== TOGGLE PUSH START ===');
  console.log('URL:', location.href);
  console.log('isSecureContext:', window.isSecureContext);
  console.log('protocol:', location.protocol);
  console.log('Notification.permission:', Notification.permission);
  console.log('serviceWorker in navigator:', 'serviceWorker' in navigator);
  
  // DIRECTE CHECKS VOOR POPUP
  if(!window.isSecureContext){
    alert('❌ Geen HTTPS!\n\nPush werkt ALLEEN op https:// of localhost.\nJij zit op: ' + location.protocol + '//' + location.host + '\n\nDaarom komt er geen popup.');
    return;
  }
  if(!('Notification' in window)){
    alert('❌ Deze browser ondersteunt geen Notifications');
    return;
  }

  let perm = Notification.permission;
  alert('DEBUG INFO:\n\nPermission nu: ' + perm + '\nSecure: ' + window.isSecureContext + '\nProtocol: ' + location.protocol + '\n\nKlik OK en dan zou de browser-popup moeten komen als permission = default');

  if(perm==='denied'){
    alert('⛔ Permission = DENIED (geblokkeerd)\n\nDaarom komt er NOOIT een popup!\n\nFix:\nChrome: slotje 🔒 > Site-instellingen > Meldingen > Toestaan\nFirefox: slotje > Verbinding > Meer info > Toestemmingen\nSafari iPhone: moet eerst "Zet op beginscherm" doen!\n\nDaarna verversen.');
    return;
  }

  if(perm==='default'){
    console.log('-> roep Notification.requestPermission() DIRECT aan');
    try{
      // BELANGRIJK: direct aanroepen, zonder await ervoor!
      const result = await Notification.requestPermission();
      console.log('requestPermission result:', result);
      alert('Popup resultaat: ' + result);
      perm = result;
      if(result!=='granted'){
        await updatePushBell();
        return;
      }
    }catch(e){
      console.error('requestPermission fout:', e);
      alert('Fout bij requestPermission: ' + e.message);
      return;
    }
  }

  // vanaf hier granted
  try{
    const btn=document.getElementById('push-bell-btn');
    if(btn) btn.textContent='⏳';
    const reg=await navigator.serviceWorker.ready;
    console.log('SW ready:', reg.scope);
    let sub=await reg.pushManager.getSubscription();
    if(sub){
      await fetch(PUSH_WORKER_URL+'/unsubscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({endpoint:sub.endpoint})}).catch(()=>{});
      await sub.unsubscribe();
      localStorage.removeItem('ommen_push_subscribed');
      alert('Meldingen uitgezet (wit)');
      await updatePushBell();
      return;
    }
    // aanzetten
    const vapidKey = await (await fetch(PUSH_WORKER_URL+'/vapidPublicKey',{cache:'no-store'})).text().then(t=>t.trim()).catch(()=>null);
    if(!vapidKey){ alert('VAPID key niet bereikbaar'); await updatePushBell(); return; }
    sub=await reg.pushManager.subscribe({userVisibleOnly:true, applicationServerKey:urlBase64ToUint8Array(vapidKey)});
    const sources=(()=>{ try{ const v=JSON.parse(localStorage.getItem('nieuwsommen_bronnen_v2')||'{}'); const aan=Object.keys(v).filter(id=>v[id]?.aan); if(aan.length) return aan; }catch{} return ALLE_BRONNEN; })();
    const p256dhKey=sub.getKey('p256dh'), authKey=sub.getKey('auth');
    const p256dh=btoa(String.fromCharCode(...new Uint8Array(p256dhKey))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    const auth=btoa(String.fromCharCode(...new Uint8Array(authKey))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    await fetch(PUSH_WORKER_URL+'/subscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({endpoint:sub.endpoint, keys:{p256dh, auth}, sources})});
    localStorage.setItem('ommen_push_subscribed','1');
    alert('✅ Meldingen AAN! Bel wordt lichtgroen.');
    await updatePushBell();
  }catch(e){ console.error(e); alert('Fout bij subscriben: '+e.message); await updatePushBell(); }
}

document.addEventListener('DOMContentLoaded', ()=>{ ensureBellButton(); updatePushBell(); setTimeout(updatePushBell,800); });
window.togglePush=togglePush; window.updatePushBell=updatePushBell;
