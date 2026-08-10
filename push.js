// push.js - BEL FIX 11-08-2026 - Tjeerd - altijd klikbaar - worker: ommen-push-v2.leeuw008.workers.dev
const WORKER_URL = 'https://ommen-push-v2.leeuw008.workers.dev';
let swReg = null;
let vapidKey = null;

async function initPush(){
  const bell = document.getElementById('bellBtn') || document.querySelector('.bell') || document.getElementById('notifBell');
  if(!bell){ console.log('BEL: knop niet gevonden'); return; }
  bell.style.pointerEvents = 'auto'; bell.style.opacity = '1'; bell.style.cursor = 'pointer';
  bell.onclick = async (e) => {
    e.preventDefault(); e.stopPropagation();
    console.log('BEL KLIK');
    try{
      if(!('Notification' in window)){ alert('Browser ondersteunt geen meldingen'); return; }
      if(Notification.permission === 'denied'){ alert('Meldingen geblokkeerd - zet aan via slotje in adresbalk'); return; }
      if(!swReg){ swReg = await navigator.serviceWorker.ready; }
      if(!vapidKey){
        const r = await fetch(WORKER_URL + '/vapidPublicKey');
        vapidKey = (await r.text()).trim();
      }
      const existing = await swReg.pushManager.getSubscription();
      if(existing){
        await fetch(WORKER_URL + '/unsubscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({endpoint:existing.endpoint})});
        await existing.unsubscribe();
        bell.textContent = '🔕'; bell.classList.remove('active');
      }else{
        const perm = await Notification.requestPermission();
        if(perm!== 'granted'){ alert('Geen toestemming'); return; }
        const sub = await swReg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:urlBase64ToUint8Array(vapidKey)});
        const p256dh = btoa(String.fromCharCode(...new Uint8Array(sub.getKey('p256dh')))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
        const auth = btoa(String.fromCharCode(...new Uint8Array(sub.getKey('auth')))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
        await fetch(WORKER_URL + '/subscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({endpoint:sub.endpoint,keys:{p256dh,auth},sources:[]})});
        bell.textContent = '🔔'; bell.classList.add('active');
        setTimeout(async()=>{ try{ await fetch(WORKER_URL + '/send?title=Bel%20werkt%20weer&body=Je%20ontvangt%20weer%20meldingen'); }catch{} },1500);
      }
    }catch(err){ console.error('BEL ERROR',err); alert('Bel fout: '+err.message); }
  };
  try{ swReg = await navigator.serviceWorker.ready; const sub = await swReg.pushManager.getSubscription(); bell.textContent = sub? '🔔' : '🔕'; if(sub) bell.classList.add('active'); }catch{}
}
function urlBase64ToUint8Array(b){const p='='.repeat((4-b.length%4)%4);const base=(b+p).replace(/-/g,'+').replace(/_/g,'/');const raw=atob(base);const out=new Uint8Array(raw.length);for(let i=0;i<raw.length;++i)out[i]=raw.charCodeAt(i);return out;}
if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',initPush);}else{initPush();}
setTimeout(initPush,2000);
