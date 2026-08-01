// script.js - FINAL FIX voor bronnen + push v6.1
const WORKER_URL = "https://ommen-push.leeuw008.workers.dev";

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
    const res = await fetch(`${WORKER_URL}/vapidPublicKey`, {cache:'no-store'});
    if (!res.ok) throw new Error("Geen key");
    return (await res.text()).trim();
  } catch (e) {
    console.error("VAPID ophalen mislukt", e);
    return null;
  }
}

// --- Bron filter FIX: als alles uitgevinkt is -> toon melding, niet alles ---
function getChosenSources(){
  return Array.from(document.querySelectorAll(".source-filter:checked")).map(b => b.value);
}

function updatePushUI() {
  // bell icon update
  const bell = document.getElementById('push-bell') || document.getElementById('push-toggle');
  if (!bell) return;
  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    bell.textContent = '🔕'; return;
  }
  if (Notification.permission === 'denied') {
    bell.textContent = '🔕'; bell.title = "Meldingen geblokkeerd"; return;
  }
  navigator.serviceWorker.ready.then(reg => reg.pushManager.getSubscription()).then(sub => {
    bell.textContent = sub ? '🔔' : '🔕';
    bell.style.opacity = sub ? '1' : '0.6';
    bell.title = sub ? "Meldingen aan (klik om uit te zetten)" : "Meldingen uit (klik om aan te zetten)";
  });
}

async function togglePush() {
  try {
    const vapidKey = await getVapidPublicKey();
    if (!vapidKey) { alert("VAPID key nog niet beschikbaar"); return; }
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (sub) {
      await fetch(`${WORKER_URL}/unsubscribe`, { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) });
      await sub.unsubscribe();
      alert("Meldingen uitgezet");
      updatePushUI(); return;
    }
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') { alert("Toestemming geweigerd"); return; }
    const convertedKey = urlBase64ToUint8Array(vapidKey);
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: convertedKey });
    let sources = getChosenSources();
    // Voor push: als niets aangevinkt is, betekent het ALLE bronnen (voor weergave is dat anders)
    if (sources.length === 0) sources = ["De Stentor","Gemeente Ommen","Ommen City","OudOmmen","RTV Oost","RTV Vechtdal","Vechtdal Centraal"];
    await fetch(`${WORKER_URL}/subscribe`, {
      method: 'POST', headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ 
        endpoint: sub.endpoint, 
        keys: { 
          p256dh: btoa(String.fromCharCode(...new Uint8Array(sub.getKey('p256dh')))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''), 
          auth: btoa(String.fromCharCode(...new Uint8Array(sub.getKey('auth')))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'') 
        }, 
        sources 
      })
    });
    alert("Meldingen aangezet! 🔔");
    updatePushUI();
  } catch (e) {
    console.error(e); alert("Fout bij aanmelden: " + e.message);
  }
}

window.togglePush = togglePush;
document.addEventListener('DOMContentLoaded', () => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js').then(() => updatePushUI()).catch(console.error);
  }
  const bell = document.getElementById('push-bell');
  if (bell) bell.addEventListener('click', togglePush);
});
