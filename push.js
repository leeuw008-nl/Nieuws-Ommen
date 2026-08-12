
// push.js v13 FINAL - BELFIX + TESTMELDING ALTIJD LOKAAL - 13-08-2026 voor morgen
const WORKER_URL = 'https://ommen-push-v2.leeuw008.workers.dev';
let swReg=null; let vapidKey=null;

function urlBase64ToUint8Array(b){const p='='.repeat((4-b.length%4)%4);const base=(b+p).replace(/-/g,'+').replace(/_/g,'/');const raw=atob(base);const out=new Uint8Array(raw.length);for(let i=0;i<raw.length;++i)out[i]=raw.charCodeAt(i);return out;}
function getBell(){ return document.getElementById('push-bell-btn') || document.querySelector('#bell-slot button'); }
function ensureBellButton(){
  const slot=document.getElementById('bell-slot'); if(!slot) return null;
  let btn=getBell();
  if(!btn){
    btn=document.createElement('button'); btn.type='button'; btn.id='push-bell-btn';
    btn.textContent='🔕'; btn.title='Meldingen aan/uit';
    btn.style.cssText='background:none;border:none;font-size:22px;cursor:pointer;line-height:1;';
    slot.appendChild(btn);
  }
  return btn;
}
function getSelectedSources(){
  try{
    if(window.getAppState){ const st=window.getAppState(); return Object.keys(st).filter(id=>st[id]?.aan); }
    const v=JSON.parse(localStorage.getItem('nieuwsommen_bronnen_v2')||'{}'); const aan=Object.keys(v).filter(id=>v[id]?.aan); if(aan.length) return aan;
  }catch{}
  return ["De Stentor","Gemeente Ommen","Ommen City","OudOmmen","RondOmmen","RTV Oost","RTV Vechtdal","Vechtdal Centraal","Natuurlijk Ommen"];
}
function showLocalTest(){
  try{
    if(Notification.permission!=='granted') return;
    // Probeer via ServiceWorker (werkt op mobiel + als tab dicht is)
    if(swReg && swReg.showNotification){
      swReg.showNotification('🔔 Bel werkt!', {body:'Testmelding: meldingen zijn aan. Je krijgt nu weer nieuws-alerts.', icon:'./icons/icon-192x192.png', badge:'./icons/icon-192x192.png', vibrate:[200,100,200]});
    } else {
      new Notification('🔔 Bel werkt!', {body:'Testmelding: meldingen zijn aan.'});
    }
  }catch(e){ console.log('local notif fail', e); try{ new Notification('🔔 Bel werkt!', {body:'Test OK'});}catch{} }
}
async function initPush(){
  const bell=ensureBellButton(); if(!bell) { console.log('BEL: slot niet gevonden'); return; }
  bell.style.pointerEvents='auto'; bell.style.opacity='1'; bell.style.cursor='pointer';
  const newBell=bell.cloneNode(true); bell.parentNode.replaceChild(newBell, bell); const b=newBell;

  b.onclick=async(e)=>{
    e.preventDefault(); e.stopPropagation();
    console.log('BEL KLIK');
    try{
      if(!('Notification' in window)){ alert('Browser ondersteunt geen meldingen'); return; }
      if(Notification.permission==='denied'){ alert('Meldingen geblokkeerd - klik op slotje 🔒 in adresbalk -> Meldingen -> Toestaan'); return; }
      if(!('serviceWorker' in navigator)){ alert('Service Worker niet ondersteund'); return; }
      if(!swReg){ try{ swReg=await navigator.serviceWorker.ready; }catch{} if(!swReg){ swReg=await navigator.serviceWorker.register('./service-worker.js',{scope:'./'}); } }
      if(!vapidKey){
        const r=await fetch(WORKER_URL+'/vapidPublicKey',{cache:'no-store'});
        if(!r.ok) throw new Error('VAPID key ophalen mislukt '+r.status);
        vapidKey=(await r.text()).trim();
      }
      const existing=await swReg.pushManager.getSubscription();
      if(existing){
        console.log('BEL: uitzetten');
        await fetch(WORKER_URL+'/unsubscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({endpoint:existing.endpoint})}).catch(()=>{});
        await existing.unsubscribe();
        b.textContent='🔕'; b.classList.remove('active','enabled');
        localStorage.removeItem('ommen_push_subscribed');
        // lokale bevestiging
        try{ swReg.showNotification('🔕 Meldingen uit op dit apparaat', {body:'Dit apparaat ontvangt geen alerts meer.'}); }catch{}
        alert('Meldingen uitgeschakeld');
      }else{
        console.log('BEL: aanzetten');
        const perm=await Notification.requestPermission();
        if(perm!=='granted'){ alert('Geen toestemming gegeven'); return; }
        const sub=await swReg.pushManager.subscribe({userVisibleOnly:true, applicationServerKey:urlBase64ToUint8Array(vapidKey)});
        const p256dh=btoa(String.fromCharCode(...new Uint8Array(sub.getKey('p256dh')))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
        const auth=btoa(String.fromCharCode(...new Uint8Array(sub.getKey('auth')))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''));
        const sources=getSelectedSources();
        console.log('BEL: subscribe naar worker met', sources.length, 'bronnen');
        const resp=await fetch(WORKER_URL+'/subscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({endpoint:sub.endpoint,keys:{p256dh,auth},sources})});
        if(!resp.ok){ const t=await resp.text(); throw new Error('Subscribe failed '+resp.status+' '+t.slice(0,200)); }
        b.textContent='🔔'; b.classList.add('active','enabled');
        localStorage.setItem('ommen_push_subscribed','1');
        // 1) Alleen LOKALE testmelding op DIT apparaat (nooit broadcast naar iedereen)
        showLocalTest();
        alert('✅ Meldingen ingeschakeld op DIT apparaat! Je zou nu direct een testmelding moeten zien.\n\nAndere apparaten krijgen hier GEEN melding van.');
      }
    }catch(err){
      console.error('BEL ERROR', err);
      alert('Bel fout: '+err.message+'\n\nTip: doe Ctrl+Shift+R, en probeer opnieuw. Check console F12.');
    }
  };
  try{
    swReg=await navigator.serviceWorker.ready;
    const sub=await swReg.pushManager.getSubscription();
    b.textContent=sub?'🔔':'🔕'; if(sub){ b.classList.add('active','enabled'); b.title='Meldingen aan - klik om uit te zetten'; } else { b.classList.remove('active','enabled'); b.title='Meldingen uit - klik om aan te zetten'; }
    console.log('BEL status', sub?'AAN':'UIT');
  }catch(e){ console.log('bell init fail', e); }
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
