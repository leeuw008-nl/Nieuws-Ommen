
const BRONNEN = [
  {id:"De Stentor", label:"De Stentor", vandaag:true, scope:"gemeente"},
  {id:"Gemeente Ommen", label:"Gemeente Ommen", vandaag:true, scope:"gemeente"},
  {id:"Natuurlijk Ommen", label:"Natuurlijk Ommen", vandaag:true, scope:"gemeente"},
  {id:"Ommen City", label:"Ommen City", vandaag:false, scope:"gemeente"},
  {id:"OudOmmen", label:"OudOmmen", vandaag:false, scope:"gemeente"},
  {id:"RondOmmen", label:"RondOmmen", vandaag:true, scope:"gemeente"},
  {id:"RTV Oost", label:"RTV Oost", vandaag:true, scope:"regio"},
  {id:"RTV Vechtdal", label:"RTV Vechtdal", vandaag:true, scope:"regio"},
  {id:"Vechtdal Centraal", label:"Vechtdal Centraal", vandaag:true, scope:"regio"},
];
const LS_KEY="nieuwsommen_bronnen_v2";
const LEGACY_KEY="ommen_selected_sources";
let state={};
function defaultState(){ const s={}; BRONNEN.forEach(b=>{ s[b.id]={aan:true, vandaag:b.vandaag, scope:b.scope}; }); return s; }
function loadState(){ try{ const v=JSON.parse(localStorage.getItem(LS_KEY)||"null"); if(v && Object.keys(v).length>0){ state=v; BRONNEN.forEach(b=>{ if(!state[b.id]) state[b.id]={aan:true, vandaag:b.vandaag, scope:b.scope}; }); return; } }catch{} try{ const legacy=JSON.parse(localStorage.getItem(LEGACY_KEY)||"[]"); if(Array.isArray(legacy)&&legacy.length>0){ const d=defaultState(); Object.keys(d).forEach(id=>{ d[id].aan=legacy.includes(id); }); state=d; saveState(); return; } }catch{} state=defaultState(); }
function saveState(){ localStorage.setItem(LS_KEY, JSON.stringify(state)); }
function getSelectedSources(){ return Object.keys(state).filter(id=>state[id]?.aan); }
function getAllArticles(){ return window._allArticles||[]; }

function renderSourceList(){
  const list=document.getElementById('source-list'); if(!list) return; list.innerHTML="";
  BRONNEN.forEach(b=>{
    const row=document.createElement('div'); row.className='source-row'+(state[b.id]?.aan?'':' off');
    row.innerHTML=`<div class="source-meta"><span class="source-name">${b.label}</span><span class="source-sub">${b.scope==='gemeente'?'Ommen':'Regio'} • ${b.vandaag?'Vandaag aan':'Vandaag uit'}</span></div><div class="toggles"><div class="toggle-col"><label class="mini-switch ${state[b.id]?.vandaag?'checked vandaag':''}"><input type="checkbox" ${state[b.id]?.vandaag?'checked':''} data-k="vandaag" data-id="${b.id}"><span class="mini-slider"></span></label><span class="mini-label">Vandaag</span></div><div class="toggle-col"><label class="mini-switch ${state[b.id]?.scope==='gemeente'?'checked scope-gemeente':'checked scope-regio'}"><input type="checkbox" ${state[b.id]?.scope==='gemeente'?'':'checked'} data-k="scope" data-id="${b.id}"><span class="mini-slider"></span></label><span class="mini-label">${state[b.id]?.scope==='gemeente'?'Ommen':'Regio'}</span></div><div class="toggle-col"><label class="mini-switch ${state[b.id]?.aan?'checked aan':'aan'}"><input type="checkbox" ${state[b.id]?.aan?'checked':''} data-k="aan" data-id="${b.id}"><span class="mini-slider"></span></label><span class="mini-label">Aan</span></div></div>`;
    list.appendChild(row);
  });
  list.querySelectorAll('input[type="checkbox"]').forEach(inp=>{ inp.addEventListener('change', (e)=>{ const id=e.target.dataset.id; const k=e.target.dataset.k; if(k==='scope'){ state[id].scope=e.target.checked?'regio':'gemeente'; } else { state[id][k]=e.target.checked; } if(k==='aan' && !state[id].aan){ state[id].vandaag=false; } saveState(); renderSourceList(); updateHeader(); window.filterAndRender && window.filterAndRender(); window.updatePushBell && window.updatePushBell(); }); });
}

function updateHeader(){
  const aan=Object.values(state).filter(s=>s.aan).length; const el=document.getElementById('filter-count'); if(el) el.textContent=`${aan} / ${BRONNEN.length} bronnen actief`;
  const btn=document.getElementById('btn-all'); if(btn){ if(aan===BRONNEN.length){ btn.textContent='Alles aan'; btn.className='btn-all-toets'; } else if(aan===0){ btn.textContent='Alles uit'; btn.className='btn-all-toets all-off'; } else { btn.textContent=`${aan} aan`; btn.className='btn-all-toets some-on'; } }
}

function setupPanel(){
  const fh=document.getElementById('filter-header'); const panel=document.getElementById('source-panel');
  const center=document.getElementById('filter-header-center'); const arrow=document.getElementById('filter-arrow');
  if(!fh||!panel) return;
  const toggle=()=>{ const isOpen=panel.classList.contains('open'); if(isOpen){ panel.classList.remove('open'); fh.classList.remove('open'); document.body.classList.remove('panel-open'); } else { panel.classList.add('open'); fh.classList.add('open'); document.body.classList.add('panel-open'); } };
  center && center.addEventListener('click', toggle);
  arrow && arrow.addEventListener('click', toggle);
  // BEL EN ALLES KNOP MOGEN NOOIT PANEL OPENEN - geen listener!
  document.getElementById('btn-all')?.addEventListener('click', (e)=>{ e.stopPropagation(); const aan=Object.values(state).filter(s=>s.aan).length; const newAan=aan<BRONNEN.length; BRONNEN.forEach(b=>{ state[b.id].aan=newAan; }); saveState(); renderSourceList(); updateHeader(); window.filterAndRender&&window.filterAndRender(); });
  document.getElementById('btn-close')?.addEventListener('click', ()=>{ panel.classList.remove('open'); fh.classList.remove('open'); document.body.classList.remove('panel-open'); });
  document.getElementById('btn-reset')?.addEventListener('click', ()=>{ state=defaultState(); saveState(); renderSourceList(); updateHeader(); window.filterAndRender&&window.filterAndRender(); });
}

document.addEventListener('DOMContentLoaded', ()=>{ loadState(); renderSourceList(); updateHeader(); setupPanel(); window.getSelectedSources=getSelectedSources; window.getAllArticles=getAllArticles; });
window.BRONNEN=BRONNEN;
