/* DEBUG versie - bel MOET nu groen/wit togglen bij klik, los van push */
if (window._ommenPushLoaded) { console.log('oude push nog geladen, overschrijf'); }
window._ommenPushLoaded = true;

const PUSH_WORKER_URL='https://ommen-push-v2.leeuw008.workers.dev';

function ensureBellButton(){
  const slot=document.getElementById('bell-slot'); if(!slot){ console.error('geen bell-slot'); return null; }
  let btn=slot.querySelector('button');
  if(!btn){
    btn=document.createElement('button');
    btn.type='button'; btn.id='push-bell-btn';
    slot.appendChild(btn);
  }
  btn.id='push-bell-btn';
  // FORCEER klikbaar
  btn.style.pointerEvents='auto';
  btn.style.cursor='pointer';
  btn.style.textDecoration='none';
  btn.onclick = (e)=>{
    e.preventDefault();
    e.stopPropagation();
    console.log('>>> BEL GEKLIKT <<< permission=', Notification.permission);
    toggleDebug();
  };
  return btn;
}

async function updatePushBell(){
  const btn=ensureBellButton(); if(!btn) return;
  const isEnabled = localStorage.getItem('ommen_bel_debug') === '1';
  btn.textContent = isEnabled ? '🔔' : '🔕';
  btn.classList.toggle('enabled', isEnabled);
  btn.style.textDecoration='none';
  btn.title = isEnabled ? 'DEBUG AAN (groen)' : 'DEBUG UIT (wit) - klik';
  console.log('updatePushBell debug:', isEnabled);
}

function toggleDebug(){
  const was = localStorage.getItem('ommen_bel_debug') === '1';
  const now = !was;
  localStorage.setItem('ommen_bel_debug', now ? '1' : '0');
  console.log('toggle debug naar', now);
  const btn=document.getElementById('push-bell-btn');
  if(btn){
    btn.textContent = now ? '🔔' : '🔕';
    btn.classList.toggle('enabled', now);
    btn.style.background = now ? '#d6ffdf' : '#fff';
    btn.style.textDecoration='none';
  }
  alert((now ? 'BEL AAN (groen) - click werkt! ✅\n' : 'BEL UIT (wit) - click werkt! ✅\n') + '\nPermission status: ' + Notification.permission + '\n\nAls je dit ziet, is de bel weer klikbaar. Daarna lossen we de echte push-popup op.');
}

// echte push pas na deze test
async function togglePush(){ toggleDebug(); }

document.addEventListener('DOMContentLoaded', ()=>{
  console.log('DOMContentLoaded debug');
  ensureBellButton();
  updatePushBell();
});
setTimeout(()=>{ ensureBellButton(); updatePushBell(); }, 500);

window.togglePush=togglePush; window.updatePushBell=updatePushBell;
