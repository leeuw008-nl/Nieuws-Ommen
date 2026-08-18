// push.js v18 FIXED - push listener hersteld + SW v227
const WORKER_URL = 'https://ommen-push-v2.leeuw008.workers.dev';
const VAPID_PUBLIC_KEY = 'BBnCDkkzIXwUYFrF8ct-OXtRQ6-HaqF74grNVDLe4pw1SwG8_JyMYIHItRY6smyqPpdt81U1EZF33loTsepqnYo';
let swReg=null;

function urlBase64ToUint8Array(base64String){
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g,'+').replace(/_/g,'/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for(let i=0;i<rawData.length;++i){ outputArray[i]=rawData.charCodeAt(i); }
  return outputArray;
}
function getBell(){ return document.getElementById('push-bell-btn') || document.querySelector('#bell-slot button'); }
function ensureBellButton(){
  const slot=document.getElementById('bell-slot'); if(!slot) return null;
  let btn=getBell();
  if(!btn){
    btn=document.createElement('button'); btn.type='button'; btn.id='push-bell-btn';
    btn.textContent='🔕'; btn.title='Meldingen';
    btn.style.cssText='background:none;border:none;font-size:22px;cursor:pointer;';
    slot.appendChild(btn);
  }
  return btn;
}
function getSelectedSources(){
  try{ const v=JSON.parse(localStorage.getItem('nieuwsommen_bronnen_v2')||'{}'); const aan=Object.keys(v).filter(id=>v[id]?.aan); if(aan.length) return aan; }catch{}
  return ["De Stentor","Gemeente Ommen","Ommen City","OudOmmen","RondOmmen","RTV Oost","RTV Vechtdal","Vechtdal Centraal","Natuurlijk Ommen"];
}
async function testLocalNotification(reason){
  try{
    if(Notification.permission!=='granted') return;
    if(swReg && swReg.showNotification){
      await swReg.showNotification('🔔 '+reason, {body:'Meldingen zijn '+reason.toLowerCase(), icon:'./icons/icon-192x192.png', badge:'./icons/icon-192x192.png', tag:'test-'+Date.now()});
    } else {
      new Notification('🔔 '+reason, {body:'Meldingen zijn '+reason.toLowerCase()});
    }
  }catch{}
}
async function initPush(){
  const bell=ensureBellButton(); if(!bell) return;
  bell.style.pointerEvents='auto'; bell.style.opacity='1'; bell.style.cursor='pointer';
  const newBell=bell.cloneNode(true); bell.parentNode.replaceChild(newBell, bell); const b=newBell;

  b.onclick=async(e)=>{
    e.preventDefault(); e.stopPropagation();
    try{
      if(!('Notification' in window)){ alert('Browser ondersteunt geen meldingen'); return; }
      if(!('serviceWorker' in navigator)){ alert('Service Worker niet ondersteund'); return; }
      if(!('PushManager' in window)){ alert('Push meldingen niet ondersteund'); return; }
      if(!swReg){
        try{ swReg=await navigator.serviceWorker.ready; }catch{}
        if(!swReg){
          swReg=await navigator.serviceWorker.register('./service-worker.js',{scope:'./'});
          await new Promise(r=>setTimeout(r,800));
        }
      }
      if(Notification.permission==='denied'){
        alert('Meldingen geblokkeerd - sta toe via slotje in adresbalk');
        return;
      }
      let existing=null;
      try{ existing=await swReg.pushManager.getSubscription(); }catch{}

      if(existing){
        try{
          await fetch(WORKER_URL+'/unsubscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({endpoint:existing.endpoint})}).catch(()=>{});
          await existing.unsubscribe();
          b.textContent='🔕'; b.classList.remove('active','enabled');
          localStorage.removeItem('ommen_push_subscribed');
          await testLocalNotification('uitgeschakeld');
          alert('Meldingen uitgeschakeld');
        }catch(err){
          try{ await existing.unsubscribe(); }catch{}
          b.textContent='🔕'; b.classList.remove('active','enabled');
          localStorage.removeItem('ommen_push_subscribed');
          alert('Meldingen uitgeschakeld');
        }
      }else{
        const perm=await Notification.requestPermission();
        if(perm!=='granted'){ alert('Geen toestemming gegeven'); return; }
        let sub;
        try{
          sub=await swReg.pushManager.subscribe({userVisibleOnly:true, applicationServerKey:urlBase64ToUint8Array(VAPID_PUBLIC_KEY)});
        }catch(subErr){
          if(subErr.message.includes('already') || subErr.name==='InvalidStateError'){
            try{
              const old=await swReg.pushManager.getSubscription();
              if(old) await old.unsubscribe();
              sub=await swReg.pushManager.subscribe({userVisibleOnly:true, applicationServerKey:urlBase64ToUint8Array(VAPID_PUBLIC_KEY)});
            }catch(e2){ throw new Error('Inschrijven mislukt: '+e2.message); }
          } else {
            throw subErr;
          }
        }
        const p256dh=btoa(String.fromCharCode(...new Uint8Array(sub.getKey('p256dh')))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
        const auth=btoa(String.fromCharCode(...new Uint8Array(sub.getKey('auth')))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
        const sources=getSelectedSources();
        const resp=await fetch(WORKER_URL+'/subscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({endpoint:sub.endpoint,keys:{p256dh,auth},sources})});
        if(!resp.ok){ const t=await resp.text(); throw new Error('Opslaan mislukt '+resp.status); }
        b.textContent='🔔'; b.classList.add('active','enabled');
        localStorage.setItem('ommen_push_subscribed','1');
        await testLocalNotification('ingeschakeld');
        alert('Meldingen ingeschakeld');
      }
    }catch(err){
      alert('Fout bij in-/uitschakelen: '+err.message);
    }
  };
  try{
    swReg=await navigator.serviceWorker.ready;
    const sub=await swReg.pushManager.getSubscription();
    b.textContent=sub?'🔔':'🔕';
    if(sub){ b.classList.add('active','enabled'); }
  }catch(e){}
}
window.updatePushBell=async()=>{
  try{
    const reg=await navigator.serviceWorker.ready;
    const sub=await reg.pushManager.getSubscription();
    if(!sub) return;
    const v=JSON.parse(localStorage.getItem('nieuwsommen_bronnen_v2')||'{}');
    const aan=Object.keys(v).filter(id=>v[id]?.aan);
    await fetch(WORKER_URL+'/subscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({endpoint:sub.endpoint,keys:{p256dh:'',auth:'',update:true},sources:aan})}).catch(()=>{});
  }catch{}
};
if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',initPush);}else{initPush();}
setTimeout(initPush,800);
setTimeout(initPush,2500);
