// push.js - BEL FIX 11-08-2026 - altijd klikbaar
let swReg=null;let vapidKey=null;
async function initPush(){
  const bell=document.getElementById('bellBtn')||document.querySelector('.bell');
  if(!bell){console.log('bellBtn niet gevonden');return;}
  console.log('push.js init - bel gevonden');
  bell.style.pointerEvents='auto'; bell.style.opacity='1';
  bell.onclick=async()=>{
    try{
      console.log('BEL KLIK');
      if(!('Notification' in window)){alert('Meldingen niet ondersteund');return;}
      if(Notification.permission==='denied'){alert('Meldingen geblokkeerd - zet aan in browser instellingen');return;}
      if(!swReg){swReg=await navigator.serviceWorker.ready;}
      if(!vapidKey){
        const r=await fetch('https://jouw-worker-naam.workers.dev/vapidPublicKey'); // VERVANG DOOR JOUW WORKER URL
        vapidKey=(await r.text()).trim();
      }
      const existing=await swReg.pushManager.getSubscription();
      if(existing){
        const ep=existing.endpoint;
        await fetch('https://jouw-worker-naam.workers.dev/unsubscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({endpoint:ep})});
        await existing.unsubscribe();
        bell.textContent='🔕'; bell.classList.remove('active'); console.log('unsubscribed');
      }else{
        const perm=await Notification.requestPermission();
        if(perm!=='granted'){alert('Toestemming geweigerd');return;}
        const sub=await swReg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:urlBase64ToUint8Array(vapidKey)});
        await fetch('https://jouw-worker-naam.workers.dev/subscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({endpoint:sub.endpoint,keys:{p256dh:btoa(String.fromCharCode(...new Uint8Array(sub.getKey('p256dh')))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''),auth:btoa(String.fromCharCode(...new Uint8Array(sub.getKey('auth')))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')},sources:[]})});
        bell.textContent='🔔'; bell.classList.add('active'); console.log('subscribed');
        // test push
        setTimeout(async()=>{try{await fetch('https://jouw-worker-naam.workers.dev/send?title=Bel%20werkt&body=Je%20ontvangt%20weer%20meldingen');}catch{}},1000);
      }
    }catch(e){console.error('BEL ERROR',e);alert('Bel fout: '+e.message);}
  };
  // init status
  try{
    if(!('serviceWorker' in navigator))return;
    swReg=await navigator.serviceWorker.ready;
    const sub=await swReg.pushManager.getSubscription();
    bell.textContent=sub?'🔔':'🔕';
    if(sub)bell.classList.add('active');
  }catch(e){console.log('init status fail',e);}
}
function urlBase64ToUint8Array(base64String){const padding='='.repeat((4-base64String.length%4)%4);const base64=(base64String+padding).replace(/-/g,'+').replace(/_/g,'/');const rawData=atob(base64);const outputArray=new Uint8Array(rawData.length);for(let i=0;i<rawData.length;++i){outputArray[i]=rawData.charCodeAt(i);}return outputArray;}
if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',initPush);}else{initPush();}
