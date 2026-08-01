// script.js - DEFINITIEF voor Ommen Nieuws met push-worker-v4
const WORKER_URL = "https://ommen-push.leeuw008.workers.dev";
const PUSH_WORKER = WORKER_URL;

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
    const res = await fetch(`${PUSH_WORKER}/vapidPublicKey`);
    if (!res.ok) throw new Error("Geen key");
    const text = (await res.text()).trim();
    return text;
  } catch (e) {
    console.error("VAPID ophalen mislukt", e);
    return null;
  }
}

async function updatePushUI() {
  const bell = document.getElementById('push-bell');
  if (!bell) return;
  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    bell.textContent = '🔕'; bell.title = "Push niet ondersteund"; return;
  }
  const perm = Notification.permission;
  if (perm === 'denied') { bell.textContent = '🔕'; bell.title = "Meldingen geblokkeerd in browser"; return; }
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  bell.textContent = sub ? '🔔' : '🔔';
  bell.style.opacity = sub ? '1' : '0.6';
  bell.title = sub ? "Meldingen aan (klik om uit te zetten)" : "Meldingen uit (klik om aan te zetten)";
}

async function togglePush() {
  try {
    const vapidKey = await getVapidPublicKey();
    if (!vapidKey) { alert("VAPID key nog niet beschikbaar - check worker /vapidPublicKey"); return; }
    
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    
    if (sub) {
      // uitschrijven
      await fetch(`${PUSH_WORKER}/unsubscribe`, { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) });
      await sub.unsubscribe();
      alert("Meldingen uitgezet");
      updatePushUI();
      return;
    }
    
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') { alert("Toestemming geweigerd"); return; }
    
    const convertedKey = urlBase64ToUint8Array(vapidKey);
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: convertedKey });
    
    // lees geselecteerde bronnen uit localStorage of default alles
    let sources = [];
    try { sources = JSON.parse(localStorage.getItem('selectedSources') || '[]'); } catch {}
    if (sources.length === 0) sources = ["De Stentor","Gemeente Ommen","Ommen City","OudOmmen","RTV Oost","RTV Vechtdal","Vechtdal Centraal"];
    
    await fetch(`${PUSH_WORKER}/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ endpoint: sub.endpoint, keys: { p256dh: btoa(String.fromCharCode(...new Uint8Array(sub.getKey('p256dh')))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''), auth: btoa(String.fromCharCode(...new Uint8Array(sub.getKey('auth')))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'') }, sources })
    });
    
    alert("Meldingen aangezet! Je krijgt nu notificaties.");
    updatePushUI();
    
  } catch (e) {
    console.error(e);
    alert("Fout bij aanmelden: " + e.message);
  }
}

// init
window.togglePush = togglePush;
document.addEventListener('DOMContentLoaded', () => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js').then(() => updatePushUI());
  }
  const bell = document.getElementById('push-bell');
  if (bell) bell.addEventListener('click', togglePush);
});
