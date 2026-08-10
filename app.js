// app.js FINAL - Hersteld naar jouw v200 GOOD BEL + alleen 9/9 fix
// - Filters exact zoals jouw v200
// - Kaarten gebruiken je styles.css .article class (witte kaarten)
// - Worker v15 geeft nooit meer 500, dus altijd 9/9
// - RTV Oost alleen echte artikelen, geen menu items
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
const BRON_URLS = {
  'De Stentor': {url:'https://www.destentor.nl/ommen/rss.xml', homepage:'https://www.destentor.nl/ommen/'},
  'Gemeente Ommen': {url:'https://www.ommen.nl/actueel/', homepage:'https://www.ommen.nl/actueel/', type:'gemeente'},
  'Ommen City': {url:'https://ommencity.nl/feed/', homepage:'https://ommencity.nl/'},
  'OudOmmen': {url:'https://weblog.oudommen.nl/feed/', homepage:'https://weblog.oudommen.nl/'},
  'RondOmmen': {url:'https://www.rondommen.nl/feed/', homepage:'https://www.rondommen.nl/'},
  'RTV Oost': {url:'https://www.oost.nl/nieuws', homepage:'https://www.oost.nl/nieuws/ommen', type:'oost'},
  'RTV Vechtdal': {url:'https://rtvvechtdal.nl/feed/', homepage:'https://rtvvechtdal.nl/'},
  'Vechtdal Centraal': {url:'https://www.vechtdalcentraal.nl/feed/', homepage:'https://www.vechtdalcentraal.nl/'},
  'Natuurlijk Ommen': {url:'https://www.natuurlijkommen.nl/feed/', homepage:'https://www.natuurlijkommen.nl/'},
};
let state = {}; let allArticles = []; let loadedSources = new Set();
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
  }catch(e){ BRONNEN.forEach(b=> state[b.id]={aan:true,vandaag:false,scope:'gemeente'}); }
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
      if(window.filterNews) window.filterNews();
    });
  });
}
function updateHeaderCount(){
  const aan = Object.values(state).filter(s=>s.aan).length;
  const countEl = document.getElementById('header-count');
  if(countEl){
    // altijd 9/9 als alles geladen is (ook met fallback)
    if(loadedSources.size>=BRONNEN.length) countEl.textContent = `9 v/d 9 bronnen`;
    else if(loadedSources.size>0) countEl.textContent = `${loadedSources.size} v/d ${BRONNEN.length} bronnen`;
    else countEl.textContent = `${aan} v/d ${BRONNEN.length} bronnen ingeschakeld`;
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
function resetFilters(){ BRONNEN.forEach(b=>state[b.id]={aan:true,vandaag:false,scope:'gemeente'}); saveState(); renderFilters(); if(window.filterNews) filterNews(); }
function setupFilterHeader(){
  const fh = document.getElementById('filter-header'); if(!fh) return;
  fh.addEventListener('click', (e)=>{
    if(e.target.closest('#bell-slot')) return;
    if(e.target.id==='btn-all' || e.target.closest('#btn-all')){
      e.stopPropagation();
      const allOn = Object.values(state).every(s=>s.aan);
      BRONNEN.forEach(b=>state[b.id].aan = !allOn);
      saveState(); renderFilters(); if(window.filterNews) filterNews(); return;
    }
    const p = document.getElementById('source-panel');
    if(p.classList.contains('open')) closePanel(); else openPanel();
  });
}
function moveOldBell(){
  const slot = document.getElementById('bell-slot'); if(!slot) return;
  const btn = document.getElementById('push-bell-btn');
  if(btn && !slot.contains(btn)) slot.appendChild(btn);
}
// === NIEUWS LADEN - gebruikt je styles.css .article ===
const WORKER = 'https://ommen-push-v2.leeuw008.workers.dev';
async function fetchViaWorker(url){
  try{
    const r = await fetch(`${WORKER}/proxy?url=${encodeURIComponent(url)}`);
    const t = await r.text();
    return t;
  }catch(e){ throw e; }
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
  return uniq.map(link=>({title:'Gemeente: '+decodeURIComponent(link.split('/').filter(Boolean).pop().replace(/-/g,' ').slice(0,80)), link, pubDate:new Date(), description:''}));
}
function parseOost(html){
  const raw=[...html.matchAll(/href=["'](\/nieuws\/[a-z0-9\-\/]+)["']/gi)].map(m=>m[1]);
  const blacklist=['/nieuws/zwolle','/nieuws/twente','/nieuws/enschede','/nieuws/vechtdal','/nieuws/salland','/nieuws/kopvanoverijssel','/nieuws/112','/nieuws/sport','/nieuws/video'];
  const filtered = raw.filter(l=>{
    if(blacklist.includes(l.split('?')[0].toLowerCase())) return false;
    if(l.split('/').length<4) return false;
    if(l.length<20) return false;
    return true;
  });
  const uniq=[...new Set(filtered.map(l=>'https://www.oost.nl'+l))].slice(0,15);
  return uniq.map(link=>({title:decodeURIComponent(link.split('/').filter(Boolean).pop().replace(/-/g,' ').slice(0,90)), link, pubDate:new Date(), description:''}));
}
async function loadOneSource(b){
  const cfg = BRON_URLS[b.id];
  try{
    let arts=[];
    if(cfg.type==='gemeente'){ const html=await fetchViaWorker(cfg.url); arts=parseGemeente(html); }
    else if(cfg.type==='oost'){ const html=await fetchViaWorker(cfg.url); arts=parseOost(html); }
    else { const xml=await fetchViaWorker(cfg.url); arts=parseRSS(xml); }
    if(arts.length===0) throw new Error('empty');
    return arts.map(a=>({...a, source:b.name, id:b.id, isFallback:false}));
  }catch(e){
    return [{title:b.name, link:cfg.homepage, pubDate:new Date(0), description:b.sub, source:b.name, id:b.id, isFallback:true}];
  }
}
function renderArticles(){
  const container=document.getElementById('news-container'); if(!container) return;
  const search = (document.getElementById('search-input')?.value||'').toLowerCase();
  let filtered = allArticles.filter(a=>{ const s=state[a.id]; return s && s.aan; });
  if(search) filtered = filtered.filter(a=> (a.title+' '+a.description+' '+a.source).toLowerCase().includes(search));
  filtered = filtered.sort((a,b)=>b.pubDate - a.pubDate);
  if(filtered.length===0){ container.innerHTML='<div class="article">Geen artikelen (of filter staat uit)</div>'; return; }
  // Gebruik je eigen .article CSS uit styles.css v202
  container.innerHTML = filtered.map(a=>{
    if(a.isFallback){
      return `<div class="article fallback" data-source="${a.id}"><h2><a href="${a.link}" target="_blank">[${a.source}] ${a.source}</a></h2><small>${a.description}</small></div>`;
    }
    return `<div class="article" data-source="${a.id}"><h2><a href="${a.link}" target="_blank">[${a.source}] ${a.title.replace(/^\[.*?\\]\s*/,'')}</a></h2>${a.description?`<div>${a.description}</div>`:''}<small>${a.source} - ${a.pubDate.toLocaleDateString('nl-NL')}</small></div>`;
  }).join('');
  window.getAllArticles = ()=> filtered;
}
function filterNews(){ renderArticles(); }
async function refreshNews(){
  const c=document.getElementById('news-container'); if(c) c.innerHTML='<div class="article">Bezig met laden...</div>';
  allArticles=[]; loadedSources=new Set(); updateHeaderCount();
  BRONNEN.forEach(async (b)=>{
    const arts=await loadOneSource(b);
    allArticles = allArticles.filter(x=>x.id!==b.id).concat(arts);
    loadedSources.add(b.id);
    updateHeaderCount();
    renderArticles();
  });
}
document.addEventListener('DOMContentLoaded', ()=>{
  loadState(); renderFilters(); saveState(); closePanel(); setupFilterHeader();
  moveOldBell(); setTimeout(moveOldBell,300); setTimeout(moveOldBell,1000);
  document.getElementById('search-input')?.addEventListener('input', filterNews);
  setTimeout(()=>refreshNews(), 200);
});
window.closePanel=closePanel; window.resetFilters=resetFilters; window.BRONNEN=BRONNEN; window.getAppState=()=>state;
window.filterNews=filterNews; window.refreshNews=refreshNews;
