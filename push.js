// push.js v12 FIX - zelfde worker als script.js + bronnen zonder Salland
const PUSH_WORKER_URL = 'https://ommen-push.leeuw008.workers.dev';
const ALLE_BRONNEN = ["De Stentor","Gemeente Ommen","Ommen City","OudOmmen","RondOmmen","RTV Oost","RTV Vechtdal","Vechtdal Centraal","Natuurlijk Ommen"];
const BELL_BG = '#E8FFEA';
const BELL_BORDER = '#A7F3D0';
const BELL_TEXT = '#065f46';
const WHITE_BG = '#ffffff';
const GRAY_BORDER = '#e5e7eb';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}
async function getVapidPublicKey() {
  try {
    // Probeer eerst nieuwe endpoint /vapid (json), daarna oude /vapidPublicKey (text)
    let r = await fetch(`${PUSH_WORKER_URL}/vapid`, {cache:'no-store'});
    if(r.ok){ const j = await r.json(); if(j.publicKey) return j.publicKey; if(j.key) return j.key; }
  } catch {}
  try {
    const r = await fetch(`${PUSH_WORKER_URL}/vapidPublicKey`, {cache:'no-store'});
    if(r.ok) return (await r.text()).trim();
  } catch(e){}
  return null;
}
async function updatePushBell() {
  const target = document.getElementById('bell-slot')?.querySelector('button');
  if(!target) return;
  if(!('Notification' in window) ||!('serviceWorker' in navigator)){
    target.textContent='🔕';
    target.style.setProperty('background', WHITE_BG, 'important');
    target.style.setProperty('border', `1px solid ${GRAY_BORDER}`, 'important');
    return;
  }
  if(Notification.permission==='denied'){
    target.textContent='🔕';
    target.style.setProperty('background', WHITE_BG, 'important');
    target.style.setProperty('border', `1px solid ${GRAY_BORDER}`, 'important');
    return;
  }
  try{
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    const isOn =!!sub;
    target.textContent = isOn? '🔔' : '🔕';
    target.style.opacity = isOn? '1' : '0.6';
    if(isOn){
      target.style.setProperty('background', BELL_BG, 'important');
      target.style.setProperty('background-color', BELL_BG, 'important');
      target.style.setProperty('border', `1px solid ${BELL_BORDER}`, 'important');
      target.style.setProperty('border-color', BELL_BORDER, 'important');
      target.style.setProperty('color', BELL_TEXT, 'important');
      target.classList.add('enabled','active');
      target.setAttribute('aria-pressed','true');
    } else {
      target.style.setProperty('background', WHITE_BG, 'important');
      target.style.setProperty('background-color', WHITE_BG, 'important');
      target.style.setProperty('border', `1px solid ${GRAY_BORDER}`, 'important');
      target.classList.remove('enabled','active');
      target.setAttribute('aria-pressed','false');
    }
  }catch{}
}
function getSelectedSources(){
  try{
    const v2 = JSON.parse(localStorage.getItem('nieuwsommen_bronnen_v2')||'{}');
    if(v2 && typeof v2 === 'object' &&!Array.isArray(v2) && Object.keys(v2).length>0){
      const aan = Object.keys(v2).filter(id=> v2[id]?.aan);
      if(aan.length>0) return aan;
    }
  }catch{}
  try{
    const s = JSON.parse(localStorage.getItem('ommen_selected_sources')||'[]');
    if(Array.isArray(s) && s.length>0) return s;
  }catch{}
  return [...ALLE_BRONNEN];
}
async function togglePushIsolated(){
  try{
    const vapidKey = await getVapidPublicKey();
    if(!vapidKey){ alert('VAPID key niet beschikbaar bij '+PUSH_WORKER_URL); return; }
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if(sub){
      await fetch(`${PUSH_WORKER_URL}/unsubscribe`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({endpoint:sub.endpoint})});
      await sub.unsubscribe();
      localStorage.removeItem('ommen_push_subscribed');
      alert('Meldingen uitgezet'); updatePushBell(); return;
    }
    const perm = await Notification.requestPermission();
    if(perm!=='granted'){ alert('Toestemming geweigerd'); return; }
    sub = await reg.pushManager.subscribe({userVisibleOnly:true, applicationServerKey:urlBase64ToUint8Array(vapidKey)});
    let sources = getSelectedSources();
    // Stuur zelfde formaat als script.js v111: endpoint + keys + sources
    const key_p256dh = btoa(String.fromCharCode(...new Uint8Array(sub.getKey('p256dh')))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    const key_auth = btoa(String.fromCharCode(...new Uint8Array(sub.getKey('auth')))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    await fetch(`${PUSH_WORKER_URL}/subscribe`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({endpoint:sub.endpoint, keys:{p256dh:key_p256dh, auth:key_auth}, sources})});
    localStorage.setItem('ommen_push_subscribed','1');
    alert('Meldingen aangezet!'); updatePushBell();
  }catch(e){ alert('Fout: '+e.message); }
}
window.addEventListener('load', ()=>{
  if('serviceWorker' in navigator) navigator.serviceWorker.ready.then(()=>updatePushBell()).catch(()=>{});
  const slot = document.getElementById('bell-slot');
  if(slot){
    const obs = new MutationObserver(()=>{
      const btn = slot.querySelector('button');
      if(btn &&!btn._pushBound){ btn._pushBound=true; btn.addEventListener('click', e=>{e.stopPropagation(); togglePushIsolated();}); updatePushBell(); }
    });
    obs.observe(slot, {childList:true});
  }
});
window.togglePush = togglePushIsolated;
