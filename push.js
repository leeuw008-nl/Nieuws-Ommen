// push.js v261 - FIXED: safe KV ID + debug logging + VAPID match
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
    const v=JSON.parse(localStorage.getItem('nieuwsommen_bronnen_v2')||'{}'); 
    const a=Object.keys(v).filter(k=>v[k]?.aan); 
    if(a.length) return a; 
  }catch{} 
  return ["De Stentor","Gemeente Ommen","Ommen City","OudOmmen","RondOmmen","RTV Oost","RTV Vechtdal","Vechtdal Centraal","Natuurlijk Ommen"]; 
}

async function updateSourcesOnServer(){
  try{
    if(!swReg) swReg = await navigator.serviceWorker.ready;
    const sub = await swReg.pushManager.getSubscription();
    if(!sub) return;
    const r=await fetch(WORKER_URL+'/subscribe',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({endpoint:sub.endpoint,keys:{},sources:getSources()})
    });
    console.log('[push v261] Sources geupdate:', getSources(), 'status', r.status);
  }catch(e){ console.log('[push v261] update sources fail', e.message); }
}

async function onBellClick(e){
  e.preventDefault(); e.stopPropagation();
  console.log('[push v261] CLICK');
  const b=getBell();
  try{
    if(!swReg) swReg=await navigator.serviceWorker.ready;
    let ex=null; try{ ex=await swReg.pushManager.getSubscription(); }catch{}
    console.log('[push v261] existing?',!!ex);
    if(ex){
      console.log('[push v261] unsubscribing', ex.endpoint.slice(0,60));
      await fetch(WORKER_URL+'/unsubscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({endpoint:ex.endpoint})}).catch(()=>{});
      await ex.unsubscribe();
      b.textContent='🔕'; b.classList.remove('enabled','active');
      localStorage.setItem('ommen_push_subscribed','0');
      alert('Meldingen uit');
    }else{
      const perm=await Notification.requestPermission(); 
      console.log('[push v261] perm',perm);
      if(perm!=='granted'){ alert('Geen toestemming - kijk bij slotje in adresbalk > Meldingen > Toestaan'); return; }
      console.log('[push v261] subscribing with VAPID', VAPID_PUBLIC_KEY.slice(0,20)+'...');
      const sub=await swReg.pushManager.subscribe({userVisibleOnly:true, applicationServerKey:urlBase64ToUint8Array(VAPID_PUBLIC_KEY)});
      console.log('[push v261] sub created', sub.endpoint.slice(0,60));
      const p256dh=btoa(String.fromCharCode(...new Uint8Array(sub.getKey('p256dh')))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
      const auth=btoa(String.fromCharCode(...new Uint8Array(sub.getKey('auth')))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
      const payload={endpoint:sub.endpoint,keys:{p256dh,auth},sources:getSources()};
      console.log('[push v261] POST /subscribe to', WORKER_URL, 'payload len', JSON.stringify(payload).length);
      const r=await fetch(WORKER_URL+'/subscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      const t=await r.text(); 
      console.log('[push v261] response',r.status, t.slice(0,300));
      if(!r.ok) throw new Error('Subscribe failed '+r.status+': '+t);
      b.textContent='🔔'; b.classList.add('enabled','active');
      localStorage.setItem('ommen_push_subscribed','1');
      alert('Meldingen aan! Je krijgt nu meldingen van alle geselecteerde bronnen ('+getSources().length+' bronnen).');
      // verify
      setTimeout(async()=>{
        try{
          const dbg=await fetch(WORKER_URL+'/debug').then(x=>x.json());
          console.log('[push v261] debug after sub', dbg.subs, dbg.counts);
        }catch{}
      },1000);
    }
  }catch(err){ console.error('[push v261] ERR',err); alert('Fout: '+err.message); }
}

async function init(){
  const b=ensureBell(); if(!b) return;
  console.log('[push v261] init - worker:', WORKER_URL, 'VAPID', VAPID_PUBLIC_KEY.slice(0,10));
  document.removeEventListener('click', window._pushClickHandler);
  window._pushClickHandler = (ev)=>{ if(ev.target.closest && ev.target.closest('#push-bell-btn')) onBellClick(ev); };
  document.addEventListener('click', window._pushClickHandler);
  try{ 
    swReg=await navigator.serviceWorker.ready; 
    const s=await swReg.pushManager.getSubscription(); 
    b.textContent=s?'🔔':'🔕'; 
    if(s) b.classList.add('enabled','active'); 
    console.log('[push v261] hasSub',!!s, s? s.endpoint.slice(0,60):''); 
    if(s){ updateSourcesOnServer(); }
  }catch(e){ console.log('[push v261] init err',e); }
}

window.updatePushBell = init;
window.updatePushSubscription = updateSourcesOnServer;

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
setTimeout(init,1000);

window.addEventListener('storage', (e)=>{
  if(e.key === 'nieuwsommen_bronnen_v2'){
    setTimeout(()=>updateSourcesOnServer(), 500);
  }
});
