// push.js v274 - PUSH FIX: alle geselecteerde bronnen als push, betere sync
const WORKER_URL = 'https://ommen-push-v2.leeuw008.workers.dev';
const VAPID_PUBLIC_KEY = 'BBnCDkkzIXwUYFrF8ct-OXtRQ6-HaqF74grNVDLe4pw1SwG8_JyMYIHItRY6smyqPpdt81U1EZF33loTsepqnYo';
let swReg=null;

function urlBase64ToUint8Array(s){ const p='='.repeat((4-s.length%4)%4); const b64=(s+p).replace(/-/g,'+').replace(/_/g,'/'); const raw=atob(b64); const o=new Uint8Array(raw.length); for(let i=0;i<raw.length;++i) o[i]=raw.charCodeAt(i); return o; }
function getBell(){ return document.getElementById('push-bell-btn'); }
function ensureBell(){
  const slot=document.getElementById('bell-slot'); if(!slot) return null;
  let btn=getBell(); if(!btn){ btn=document.createElement('button'); btn.id='push-bell-btn'; btn.textContent='🔕'; btn.title='Push meldingen aan/uit'; slot.appendChild(btn); }
  return btn;
}
function getSources(){ 
  try{ 
    const v=JSON.parse(localStorage.getItem('nieuwsommen_bronnen_v274')||'{}'); 
    const a=Object.keys(v).filter(k=>v[k]?.aan); 
    if(a.length) return a; 
  }catch{} 
  return ["De Stentor","Gemeente Ommen","Ommen City","OudOmmen","RondOmmen","RTV Oost","RTV Vechtdal","Vechtdal Centraal","Natuurlijk Ommen"]; 
}

// v274: update sources op server wanneer filter verandert
async function updateSourcesOnServer(){
  try{
    if(!swReg) swReg = await navigator.serviceWorker.ready;
    const sub = await swReg.pushManager.getSubscription();
    if(!sub) return;
    // Stuur geupdate sources naar worker
    await fetch(WORKER_URL+'/subscribe',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({endpoint:sub.endpoint,keys:{},sources:getSources()})
    });
    console.log('[push v274] Sources geupdate op server:', getSources());
  }catch(e){ console.log('[push v274] update sources fail', e.message); }
}

async function onBellClick(e){
  e.preventDefault(); e.stopPropagation();
  console.log('[push v274] CLICK');
  const b=getBell();
  try{
    if(!swReg) swReg=await navigator.serviceWorker.ready;
    let ex=null; try{ ex=await swReg.pushManager.getSubscription(); }catch{}
    console.log('[push v274] existing?',!!ex);
    if(ex){
      console.log('[push v274] unsubscribing');
      await fetch(WORKER_URL+'/unsubscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({endpoint:ex.endpoint})}).catch(()=>{});
      await ex.unsubscribe();
      b.textContent='🔕'; b.classList.remove('enabled','active');
      localStorage.setItem('ommen_push_subscribed','0');
      alert('Meldingen uit');
    }else{
      const perm=await Notification.requestPermission(); 
      console.log('[push v274] perm',perm);
      if(perm!=='granted'){ alert('Geen toestemming - kijk bij slotje in adresbalk > Meldingen > Toestaan'); return; }
      const sub=await swReg.pushManager.subscribe({userVisibleOnly:true, applicationServerKey:urlBase64ToUint8Array(VAPID_PUBLIC_KEY)});
      const p256dh=btoa(String.fromCharCode(...new Uint8Array(sub.getKey('p256dh')))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
      const auth=btoa(String.fromCharCode(...new Uint8Array(sub.getKey('auth')))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
      console.log('[push v274] POST /subscribe to', WORKER_URL, 'met bronnen', getSources());
      const r=await fetch(WORKER_URL+'/subscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({endpoint:sub.endpoint,keys:{p256dh,auth},sources:getSources()})});
      console.log('[push v274] response',r.status); 
      const t=await r.text(); 
      console.log('[push v274] body', t);
      if(!r.ok) throw new Error(t);
      b.textContent='🔔'; b.classList.add('enabled','active');
      localStorage.setItem('ommen_push_subscribed','1');
      alert('Meldingen aan! Je krijgt nu meldingen van alle geselecteerde bronnen ('+getSources().length+' bronnen). Tip: zet bronnen aan/uit in filterpaneel en je push voorkeur wordt automatisch geupdate.');
    }
  }catch(err){ console.error('[push v274] ERR',err); alert('Fout: '+err.message); }
}

async function init(){
  const b=ensureBell(); if(!b) return;
  console.log('[push v274] init - worker:', WORKER_URL);
  document.removeEventListener('click', window._pushClickHandler);
  window._pushClickHandler = (ev)=>{ if(ev.target.closest && ev.target.closest('#push-bell-btn')) onBellClick(ev); };
  document.addEventListener('click', window._pushClickHandler);
  try{ 
    swReg=await navigator.serviceWorker.ready; 
    const s=await swReg.pushManager.getSubscription(); 
    b.textContent=s?'🔔':'🔕'; 
    if(s) b.classList.add('enabled','active'); 
    console.log('[push v274] hasSub',!!s); 
    if(s){
      // v274: bij init al sources updaten
      updateSourcesOnServer();
    }
  }catch(e){ console.log('[push v274] init err',e); }
}

// Expose voor app.js zodat bij saveState sources geupdate worden
window.updatePushBell = init;
window.updatePushSubscription = updateSourcesOnServer;

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
setTimeout(init,1000);

// Luister naar filter changes
window.addEventListener('storage', (e)=>{
  if(e.key === 'nieuwsommen_bronnen_v274'){
    setTimeout(()=>updateSourcesOnServer(), 500);
  }
});
