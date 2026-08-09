
const PUSH_WORKER_URL='https://ommen-push-v2.leeuw008.workers.dev';
const ALLE_BRONNEN=["De Stentor","Gemeente Ommen","Natuurlijk Ommen","Ommen City","OudOmmen","RondOmmen","RTV Oost","RTV Vechtdal","Vechtdal Centraal"];
function urlBase64ToUint8Array(b64){ const p='='.repeat((4-b64.length%4)%4); const base=(b64+p).replace(/-/g,'+').replace(/_/g,'/'); const raw=atob(base); const out=new Uint8Array(raw.length); for(let i=0;i<raw.length;++i) out[i]=raw.charCodeAt(i); return out; }
async function getVapidPublicKey(){ try{ const r=await fetch(PUSH_WORKER_URL+'/vapidPublicKey',{cache:'no-store'}); if(!r.ok) throw new Error(); return (await r.text()).trim(); }catch{ return null; } }
async function updatePushBell(){
  const btn=document.getElementById('push-bell'); if(!btn) return;
  try{
    if(!('Notification' in window)||!('serviceWorker' in navigator)){ btn.textContent='🔕'; btn.classList.remove('enabled'); return; }
    if(Notification.permission==='denied'){ btn.textContent='🔕'; btn.classList.remove('enabled'); btn.title='Geblokkeerd in browser'; return; }
    const reg=await navigator.serviceWorker.ready; const sub=await reg.pushManager.getSubscription();
    btn.textContent=sub?'🔔':'🔕'; btn.classList.toggle('enabled', !!sub);
  }catch(e){ console.error(e); }
}
function getSelectedSourcesLocal(){ try{ const v=JSON.parse(localStorage.getItem('nieuwsommen_bronnen_v2')||'{}'); const aan=Object.keys(v).filter(id=>v[id]?.aan); if(aan.length) return aan; }catch{} return [...ALLE_BRONNEN]; }
async function togglePush(){
  try{
    const vapidKey=await getVapidPublicKey(); if(!vapidKey){ alert('VAPID key niet beschikbaar'); return; }
    const reg=await navigator.serviceWorker.ready;
    let sub=await reg.pushManager.getSubscription();
    if(sub){
      await fetch(PUSH_WORKER_URL+'/unsubscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({endpoint:sub.endpoint})}).catch(()=>{});
      await sub.unsubscribe(); localStorage.removeItem('ommen_push_subscribed'); await updatePushBell(); return;
    }
    const perm=await Notification.requestPermission(); if(perm!=='granted'){ alert('Toestemming geweigerd'); updatePushBell(); return; }
    sub=await reg.pushManager.subscribe({userVisibleOnly:true, applicationServerKey:urlBase64ToUint8Array(vapidKey)});
    const sources=getSelectedSourcesLocal();
    const p256dhKey=sub.getKey('p256dh'), authKey=sub.getKey('auth');
    const p256dh=btoa(String.fromCharCode(...new Uint8Array(p256dhKey))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    const auth=btoa(String.fromCharCode(...new Uint8Array(authKey))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    await fetch(PUSH_WORKER_URL+'/subscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({endpoint:sub.endpoint, keys:{p256dh, auth}, sources})});
    localStorage.setItem('ommen_push_subscribed','1'); await updatePushBell();
  }catch(e){ console.error(e); alert('Fout: '+e.message); }
}
document.addEventListener('DOMContentLoaded', ()=>{
  const btn=document.getElementById('push-bell'); if(btn) btn.addEventListener('click', (e)=>{ e.stopPropagation(); togglePush(); });
  if('serviceWorker' in navigator){ navigator.serviceWorker.ready.then(()=>updatePushBell()).catch(()=>{}); }
  setTimeout(updatePushBell,1200);
});
window.togglePush=togglePush; window.updatePushBell=updatePushBell;
