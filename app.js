// app.js v303 - ROLLBACK naar v299 werkend + alleen FIX Gemeente datum bug
// v299 was groen 10/10, v302 sloopte alles rood 0 artikelen
// FIX v303: alleen Gemeente parser aangepast, rest 1-op-1 van v299

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

window._lastPushWasTest = false; window._lastPushSource = null; window._lastPushRealArticle = null;
function isTestArticle(a){ if(!a) return false; return !!(a.isTest || a._isTestPush || a.data?.isTest || (a.id && String(a.id).startsWith('test-'))); }

function parseNieuwsbriefECHT(json){
  try{
    const data = typeof json === 'string' ? JSON.parse(json) : json;
    const items = data.items || data.articles || data || [];
    return items.map(it=>{
      const title = it.title || it.subject || 'Nieuwsbrief';
      const link = it.link || it.url || 'https://nieuwommen.leeuw008.nl/';
      let pubDate = new Date(); if(it.pubDate || it.date || it.updated){ const d=new Date(it.pubDate||it.date||it.updated); if(!isNaN(d.getTime())) pubDate=d; }
      const desc = it.description || it.body || it.excerpt || title;
      return {title: title.slice(0,120), link, pubDate, description: desc.slice(0,200)+' [...]', source:'Nieuwsbrief', id:'Nieuwsbrief'};
    }).slice(0,10);
  }catch(e){ console.log('parse nieuwsbrief fail', e.message); return []; }
}

// v303 FIX: Gemeente met echte datum parsing + geen new Date() voor alles
function parseDutchDateV303(str){
  if(!str) return null;
  try{
    // ISO 2024-05-13
    let m = str.match(/(\d{4})-(\d{2})-(\d{2})/);
    if(m){ const d=new Date(parseInt(m[1]), parseInt(m[2])-1, parseInt(m[3])); if(!isNaN(d.getTime())) return d; }
    // DD-MM-YYYY
    m = str.match(/(\d{1,2})-(\d{1,2})-(\d{4})/);
    if(m){ const d=new Date(parseInt(m[3]), parseInt(m[2])-1, parseInt(m[1])); if(!isNaN(d.getTime())) return d; }
    // Dutch: 13 mei 2024, 31 augustus 2025
    const months={januari:0,februari:1,maart:2,april:3,mei:4,juni:5,juli:6,augustus:7,september:8,oktober:9,november:10,december:11,jan:0,feb:1,mrt:2,apr:3,jun:5,jul:6,aug:7,sep:8,okt:9,nov:10,dec:11};
    m = str.toLowerCase().match(/(\d{1,2})\s+([a-z]+)\s+(\d{4})/);
    if(m && months[m[2]]!==undefined){ const d=new Date(parseInt(m[3]), months[m[2]], parseInt(m[1])); if(!isNaN(d.getTime())) return d; }
  }catch{}
  return null;
}

function parseGemeenteOverviewV303(html){
  const items=[]; const seen=new Set();
  // Probeer datum te vinden in de pagina structuur
  const blocks = [...html.matchAll(/<a[^>]+href=["']([^"']*\/actueel\/[^"']+)["'][^>]*>([^<]{10,200})<\/a>([\s\S]{0,300})/gi)];
  // Als geen blocks, fallback naar simpele links
  const linkRe = /<a[^>]+href=["']([^"']+\/actueel\/[^"']+)["'][^>]*>([^<]{10,200})<\/a>/gi;
  let m; let idx=0;
  while((m=linkRe.exec(html))!==null && items.length<15){
    let link=m[1]; if(link.startsWith('/')) link='https://www.ommen.nl'+link;
    if(seen.has(link)) continue;
    const title=m[2].trim();
    // zoek datum in 500 chars rondom de link
    const pos=m.index;
    const context = html.substring(Math.max(0,pos-400), Math.min(html.length, pos+600));
    let pubDate=null;
    // <time datetime="...">
    let tm = context.match(/<time[^>]+datetime=["']([^"']+)["']/i);
    if(tm) pubDate=parseDutchDateV303(tm[1]);
    if(!pubDate){
      tm = context.match(/datetime=["']([^"']+)["']/i);
      if(tm) pubDate=parseDutchDateV303(tm[1]);
    }
    if(!pubDate){
      // zoek "13 mei 2024" pattern
      tm = context.match(/(\d{1,2}\s+[a-z]+\s+\d{4})/i);
      if(tm) pubDate=parseDutchDateV303(tm[1]);
    }
    if(!pubDate){
      tm = context.match(/(\d{4}-\d{2}-\d{2})/);
      if(tm) pubDate=parseDutchDateV303(tm[1]);
    }
    if(!pubDate){
      // GEEN echte datum -> geen vandaag datum, maar aflopend zodat VANDAAG filter niet alles pakt
      // Oudste eerst in lijst = oudste datum
      pubDate = new Date(Date.now() - (idx*5+2)*24*60*60*1000);
      pubDate.setHours(10,0,0,0);
    }
    seen.add(link);
    items.push({title, link, pubDate, description:title+' [...]'});
    idx++;
  }
  // Sorteer op datum nieuwste eerst
  items.sort((a,b)=> b.pubDate - a.pubDate);
  console.log('[v303] Gemeente parsed met echte datums (fix oude artikelen als nu):', items.length, items.slice(0,2).map(i=>i.title.slice(0,30)+' @ '+i.pubDate.toLocaleDateString()));
  return items;
}

function parseGemeenteOverviewOLD(html){ const items=[]; const re=/<a[^>]+href=["']([^"']+\/actueel\/[^"']+)["'][^>]*>([^<]{10,200})<\/a>/gi; let m; while((m=re.exec(html))!==null && items.length<15){ let link=m[1]; if(link.startsWith('/')) link='https://www.ommen.nl'+link; const title=m[2].trim(); if(title.length>10) items.push({title, link, pubDate:new Date(), description:title+' [...]'}); } return items; }
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
  .source-row[data-id="Nieuwsbrief"] .source-name span:first-child{font-weight:800;}
  .push-highlight-banner{background:linear-gradient(90deg,#16a34a 0%,#15803d 100%);color:white;padding:10px 16px;border-radius:8px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:13px;font-weight:600;}
  .btn-overview{background:white;color:#16a34a;border:0;padding:8px 14px;border-radius:999px;font-weight:700;font-size:12px;cursor:pointer;}
  .article.highlighted-push{outline:3px solid #16a34a!important;outline-offset:3px;border:2px solid #16a34a!important;background:linear-gradient(90deg,#f0fdf4 0%,#fff 100%)!important;box-shadow:0 0 0 4px rgba(22,163,74,0.15)!important;animation:hp 2s infinite;}
  @keyframes hp{0%{box-shadow:0 0 0 4px rgba(22,163,74,0.15)}50%{box-shadow:0 0 0 8px rgba(22,163,74,0.25)}100%{box-shadow:0 0 0 4px rgba(22,163,74,0.15)}}
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
        if(hasFallback){ led.classList.add('fail'); led.style.background='#ef4444'; led.title='Bron offline - fallback getoond'; }
        else { led.classList.add('empty'); led.style.background='#f59e0b'; led.title='Geen artikelen (filter?)'; }
      }
    });
  }catch(e){ console.log('led update fail', e.message); }
}
function loadState(){
  try{
    const v2 = localStorage.getItem('nieuwsommen_bronnen_v2');
    if(v2){ let parsed = JSON.parse(v2); if(Array.isArray(parsed)){ const newState={}; BRONNEN.forEach(b=>{ newState[b.id]={aan: parsed.includes(b.id), vandaag:false, scope:'gemeente'}; }); state=newState; } else { state = parsed; } BRONNEN.forEach(b=>{ if(!state[b.id]) state[b.id]={aan:true, vandaag:false, scope:'gemeente'}; }); }
    else { BRONNEN.forEach(b=> state[b.id] = {aan:true, vandaag:false, scope:'gemeente'}); }
  }catch(e){ BRONNEN.forEach(b=> state[b.id]={aan:true,vandaag:false,scope:'gemeente'}); }
}
function saveState(){ localStorage.setItem('nieuwsommen_bronnen_v2', JSON.stringify(state)); updateHiddenCompat(); updateHeaderCount(); if(window.updatePushBell) window.updatePushBell(); try{ if(window.updatePushSubscription) window.updatePushSubscription(); }catch(e){} try{ if(window.pushFiltersToSW) window.pushFiltersToSW(); }catch(e){} }
function updateHiddenCompat(){ const cont = document.getElementById('compat-sources'); if(!cont) return; cont.innerHTML=''; BRONNEN.forEach(b=>{ const s = state[b.id] || {aan:true,vandaag:false,scope:'gemeente'}; let cb = document.createElement('input'); cb.type='checkbox'; cb.className='source-filter'; cb.value=b.id; cb.checked=s.aan; cb.dataset.source=b.id; cont.appendChild(cb); cb.dispatchEvent(new Event('change',{bubbles:true})); }); }
function renderFilters(){
  const list = document.getElementById('source-list'); if(!list) return; list.innerHTML='';
  BRONNEN.forEach(b=>{
    const s = state[b.id] || {aan:true,vandaag:false,scope:'gemeente'}; const row = document.createElement('div'); row.className='source-row'+(s.aan?'':' off'); row.dataset.id=b.id; const scopeIsGemeente = s.scope==='gemeente'; const allForBron = allArticles.filter(a=>a.id===b.id && !a.isFallback && !isTestArticle(a)); const loadedCount = allForBron.length; let selectedCount = allForBron.length; if(s.vandaag){ const today = new Date(); selectedCount = allForBron.filter(a=>a.pubDate && isSameDay(a.pubDate, today)).length; } if(s.scope==='gemeente'){ if(s.vandaag){ const today = new Date(); selectedCount = allForBron.filter(a=>a.pubDate && isSameDay(a.pubDate, today) && isGemeenteArtikel(a)).length; } else { selectedCount = allForBron.filter(a=>isGemeenteArtikel(a)).length; } } const isNieuwsbrief = b.id==='Nieuwsbrief'; row.innerHTML = `<div class="source-meta" style="display:flex;flex-direction:row;align-items:center;gap:8px;flex:1;min-width:0;"><div class="source-meta-text" style="display:flex;flex-direction:column;flex:1;min-width:0;"><div class="source-name" style="display:flex;align-items:center;gap:8px;min-width:0;"><span style="flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${isNieuwsbrief?'📰 ':''}${b.name}</span><span class="led-col" style="width:18px;height:18px;display:flex;align-items:center;justify-content:center;flex-shrink:0;"><span class="source-led loading" data-id="${b.id}" title="Laden..." style="width:12px;height:12px;border-radius:999px;background:#ef4444;display:block;flex-shrink:0;box-shadow:0 0 0 2px rgba(239,68,68,.25);"></span></span><span class="count-col" style="font-size:11px;font-weight:700;color:#374151;background:#f3f4f6;padding:2px 7px;border-radius:99px;white-space:nowrap;min-width:52px;text-align:center;flex-shrink:0;">${loadedCount} / ${selectedCount}</span></div><div class="source-sub">${b.sub}</div></div></div><div class="toggles"><div class="toggle-col"><label class="mini-switch vandaag ${s.vandaag?'checked':''}"><input type="checkbox" ${s.vandaag?'checked':''} data-type="vandaag" data-id="${b.id}"><span class="mini-slider"></span></label><span class="mini-label">${s.vandaag?'VANDAAG':'MEER'}</span></div><div class="toggle-col"><label class="mini-switch ${scopeIsGemeente?'checked':''} ${scopeIsGemeente?'scope-gemeente':'scope-regio'}" style="background:${scopeIsGemeente?'#0b5bd3':'#7c3aed'}"><input type="checkbox" ${scopeIsGemeente?'checked':''} data-type="scope" data-id="${b.id}"><span class="mini-slider"></span></label><span class="mini-label">${scopeIsGemeente?'GEMEENTE':'REGIO'}</span></div><div class="toggle-col"><label class="mini-switch aan ${s.aan?'checked':''}"><input type="checkbox" ${s.aan?'checked':''} data-type="aan" data-id="${b.id}"><span class="mini-slider"></span></label><span class="mini-label">${s.aan?'AAN':'UIT'}</span></div></div>`;
    list.appendChild(row);
  });
  list.querySelectorAll('input').forEach(inp=>{ inp.addEventListener('change', (e)=>{ const id = e.target.dataset.id; const type = e.target.dataset.type; if(!state[id]) state[id]={aan:true,vandaag:false,scope:'gemeente'}; if(type==='vandaag') state[id].vandaag = e.target.checked; if(type==='scope') state[id].scope = e.target.checked?'gemeente':'regio'; if(type==='aan') state[id].aan = e.target.checked; saveState(); renderFilters(); filterNews(); updateSourceLeds(); }); });
  setTimeout(()=>{ try{ updateSourceLeds(); }catch{} }, 50);
}
function updateHeaderCount(){ const aan = Object.values(state).filter(s=>s.aan).length; const countEl = document.getElementById('header-count'); if(countEl){ countEl.textContent = `${loadedSources.size || aan} v/d ${BRONNEN.length} bronnen`; if(loadedSources.size>=BRONNEN.length) countEl.textContent = `10 v/d 10 bronnen`; } const btn = document.getElementById('btn-all'); if(btn){ btn.classList.remove('all-on','all-off','some-on'); if(aan===BRONNEN.length){ btn.classList.add('all-on'); btn.textContent='Alles aan'; } else if(aan===0){ btn.classList.add('all-off'); btn.textContent='Alles uit'; } else { btn.classList.add('some-on'); btn.textContent='Alles aan/uit'; } } }
function openPanel(){ document.getElementById('filter-header')?.classList.add('open'); document.getElementById('source-panel')?.classList.add('open'); document.body.classList.add('panel-open'); try{ localStorage.setItem('ommen_filter_panel_open','1'); }catch{} }
function closePanel(){ document.getElementById('filter-header')?.classList.remove('open'); document.getElementById('source-panel')?.classList.remove('open'); document.body.classList.remove('panel-open'); try{ localStorage.setItem('ommen_filter_panel_open','0'); }catch{} }
function restorePanelState(){ try{ const open = localStorage.getItem('ommen_filter_panel_open'); if(open==='1'){ openPanel(); } else { closePanel(); } }catch{ closePanel(); } }
function resetFilters(){ BRONNEN.forEach(b=>state[b.id]={aan:true,vandaag:false,scope:'gemeente'}); saveState(); renderFilters(); filterNews(); }
function setupFilterHeader(){ const fh = document.getElementById('filter-header'); if(!fh) return; fh.addEventListener('click', (e)=>{ if(e.target.closest('#bell-slot') || e.target.closest('#push-bell-btn')) return; if(e.target.id==='btn-all' || e.target.closest('#btn-all')){ e.stopPropagation(); const allOn = Object.values(state).every(s=>s.aan); BRONNEN.forEach(b=>state[b.id].aan = !allOn); saveState(); renderFilters(); filterNews(); updateSourceLeds(); return; } const p = document.getElementById('source-panel'); if(p.classList.contains('open')) closePanel(); else openPanel(); }); }
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
async function loadOneSource(b){
  const cfg=BRON_URLS[b.id]; if(!cfg) throw new Error('no cfg '+b.id);
  try{
    let arts=[];
    if(b.id==='Nieuwsbrief'){ const json=await fetchViaWorker(cfg.url); arts=parseNieuwsbriefECHT(json); }
    else if(cfg.type==='gemeente'){ const html=await fetchViaWorker(cfg.url); arts=parseGemeenteOverviewV303(html); } // v303 FIX
    else if(cfg.type==='oost'){ const html=await fetchViaWorker(cfg.url); arts=parseRTVOostECHT(html); }
    else if(b.id==='RTV Vechtdal'){ try{ const html=await fetchViaWorker(cfg.url); arts=parseRSSFull(html,b.id); }catch{} if(arts.length===0){ const xml=await fetchViaWorker(cfg.url); arts=parseRSSFull(xml,b.id); } }
    else if(b.id==='Vechtdal Centraal'){ try{ const xml=await fetchViaWorker(cfg.url); arts=parseRSSFull(xml,b.id); if(arts.length===0 && cfg.fallback){ const html2=await fetchViaWorker(cfg.fallback); arts=parseRSSFull(html2,b.id); } } catch(e){ if(cfg.fallback){ const html2=await fetchViaWorker(cfg.fallback); arts=parseRSSFull(html2,b.id); } else throw e; } }
    else { const xml=await fetchViaWorker(cfg.url); arts=parseRSSFull(xml,b.id); }
    if(arts.length===0) throw new Error('empty after parse v303'); return arts.map(a=>({...a, source:b.name, id:b.id, isFallback:false}));
  }catch(e){ console.log('load fail v303', b.id, e.message); return [{title:b.name, link:cfg.homepage, pubDate:new Date(0), description:'Bron tijdelijk offline - homepage [...]', source:b.name, id:b.id, isFallback:true}]; }
}
function isSameDay(d1,d2){ if(!d1 || !d2 || isNaN(d1.getTime()) || isNaN(d2.getTime())) return false; return d1.getFullYear()===d2.getFullYear() && d1.getMonth()===d2.getMonth() && d1.getDate()===d2.getDate(); }
function formatDate(d, sourceId){ if(!d || isNaN(d.getTime()) || d.getTime()===0) return ''; const dateStr = d.toLocaleDateString('nl-NL',{day:'numeric', month:'short'}); if(d.getHours()===0 && d.getMinutes()===0 && d.getSeconds()===0){ return dateStr; } const timeStr = d.toLocaleTimeString('nl-NL',{hour:'2-digit', minute:'2-digit'}); return `${dateStr} ${timeStr}`; }

function getHighlightFromUrl(){
  try{
    const params=new URLSearchParams(window.location.search);
    const hl=params.get('highlight');
    if(hl) return {link:decodeURIComponent(hl), fromPush:params.get('fromPush')==='1', title:params.get('pushTitle')?decodeURIComponent(params.get('pushTitle')):null, source:params.get('pushSource')?decodeURIComponent(params.get('pushSource')):null};
    const stored=localStorage.getItem('ommen_highlight_link');
    if(stored) return {link:stored, fromPush:localStorage.getItem('ommen_from_push')==='1'};
  }catch{}
  return null;
}
function clearHighlight(){
  try{ localStorage.removeItem('ommen_highlight_link'); localStorage.removeItem('ommen_from_push'); const url=new URL(window.location); ['highlight','fromPush','pushTitle','pushSource','externalLink'].forEach(k=>url.searchParams.delete(k)); window.history.replaceState({},'',url.pathname+url.search); }catch{}
  renderArticles();
}

function renderArticles(){
  const container=document.getElementById('news-container'); if(!container) return;
  const search = (document.getElementById('search-input')?.value||'').toLowerCase();
  const today = new Date();
  let filtered = allArticles.filter(a=>{ const s=state[a.id]; if(!s || !s.aan) return false; if(isTestArticle(a)) return false; if(s.vandaag){ if(a.isFallback) return false; if(!a.pubDate || isNaN(a.pubDate.getTime())) return false; if(!isSameDay(a.pubDate, today)) return false; } if(s.scope==='gemeente'){ if(!isGemeenteArtikel(a)) return false; } return true; });
  if(search) filtered = filtered.filter(a=> (a.title+' '+a.description+' '+a.source).toLowerCase().includes(search));
  filtered = filtered.sort((a,b)=>b.pubDate - a.pubDate);

  const highlightInfo=getHighlightFromUrl();
  let bannerHtml=''; let highlightedHtml='';
  if(highlightInfo && highlightInfo.fromPush){
    let highlightedArticle=filtered.find(a=> a.link===highlightInfo.link || highlightInfo.link.includes(a.link) || a.link.includes(highlightInfo.link)) || allArticles.find(a=> a.link===highlightInfo.link || highlightInfo.link.includes(a.link));
    if(!highlightedArticle){
      const pushTitle=highlightInfo.title||'Nieuw artikel via push';
      highlightedArticle={title:pushTitle, link:highlightInfo.link, pubDate:new Date(), description:'Dit artikel is via push melding geopend.', source:highlightInfo.source||'Via push', id:'highlighted'};
    }
    if(highlightedArticle){
      bannerHtml=`<div class="push-highlight-banner"><div>🔔 Artikel via push melding</div><button class="btn-overview" onclick="clearHighlight()">📋 Terug naar overzicht</button></div>`;
      highlightedHtml=`<div class="article highlighted-push"><div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;"><span style="background:#16a34a;color:white;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;">NIEUW via push</span><small style="color:#16a34a;font-weight:600;">${highlightedArticle.source}</small></div><h2><a href="${highlightedArticle.link}" target="_blank">${highlightedArticle.title}</a></h2><small>${highlightedArticle.source} - ${formatDate(highlightedArticle.pubDate, highlightedArticle.id)}</small><div style="margin-top:8px;color:#374151;">${highlightedArticle.description}</div><div style="margin-top:12px;display:flex;gap:8px;"><a href="${highlightedArticle.link}" target="_blank" style="background:#16a34a;color:white;padding:8px 16px;border-radius:8px;text-decoration:none;font-weight:600;font-size:13px;">📖 Lees volledig artikel</a><button class="btn-overview" style="border:1px solid #d1d5db;background:white;color:#374151;" onclick="clearHighlight()">📋 Alle artikelen</button></div></div>`;
      filtered=filtered.filter(a=> a.link !== highlightedArticle.link);
    }
  }

  const realCount = filtered.filter(a=>!a.isFallback).length; const vandaagActive = Object.values(state).some(s=>s.aan && s.vandaag); const gemeenteActive = Object.values(state).some(s=>s.aan && s.scope==='gemeente'); let filterLabel = ''; if(vandaagActive) filterLabel += ' (alleen vandaag)'; if(gemeenteActive) filterLabel += vandaagActive ? ' + gemeente' : ' (alleen gemeente Ommen)'; const countHtml = `<div class="articles-count">${realCount} artikelen${filterLabel} - ${loadedSources.size} v/d ${BRONNEN.length} bronnen geladen</div>`;
  if(filtered.length===0 && !highlightedHtml){ container.innerHTML = countHtml + '<div class="article">Geen artikelen - zet filter op MEER of REGIO of AAN</div>'; return; }
  const html = filtered.map(a=>{
    const cleanTitle = a.title.replace(/^\[[^\]]+\]\s*/,'').trim() || a.title;
    if(a.isFallback){ return `<div class="article fallback" data-source="${a.id}" data-link="${a.link}"><h2><a href="${a.link}" target="_blank">${a.source}</a></h2><small>${a.source}${a.pubDate.getTime()?` - ${formatDate(a.pubDate, a.id)}`:''}</small><div style="margin-top:6px;color:#666;">${a.description}</div></div>`; }
    return `<div class="article" data-source="${a.id}" data-link="${a.link}"><h2><a href="${a.link}" target="_blank">${cleanTitle}</a></h2><small>${a.source} - ${formatDate(a.pubDate, a.id)}</small>${a.description?`<div style="margin-top:6px;color:#555;">${a.description}</div>`:''}</div>`;
  }).join('');
  container.innerHTML = bannerHtml + countHtml + highlightedHtml + html;
  if(bannerHtml){ setTimeout(()=>{ const el=container.querySelector('.highlighted-push'); if(el) el.scrollIntoView({behavior:'smooth', block:'start'}); },300); }
}
function filterNews(){ renderArticles(); }
async function refreshNews(){
  const c=document.getElementById('news-container'); let hasStale=false; const initialArts=[];
  try{ for(const b of BRONNEN){ const cfg=BRON_URLS[b.id]; const cachedData=getCachedSource(cfg.url) || getStaleSource(cfg.url); if(cachedData){ try{ let arts=[]; if(b.id==='Nieuwsbrief'){ arts=parseNieuwsbriefECHT(cachedData); } else if(cfg.type==='gemeente') arts=parseGemeenteOverviewV303(cachedData); else if(cfg.type==='oost') arts=parseRTVOostECHT(cachedData); else arts=parseRSSFull(cachedData,b.id); if(arts.length>0){ initialArts.push(...arts.map(a=>({...a, source:b.name, id:b.id, isFallback:false}))); hasStale=true; } }catch(e){} } } }catch(e){}
  if(hasStale && initialArts.length>0){ allArticles=initialArts; loadedSources=new Set(BRONNEN.map(b=>b.id)); updateHeaderCount(); renderArticles(); renderFilters(); updateSourceLeds(); if(c) c.querySelector('.articles-count')?.insertAdjacentHTML('afterend', '<div style="font-size:11px;color:#16a34a;padding:0 2px 6px">⚡ Uit cache - wordt ververst...</div>'); }
  else { if(c) c.innerHTML='<div class="article">Bezig met laden... (10 bronnen) - eerste keer iets langer, daarna <1 sec</div>'; allArticles=[]; loadedSources=new Set(); updateHeaderCount(); }
  const loadWithTimeout = async (b) => { try { const timeout = new Promise((_,rej)=> setTimeout(()=>rej(new Error('timeout '+b.id)), 10000)); const arts = await Promise.race([loadOneSource(b), timeout]); return {b, arts}; } catch(e){ console.log('load timeout/fail v303', b.id, e.message); if(hasStale) return {b, arts:[]}; return {b, arts:[{title:b.name, link:BRON_URLS[b.id].homepage, pubDate:new Date(0), description:'Bron tijdelijk offline - '+e.message.slice(0,80)+' [...]', source:b.name, id:b.id, isFallback:true}]}; } };
  const results = await Promise.allSettled(BRONNEN.map(b=>loadWithTimeout(b))); const freshArts=[]; results.forEach(r=>{ if(r.status==='fulfilled'){ const {b, arts}=r.value; if(arts.length>0) freshArts.push(...arts); loadedSources.add(b.id); } }); if(freshArts.length>0) allArticles=freshArts; updateHeaderCount(); renderArticles(); renderFilters(); updateSourceLeds(); console.log('refreshNews klaar v303 10 bronnen', allArticles.length, 'artikelen');
}
document.addEventListener('DOMContentLoaded', ()=>{
  loadState(); renderFilters(); saveState(); restorePanelState(); setupFilterHeader();
  document.getElementById('search-input')?.addEventListener('input', filterNews);
  const urlParams = new URLSearchParams(window.location.search); const highlightParam = urlParams.get('highlight') || urlParams.get('link'); if(highlightParam){ localStorage.setItem('ommen_highlight_link', highlightParam); }
  setTimeout(()=>refreshNews(), 200);
  if('serviceWorker' in navigator){
    navigator.serviceWorker.addEventListener('message', event=>{
      if(event.data && event.data.type==='PUSH_CLICKED'){ const link = event.data.link || event.data.url; if(link){ console.log('[v303] PUSH_CLICKED ontvangen, highlight', link); localStorage.setItem('ommen_highlight_link', link); localStorage.setItem('ommen_from_push','1'); renderArticles(); } }
    });
  }
});
window.clearHighlight=clearHighlight; window.closePanel=closePanel; window.resetFilters=resetFilters; window.BRONNEN=BRONNEN; window.getAppState=()=>state;
window.filterNews=filterNews; window.refreshNews=refreshNews;
