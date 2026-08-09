
const PUSH_WORKER_URL = 'https://ommen-push-v2.leeuw008.workers.dev';
const ALLE_BRONNEN = ["De Stentor","Gemeente Ommen","Natuurlijk Ommen","Ommen City","OudOmmen","RondOmmen","RTV Oost","RTV Vechtdal","Vechtdal Centraal"];
function urlBase64ToUint8Array(base64String){ const padding='='.repeat((4-base64String.length%4)%4); const base64=(base64String+padding).replace(/-/g,'+').replace(/_/g,'/'); const rawData=atob(base64); const out=new Uint8Array(rawData.length); for(let i=0;i<rawData.length;++i) out[i]=rawData.charCodeAt(i); return out; }
async function getVapidPublicKey(){ try{ const r=await fetch(PUSH_WORKER_URL+'/vapidPublicKey',{cache:'no-store'}); if(!r.ok) throw new Error('no key'); return (await r.text()).trim(); }catch(e){ return null; } }
async function updatePushBell(){
  const btn=document.getElementById('push-bell'); if(!btn) return;
  try{
    if(!('Notification' in window) || !('serviceWorker' in navigator)){ btn.textContent='🔕'; btn.classList.remove('enabled'); return; }
    if(Notification.permission==='denied'){ btn.textContent='🔕'; btn.classList.remove('enabled'); btn.title='Meldingen geblokkeerd in browser'; return; }
    const reg=await navigator.serviceWorker.ready; const sub=await reg.pushManager.getSubscription();
    const isOn=!!sub;
    btn.textContent=isOn?'🔔':'🔕';
    btn.classList.toggle('enabled', isOn);
    btn.title=isOn?'Meldingen aan - klik om uit te zetten':'Meldingen uit - klik om aan te zetten';
  }catch(e){ console.error('bell update', e); }
}
function getSelectedSources(){ try{ const v2=JSON.parse(localStorage.getItem('nieuwsommen_bronnen_v2')||'{}'); if(v2 && Object.keys(v2).length>0){ const aan=Object.keys(v2).filter(id=>v2[id]?.aan); if(aan.length>0) return aan; } }catch{} try{ const s=JSON.parse(localStorage.getItem('ommen_selected_sources')||'[]'); if(Array.isArray(s)&&s.length>0) return s; }catch{} return [...ALLE_BRONNEN]; }
async function togglePush(){
  try{
    const vapidKey=await getVapidPublicKey(); if(!vapidKey){ alert('VAPID key niet beschikbaar'); return; }
    const reg=await navigator.serviceWorker.ready;
    let sub=await reg.pushManager.getSubscription();
    if(sub){
      await fetch(PUSH_WORKER_URL+'/unsubscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({endpoint:sub.endpoint})});
      await sub.unsubscribe();
      localStorage.removeItem('ommen_push_subscribed');
      updatePushBell();
      return;
    }
    const perm=await Notification.requestPermission();
    if(perm!=='granted'){ alert('Toestemming geweigerd'); updatePushBell(); return; }
    sub=await reg.pushManager.subscribe({userVisibleOnly:true, applicationServerKey:urlBase64ToUint8Array(vapidKey)});
    let sources=getSelectedSources();
    const p256dhKey=sub.getKey('p256dh'); const authKey=sub.getKey('auth');
    const p256dh=btoa(String.fromCharCode(...new Uint8Array(p256dhKey))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    const auth=btoa(String.fromCharCode(...new Uint8Array(authKey))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    await fetch(PUSH_WORKER_URL+'/subscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({endpoint:sub.endpoint, keys:{p256dh, auth}, sources})});
    localStorage.setItem('ommen_push_subscribed','1');
    updatePushBell();
  }catch(e){ console.error(e); alert('Fout: '+e.message); }
}
document.addEventListener('DOMContentLoaded', ()=>{
  const btn=document.getElementById('push-bell');
  if(btn){ btn.addEventListener('click', (e)=>{ e.stopPropagation(); togglePush(); }); }
  if('serviceWorker' in navigator){ navigator.serviceWorker.ready.then(()=>updatePushBell()).catch(()=>{}); }
  setTimeout(updatePushBell, 1500);
});
window.togglePush=togglePush; window.updatePushBell=updatePushBell;
