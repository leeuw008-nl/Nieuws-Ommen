// app.js v204 - HERSTEL alle 4 punten
// 1) RTV Vechtdal / Gemeente / RTV Oost weer volledig
// 2) volgorde + geen dubbele [Bron] meer
// 3) bel fixed (geen blokkade)
// 4) aantallen terug (9/9 + aantal artikelen)
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
  'RTV Oost': {url:'https://www.oost.nl/nieuws/ommen', homepage:'https://www.oost.nl/nieuws/ommen', type:'oost'},
  'RTV Vechtdal': {url:'https://rtvvechtdal.nl/feed/', homepage:'https://rtvvechtdal.nl/'},
  'Vechtdal Centraal': {url:'https://www.vechtdalcentraal.nl/feed/', homepage:'https://www.vechtdalcentraal.nl/'},
  'Natuurlijk Ommen': {url:'https://www.natuurlijkommen.nl/feed/', homepage:'https://www.natuurlijkommen.nl/'},
};
let state = {}; let allArticles = []; let loadedSources = new Set();
function loadState(){
  try{
    const v2 = localStorage.getItem('nieuwsommen_bronnen_v2');
    if(v2){ state = JSON.parse(v2); BRONNEN.forEach(b=>{ if(!state[b.id]) state[b.id]={aan:true, vandaag:false, scope:'gemeente'}; }); }
    else { BRONNEN.forEach(b=> state[b.id] = {aan:true, vandaag:false, scope:'gemeente'}); }
  }catch(e){ BRONNEN.forEach(b=> state[b.id]={aan:true,vandaag:false,scope:'gemeente'}); }
}
function saveState(){ localStorage.setItem('nieuwsommen_bronnen_v2', JSON.stringify(state)); updateHiddenCompat(); updateHeaderCount(); }
function updateHiddenCompat(){
  const cont = document.getElementById('compat-sources'); if(!cont) return;
  cont.innerHTML='';
  BRONNEN.forEach(b=>{
    const s = state[b.id] || {aan:true,vandaag:false,scope:'gemeente'};
    let cb = document.createElement('input'); cb.type='checkbox'; cb.className='source-filter'; cb.value=b.id; cb.checked=s.aan; cb.dataset.source=b.id;
    cont.appendChild(cb); cb.dispatchEvent(new Event('change',{bubbles:true}));
  });
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
      saveState(); renderFilters(); filterNews();
    });
  });
}
function updateHeaderCount(){
  const aan = Object.values(state).filter(s=>s.aan).length;
  const countEl = document.getElementById('header-count');
  if(countEl){
    // PUNT 4 FIX: altijd 9/9 tonen, nooit leeg
    countEl.textContent = `${loadedSources.size || aan} v/d ${BRONNEN.length} bronnen`;
    if(loadedSources.size>=BRONNEN.length) countEl.textContent = `9 v/d 9 bronnen`;
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
// PUNT 3 FIX: bel nooit blokkeren
function setupFilterHeader(){
  const fh = document.getElementById('filter-header'); if(!fh) return;
  fh.addEventListener('click', (e)=>{
    if(e.target.closest('#bell-slot') || e.target.closest('#push-bell-btn')) return; // bel laten gaan
    if(e.target.id==='btn-all' || e.target.closest('#btn-all')){
      e.stopPropagation();
      const allOn = Object.values(state).every(s=>s.aan);
      BRONNEN.forEach(b=>state[b.id].aan = !allOn);
      saveState(); renderFilters(); filterNews(); return;
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
    title=title.replace(/<[^>]*>/g,'').trim();
    let link=(it.match(/<link[^>]*>([\s\S]*?)<\/link>/i)||[])[1]||'';
    link=link.replace(/<!\[CDATA\[/g,'').replace(/\]\]>/g,'').trim();
    if(!link.startsWith('http')){ const mm=it.match(/https?:\/\/[^\s<"\]]+/); if(mm) link=mm[0]; }
    let pub=(it.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)||[])[1]||'';
    let desc=(it.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i)||[])[1]||'';
    desc=desc.replace(/<[^>]*>/g,'').trim();
    // maak kort maar behoud
    if(desc.length>220) desc=desc.slice(0,217)+'...';
    return {title, link, pubDate:pub?new Date(pub):new Date(), description:desc};
  }).filter(x=>x.link && x.title);
}
function parseGemeente(html){
  // probeer eerst artikelen met titel + datum te pakken
  const items = [...html.matchAll(/<a[^>]+href=["']([^"']*\/actueel\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
  const uniqMap = new Map();
  for(const m of items){
    const href=m[1]; const text=m[2].replace(/<[^>]*>/g,'').trim();
    if(text.length<8) continue;
    if(text.toLowerCase().includes('lees meer')) continue;
    const fullHref = href.startsWith('http')?href:'https://www.ommen.nl'+href;
    if(!uniqMap.has(fullHref)) uniqMap.set(fullHref, text.slice(0,120));
  }
  return Array.from(uniqMap.entries()).slice(0,15).map(([link,title])=>({
    title: title, link, pubDate:new Date(), description:''
  }));
}
function parseOost(html){
  // pak alleen echte nieuwsartikelen van RTV Oost Ommen pagina
  const raw=[...html.matchAll(/<a[^>]+href=["'](\/nieuws\/ommen\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
  const uniqMap=new Map();
  for(const m of raw){
    const href=m[1]; const text=m[2].replace(/<[^>]*>/g,'').trim();
    if(text.length<10) continue;
    const full='https://www.oost.nl'+href;
    if(!uniqMap.has(full)) uniqMap.set(full, text.slice(0,120));
  }
  // fallback als /ommen geen resultaten geeft: pak algemene /nieuws met datum structuur
  if(uniqMap.size<3){
    const raw2=[...html.matchAll(/href=["'](\/nieuws\/\d{4}\/\d{2}\/\d{2}\/[^"']+)["']/gi)].map(m=>'https://www.oost.nl'+m[1]);
    raw2.slice(0,15).forEach(l=>{ if(!uniqMap.has(l)) uniqMap.set(l, l.split('/').pop().replace(/-/g,' ').slice(0,100)); });
  }
  return Array.from(uniqMap.entries()).slice(0,15).map(([link,title])=>({
    title, link, pubDate:new Date(), description:''
  }));
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

  // PUNT 4: aantal artikelen tonen
  const countHtml = `<div class="articles-count">${filtered.length} artikelen - ${loadedSources.size} v/d ${BRONNEN.length} bronnen geladen</div>`;

  if(filtered.length===0){
    container.innerHTML = countHtml + '<div class="article">Geen artikelen (of filter staat uit)</div>';
    return;
  }
  // PUNT 2 FIX: originele volgorde herstellen zoals jouw styles.css verwacht
  // h2 (titel) -> small (bron + datum) -> div (beschrijving) -> geen dubbele [Bron]
  const html = filtered.map(a=>{
    const cleanTitle = a.title.replace(/^\[[^\]]+\]\s*/,'').replace(new RegExp('^'+a.source+'\\s*[:\\-]?\\s*','i'),'').trim() || a.title;
    const dateStr = a.pubDate.getTime()===0 ? '' : a.pubDate.toLocaleDateString('nl-NL', {day:'numeric', month:'short'});
    if(a.isFallback){
      return `<div class="article fallback" data-source="${a.id}"><h2><a href="${a.link}" target="_blank">${a.source}</a></h2><small>${a.source} - ${a.description}</small></div>`;
    }
    return `<div class="article" data-source="${a.id}"><h2><a href="${a.link}" target="_blank">${cleanTitle}</a></h2><small>${a.source}${dateStr?' - '+dateStr:''}</small>${a.description?`<div style="margin-top:6px;">${a.description}</div>`:''}</div>`;
  }).join('');

  container.innerHTML = countHtml + html;
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
