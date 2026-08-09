
const BRONNEN = [
  {id:"De Stentor", label:"De Stentor", sub:"Regionaal Ommen", vandaag:true, scope:"gemeente"},
  {id:"Gemeente Ommen", label:"Gemeente Ommen", sub:"Officieel", vandaag:true, scope:"gemeente"},
  {id:"Natuurlijk Ommen", label:"Natuurlijk Ommen", sub:"Toerisme", vandaag:true, scope:"gemeente"},
  {id:"Ommen City", label:"Ommen City", sub:"Lokaal", vandaag:false, scope:"gemeente"},
  {id:"OudOmmen", label:"OudOmmen", sub:"Historie", vandaag:false, scope:"gemeente"},
  {id:"RondOmmen", label:"RondOmmen", sub:"Lokaal", vandaag:true, scope:"gemeente"},
  {id:"RTV Oost", label:"RTV Oost", sub:"Regio Overijssel", vandaag:true, scope:"regio"},
  {id:"RTV Vechtdal", label:"RTV Vechtdal", sub:"Vechtdal", vandaag:true, scope:"regio"},
  {id:"Vechtdal Centraal", label:"Vechtdal Centraal", sub:"112 & dorpen", vandaag:true, scope:"regio"},
];
const LS_KEY="nieuwsommen_bronnen_v2";
let state={};
function defaultState(){ const s={}; BRONNEN.forEach(b=>{ s[b.id]={aan:true, vandaag:b.vandaag, scope:b.scope}; }); return s; }
function loadState(){ try{ const v=JSON.parse(localStorage.getItem(LS_KEY)||"null"); if(v && Object.keys(v).length>0){ state=v; BRONNEN.forEach(b=>{ if(!state[b.id]) state[b.id]={aan:true, vandaag:b.vandaag, scope:b.scope}; }); return; } }catch{} state=defaultState(); }
function saveState(){ localStorage.setItem(LS_KEY, JSON.stringify(state)); }
function getSelectedSources(){ return Object.keys(state).filter(id=>state[id]?.aan); }

function renderSourceList(){
  const list=document.getElementById('source-list'); if(!list) return; list.innerHTML="";
  BRONNEN.forEach(b=>{
    const s=state[b.id];
    const row=document.createElement('div'); row.className='source-row'+(s.aan?'':' off');
    row.innerHTML=`<div class="source-meta"><span class="source-name">${b.label}</span><span class="source-sub">${b.sub}</span></div>
    <div class="toggles">
      <div class="toggle-col"><label class="mini-switch ${s.vandaag?'checked vandaag':''}"><input type="checkbox" ${s.vandaag?'checked':''} data-k="vandaag" data-id="${b.id}"><span class="mini-slider"></span></label><span class="mini-label">Vandaag</span></div>
      <div class="toggle-col"><label class="mini-switch ${s.scope==='gemeente'?'checked scope-gemeente':'checked scope-regio'}"><input type="checkbox" ${s.scope==='gemeente'?'checked':''} data-k="scope" data-id="${b.id}"><span class="mini-slider"></span></label><span class="mini-label">${s.scope==='gemeente'?'Ommen':'Regio'}</span></div>
      <div class="toggle-col"><label class="mini-switch ${s.aan?'checked aan':''}"><input type="checkbox" ${s.aan?'checked':''} data-k="aan" data-id="${b.id}"><span class="mini-slider"></span></label><span class="mini-label">Aan</span></div>
    </div>`;
    list.appendChild(row);
  });
  list.querySelectorAll('input').forEach(inp=>{
    inp.addEventListener('change', (e)=>{
      const id=e.target.dataset.id, k=e.target.dataset.k;
      if(k==='scope') state[id].scope=e.target.checked?'gemeente':'regio';
      else state[id][k]=e.target.checked;
      saveState(); renderSourceList(); updateHeader(); window.filterAndRender&&window.filterAndRender(); window.updatePushBell&&window.updatePushBell();
    });
  });
}
function updateHeader(){
  const aan=Object.values(state).filter(s=>s.aan).length;
  const el=document.getElementById('filter-count'); if(el) el.textContent=`${aan} / ${BRONNEN.length} bronnen actief`;
  const btn=document.getElementById('btn-all'); if(btn){
    if(aan===BRONNEN.length){ btn.textContent='Alles aan'; btn.className='btn-all-toets'; }
    else if(aan===0){ btn.textContent='Alles uit'; btn.className='btn-all-toets all-off'; }
    else { btn.textContent=`${aan} aan`; btn.className='btn-all-toets some-on'; }
  }
}
function setupPanel(){
  const fh=document.getElementById('filter-header'), panel=document.getElementById('source-panel');
  const center=document.getElementById('filter-header-center'), arrow=document.getElementById('filter-arrow');
  if(!fh||!panel) return;
  const toggle=()=>{ const open=panel.classList.contains('open'); if(open){ panel.classList.remove('open'); fh.classList.remove('open'); document.body.classList.remove('panel-open'); } else { panel.classList.add('open'); fh.classList.add('open'); document.body.classList.add('panel-open'); } };
  center&&center.addEventListener('click', toggle);
  arrow&&arrow.addEventListener('click', toggle);
  document.getElementById('btn-all')?.addEventListener('click', (e)=>{ e.stopPropagation(); const aan=Object.values(state).filter(s=>s.aan).length; const newAan=aan<BRONNEN.length; BRONNEN.forEach(b=>state[b.id].aan=newAan); saveState(); renderSourceList(); updateHeader(); window.filterAndRender&&window.filterAndRender(); });
  document.getElementById('btn-close')?.addEventListener('click', ()=>{ panel.classList.remove('open'); fh.classList.remove('open'); document.body.classList.remove('panel-open'); });
  document.getElementById('btn-reset')?.addEventListener('click', ()=>{ state=defaultState(); saveState(); renderSourceList(); updateHeader(); window.filterAndRender&&window.filterAndRender(); });
}
document.addEventListener('DOMContentLoaded', ()=>{ loadState(); renderSourceList(); updateHeader(); setupPanel(); window.getSelectedSources=getSelectedSources; window.BRONNEN=BRONNEN; });
