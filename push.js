// push.js v19 FIXED - delegated click zodat app.js hem niet kapot maakt
const WORKER_URL = 'https://ommen-push-v2.leeuw008.workers.dev';
const VAPID_PUBLIC_KEY = 'BBnCDkkzIXwUYFrF8ct-OXtRQ6-HaqF74grNVDLe4pw1SwG8_JyMYIHItRY6smyqPpdt81U1EZF33loTsepqnYo';
let swReg=null;

function urlBase64ToUint8Array(b64s){
  const pad='='.repeat((4-b64s.length%4)%4);
  const b64=(b64s+pad).replace(/-/g,'+').replace(/_/g,'/');
  const raw=atob(b64);
  const out=new Uint8Array(raw.length);
  for(let i=0;i<raw.length;++i) out[i]=raw.charCodeAt(i);
  return out;
}
function getBell(){ return document.getElementById('push-bell-btn'); }
function ensureBellButton(){
  const slot=document.getElementById('bell-slot'); if(!slot) return null;
  let btn=getBell();
  if(!btn){
    btn=document.createElement('button'); btn.type='button'; btn.id='push-bell-btn';
    btn.textContent='🔕'; btn.title='Meldingen';
    slot.appendChild(btn);
  }
  return btn;
}
function getSelectedSources(){
  try{ const v=JSON.parse(localStorage.getItem('nieuwsommen_bronnen_v2')||'{}'); const aan=Object.keys(v).filter(id=>v[id]?.aan); if(aan.length) return aan; }catch{}
  return ["De Stentor","Gemeente Ommen","Ommen City","OudOmmen","RondOmmen","RTV Oost","RTV Vechtdal","Vechtdal Centraal","Natuurlijk Ommen"];
}

async function handleBellClick(e){
  e.preventDefault(); e.stopPropagation();
  const b=getBell(); if(!b) return;
  console.log('[push.js v19] bell clicked, permission=', Notification.permission);
  try{
    if(!('Notification' in window)){ alert('Browser ondersteunt geen meldingen'); return; }
    if(!('serviceWorker' in navigator)){ alert('Service Worker niet ondersteund'); return; }
    if(!('PushManager' in window)){ alert('Push niet ondersteund'); return; }
    if(!swReg){
      try{ swReg=await navigator.serviceWorker.ready; }catch{}
      if(!swReg) swReg=await navigator.serviceWorker.register('./service-worker.js',{scope:'./'});
    }
    if(Notification.permission==='denied'){ alert('Meldingen geblokkeerd - via slotje in adresbalk toestaan'); return; }
    let existing=null; try{ existing=await swReg.pushManager.getSubscription(); }catch{}
    console.log('[push.js v19] existing sub:',!!existing);
    if(existing){
      console.log('[push.js v19] unsubscribing...');
      try{ await fetch(WORKER_URL+'/unsubscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({endpoint:existing.endpoint})}).catch(()=>{}); }catch{}
      await existing.unsubscribe();
      b.textContent='🔕'; b.classList.remove('active','enabled');
      localStorage.removeItem('ommen_push_subscribed');
      alert('Meldingen uitgeschakeld');
      console.log('[push.js v19] unsubscribed');
    }else{
      const perm=await Notification.requestPermission();
      console.log('[push.js v19] permission result:', perm);
      if(perm!=='granted'){ alert('Geen toestemming'); return; }
      console.log('[push.js v19] subscribing...');
      const sub=await swReg.pushManager.subscribe({userVisibleOnly:true, applicationServerKey:urlBase64ToUint8Array(VAPID_PUBLIC_KEY)});
      const p256dh=btoa(String.fromCharCode(...new Uint8Array(sub.getKey('p256dh')))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
      const auth=btoa(String.fromCharCode(...new Uint8Array(sub.getKey('auth')))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
      const sources=getSelectedSources();
      console.log('[push.js v19] sending to worker...', sources.length);
      const resp=await fetch(WORKER_URL+'/subscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({endpoint:sub.endpoint,keys:{p256dh,auth},sources})});
      console.log('[push.js v19] worker response:', resp.status);
      if(!resp.ok){ const t=await resp.text(); throw new Error('Opslaan mislukt '+resp.status+' '+t); }
      b.textContent='🔔'; b.classList.add('active','enabled');
      localStorage.setItem('ommen_push_subscribed','1');
      alert('Meldingen ingeschakeld - test push komt nu');
      try{ await swReg.showNotification('🔔 ingeschakeld',{body:'Meldingen zijn ingeschakeld', tag:'test-'+Date.now()}); }catch{}
    }
  }catch(err){
    console.error('[push.js v19] fout:', err);
    alert('Fout bij in-/uitschakelen: '+err.message);
  }
}

async function initPush(){
  const bell=ensureBellButton(); if(!bell) { console.log('[push.js v19] no bell-slot'); return; }
  console.log('[push.js v19] initPush start');
  // delegated click - werkt ook als app.js de header herschrijft
  document.removeEventListener('click', handleBellClickDelegated);
  document.addEventListener('click', handleBellClickDelegated);
  try{
    swReg=await navigator.serviceWorker.ready;
    const sub=await swReg.pushManager.getSubscription();
    bell.textContent=sub?'🔔':'🔕';
    if(sub) bell.classList.add('active','enabled');
    console.log('[push.js v19] ready, hasSub=',!!sub);
  }catch(e){ console.log('[push.js v19] ready error', e); }
}
function handleBellClickDelegated(ev){
  const btn=ev.target.closest && ev.target.closest('#push-bell-btn');
  if(btn) handleBellClick(ev);
}
if(document.readyState==='loading'){ document.addEventListener('DOMContentLoaded',initPush); }else{ initPush(); }
setTimeout(initPush,1200);
