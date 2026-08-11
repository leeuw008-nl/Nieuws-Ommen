// push.js v12 - FIX 12-08-2026 - unified bell handling + subpad fix
const WORKER_URL = 'https://ommen-push-v2.leeuw008.workers.dev';
let swReg=null; let vapidKey=null;

function urlBase64ToUint8Array(b){const p='='.repeat((4-b.length%4)%4);const base=(b+p).replace(/-/g,'+').replace(/_/g,'/');const raw=atob(base);const out=new Uint8Array(raw.length);for(let i=0;i<raw.length;++i)out[i]=raw.charCodeAt(i);return out;}
function getBell(){
  return document.getElementById('push-bell-btn') || document.getElementById('bellBtn') || document.querySelector('.bell') || document.getElementById('notifBell') || document.querySelector('#bell-slot button');
}
function ensureBellButton(){
  const slot=document.getElementById('bell-slot');
  if(!slot) return null;
  let btn=getBell();
  if(!btn){
    btn=document.createElement('button');
    btn.type='button';
    btn.id='push-bell-btn';
    btn.textContent='🔕';
    btn.title='Meldingen aan/uit';
    btn.style.cssText='background:none;border:none;font-size:20px;cursor:pointer;';
    slot.appendChild(btn);
  }
  return btn;
}
function getSelectedSources(){
  try{
    if(window.getAppState){
      const st=window.getAppState();
      return Object.keys(st).filter(id=>st[id]?.aan);
    }
    const v=JSON.parse(localStorage.getItem('nieuwsommen_bronnen_v2')||'{}');
    const aan=Object.keys(v).filter(id=>v[id]?.aan);
    if(aan.length) return aan;
  }catch{}
  return ["De Stentor","Gemeente Ommen","Ommen City","OudOmmen","RondOmmen","RTV Oost","RTV Vechtdal","Vechtdal Centraal","Natuurlijk Ommen"];
}
async function initPush(){
  const bell=ensureBellButton();
  if(!bell) return;
  bell.style.pointerEvents='auto'; bell.style.opacity='1'; bell.style.cursor='pointer';
  
  // voorkom dubbele handlers
  const newBell=bell.cloneNode(true);
  bell.parentNode.replaceChild(newBell, bell);
  const b=newBell;

  b.onclick=async(e)=>{
    e.preventDefault(); e.stopPropagation();
    try{
      if(Notification.permission==='denied'){ alert('Meldingen geblokkeerd - zet aan via slotje in adresbalk'); return; }
      if(!swReg) swReg=await navigator.serviceWorker.ready;
      if(!vapidKey){
        const r=await fetch(WORKER_URL+'/vapidPublicKey',{cache:'no-store'});
        if(!r.ok) throw new Error('VAPID key niet beschikbaar');
        vapidKey=(await r.text()).trim();
      }
      const existing=await swReg.pushManager.getSubscription();
      if(existing){
        await fetch(WORKER_URL+'/unsubscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({endpoint:existing.endpoint})}).catch(()=>{});
        await existing.unsubscribe();
        b.textContent='🔕'; b.classList.remove('active','enabled');
        localStorage.removeItem('ommen_push_subscribed');
        alert('Meldingen uitgeschakeld');
      }else{
        const perm=await Notification.requestPermission();
        if(perm!=='granted'){ alert('Toestemming geweigerd'); return; }
        const sub=await swReg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:urlBase64ToUint8Array(vapidKey)});
        const p256dh=btoa(String.fromCharCode(...new Uint8Array(sub.getKey('p256dh')))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
        const auth=btoa(String.fromCharCode(...new Uint8Array(sub.getKey('auth')))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
        const sources=getSelectedSources();
        const resp=await fetch(WORKER_URL+'/subscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({endpoint:sub.endpoint,keys:{p256dh,auth},sources})});
        if(!resp.ok) throw new Error('Subscribe failed');
        b.textContent='🔔'; b.classList.add('active','enabled');
        localStorage.setItem('ommen_push_subscribed','1');
        alert('Meldingen ingeschakeld! Je krijgt nu een testmelding.');
        try{ new Notification('Ommen Nieuws',{body:"Meldingen zijn ingeschakeld!"}); }catch{}
        setTimeout(()=>{ fetch(WORKER_URL+'/send?title=Bel%20werkt%20weer&body=Bevestiging:%20meldingen%20aan').catch(()=>{}); },1200);
      }
    }catch(err){
      console.error(err);
      alert('Bel fout: '+err.message);
    }
  };
  try{
    swReg=await navigator.serviceWorker.ready;
    const sub=await swReg.pushManager.getSubscription();
    b.textContent=sub?'🔔':'🔕';
    if(sub){ b.classList.add('active','enabled'); } else { b.classList.remove('active','enabled'); }
  }catch(e){ console.log('bell init fail', e); }
}

// update bell when sources change
window.updatePushBell=async()=>{
  try{
    const bell=getBell(); if(!bell) return;
    const reg=await navigator.serviceWorker.ready;
    const sub=await reg.pushManager.getSubscription();
    if(!sub) return;
    const sources=getSelectedSources();
    await fetch(WORKER_URL+'/subscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({endpoint:sub.endpoint,keys:{p256dh:'',auth:'',update:true},sources})}).catch(()=>{});
  }catch{}
};

if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',initPush);}else{initPush();}
setTimeout(initPush,800);
setTimeout(initPush,2000);
