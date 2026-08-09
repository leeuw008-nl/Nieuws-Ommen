// app.js v200 - FIXED BEL CLICKABLE - geen moveOldBell
const BRONNEN = [
  {id:'De Stentor', name:'De Stentor', sub:'regionaal (Ommen)'},
  {id:'Gemeente Ommen', name:'Gemeente Ommen', sub:'officiële berichten'},
  {id:'Ommen City', name:'Ommen City', sub:'lokaal nieuws Ommen'},
  {id:'OudOmmen', name:'OudOmmen', sub:'artikelen over historie'},
  {id:'RondOmmen', name:'RondOmmen', sub:'lokaal nieuws'},
  {id:'RTV Oost', name:'RTV Oost', sub:'regionaal Overijssel'},
  {id:'RTV Vechtdal', name:'RTV Vechtdal', sub:'lokaal Vechtdal - via VechtdalLeeft'},
  {id:'Vechtdal Centraal', name:'Vechtdal Centraal', sub:'112 & dorpsnieuws'},
  {id:'Natuurlijk Ommen', name:'Natuurlijk Ommen', sub:'evenementen & toerisme'},
];
let state = {};
function loadState(){
  try{
    const raw=localStorage.getItem('nieuwsommen_bronnen_v2');
    if(!raw){ BRONNEN.forEach(b=>state[b.id]={aan:true, vandaag:false, scope:'gemeente'}); return; }
    const v=JSON.parse(raw);
    // Fix als er maar 1 bron aan staat (corrupte state uit screenshot)
    const aanCount=Object.values(v).filter(s=>s?.aan).length;
    if(aanCount<=1){
      BRONNEN.forEach(b=>state[b.id]={aan:true, vandaag:false, scope:'gemeente'});
      saveState(); return;
    }
    state=v;
    if(state['Salland Centraal']) delete state['Salland Centraal'];
    BRONNEN.forEach(b=>{ if(!state[b.id]) state[b.id]={aan:true, vandaag:false, scope:'gemeente'}; });
  }catch{ BRONNEN.forEach(b=>state[b.id]={aan:true, vandaag:false, scope:'gemeente'}); }
}
function saveState(){ localStorage.setItem('nieuwsommen_bronnen_v2', JSON.stringify(state)); updateHeaderCount(); }
function renderFilters(){
  const list=document.getElementById('source-list'); if(!list) return;
  list.innerHTML='';
  BRONNEN.forEach(b=>{
    const s=state[b.id]||{aan:true, vandaag:false, scope:'gemeente'};
    const row=document.createElement('div'); row.className='source-row'+(s.aan?'':' off');
    const geme=s.scope==='gemeente';
    row.innerHTML=`<div class="source-meta"><div class="source-name">${b.name}</div><div class="source-sub">${b.sub}</div></div>
      <div class="toggles">
        <div class="toggle-col"><label class="mini-switch vandaag ${s.vandaag?'checked':''}"><input type="checkbox" ${s.vandaag?'checked':''} data-type="vandaag" data-id="${b.id}"><span class="mini-slider"></span></label><span class="mini-label">${s.vandaag?'VANDAAG':'MEER'}</span></div>
        <div class="toggle-col"><label class="mini-switch ${geme?'checked scope-gemeente':'checked scope-regio'}"><input type="checkbox" ${geme?'checked':''} data-type="scope" data-id="${b.id}"><span class="mini-slider"></span></label><span class="mini-label">${geme?'GEMEENTE':'REGIO'}</span></div>
        <div class="toggle-col"><label class="mini-switch aan ${s.aan?'checked':''}"><input type="checkbox" ${s.aan?'checked':''} data-type="aan" data-id="${b.id}"><span class="mini-slider"></span></label><span class="mini-label">${s.aan?'AAN':'UIT'}</span></div>
      </div>`;
    list.appendChild(row);
  });
  list.querySelectorAll('input').forEach(i=>{
    i.addEventListener('change', e=>{
      const id=e.target.dataset.id, t=e.target.dataset.type;
      if(!state[id]) state[id]={aan:true, vandaag:false, scope:'gemeente'};
      if(t==='vandaag') state[id].vandaag=e.target.checked;
      if(t==='scope') state[id].scope=e.target.checked?'gemeente':'regio';
      if(t==='aan') state[id].aan=e.target.checked;
      saveState(); renderFilters(); window.filterNews&&window.filterNews();
    });
  });
}
function updateHeaderCount(){
  const aan=Object.values(state).filter(s=>s.aan).length;
  const el=document.getElementById('header-count') || document.getElementById('filter-count');
  if(el) el.textContent=`${aan} / ${BRONNEN.length} bronnen actief`;
  const btn=document.getElementById('btn-all');
  if(btn){ btn.textContent= aan===BRONNEN.length?'Alles aan': aan===0?'Alles uit': `${aan} aan`; btn.className= aan===BRONNEN.length?'btn-all-toets': aan===0?'btn-all-toets all-off':'btn-all-toets some-on'; }
}
function openPanel(){ document.getElementById('filter-header')?.classList.add('open'); document.getElementById('source-panel')?.classList.add('open'); }
function closePanel(){ document.getElementById('filter-header')?.classList.remove('open'); document.getElementById('source-panel')?.classList.remove('open'); }
function setupHeader(){
  const fh=document.getElementById('filter-header'); if(!fh) return;
  fh.addEventListener('click', e=>{
    if(e.target.closest('#bell-slot') || e.target.closest('#btn-all')) return;
    const p=document.getElementById('source-panel');
    if(p.classList.contains('open')) closePanel(); else openPanel();
  });
  document.getElementById('btn-all')?.addEventListener('click', e=>{
    e.stopPropagation();
    const allOn=Object.values(state).every(s=>s.aan);
    BRONNEN.forEach(b=>state[b.id].aan=!allOn);
    saveState(); renderFilters(); window.filterNews&&window.filterNews();
  });
  document.getElementById('btn-close')?.addEventListener('click', closePanel);
  document.getElementById('btn-reset')?.addEventListener('click', ()=>{ BRONNEN.forEach(b=>state[b.id]={aan:true, vandaag:false, scope:'gemeente'}); saveState(); renderFilters(); window.filterNews&&window.filterNews(); });
}
document.addEventListener('DOMContentLoaded', ()=>{
  loadState(); renderFilters(); updateHeaderCount(); setupHeader(); closePanel();
  // Reset als maar 1 bron aan staat (zoals op screenshot)
  const aan=Object.values(state).filter(s=>s.aan).length;
  if(aan<=1){ BRONNEN.forEach(b=>state[b.id]={aan:true, vandaag:false, scope:'gemeente'}); saveState(); renderFilters(); updateHeaderCount(); }
});
