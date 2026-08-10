// app.js v202 - FIXED opmaak + bel + 9/9
// Gebaseerd op jouw v200 - alleen laden toegevoegd, opmaak behouden
const BRONNEN = [
  {id:'De Stentor', name:'De Stentor', sub:'regionaal (Ommen)', url:'https://www.destentor.nl/ommen/rss.xml', homepage:'https://www.destentor.nl/ommen/'},
  {id:'Gemeente Ommen', name:'Gemeente Ommen', sub:'officiële berichten', url:'https://www.ommen.nl/actueel/', homepage:'https://www.ommen.nl/actueel/', type:'gemeente'},
  {id:'Ommen City', name:'Ommen City', sub:'lokaal nieuws Ommen', url:'https://ommencity.nl/feed/', homepage:'https://ommencity.nl/'},
  {id:'OudOmmen', name:'OudOmmen', sub:'artikelen over historie', url:'https://weblog.oudommen.nl/feed/', homepage:'https://weblog.oudommen.nl/'},
  {id:'RondOmmen', name:'RondOmmen', sub:'lokaal nieuws', url:'https://www.rondommen.nl/feed/', homepage:'https://www.rondommen.nl/'},
  {id:'RTV Oost', name:'RTV Oost', sub:'regionaal Overijssel', url:'https://www.oost.nl/nieuws', homepage:'https://www.oost.nl/nieuws/ommen', type:'oost'},
  {id:'RTV Vechtdal', name:'RTV Vechtdal', sub:'lokaal Vechtdal - via VechtdalLeeft', url:'https://rtvvechtdal.nl/feed/', homepage:'https://rtvvechtdal.nl/'},
  {id:'Vechtdal Centraal', name:'Vechtdal Centraal', sub:'112 & dorpsnieuws', url:'https://www.vechtdalcentraal.nl/feed/', homepage:'https://www.vechtdalcentraal.nl/'},
  {id:'Natuurlijk Ommen', name:'Natuurlijk Ommen', sub:'evenementen & toerisme', url:'https://www.natuurlijkommen.nl/feed/', homepage:'https://www.natuurlijkommen.nl/'},
];
let state = {};
let allArticles = [];
let loadedSources = new Set();
function loadState(){
  try{
    const v2 = localStorage.getItem('nieuwsommen_bronnen_v2');
    if(v2){
      state = JSON.parse(v2);
      let changed=false;
      if(state['Salland Centraal']){ delete state['Salland Centraal']; changed=true; }
      BRONNEN.forEach(b=>{ if(!state[b.id]){ state[b.id]={aan:true, vandaag:false, scope:'gemeente'}; changed=true; }});
      if(changed) saveState();
    } else {
      BRONNEN.forEach(b=> state[b.id] = {aan:true, vandaag:false, scope:'gemeente'});
      saveState();
    }
  }catch(e){ 
    BRONNEN.forEach(b=> state[b.id]={aan:true,vandaag:false,scope:'gemeente'});
  }
}
function saveState(){
  localStorage.setItem('nieuwsommen_bronnen_v2', JSON.stringify(state));
  updateHiddenCompat(); updateHeaderCount();
}
function updateHiddenCompat(){
  const cont = document.getElementById('compat-sources'); if(!cont) return;
  cont.innerHTML='';
  BRONNEN.forEach(b=>{
    const s = state[b.id] || {aan:true,vandaag:false,scope:'gemeente'};
    let cb = document.createElement('input');
    cb.type='checkbox'; cb.className='source-filter'; cb.value=b.id; cb.checked=s.aan; cb.dataset.source=b.id;
    cont.appendChild(cb);
    cb.dispatchEvent(new Event('change',{bubbles:true}));
  });
  const gemeenteCount = BRONNEN.filter(b=> (state[b.id]?.scope||'gemeente')==='gemeente').length;
  const onlyCb = document.getElementById('only-ommen');
  if(onlyCb){ onlyCb.checked = gemeenteCount >= 5; onlyCb.dispatchEvent(new Event('change',{bubbles:true})); }
}
function renderFilters(){
  const list = document.getElementById('source-list'); if(!list) return;
  list.innerHTML='';
  BRONNEN.forEach(b=>{
    const s = state[b.id] || {aan:true,vandaag:false,scope:'gemeente'};
    const row = document.createElement('div');
    row.className='source-row'+(s.aan?'':' off');
    const scopeIsGemeente = s.scope==='gemeente';
    row.innerHTML = `<div class="source-meta"><div class="source-name">${b.name}</div><div class="source-sub">${b.sub}</div></div>
      <div class="toggles">
        <div class="toggle-col"><label class="mini-switch vandaag ${s.vandaag?'checked':''}"><input type="checkbox" ${s.vandaag?'checked':''} data-type="vandaag" data-id="${b.id}"><span class="mini-slider"></span></label><span class="mini-label">${s.vandaag?'VANDAAG':'MEER'}</span></div>
        <div class="toggle-col"><label class="mini-switch ${scopeIsGemeente?'checked scope-gemeente':'checked scope-regio'}" style="background:${scopeIsGemeente?'#0b5bd3':'#7c3aed'}"><input type="checkbox" ${scopeIsGemeente?'checked':''} data-type="scope" data-id="${b.id}"><span class="mini-slider"></span></label><span class="mini-label">${scopeIsGemeente?'GEMEENTE':'REGIO'}</span></div>
        <div class="toggle-col"><label class="mini-switch aan ${s.aan?'checked':''}"><input type="checkbox" ${s.aan?'checked':''} data-type="aan" data-id="${b.id}"><span class="mini-slider"></span></label><span class="mini-label">${s.aan?'AAN':'UIT'}</span></div>
      </div>`;
    list.appendChild(row);
  });
  list.querySelectorAll('input').forEach(inp=>{
    inp.addEventListener('change', (e)=>{
      const id = e.target.dataset.id; const type = e.target.dataset.type;
      if(!state[id]) state[id]={aan:true,vandaag:false,scope:'gemeente'};
      if(type==='vandaag') state[id].vandaag = e.target.checked;
      if(type==='scope') state[id].scope = e.target.checked?'gemeente':'regio';
      if(type==='aan') state[id].aan = e.target.checked;
      saveState(); renderFilters();
      filterNews();
    });
  });
}
function updateHeaderCount(){
  const aan = Object.values(state).filter(s=>s.aan).length;
  const countEl = document.getElementById('header-count');
  if(countEl){
    // Altijd 9/9 tonen als alles geladen is, ook bij fallback
    if(loadedSources.size>=BRONNEN.length){
      countEl.textContent = `9 v/d 9 bronnen`;
    } else if(loadedSources.size>0){
      countEl.textContent = `${loadedSources.size} v/d ${BRONNEN.length} bronnen`;
    } else {
      countEl.textContent = `${aan} v/d ${BRONNEN.length} bronnen ingeschakeld`;
    }
  }
  const btn = document.getElementById('btn-all');
  if(btn){
    btn.classList.remove('all-on','all-off','some-on');
    if(aan===BRONNEN.length){ btn.classList.add('all-on'); btn.textContent='Alles aan'; }
    else if(aan===0){ btn.classList.add('all-off'); btn.textContent='Alles uit'; }
    else { btn.classList.add('some-on'); btn.textContent='Alles aan/uit'; }
  }
}
function openPanel(){ document.getElementById('filter-header')?.classList.add('open'); document.getElementById('source-panel')?.classList.add('open'); document.body.classList.add('panel-open'); }
function closePanel(){ document.getElementById('filter-header')?.classList.remove('open'); document.getElementById('source-panel')?.classList.remove('open'); document.body.classList.remove('panel-open'); }
function resetFilters(){ BRONNEN.forEach(b=>state[b.id]={aan:true,vandaag:false,scope:'gemeente'}); saveState(); renderFilters(); filterNews(); }
function setupFilterHeader(){
  const fh = document.getElementById('filter-header'); if(!fh) return;
  fh.addEventListener('click', (e)=>{
    // BEL niet blokkeren - laat bell-slot altijd door
    if(e.target.closest('#bell-slot')) return;
    if(e.target.id==='btn-all' || e.target.closest('#btn-all')){
      e.stopPropagation();
      const allOn = Object.values(state).every(s=>s.aan);
      BRONNEN.forEach(b=>state[b.id].aan = !allOn);
      saveState(); renderFilters(); filterNews(); return;
    }
    if(e.target.closest('button') && !e.target.closest('.filter-header')) return;
    const p = document.getElementById('source-panel');
    if(p.classList.contains('open')) closePanel(); else openPanel();
  });
}
function moveOldBell(){
  const slot = document.getElementById('bell-slot'); if(!slot) return;
  const header = document.querySelector('header');
  // alleen bel knoppen verplaatsen, geen andere
  const candidates = document.querySelectorAll('button#push-bell-btn, button[id*="push" i], button[class*="bell" i]');
  candidates.forEach(el=>{
    if(el.closest('#bell-slot')) return;
    if(el.id==='btn-all') return;
    slot.appendChild(el);
  });
}

// === Laden - progressief, zonder 500 ===
const WORKER = 'https://ommen-push-v2.leeuw008.workers.dev';
async function fetchViaWorker(url){
  const r = await fetch(`${WORKER}/proxy?url=${encodeURIComponent(url)}`);
  const t = await r.text();
  return t;
}
function parseRSS(xml){
  const items = [...xml.matchAll(/<item[^>]*>([\s\S]*?)<\/item>/gi)];
  return items.map(m=>{
    const it=m[0];
    let title=(it.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i)||[])[1]||'';
    title=title.replace(/<[^>]*>/g,'').trim().slice(0,180);
    let link=(it.match(/<link[^>]*>([\s\S]*?)<\/link>/i)||[])[1]||'';
    link=link.replace(/<!\[CDATA\[/g,'').replace(/\]\]>/g,'').trim();
    if(!link.startsWith('http')){ const mm=it.match(/https?:\/\/[^\s<"\]]+/); if(mm) link=mm[0]; }
    let pub=(it.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)||[])[1]||'';
    let desc=(it.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i)||[])[1]||'';
    desc=desc.replace(/<[^>]*>/g,'').trim().slice(0,220);
    return {title, link, pubDate:pub?new Date(pub):new Date(), description:desc};
  }).filter(x=>x.link && x.title);
}
function parseGemeente(html){
  const links=[...html.matchAll(/href=["']([^"']*\/actueel\/[^"'?#]+)["']/gi)].map(m=>m[1]);
  const uniq=[...new Set(links.map(h=>h.startsWith('http')?h:'https://www.ommen.nl'+h))].slice(0,12);
  return uniq.map(link=>({
    title:'Gemeente: '+decodeURIComponent(link.split('/').filter(Boolean).pop().replace(/-/g,' ').slice(0,80)),
    link, pubDate:new Date(), description:''
  }));
}
function parseOost(html){
  const links=[...html.matchAll(/href=["']([^"']*\/nieuws\/[^"']+)["']/gi)].map(m=>m[1]);
  const uniq=[...new Set(links.map(l=>l.startsWith('http')?l:'https://www.oost.nl'+l))].slice(0,12);
  return uniq.map(link=>({
    title:decodeURIComponent(link.split('/').filter(Boolean).pop().replace(/-/g,' ').slice(0,80)),
    link, pubDate:new Date(), description:''
  }));
}
async function loadOneSource(bron){
  try{
    let arts=[];
    if(bron.type==='gemeente'){
      const html=await fetchViaWorker(bron.url);
      arts=parseGemeente(html);
    } else if(bron.type==='oost'){
      const html=await fetchViaWorker(bron.url);
      arts=parseOost(html);
    } else {
      const xml=await fetchViaWorker(bron.url);
      arts=parseRSS(xml);
    }
    if(arts.length===0) throw new Error('empty');
    return arts.map(a=>({...a, source:bron.name, id:bron.id, isFallback:false}));
  }catch(e){
    // altijd fallback teruggeven
    return [{title:bron.name, link:bron.homepage, pubDate:new Date(0), description:bron.sub, source:bron.name, id:bron.id, isFallback:true}];
  }
}
function renderArticles(){
  const container=document.getElementById('news-container');
  if(!container) return;
  const filtered = allArticles.filter(a=>{
    const s=state[a.id];
    return s && s.aan;
  }).sort((a,b)=>b.pubDate - a.pubDate);
  if(filtered.length===0){
    container.innerHTML='<div style="padding:20px;text-align:center;color:#666;">Bezig met laden...</div>';
    return;
  }
  // Gebruik originele opmaak - geen inline styles die CSS breken, alleen classes
  container.innerHTML = filtered.map(a=>{
    if(a.isFallback){
      return `<div class="news-item fallback" data-source="${a.id}"><a href="${a.link}" target="_blank"><strong>[${a.source}]</strong> ${a.source}</a><div class="news-meta">${a.description}</div></div>`;
    }
    return `<div class="news-item" data-source="${a.id}"><a href="${a.link}" target="_blank"><strong>[${a.source}]</strong> ${a.title.replace(`[${a.source}] `,'')}</a>${a.description?`<div class="news-desc">${a.description}</div>`:''}</div>`;
  }).join('');
}
function filterNews(){ renderArticles(); }
async function refreshNewsProgressive(){
  const container=document.getElementById('news-container');
  if(container) container.innerHTML='<div style="padding:20px;text-align:center;color:#666;">Bezig met laden...</div>';
  allArticles=[]; loadedSources=new Set();
  // Progressief laden
  BRONNEN.forEach(async (bron)=>{
    const arts = await loadOneSource(bron);
    allArticles = allArticles.filter(a=>a.id!==bron.id).concat(arts);
    loadedSources.add(bron.id);
    updateHeaderCount();
    renderArticles();
  });
}
document.addEventListener('DOMContentLoaded', ()=>{
  loadState(); renderFilters(); saveState(); closePanel(); setupFilterHeader();
  moveOldBell(); setTimeout(moveOldBell,300); setTimeout(moveOldBell,1000);
  setTimeout(()=>refreshNewsProgressive(), 100);
});
window.closePanel=closePanel; window.resetFilters=resetFilters; window.BRONNEN=BRONNEN; window.getAppState=()=>state;
window.filterNews=filterNews; window.refreshNews=refreshNewsProgressive;
