
// push.js v15 - NO BROADCAST + MOBILE FIX + DEBUG - 13-08-2026
const WORKER_URL = 'https://ommen-push-v2.leeuw008.workers.dev';
let swReg=null; let vapidKey=null;

function urlBase64ToUint8Array(base64String){
  try{
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g,'+').replace(/_/g,'/');
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for(let i=0;i<rawData.length;++i){ outputArray[i]=rawData.charCodeAt(i); }
    return outputArray;
  }catch(e){ console.error('b64 decode fail', e); throw e; }
}
function getBell(){ return document.getElementById('push-bell-btn') || document.querySelector('#bell-slot button'); }
function ensureBellButton(){
  const slot=document.getElementById('bell-slot'); if(!slot){ console.log('BEL: #bell-slot niet gevonden'); return null; }
  let btn=getBell();
  if(!btn){
    btn=document.createElement('button'); btn.type='button'; btn.id='push-bell-btn';
    btn.textContent='\uD83D\uDD15'; // 🔕 as unicode to avoid encoding issues
    btn.title='Meldingen aan/uit';
    btn.style.cssText='background:none;border:none;font-size:22px;cursor:pointer;line-height:1;';
    slot.appendChild(btn);
    console.log('BEL: knop aangemaakt');
  }
  return btn;
}
function getSelectedSources(){
  try{
    const v=JSON.parse(localStorage.getItem('nieuwsommen_bronnen_v2')||'{}');
    const aan=Object.keys(v).filter(id=>v[id]?.aan);
    if(aan.length) return aan;
  }catch{}
  return ["De Stentor","Gemeente Ommen","Ommen City","OudOmmen","RondOmmen","RTV Oost","RTV Vechtdal","Vechtdal Centraal","Natuurlijk Ommen"];
}
function showLocalTest(){
  try{
    if(Notification.permission!=='granted'){ console.log('BEL: geen permission voor local test'); return; }
    if(swReg && swReg.showNotification){
      swReg.showNotification('\uD83D\uDD14 Bel werkt!', {body:'Testmelding: dit apparaat ontvangt weer alerts (alleen dit apparaat).', icon:'./icons/icon-192x192.png', badge:'./icons/icon-192x192.png', vibrate:[200,100,200], tag:'bel-test'});
    } else {
      new Notification('\uD83D\uDD14 Bel werkt!', {body:'Testmelding: dit apparaat ontvangt weer alerts.'});
    }
  }catch(e){ console.log('local notif fail', e); try{ new Notification('Bel werkt!', {body:'Test OK'});}catch(e2){ console.log('fallback notif fail', e2); } }
}
async function initPush(){
  console.log('BEL v15 init start');
  const bell=ensureBellButton(); if(!bell){ console.log('BEL: geen bell, stop'); return; }
  bell.style.pointerEvents='auto'; bell.style.opacity='1'; bell.style.cursor='pointer';
  // vervang om dubbele handlers te voorkomen
  const newBell=bell.cloneNode(true); bell.parentNode.replaceChild(newBell, bell); const b=newBell;

  b.onclick=async(e)=>{
    e.preventDefault(); e.stopPropagation();
    console.log('BEL KLIK v15');
    try{
      if(!('Notification' in window)){ alert('Deze browser ondersteunt geen meldingen'); return; }
      if(Notification.permission==='denied'){ alert('Meldingen geblokkeerd - ga naar instellingen van je browser (slotje in adresbalk) -> Meldingen -> Toestaan'); return; }
      if(!('serviceWorker' in navigator)){ alert('Service Worker niet ondersteund'); return; }
      if(!swReg){
        try{ swReg=await navigator.serviceWorker.ready; }catch{}
        if(!swReg){
          console.log('BEL: registreer SW ./service-worker.js');
          swReg=await navigator.serviceWorker.register('./service-worker.js',{scope:'./'});
        }
      }
      if(!vapidKey){
        console.log('BEL: haal VAPID key op');
        const r=await fetch(WORKER_URL+'/vapidPublicKey',{cache:'no-store'});
        if(!r.ok) throw new Error('VAPID key ophalen mislukt: '+r.status);
        vapidKey=(await r.text()).trim();
        console.log('BEL: VAPID ok len', vapidKey.length);
      }
      const existing=await swReg.pushManager.getSubscription();
      console.log('BEL: existing sub?', !!existing);
      if(existing){
        console.log('BEL: unsubscribe start');
        try{ await fetch(WORKER_URL+'/unsubscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({endpoint:existing.endpoint})}); }catch(err){ console.log('unsub worker fail', err); }
        await existing.unsubscribe();
        b.textContent='\uD83D\uDD15'; b.classList.remove('active','enabled');
        localStorage.removeItem('ommen_push_subscribed');
        try{ if(swReg.showNotification){ swReg.showNotification('\uD83D\uDD15 Meldingen uit op dit apparaat', {body:'Dit apparaat ontvangt geen alerts meer.', tag:'bel-off'}); } }catch{}
        alert('Meldingen uitgeschakeld op DIT apparaat');
      }else{
        console.log('BEL: subscribe start');
        const perm=await Notification.requestPermission();
        console.log('BEL: permission', perm);
        if(perm!=='granted'){ alert('Geen toestemming gegeven ('+perm+')'); return; }
        console.log('BEL: pushManager.subscribe...');
        let sub;
        try{
          sub=await swReg.pushManager.subscribe({userVisibleOnly:true, applicationServerKey:urlBase64ToUint8Array(vapidKey)});
        }catch(subErr){
          console.error('BEL subscribe error', subErr);
          // Vaak: gcm_sender_id of VAPID mismatch -> toon details
          alert('Subscribe mislukt: '+subErr.message+'\n\nTip: verwijder site-gegevens (Instellingen -> Privacy -> Sitegegevens wissen) en probeer opnieuw.\n\nConsole: '+subErr.name);
          return;
        }
        console.log('BEL: sub OK', sub.endpoint.slice(-20));
        const p256dh=btoa(String.fromCharCode(...new Uint8Array(sub.getKey('p256dh')))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
        const auth=btoa(String.fromCharCode(...new Uint8Array(sub.getKey('auth')))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
        const sources=getSelectedSources();
        console.log('BEL: stuur sub naar worker', sources.length);
        const resp=await fetch(WORKER_URL+'/subscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({endpoint:sub.endpoint,keys:{p256dh,auth},sources})});
        const respText=await resp.text();
        console.log('BEL: subscribe response', resp.status, respText.slice(0,200));
        if(!resp.ok) throw new Error('Subscribe naar worker mislukt: '+resp.status+' '+respText.slice(0,300));
        b.textContent='\uD83D\uDD14'; b.classList.add('active','enabled');
        localStorage.setItem('ommen_push_subscribed','1');
        showLocalTest();
        alert('Meldingen ingeschakeld op DIT apparaat!\n\nJe zou nu direct een melding moeten zien. Andere apparaten krijgen GEEN melding.');
      }
    }catch(err){
      console.error('BEL ERROR v15', err);
      alert('Bel fout: '+err.message+'\n\nOpen console (op PC F12) voor details.\nNaam: '+err.name);
    }
  };
  try{
    swReg=await navigator.serviceWorker.ready;
    const sub=await swReg.pushManager.getSubscription();
    b.textContent=sub?'\uD83D\uDD14':'\uD83D\uDD15';
    if(sub){ b.classList.add('active','enabled'); b.title='Meldingen aan - klik om uit te zetten'; } else { b.classList.remove('active','enabled'); b.title='Meldingen uit - klik om aan te zetten'; }
    console.log('BEL status bij laden', sub?'AAN':'UIT');
  }catch(e){ console.log('bell status fail', e); }
}
window.updatePushBell=async()=>{
  try{
    const bell=getBell(); if(!bell) return;
    const reg=await navigator.serviceWorker.ready;
    const sub=await reg.pushManager.getSubscription();
    if(!sub) return;
    const sources=getSelectedSources();
    await fetch(WORKER_URL+'/subscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({endpoint:sub.endpoint,keys:{p256dh:'',auth:'',update:true},sources})}).catch(()=>{});
    console.log('BEL sources update', sources.length);
  }catch{}
};
if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',initPush);}else{initPush();}
setTimeout(initPush,800);
setTimeout(initPush,2500);
