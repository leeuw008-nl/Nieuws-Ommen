
// push.js v16 ULTRA DEBUG - PC geen melding + telefoon geen bel - 13-08-2026
const WORKER_URL = 'https://ommen-push-v2.leeuw008.workers.dev';
let swReg=null; let vapidKey=null;

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
  const results = [];
  results.push('--- TEST LOCAL NOTIF: '+reason+' ---');
  results.push('Notification in window: '+('Notification' in window));
  results.push('permission: '+Notification.permission);
  results.push('swReg: '+(swReg?'ok':'null'));
  results.push('swReg.showNotification: '+(swReg && swReg.showNotification?'yes':'no'));
  try{
    if(Notification.permission!=='granted'){ results.push('FAIL: permission niet granted'); return results.join('\n'); }
    if(swReg && swReg.showNotification){
      try{
        await swReg.showNotification('🔔 Test '+reason, {body:'Dit is een testmelding ('+reason+') - als je dit ziet werkt het!', icon:'./icons/icon-192x192.png', badge:'./icons/icon-192x192.png', tag:'debug-'+Date.now()});
        results.push('OK: swReg.showNotification gelukt');
      }catch(e){
        results.push('FAIL swReg.showNotification: '+e.message+' | '+e.name);
        try{ new Notification('🔔 Test '+reason, {body:'Fallback new Notification - '+e.message}); results.push('OK: fallback new Notification gelukt'); }
        catch(e2){ results.push('FAIL fallback new Notification: '+e2.message); }
      }
    } else {
      try{ new Notification('🔔 Test '+reason, {body:'Direct new Notification test'}); results.push('OK: direct new Notification gelukt'); }
      catch(e){ results.push('FAIL direct new Notification: '+e.message); }
    }
  }catch(e){ results.push('EXCEPTION: '+e.message); }
  return results.join('\n');
}
async function initPush(){
  console.log('BEL v16 ULTRA init');
  const bell=ensureBellButton(); if(!bell) return;
  bell.style.pointerEvents='auto'; bell.style.opacity='1'; bell.style.cursor='pointer';
  const newBell=bell.cloneNode(true); bell.parentNode.replaceChild(newBell, bell); const b=newBell;

  b.onclick=async(e)=>{
    e.preventDefault(); e.stopPropagation();
    console.log('BEL KLIK v16');
    let debugLog = '';
    try{
      debugLog += 'Step 0: check support\n';
      if(!('Notification' in window)){ alert('❌ Browser ondersteunt geen Notification API'); return; }
      if(!('serviceWorker' in navigator)){ alert('❌ Geen ServiceWorker support'); return; }
      if(!('PushManager' in window)){ alert('❌ Geen PushManager support'); return; }

      debugLog += 'Step 1: get SW\n';
      if(!swReg){
        try{ swReg=await navigator.serviceWorker.ready; debugLog+='ready ok\n'; }catch(err){ debugLog+='ready fail '+err.message+'\n'; }
        if(!swReg){
          debugLog+='registreer SW\n';
          swReg=await navigator.serviceWorker.register('./service-worker.js',{scope:'./'});
          debugLog+='SW geregistreerd '+swReg.scope+'\n';
          // wacht tot active
          await new Promise(r=>setTimeout(r,800));
        }
      }
      debugLog+='SW: '+(swReg?swReg.scope:'null')+'\n';

      debugLog+='Step 2: permission '+Notification.permission+'\n';
      if(Notification.permission==='denied'){
        alert('❌ Meldingen GEBLOKKEERD in browser\n\nOplossing:\nPC: klik slotje in adresbalk -> Meldingen -> Toestaan\nTelefoon: Chrome -> Instellingen -> Meldingen -> Site-instellingen -> Toestaan');
        return;
      }

      debugLog+='Step 3: VAPID key\n';
      if(!vapidKey){
        const r=await fetch(WORKER_URL+'/vapidPublicKey',{cache:'no-store'});
        if(!r.ok) throw new Error('VAPID ophalen mislukt '+r.status);
        vapidKey=(await r.text()).trim();
        debugLog+='VAPID len '+vapidKey.length+'\n';
      }

      debugLog+='Step 4: check bestaande sub\n';
      let existing=null;
      try{ existing=await swReg.pushManager.getSubscription(); debugLog+='existing: '+(existing?'YES '+existing.endpoint.slice(-20):'NO')+'\n'; }catch(err){ debugLog+='getSubscription fail '+err.message+'\n'; }

      if(existing){
        debugLog+='Step 5: UNSUBSCRIBE\n';
        try{
          await fetch(WORKER_URL+'/unsubscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({endpoint:existing.endpoint})}).catch(()=>{});
          await existing.unsubscribe();
          b.textContent='🔕'; b.classList.remove('active','enabled');
          localStorage.removeItem('ommen_push_subscribed');
          const testRes = await testLocalNotification('UIT gezet');
          alert('Meldingen UIT op dit apparaat\n\nDebug:\n'+debugLog+'\n\n'+testRes);
        }catch(err){
          debugLog+='unsub fail '+err.message+'\n';
          // force clear
          try{ await existing.unsubscribe(); }catch{}
          b.textContent='🔕'; b.classList.remove('active','enabled');
          localStorage.removeItem('ommen_push_subscribed');
          alert('Meldingen uit (met fout, maar wel uit): '+err.message+'\n\n'+debugLog);
        }
      }else{
        debugLog+='Step 5: REQUEST PERMISSION\n';
        const perm=await Notification.requestPermission();
        debugLog+='perm result: '+perm+'\n';
        if(perm!=='granted'){ alert('Geen toestemming: '+perm+'\n\n'+debugLog); return; }

        debugLog+='Step 6: SUBSCRIBE\n';
        let sub;
        try{
          sub=await swReg.pushManager.subscribe({userVisibleOnly:true, applicationServerKey:urlBase64ToUint8Array(vapidKey)});
          debugLog+='sub ok endpoint ...'+sub.endpoint.slice(-30)+'\n';
        }catch(subErr){
          debugLog+='SUBSCRIBE FAIL: '+subErr.message+' | name='+subErr.name+'\n';
          // Veel voorkomende oorzaak: oude sub in andere scope
          if(subErr.message.includes('already') || subErr.name==='InvalidStateError'){
            debugLog+='Probeer cleanup en opnieuw\n';
            try{
              const old=await swReg.pushManager.getSubscription();
              if(old) await old.unsubscribe();
              sub=await swReg.pushManager.subscribe({userVisibleOnly:true, applicationServerKey:urlBase64ToUint8Array(vapidKey)});
              debugLog+='retry ok\n';
            }catch(e2){ throw new Error('Subscribe blijft falen na cleanup: '+e2.message+' ('+subErr.message+')'); }
          } else {
            throw subErr;
          }
        }

        debugLog+='Step 7: stuur naar worker\n';
        const p256dh=btoa(String.fromCharCode(...new Uint8Array(sub.getKey('p256dh')))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
        const auth=btoa(String.fromCharCode(...new Uint8Array(sub.getKey('auth')))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
        const sources=getSelectedSources();
        const resp=await fetch(WORKER_URL+'/subscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({endpoint:sub.endpoint,keys:{p256dh,auth},sources})});
        const respText=await resp.text();
        debugLog+='worker resp '+resp.status+' '+respText.slice(0,200)+'\n';
        if(!resp.ok) throw new Error('Worker subscribe fail '+resp.status+' '+respText);

        b.textContent='🔔'; b.classList.add('active','enabled');
        localStorage.setItem('ommen_push_subscribed','1');

        debugLog+='Step 8: LOCAL TEST\n';
        const testRes = await testLocalNotification('AAN gezet - dit apparaat');
        alert('✅ Meldingen AAN op DIT apparaat!\n\nAls je GEEN melding bovenin ziet, staat je OS meldingen uit!\n\nDebug:\n'+debugLog+'\n\nTest result:\n'+testRes);
      }
    }catch(err){
      console.error('BEL ERROR v16', err);
      alert('❌ Bel fout: '+err.message+'\nNaam: '+err.name+'\n\nDebug log:\n'+debugLog+'\n\nOplossing: Wis sitegegevens en probeer opnieuw.');
    }
  };

  // extra knop voor testen zonder bel aan/uit
  window.testNotif = async()=>{ const r=await testLocalNotification('handmatige test'); alert(r); };

  try{
    swReg=await navigator.serviceWorker.ready;
    const sub=await swReg.pushManager.getSubscription();
    b.textContent=sub?'🔔':'🔕';
    if(sub){ b.classList.add('active','enabled'); }
    console.log('BEL v16 status', sub?'AAN':'UIT');
  }catch(e){ console.log('status fail', e); }
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
