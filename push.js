// push.js v20 - FIXED for worker-v20 no-payload + SHA-256 ID fix
const WORKER_URL = 'https://ommen-push-v2.leeuw008.workers.dev';
const VAPID_PUBLIC_KEY = 'BBnCDkkzIXwUYFrF8ct-OXtRQ6-HaqF74grNVDLe4pw1SwG8_JyMYIHItRY6smyqPpdt81U1EZF33loTsepqnYo';
let swReg=null;

function urlBase64ToUint8Array(s){ const p='='.repeat((4-s.length%4)%4); const b64=(s+p).replace(/-/g,'+').replace(/_/g,'/'); const raw=atob(b64); const o=new Uint8Array(raw.length); for(let i=0;i<raw.length;++i) o[i]=raw.charCodeAt(i); return o; }
function getBell(){ return document.getElementById('push-bell-btn'); }
function ensureBell(){
  const slot=document.getElementById('bell-slot'); if(!slot) return null;
  let btn=getBell(); if(!btn){ btn=document.createElement('button'); btn.id='push-bell-btn'; btn.textContent='🔕'; slot.appendChild(btn); }
  return btn;
}
function getSources(){ 
  try{ 
    const v=JSON.parse(localStorage.getItem('nieuwsommen_bronnen_v2')||'{}'); 
    const a=Object.keys(v).filter(k=>v[k]?.aan); 
    if(a.length) return a; 
  }catch{} 
  return ["De Stentor","Gemeente Ommen","Ommen City","OudOmmen","RondOmmen","RTV Oost","RTV Vechtdal","Vechtdal Centraal","Natuurlijk Ommen"]; 
}

async function onBellClick(e){
  e.preventDefault(); e.stopPropagation();
  console.log('[push v20] CLICK');
  const b=getBell();
  try{
    if(!swReg) swReg=await navigator.serviceWorker.ready;
    let ex=null; try{ ex=await swReg.pushManager.getSubscription(); }catch{}
    console.log('[push v20] existing?',!!ex);
    if(ex){
      console.log('[push v20] unsubscribing');
      await fetch(WORKER_URL+'/unsubscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({endpoint:ex.endpoint})}).catch(()=>{});
      await ex.unsubscribe();
      b.textContent='🔕'; b.classList.remove('enabled','active');
      localStorage.setItem('ommen_push_subscribed','0');
      alert('Meldingen uit');
    }else{
      const perm=await Notification.requestPermission(); 
      console.log('[push v20] perm',perm);
      if(perm!=='granted'){ alert('Geen toestemming - kijk bij slotje in adresbalk > Meldingen > Toestaan'); return; }
      const sub=await swReg.pushManager.subscribe({userVisibleOnly:true, applicationServerKey:urlBase64ToUint8Array(VAPID_PUBLIC_KEY)});
      const p256dh=btoa(String.fromCharCode(...new Uint8Array(sub.getKey('p256dh')))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
      const auth=btoa(String.fromCharCode(...new Uint8Array(sub.getKey('auth')))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
      console.log('[push v20] POST /subscribe to', WORKER_URL);
      const r=await fetch(WORKER_URL+'/subscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({endpoint:sub.endpoint,keys:{p256dh,auth},sources:getSources()})});
      console.log('[push v20] response',r.status); 
      const t=await r.text(); 
      console.log('[push v20] body', t);
      if(!r.ok) throw new Error(t);
      b.textContent='🔔'; b.classList.add('enabled','active');
      localStorage.setItem('ommen_push_subscribed','1');
      alert('Meldingen aan! Je krijgt nu pushes via v20 no-payload mode');
    }
  }catch(err){ console.error('[push v20] ERR',err); alert('Fout: '+err.message); }
}

async function init(){
  const b=ensureBell(); if(!b) return;
  console.log('[push v20] init - worker:', WORKER_URL);
  // voorkom dubbele listeners
  document.removeEventListener('click', window._pushClickHandler);
  window._pushClickHandler = (ev)=>{ if(ev.target.closest && ev.target.closest('#push-bell-btn')) onBellClick(ev); };
  document.addEventListener('click', window._pushClickHandler);
  try{ 
    swReg=await navigator.serviceWorker.ready; 
    const s=await swReg.pushManager.getSubscription(); 
    b.textContent=s?'🔔':'🔕'; 
    if(s) b.classList.add('enabled','active'); 
    console.log('[push v20] hasSub',!!s); 
    // update sources op server als we al subscribed zijn
    if(s){
      fetch(WORKER_URL+'/subscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({endpoint:s.endpoint,keys:{},sources:getSources()})}).catch(()=>{});
    }
  }catch(e){ console.log('[push v20] init err',e); }
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
setTimeout(init,1000);
