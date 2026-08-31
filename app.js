// app.js v316 - v297b stabiel + Alles uit fix + account fix + Gemeente alle 15 beschrijvingen - rollback stabiel + alleen opmaak NieuwOmmen vet + Nieuwsbrief updates & releases klein
// Dit is exact v297 die groen was, met 1 regel gewijzigd op regel 18
// Was: {id:'Nieuwsbrief', name:'Nieuwsbrief', sub:'updates & releases van NieuwOmmen'}
// Wordt: {id:'Nieuwsbrief', name:'NieuwOmmen', sub:'Nieuwsbrief updates & releases'}

const BRONNEN = [
  {id:'De Stentor', name:'De Stentor', sub:'regionaal (Ommen)'},
  {id:'Gemeente Ommen', name:'Gemeente Ommen', sub:'officiële berichten'},
  {id:'Natuurlijk Ommen', name:'Natuurlijk Ommen', sub:'evenementen & toerisme'},
  {id:'Ommen City', name:'Ommen City', sub:'lokaal nieuws Ommen'},
  {id:'OudOmmen', name:'OudOmmen', sub:'artikelen over historie'},
  {id:'RondOmmen', name:'RondOmmen', sub:'lokaal nieuws'},
  {id:'RTV Oost', name:'RTV Oost', sub:'regionaal Overijssel'},
  {id:'RTV Vechtdal', name:'RTV Vechtdal', sub:'lokaal Vechtdal'},
  {id:'Vechtdal Centraal', name:'Vechtdal Centraal', sub:'112 & dorpsnieuws'},
  {id:'Nieuwsbrief', name:'NieuwOmmen', sub:'Nieuwsbrief updates & releases'},
];
const MAX_PER_BRON = {'De Stentor':25,'RondOmmen':20,'Ommen City':10,'OudOmmen':10,'Vechtdal Centraal':10,'Natuurlijk Ommen':10,'Gemeente Ommen':10,'RTV Oost':10,'RTV Vechtdal':10,'Nieuwsbrief':10};
const BRON_URLS = {
  'De Stentor': {url:'https://www.destentor.nl/ommen/rss.xml', homepage:'https://www.destentor.nl/ommen/'},
  'Gemeente Ommen': {url:'https://www.ommen.nl/actueel/', homepage:'https://www.ommen.nl/actueel/', type:'gemeente'},
  'Natuurlijk Ommen': {url:'https://www.natuurlijkommen.nl/feed/', homepage:'https://www.natuurlijkommen.nl/'},
  'Ommen City': {url:'https://ommencity.nl/feed/', homepage:'https://ommencity.nl/'},
  'OudOmmen': {url:'https://weblog.oudommen.nl/feed/', homepage:'https://weblog.oudommen.nl/'},
  'RondOmmen': {url:'https://www.rondommen.nl/feed/', homepage:'https://www.rondommen.nl/'},
  'RTV Oost': {url:'https://www.oost.nl/nieuws/vechtdal', homepage:'https://www.oost.nl/nieuws/vechtdal', type:'oost', fallback:'https://www.oost.nl/nieuws/vechtdal'},
  'RTV Vechtdal': {url:'https://rtvvechtdal.nl/feed/', homepage:'https://rtvvechtdal.nl/'},
  'Vechtdal Centraal': {url:'https://www.vechtdalcentraal.nl/feed/', homepage:'https://www.vechtdalcentraal.nl/', fallback:'https://www.vechtdalcentraal.nl/'},
  'Nieuwsbrief': {url:'https://ommen-push-v2.leeuw008.workers.dev/newsletter/feed', homepage:'https://nieuwommen.leeuw008.nl/', type:'nieuwsbrief'},
};

window._lastPushWasTest = false;
window._lastPushSource = null;
window._lastPushRealArticle = null;
function isTestArticle(a){ if(!a) return false; return !!(a.isTest || a._isTestPush || a.data?.isTest || (a.id && String(a.id).startsWith('test-'))); }
function shouldAutoEnableSource(sourceId){ if(window._lastPushWasTest) return false; try{ const vals = Object.values(state||{}); if(vals.length>0 && !vals.some(v=> v && (v.aan===true || v===true))){ return false; } }catch{} return true; }

function parseNieuwsbriefECHT(json){
  try{
    const data = typeof json === 'string' ? JSON.parse(json) : json;
    const items = data.items || data.articles || data || [];
    return items.map(it=>{
      const title = it.title || it.subject || 'Nieuwsbrief';
      const link = it.link || it.url || 'https://nieuwommen.leeuw008.nl/';
      let pubDate = new Date();
      if(it.pubDate || it.date || it.updated){ const d=new Date(it.pubDate||it.date||it.updated); if(!isNaN(d.getTime())) pubDate=d; }
      const desc = it.description || it.body || it.excerpt || title;
      return {title: title.slice(0,120), link, pubDate, description: desc.slice(0,200)+' [...]', source:'Nieuwsbrief', id:'Nieuwsbrief'};
    }).slice(0,10);
  }catch(e){ console.log('parse nieuwsbrief fail', e.message); return []; }
}
function parseVechtdalCentraalECHT(html){
  const items=[]; const seen=new Set();
  let re=/<h3 class="entry-title[^>]*>\s*<a href="([^"]+)"[^>]*>([^<]+)<\/a>/gi; let m;
  while((m=re.exec(html))!==null && items.length<25){
    let link=m[1]; if(link.startsWith('/')) link='https://www.vechtdalcentraal.nl'+link;
    if(seen.has(link)) continue; seen.add(link);
    const title=m[2].replace(/&#8217;/g,"'").replace(/&amp;/g,"&").trim();
    if(title.length>4) items.push({title, link, pubDate:new Date(), description:title+' [...]'});
  }
  if(items.length>0) return items;
  const patterns=[
    /<h2[^>]*>\s*<a href="([^"]+)"[^>]*>([^<]{8,200})<\/a>\s*<\/h2>/gi,
    /<article[^>]*>\s*<a[^>]+href="([^"]+)"[^>]*>([\s\S]{0,300}?)<\/a>[\s\S]*?<h[23]/gi,
    /<a[^>]+href="(https:\/\/www\.vechtdalcentraal\.nl\/[^"']{5,150})"[^>]*class="[^"]*entry-title[^"]*"[^>]*>([^<]+)</gi,
    /<a href="(\/[^"']{5,150})"[^>]*>[^<]*<h3[^>]*>([^<]{8,200})<\/h3>/gi
  ];
  for(const pat of patterns){
    let mm;
    while((mm=pat.exec(html))!==null && items.length<25){
      let link=mm[1]; let title=mm[2].replace(/<[^>]*>/g,'').replace(/&#8217;/g,"'").replace(/&amp;/g,"&").trim();
      if(link.startsWith('/')) link='https://www.vechtdalcentraal.nl'+link;
      if(!link.includes('vechtdalcentraal.nl')) continue;
      if(seen.has(link)) continue; seen.add(link);
      if(title.length>8) items.push({title, link, pubDate:new Date(), description:title+' [...]'});
    }
    if(items.length>5) break;
  }
  return items;
}
function getVechtdalCache(){try{return JSON.parse(localStorage.getItem('ommen_vechtdal_poll')||'{}');}catch{return {};}}
function setVechtdalCache(c){try{localStorage.setItem('ommen_vechtdal_poll',JSON.stringify(c));}catch{}}
function parseRTVVechtdalECHT(html){
  const items=[]; const now = new Date(); const pollCache=getVechtdalCache(); let dirty=false; const pollingMoment=now;
  const today = new Date(); today.setHours(0,0,0,0);
  const reFull=/<div class="allmode_date">([^<]+)<\/div>[\s\S]{0,600}?<h3 class="allmode_title"><a href="([^"]+)">([^<]+)<\/a>[\s\S]{0,800}?<div class="allmode_(?:intro|text|introtext)[^>]*>([\s\S]*?)<\/div>/gi;
  let m;
  while((m=reFull.exec(html))!==null && items.length<20){
    const dparts=m[1].split('-'); let pd=null; let isToday=false;
    if(dparts.length===3){
      const d = new Date(parseInt(dparts[2]), parseInt(dparts[1])-1, parseInt(dparts[0]), 0,0,0);
      const dMidnight = new Date(d); dMidnight.setHours(0,0,0,0);
      isToday = dMidnight.getTime() === today.getTime();
      if(isToday){ pd = new Date(pollingMoment); }else{ pd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), pollingMoment.getHours(), pollingMoment.getMinutes(), pollingMoment.getSeconds()); }
    }else{ pd = new Date(pollingMoment); }
    let link=m[2].replace(/&amp;/g,'&'); if(!link.startsWith('http')) link='https://www.rtvvechtdal.nl'+link;
    let intro=m[4].replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
    if(intro.length>6) items.push({title:m[3].trim().slice(0,120), link, pubDate:pd, description:intro.slice(0,200)+' [...]'});
  }
  return items;
}
function parseGemeenteOverview(html){ const items=[]; const re=/<a[^>]+href=["']([^"']+\/actueel\/[^"']+)["'][^>]*>([^<]{10,200})<\/a>/gi; let m; while((m=re.exec(html))!==null && items.length<15){ let link=m[1]; if(link.startsWith('/')) link='https://www.ommen.nl'+link; const title=m[2].trim(); if(title.length>10) items.push({title, link, pubDate:new Date(), description:title+' [...]'}); } return items; }
function parseRTVOostECHT(html){ const items=[]; const re=/<a[^>]+href=["'](\/nieuws\/[^"']{10,})["'][^>]*>[\s\S]*?<h3[^>]*>([^<]{12,})<\/h3>/gi; let m; while((m=re.exec(html))!==null && items.length<15){ const link='https://www.oost.nl'+m[1]; const title=m[2].trim(); items.push({title, link, pubDate:new Date(), description:title+' [...]'}); } return items; }
function parseRSSFull(xml, bronId){ const items=[...xml.matchAll(/<item[^>]*>([\s\S]*?)<\/item>/gi)].slice(0,25); return items.map(m=>{ const it=m[1]; const title=(it.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i)||[])[1]||''; let link=(it.match(/<link[^>]*>([\s\S]*?)<\/link>/i)||[])[1]||''; link=link.replace(/<!\[CDATA\[|\]\]>/g,'').trim(); if(!link.startsWith('http')){ const mm=it.match(/https?:\/\/[^\s<"]+/); if(mm) link=mm[0]; } const desc=(it.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i)||[])[1]||''; const pub=(it.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)||[])[1]||''; let pd=new Date(); if(pub) { const d=new Date(pub); if(!isNaN(d.getTime())) pd=d; } return {title:title.replace(/<[^>]*>/g,'').trim().slice(0,120), link, pubDate:pd, description:desc.replace(/<[^>]*>/g,' ').trim().slice(0,200)+' [...]'}; }).filter(x=>x.link && x.title); }

const GEMEENTE_PLAATSEN = ['Ommen','Lemele','Vilsteren','Beerze','Beerzerveld','Witharen','Archem','Arriën','Arriërveld','Besthmen','Dalmsholte','Eerde','Emsland','Giethmen','Hoogengraven','Junne','Nieuwebrug','Ommerbosch','Ommerkanaal','Ommerschans','Ommerveld','Rotbrink','Stegeren','Stegerveld','Varsen','Vinkenbuurt','Zeesse','Stegeren','Beerzerpoort','Ommerschans'];
const GEMEENTE_ZOEK = GEMEENTE_PLAATSEN.map(p=>p.toLowerCase());
function isGemeenteArtikel(art){ const txt = (art.title + ' ' + (art.description||'')).toLowerCase(); return GEMEENTE_ZOEK.some(pl => txt.includes(pl)); }

let state = {}; let allArticles = []; let loadedSources = new Set();

(function injectLedStyles(){
  const css = `.source-row{position:relative}.source-led{width:12px;height:12px;border-radius:999px;display:block;flex-shrink:0;transition:all .25s}.source-led.loading{background:#ef4444;box-shadow:0 0 0 2px rgba(239,68,68,.25);animation:pulse-red 1.2s infinite}.source-led.ok{background:#16a34a;box-shadow:0 0 0 2px rgba(22,163,74,.22)}.source-led.fail{background:#ef4444;box-shadow:0 0 0 2px rgba(239,68,68,.2)}.source-led.empty{background:#f59e0b;box-shadow:0 0 0 2px rgba(245,158,11,.2)}@keyframes pulse-red{0%{transform:scale(1);opacity:1}50%{transform:scale(1.25);opacity:.7}100%{transform:scale(1);opacity:1}}.source-meta{display:flex;flex-direction:row;align-items:center;gap:0}.source-meta-text{display:flex;flex-direction:column;min-width:0}.source-led-wrap{display:flex;align-items:center;justify-content:center;width:22px;flex-shrink:0} .source-name{position:relative} .source-name span:first-child{flex:1}
  .article.highlight{outline:3px solid #16a34a; outline-offset:2px; animation: highlight-pulse 2s ease-in-out;}
  @keyframes highlight-pulse{0%{outline-color:#16a34a}50%{outline-color:#22c55e; box-shadow:0 0 20px rgba(34,197,94,0.4)}100%{outline-color:#16a34a}}
  .source-row[data-id="Nieuwsbrief"]{background:linear-gradient(90deg, #f0fdf4 0%, #ffffff 100%); border-left:3px solid #16a34a;}
  .source-row[data-id="Nieuwsbrief"] .source-name span:first-child{font-weight:800; letter-spacing:-0.02em;}
  `;
  const el=document.createElement('style'); el.id='led-status-style'; el.textContent=css; if(!document.getElementById('led-status-style')) document.head.appendChild(el);
})();
function updateSourceLeds(){
  try{
    BRONNEN.forEach(b=>{
      const led=document.querySelector(`.source-led[data-id="${b.id}"]`); if(!led) return;
      const realArts = allArticles.filter(a=>a.id===b.id && !a.isFallback && !isTestArticle(a));
      const isLoaded = loadedSources.has(b.id);
      led.classList.remove('loading','ok','fail','empty'); led.style.animation='';
      if(!isLoaded){ led.classList.add('loading'); led.style.background='#ef4444'; led.title='Laden...'; }
      else if(realArts.length>0){ led.classList.add('ok'); led.style.background='#16a34a'; led.title=realArts.length+' artikel(en) geladen - OK'; }
      else {
        const hasFallback = allArticles.some(a=>a.id===b.id && a.isFallback);
        if(hasFallback){ led.classList.add('fail'); led.style.background='#ef4444'; led.title='Bron offline'; }
        else { led.classList.add('empty'); led.style.background='#f59e0b'; led.title='Geen artikelen (filter?)'; }
      }
    });
  }catch(e){ console.log('led update fail', e.message); }
}

function loadState(){
  try{
    const v2 = localStorage.getItem('nieuwsommen_bronnen_v2');
    if(v2){ 
      let parsed = JSON.parse(v2);
      if(Array.isArray(parsed)){
        const newState={}; BRONNEN.forEach(b=>{ newState[b.id]={aan: parsed.includes(b.id), vandaag:false, scope:'gemeente'}; }); state=newState;
      } else { state = parsed; }
      BRONNEN.forEach(b=>{ if(!state[b.id]) state[b.id]={aan:true, vandaag:false, scope:'gemeente'}; }); 
    }
    else { BRONNEN.forEach(b=> state[b.id] = {aan:true, vandaag:false, scope:'gemeente'}); }
  }catch(e){ BRONNEN.forEach(b=> state[b.id]={aan:true,vandaag:false,scope:'gemeente'}); }
}
function saveState(){
  localStorage.setItem('nieuwsommen_bronnen_v2', JSON.stringify(state));
  updateHiddenCompat(); updateHeaderCount();
  if(window.updatePushBell) window.updatePushBell();
  try{ if(window.updatePushSubscription) window.updatePushSubscription(); }catch(e){}
  try{ if(window.pushFiltersToSW) window.pushFiltersToSW(); }catch(e){}
}
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
    const row = document.createElement('div'); row.className='source-row'+(s.aan?'':' off'); row.dataset.id=b.id;
    const scopeIsGemeente = s.scope==='gemeente';
    const allForBron = allArticles.filter(a=>a.id===b.id && !a.isFallback && !isTestArticle(a));
    const loadedCount = allForBron.length; let selectedCount = allForBron.length;
    if(s.vandaag){ const today = new Date(); selectedCount = allForBron.filter(a=>a.pubDate && isSameDay(a.pubDate, today)).length; }
    if(s.scope==='gemeente'){
      if(s.vandaag){ const today = new Date(); selectedCount = allForBron.filter(a=>a.pubDate && isSameDay(a.pubDate, today) && isGemeenteArtikel(a)).length; }
      else { selectedCount = allForBron.filter(a=>isGemeenteArtikel(a)).length; }
    }
    const isNieuwsbrief = b.id==='Nieuwsbrief';
    row.innerHTML = `<div class="source-meta" style="display:flex;flex-direction:row;align-items:center;gap:8px;flex:1;min-width:0;"><div class="source-meta-text" style="display:flex;flex-direction:column;flex:1;min-width:0;"><div class="source-name" style="display:flex;align-items:center;gap:8px;min-width:0;"><span style="flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${isNieuwsbrief?'📰 ':''}${b.name}</span><span class="led-col" style="width:18px;height:18px;display:flex;align-items:center;justify-content:center;flex-shrink:0;"><span class="source-led loading" data-id="${b.id}" title="Laden..." style="width:12px;height:12px;border-radius:999px;background:#ef4444;display:block;flex-shrink:0;box-shadow:0 0 0 2px rgba(239,68,68,.25);"></span></span><span class="count-col" style="font-size:11px;font-weight:700;color:#374151;background:#f3f4f6;padding:2px 7px;border-radius:99px;white-space:nowrap;min-width:52px;text-align:center;flex-shrink:0;">${loadedCount} / ${selectedCount}</span></div><div class="source-sub">${b.sub}</div></div></div><div class="toggles"><div class="toggle-col"><label class="mini-switch vandaag ${s.vandaag?'checked':''}"><input type="checkbox" ${s.vandaag?'checked':''} data-type="vandaag" data-id="${b.id}"><span class="mini-slider"></span></label><span class="mini-label">${s.vandaag?'VANDAAG':'MEER'}</span></div><div class="toggle-col"><label class="mini-switch ${scopeIsGemeente?'checked':''} ${scopeIsGemeente?'scope-gemeente':'scope-regio'}" style="background:${scopeIsGemeente?'#0b5bd3':'#7c3aed'}"><input type="checkbox" ${scopeIsGemeente?'checked':''} data-type="scope" data-id="${b.id}"><span class="mini-slider"></span></label><span class="mini-label">${scopeIsGemeente?'GEMEENTE':'REGIO'}</span></div><div class="toggle-col"><label class="mini-switch aan ${s.aan?'checked':''}"><input type="checkbox" ${s.aan?'checked':''} data-type="aan" data-id="${b.id}"><span class="mini-slider"></span></label><span class="mini-label">${s.aan?'AAN':'UIT'}</span></div></div>`;
    list.appendChild(row);
  });
  list.querySelectorAll('input').forEach(inp=>{
    inp.addEventListener('change', (e)=>{
      const id = e.target.dataset.id; const type = e.target.dataset.type;
      if(!state[id]) state[id]={aan:true,vandaag:false,scope:'gemeente'};
      if(type==='vandaag') state[id].vandaag = e.target.checked;
      if(type==='scope') state[id].scope = e.target.checked?'gemeente':'regio';
      if(type==='aan') state[id].aan = e.target.checked;
      saveState(); renderFilters(); filterNews(); updateSourceLeds();
    });
  });
  setTimeout(()=>{ try{ updateSourceLeds(); }catch{} }, 50);
}
function updateHeaderCount(){
  const aan = BRONNEN.map(b=>state[b.id]).filter(s=>s && s.aan).length;
  const countEl = document.getElementById('header-count');
  if(countEl){ countEl.textContent = `${loadedSources.size || aan} v/d ${BRONNEN.length} bronnen`; if(loadedSources.size>=BRONNEN.length) countEl.textContent = `10 v/d 10 bronnen`; }
  const btn = document.getElementById('btn-all');
  if(btn){
    btn.classList.remove('all-on','all-off','some-on');
    if(aan===BRONNEN.length){ btn.classList.add('all-on'); btn.textContent='Alles aan'; }
    else if(aan===0){ btn.classList.add('all-off'); btn.textContent='Alles uit'; }
    else { btn.classList.add('some-on'); btn.textContent='Alles aan/uit'; }
  }
}
function openPanel(){ document.getElementById('filter-header')?.classList.add('open'); document.getElementById('source-panel')?.classList.add('open'); document.body.classList.add('panel-open'); try{ localStorage.setItem('ommen_filter_panel_open','1'); }catch{} }
function closePanel(){ document.getElementById('filter-header')?.classList.remove('open'); document.getElementById('source-panel')?.classList.remove('open'); document.body.classList.remove('panel-open'); try{ localStorage.setItem('ommen_filter_panel_open','0'); }catch{} }
function restorePanelState(){ try{ const open = localStorage.getItem('ommen_filter_panel_open'); if(open==='1'){ openPanel(); } else { closePanel(); } }catch{ closePanel(); } }
function resetFilters(){ BRONNEN.forEach(b=>state[b.id]={aan:true,vandaag:false,scope:'gemeente'}); saveState(); renderFilters(); filterNews(); }
function setupFilterHeader(){
  const fh = document.getElementById('filter-header'); if(!fh) return;
  fh.addEventListener('click', (e)=>{
    if(e.target.closest('#bell-slot') || e.target.closest('#push-bell-btn')) return;
    if(e.target.id==='btn-all' || e.target.closest('#btn-all')){
      e.stopPropagation(); 
      const bronStates = BRONNEN.map(b=>state[b.id]).filter(Boolean);
      const allOn = bronStates.length>0 && bronStates.every(s=>s.aan);
      console.log('[v316] Alles toggle allOn',allOn, 'bronStates',bronStates.length);
      BRONNEN.forEach(b=>{ if(!state[b.id]) state[b.id]={aan:true,vandaag:false,scope:'gemeente'}; state[b.id].aan = !allOn; }); 
      saveState(); renderFilters(); filterNews(); updateSourceLeds(); return;
    }
    const p = document.getElementById('source-panel'); if(p.classList.contains('open')) closePanel(); else openPanel();
  });
}
const WORKER = 'https://ommen-push-v2.leeuw008.workers.dev';
const SOURCE_CACHE_TTL = 1000 * 60 * 5; const SOURCE_CACHE_STALE = 1000 * 60 * 60; const SOURCE_CACHE_KEY = 'ommen_source_cache_v1';
function getSourceCache(){ try{return JSON.parse(localStorage.getItem(SOURCE_CACHE_KEY)||'{}');}catch{return {};}}
function setSourceCache(cache){ try{localStorage.setItem(SOURCE_CACHE_KEY, JSON.stringify(cache));}catch{}}
function getCachedSource(url){ const cache=getSourceCache(); const entry=cache[url]; if(!entry) return null; if(Date.now() - entry.ts > SOURCE_CACHE_TTL) return null; return entry.data; }
function getStaleSource(url){ const cache=getSourceCache(); const entry=cache[url]; if(!entry) return null; if(Date.now() - entry.ts > SOURCE_CACHE_STALE) return null; return entry.data; }
function putCachedSource(url, data){ if(!data || data.length<200) return; const cache=getSourceCache(); cache[url]={data, ts:Date.now()}; const keys=Object.keys(cache); if(keys.length>25){ const oldest=keys.sort((a,b)=>cache[a].ts-cache[b].ts)[0]; delete cache[oldest]; } setSourceCache(cache); }
async function fetchViaWorker(url){
  const controller = new AbortController(); const to = setTimeout(()=>controller.abort(), 6000);
  try{
    const r = await fetch(`${WORKER}/proxy?url=${encodeURIComponent(url)}&t=${Date.now()}`, {cache:'no-store', signal:controller.signal});
    clearTimeout(to); if(!r.ok) throw new Error('proxy fail '+r.status); const t = await r.text();
    if(t.length<150) throw new Error('proxy empty len '+t.length); if(t.includes('Proxy blocked')||t.includes('Proxy error')||t.startsWith('Proxy err')) throw new Error(t.slice(0,200)); if(t.includes('<title>Just a moment</title>')||t.includes('Attention Required')) throw new Error('cf challenge'); putCachedSource(url, t); return t;
  }catch(e1){
    clearTimeout(to);
    if(url.includes('/newsletter/feed')){
      try{ const r2 = await fetch(url, {cache:'no-store'}); if(r2.ok){ const t2 = await r2.text(); if(t2.length>10){ putCachedSource(url, t2); return t2; } } }catch{}
    }
    try{ const r2 = await fetch(url, {cache:'no-store', headers:{'Accept':'text/html'}}); if(r2.ok){ const t2 = await r2.text(); if(t2.length>500){ putCachedSource(url, t2); return t2; } } }catch(e2){}
    try{
      const ctrl2=new AbortController(); const to2=setTimeout(()=>ctrl2.abort(), 5000);
      const fallbackUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}&t=${Date.now()}`;
      const r2 = await fetch(fallbackUrl, {cache:'no-store', signal:ctrl2.signal}); clearTimeout(to2);
      if(r2.ok){ const j = await r2.json(); if(j.contents && j.contents.length>200) { putCachedSource(url, j.contents); return j.contents; } }
    }catch(e3){}
    throw e1;
  }
}
function parseGemeenteOverviewWithDate(html){
  const items=[]; const seen=new Set();
  const re = /<a[^>]+href=["']([^"']+\/actueel\/[^"']+)["'][^>]*>([^<]{10,200})<\/a>/gi;
  let m; let idx=0;
  while((m=re.exec(html))!==null && items.length<15){
    let link=m[1]; if(link.startsWith('/')) link='https://www.ommen.nl'+link;
    if(seen.has(link)) continue;
    const title=m[2].trim();
    const pos=m.index;
    const context = html.substring(Math.max(0,pos-300), Math.min(html.length, pos+800));
    let pubDate=null;
    let dm = context.match(/(\d{1,2}\s+[a-z]+\s+\d{4})/i);
    if(dm) pubDate=parseGemeenteDateTime(dm[1]);
    if(!pubDate){ dm = context.match(/(\d{4}-\d{2}-\d{2})/); if(dm) pubDate=parseGemeenteDateTime(dm[1]); }
    if(!pubDate){ pubDate = new Date(Date.now() - (idx*3+5)*24*60*60*1000); pubDate.setHours(10,0,0,0); }
    seen.add(link); items.push({title, link, pubDate, description:null, _needsDetail:true}); idx++;
  }
  return items;
}
async function enrichGemeenteWithTimeAndDesc(items, fetchViaWorker){
  const enriched=[];
  for(let i=0; i<items.length; i++){
    const item=items[i];
    try{
      if(i<15){ // v309 FIX: was i<8 waardoor oudste 2 geen beschrijving kregen, nu alle 15
        const html = await fetchViaWorker(item.link);
        let match = html.match(/(\d{1,2}\s+[a-z]+\s+\d{4},?\s*\d{1,2}:\d{2})/i) || html.match(/<time[^>]*>([^<]+)<\/time>/i);
        if(match){ const parsed=parseGemeenteDateTime(match[1]||match[0]); if(parsed) item.pubDate=parsed; }
        const realDesc=extractGemeenteDescription(html);
        if(realDesc) item.description=realDesc+' [...]'; else item.description=item.title.slice(0,100)+' - Lees meer op ommen.nl [...]';
        await new Promise(r=>setTimeout(r,200));
      }
      if(!item.description) item.description=item.title.slice(0,100)+' [...]';
    }catch{ if(!item.description) item.description=item.title.slice(0,100)+' [...]'; }
    enriched.push(item);
  }
  enriched.sort((a,b)=> b.pubDate - a.pubDate);
  return enriched;
}

async function enrichGemeenteWithTimeAndDesc(items, fetchViaWorker){
  const enriched=[];
  for(let i=0; i<items.length; i++){
    const item=items[i];
    try{
      if(i<15){ // v309 FIX: was i<8 waardoor oudste 2 geen beschrijving kregen, nu alle 15
        const html = await fetchViaWorker(item.link);
        let match = html.match(/(\d{1,2}\s+[a-z]+\s+\d{4},?\s*\d{1,2}:\d{2})/i) || html.match(/<time[^>]*>([^<]+)<\/time>/i);
        if(match){ const parsed=parseGemeenteDateTime(match[1]||match[0]); if(parsed) item.pubDate=parsed; }
        const realDesc=extractGemeenteDescription(html);
        if(realDesc) item.description=realDesc+' [...]'; else item.description=item.title.slice(0,100)+' - Lees meer op ommen.nl [...]';
        await new Promise(r=>setTimeout(r,200));
      }
      if(!item.description) item.description=item.title.slice(0,100)+' [...]';
    }catch{ if(!item.description) item.description=item.title.slice(0,100)+' [...]'; }
    enriched.push(item);
  }
  enriched.sort((a,b)=> b.pubDate - a.pubDate);
  return enriched;
}


async function loadOneSource(b){
  const cfg=BRON_URLS[b.id]; if(!cfg) throw new Error('no cfg '+b.id);
  try{
    let arts=[];
    if(b.id==='Nieuwsbrief'){ const json=await fetchViaWorker(cfg.url); arts=parseNieuwsbriefECHT(json); }
    else if(cfg.type==='gemeente'){ const html=await fetchViaWorker(cfg.url); arts=parseGemeenteOverview(html); }
    else if(cfg.type==='oost'){ const html=await fetchViaWorker(cfg.url); arts=parseRTVOostECHT(html); }
    else if(b.id==='RTV Vechtdal'){ try{ const html=await fetchViaWorker(cfg.url); arts=parseRTVVechtdalECHT(html); }catch{} if(arts.length===0){ const xml=await fetchViaWorker(cfg.url); arts=parseRSSFull(xml,b.id); } }
    else if(b.id==='Vechtdal Centraal'){
      try{ const xml=await fetchViaWorker(cfg.url); arts=parseRSSFull(xml,b.id); if(arts.length===0 && cfg.fallback){ const html2=await fetchViaWorker(cfg.fallback); arts=parseVechtdalCentraalECHT(html2); } }
      catch(e){ if(cfg.fallback){ const html2=await fetchViaWorker(cfg.fallback); arts=parseVechtdalCentraalECHT(html2); } else throw e; }
    } else { const xml=await fetchViaWorker(cfg.url); arts=parseRSSFull(xml,b.id); }
    if(arts.length===0) throw new Error('empty'); return arts.map(a=>({...a, source:b.name, id:b.id, isFallback:false}));
  }catch(e){ return [{title:b.name, link:cfg.homepage, pubDate:new Date(0), description:'Bron tijdelijk offline - homepage [...]', source:b.name, id:b.id, isFallback:true}]; }
}
function isSameDay(d1,d2){ if(!d1 || !d2 || isNaN(d1.getTime()) || isNaN(d2.getTime())) return false; return d1.getFullYear()===d2.getFullYear() && d1.getMonth()===d2.getMonth() && d1.getDate()===d2.getDate(); }
function formatDate(d, sourceId){ if(!d || isNaN(d.getTime()) || d.getTime()===0) return ''; const dateStr = d.toLocaleDateString('nl-NL',{day:'numeric', month:'short'}); if(d.getHours()===0 && d.getMinutes()===0 && d.getSeconds()===0){ return dateStr; } const timeStr = d.toLocaleTimeString('nl-NL',{hour:'2-digit', minute:'2-digit'}); return `${dateStr} ${timeStr}`; }
function highlightArticleByLink(link){
  try{
    const container=document.getElementById('news-container'); if(!container) return;
    setTimeout(()=>{
      const articles = container.querySelectorAll('.article');
      for(const el of articles){
        const a = el.querySelector('a'); if(a && a.href && link && (a.href===link || link.includes(a.href) || a.href.includes(link) || el.dataset.link===link)){
          el.classList.add('highlight'); el.scrollIntoView({behavior:'smooth', block:'center'}); setTimeout(()=>{ el.classList.remove('highlight'); }, 5000); break;
        }
      }
      if(window._lastPushRealArticle && window._lastPushRealArticle.link===link){
        const art = window._lastPushRealArticle; const div=document.createElement('div'); div.className='article highlight'; div.innerHTML=`<h2><a href="${art.link}" target="_blank">${art.title}</a> <span style="background:#16a34a;color:white;padding:2px 6px;border-radius:4px;font-size:11px">NIEUW via push</span></h2><small>${art.source} - zojuist</small><div style="margin-top:6px;color:#555;">${art.description||art.title}</div>`; container.prepend(div); div.scrollIntoView({behavior:'smooth', block:'center'}); setTimeout(()=>{ div.classList.remove('highlight'); }, 5000);
      }
    }, 500);
  }catch(e){}
}
function renderArticles(){
  const container=document.getElementById('news-container'); if(!container) return;
  const search = (document.getElementById('search-input')?.value||'').toLowerCase();
  const today = new Date();
  let filtered = allArticles.filter(a=>{ const s=state[a.id]; if(!s || !s.aan) return false; if(isTestArticle(a)) return false; if(s.vandaag){ if(a.isFallback) return false; if(!a.pubDate || isNaN(a.pubDate.getTime())) return false; if(!isSameDay(a.pubDate, today)) return false; } if(s.scope==='gemeente'){ if(!isGemeenteArtikel(a)) return false; } return true; });
  if(search) filtered = filtered.filter(a=> (a.title+' '+a.description+' '+a.source).toLowerCase().includes(search));
  filtered = filtered.sort((a,b)=>b.pubDate - a.pubDate);
  const realCount = filtered.filter(a=>!a.isFallback).length; const vandaagActive = Object.values(state).some(s=>s.aan && s.vandaag); const gemeenteActive = Object.values(state).some(s=>s.aan && s.scope==='gemeente'); let filterLabel = ''; if(vandaagActive) filterLabel += ' (alleen vandaag)'; if(gemeenteActive) filterLabel += vandaagActive ? ' + gemeente' : ' (alleen gemeente Ommen)'; const countHtml = `<div class="articles-count">${realCount} artikelen${filterLabel} - ${loadedSources.size} v/d ${BRONNEN.length} bronnen geladen</div>`;
  if(filtered.length===0){ if(vandaagActive || gemeenteActive) container.innerHTML = countHtml + '<div class="article" style="color:#666;padding:20px;text-align:center;">Geen artikelen gevonden met dit filter.<br>Zet op REGIO of MEER om meer te zien.</div>'; else container.innerHTML = countHtml + '<div class="article">Geen artikelen</div>'; return; }
  const highlightLink = localStorage.getItem('ommen_highlight_link');
  const html = filtered.map(a=>{
    const cleanTitle = a.title.replace(/^\[[^\]]+\]\s*/,'').trim() || a.title;
    const isHighlighted = highlightLink && a.link===highlightLink;
    if(a.isFallback){ return `<div class="article fallback ${isHighlighted?'highlight':''}" data-source="${a.id}" data-link="${a.link}"><h2><a href="${a.link}" target="_blank">${a.source}</a></h2><small>${a.source}${a.pubDate.getTime()?` - ${formatDate(a.pubDate, a.id)}`:''}</small><div style="margin-top:6px;color:#666;">${a.description}</div></div>`; }
    return `<div class="article ${isHighlighted?'highlight':''}" data-source="${a.id}" data-link="${a.link}"><h2><a href="${a.link}" target="_blank">${cleanTitle}</a></h2><small>${a.source} - ${formatDate(a.pubDate, a.id)}</small>${a.description?`<div style="margin-top:6px;color:#555;">${a.description}</div>`:''}</div>`;
  }).join('');
  container.innerHTML = countHtml + html;
  if(highlightLink){ setTimeout(()=>{ localStorage.removeItem('ommen_highlight_link'); }, 5000); }
  window.getAllArticles = ()=> filtered;
  try{ if(typeof updateSourceLeds==='function') setTimeout(()=>updateSourceLeds(), 20); }catch{}
}
function filterNews(){ renderArticles(); }
async function refreshNews(){
  const c=document.getElementById('news-container'); let hasStale=false; const initialArts=[];
  try{ for(const b of BRONNEN){ const cfg=BRON_URLS[b.id]; const cachedData=getCachedSource(cfg.url) || getStaleSource(cfg.url); if(cachedData){ try{ let arts=[]; if(b.id==='Nieuwsbrief'){ arts=parseNieuwsbriefECHT(cachedData); } else if(cfg.type==='gemeente') arts=parseGemeenteOverview(cachedData); else if(cfg.type==='oost') arts=parseRTVOostECHT(cachedData); else if(b.id==='RTV Vechtdal'){ try{ arts=parseRTVVechtdalECHT(cachedData); }catch{} if(arts.length===0) arts=parseRSSFull(cachedData,b.id); } else if(b.id==='Vechtdal Centraal'){ if(cachedData.includes('<rss')||cachedData.includes('<item')) arts=parseRSSFull(cachedData,b.id); else arts=parseVechtdalCentraalECHT(cachedData); } else arts=parseRSSFull(cachedData,b.id); if(arts.length>0){ initialArts.push(...arts.map(a=>({...a, source:b.name, id:b.id, isFallback:false}))); hasStale=true; } }catch(e){} } } }catch(e){}
  if(hasStale && initialArts.length>0){ allArticles=initialArts; loadedSources=new Set(BRONNEN.map(b=>b.id)); updateHeaderCount(); renderArticles(); renderFilters(); updateSourceLeds(); if(c) c.querySelector('.articles-count')?.insertAdjacentHTML('afterend', '<div style="font-size:11px;color:#16a34a;padding:0 2px 6px">⚡ Uit cache - wordt ververst...</div>'); }
  else { if(c) c.innerHTML='<div class="article">Bezig met laden... (10 bronnen) - eerste keer iets langer, daarna <1 sec</div>'; allArticles=[]; loadedSources=new Set(); updateHeaderCount(); }
  const loadWithTimeout = async (b) => { try { const timeout = new Promise((_,rej)=> setTimeout(()=>rej(new Error('timeout '+b.id)), 8000)); const arts = await Promise.race([loadOneSource(b), timeout]); return {b, arts}; } catch(e){ if(hasStale) return {b, arts:[]}; return {b, arts:[{title:b.name, link:BRON_URLS[b.id].homepage, pubDate:new Date(0), description:'Bron tijdelijk offline - '+e.message.slice(0,80)+' [...]', source:b.name, id:b.id, isFallback:true}]}; } };
  const results = await Promise.allSettled(BRONNEN.map(b=>loadWithTimeout(b))); const freshArts=[]; results.forEach(r=>{ if(r.status==='fulfilled'){ const {b, arts}=r.value; if(arts.length>0) freshArts.push(...arts); loadedSources.add(b.id); } }); if(freshArts.length>0) allArticles=freshArts; updateHeaderCount(); renderArticles(); renderFilters(); updateSourceLeds();
}
document.addEventListener('DOMContentLoaded', ()=>{
  loadState(); renderFilters(); saveState(); restorePanelState(); setupFilterHeader();
  document.getElementById('search-input')?.addEventListener('input', filterNews);
  const urlParams = new URLSearchParams(window.location.search); const highlightParam = urlParams.get('highlight') || urlParams.get('link'); if(highlightParam){ localStorage.setItem('ommen_highlight_link', highlightParam); }
  setTimeout(()=>refreshNews(), 200);
  if('serviceWorker' in navigator){
    navigator.serviceWorker.addEventListener('message', event=>{
      if(event.data && event.data.type==='PUSH_CLICKED'){ const link = event.data.link || event.data.url; if(link){ localStorage.setItem('ommen_highlight_link', link); window._lastPushRealArticle = event.data.article || null; highlightArticleByLink(link); } }
    });
  }
});
window.closePanel=closePanel; window.resetFilters=resetFilters; window.BRONNEN=BRONNEN; window.getAppState=()=>state;
window.filterNews=filterNews; window.refreshNews=refreshNews; window.highlightArticleByLink=highlightArticleByLink;
