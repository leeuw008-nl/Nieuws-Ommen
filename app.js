// app.js v302 - FIX Gemeente Ommen oude artikelen met datum/nu
// CHANGELOG v302:
// - FIX: Gemeente parser gaf alle artikelen new Date() = nu, waardoor oude artikelen als vandaag 09:47 verschenen
// - NIEUW: parseGemeenteOverview v302 probeert echte datum uit HTML te halen (time datetime, Dutch date, etc)
// - Als geen datum gevonden, gebruik aflopende datum (nu - index*2uur) zodat niet alles als zelfde moment telt
// - NieuwOmmen vet + Nieuwsbrief updates & releases klein behouden
// - Omlijnd fix v301 behouden (highlight + terug naar overzicht knop)

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
const BRON_URLS = {
  'De Stentor': {url:'https://www.destentor.nl/ommen/rss.xml', homepage:'https://www.destentor.nl/ommen/'},
  'Gemeente Ommen': {url:'https://www.ommen.nl/actueel/', homepage:'https://www.ommen.nl/actueel/', type:'gemeente'},
  'Natuurlijk Ommen': {url:'https://www.natuurlijkommen.nl/feed/', homepage:'https://www.natuurlijkommen.nl/'},
  'Ommen City': {url:'https://ommencity.nl/feed/', homepage:'https://ommencity.nl/'},
  'OudOmmen': {url:'https://weblog.oudommen.nl/feed/', homepage:'https://weblog.oudommen.nl/'},
  'RondOmmen': {url:'https://www.rondommen.nl/feed/', homepage:'https://www.rondommen.nl/'},
  'RTV Oost': {url:'https://www.oost.nl/nieuws/vechtdal', homepage:'https://www.oost.nl/nieuws/vechtdal', type:'oost'},
  'RTV Vechtdal': {url:'https://rtvvechtdal.nl/feed/', homepage:'https://rtvvechtdal.nl/'},
  'Vechtdal Centraal': {url:'https://www.vechtdalcentraal.nl/feed/', homepage:'https://www.vechtdalcentraal.nl/'},
  'Nieuwsbrief': {url:'https://ommen-push-v2.leeuw008.workers.dev/newsletter/feed', homepage:'https://nieuwommen.leeuw008.nl/', type:'nieuwsbrief'},
};

let state = {}; let allArticles = []; let loadedSources = new Set();
let highlightedLink = null; let fromPush = false;

(function injectStyles(){
  const css = `
  .source-row{position:relative}.source-led{width:12px;height:12px;border-radius:999px;display:block;flex-shrink:0}
  .source-led.loading{background:#ef4444;animation:pulse-red 1.2s infinite}.source-led.ok{background:#16a34a}.source-led.fail{background:#ef4444}.source-led.empty{background:#f59e0b}
  @keyframes pulse-red{0%{transform:scale(1)}50%{transform:scale(1.25)}100%{transform:scale(1)}}
  .source-row[data-id="Nieuwsbrief"]{background:linear-gradient(90deg,#f0fdf4 0%,#fff 100%);border-left:3px solid #16a34a;}
  .source-row[data-id="Nieuwsbrief"] .source-name span:first-child{font-weight:800;}
  .article.highlighted-push{outline:3px solid #16a34a;outline-offset:3px;border:2px solid #16a34a!important;background:linear-gradient(90deg,#f0fdf4 0%,#fff 100%)!important;box-shadow:0 0 0 4px rgba(22,163,74,0.15),0 4px 12px rgba(22,163,74,0.2)!important;animation:hp 2s ease-in-out infinite;position:relative;z-index:10;}
  @keyframes hp{0%{box-shadow:0 0 0 4px rgba(22,163,74,0.15)}50%{box-shadow:0 0 0 8px rgba(22,163,74,0.25)}100%{box-shadow:0 0 0 4px rgba(22,163,74,0.15)}}
  .push-highlight-banner{background:linear-gradient(90deg,#16a34a 0%,#15803d 100%);color:white;padding:10px 16px;border-radius:8px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:13px;font-weight:600;}
  .btn-overview{background:white;color:#16a34a;border:0;padding:8px 14px;border-radius:999px;font-weight:700;font-size:12px;cursor:pointer;}
  `;
  const el=document.createElement('style'); el.id='v302-style'; el.textContent=css;
  if(!document.getElementById('v302-style')) document.head.appendChild(el);
})();

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
  highlightedLink=null; fromPush=false;
  localStorage.removeItem('ommen_highlight_link'); localStorage.removeItem('ommen_from_push'); localStorage.removeItem('ommen_push_title');
  try{ const url=new URL(window.location); ['highlight','fromPush','pushTitle','pushSource','externalLink'].forEach(k=>url.searchParams.delete(k)); window.history.replaceState({},'',url.pathname+url.search); }catch{}
  renderArticles();
}

// v302 FIX: echte datum parser voor Gemeente Ommen
function parseDutchDate(str){
  if(!str) return null;
  try{
    // 1. ISO datetime: 2024-05-13T09:47:00 or 2024-05-13
    const iso = str.match(/(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2}(?::\d{2})?))?/);
    if(iso){
      const d=new Date(iso[0]); if(!isNaN(d.getTime())) return d;
    }
    // 2. Dutch: 13 mei 2024, 13 mei, 31 augustus 2025
    const months = {januari:0, februari:1, maart:2, april:3, mei:4, juni:5, juli:6, augustus:7, september:8, oktober:9, november:10, december:11, jan:0, feb:1, mrt:2, apr:3, jun:5, jul:6, aug:7, sep:8, okt:9, nov:10, dec:11};
    const dutch = str.toLowerCase().match(/(\d{1,2})\s+([a-z]+)\s+(\d{4})/);
    if(dutch){
      const day=parseInt(dutch[1]); const mon=months[dutch[2]]; const year=parseInt(dutch[3]);
      if(mon!==undefined){ const d=new Date(year, mon, day); if(!isNaN(d.getTime())) return d; }
    }
    const dutchNoYear = str.toLowerCase().match(/(\d{1,2})\s+([a-z]+)/);
    if(dutchNoYear){
      const day=parseInt(dutchNoYear[1]); const mon=months[dutchNoYear[2]];
      if(mon!==undefined){
        const now=new Date(); let year=now.getFullYear();
        const d=new Date(year, mon, day);
        // als datum in toekomst, vorig jaar
        if(d.getTime() > now.getTime()+86400000) d.setFullYear(year-1);
        if(!isNaN(d.getTime())) return d;
      }
    }
    // 3. DD-MM-YYYY or DD/MM/YYYY
    const dm = str.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
    if(dm){
      const d=new Date(parseInt(dm[3]), parseInt(dm[2])-1, parseInt(dm[1]));
      if(!isNaN(d.getTime())) return d;
    }
  }catch{}
  return null;
}

function parseGemeenteOverviewV302(html){
  const items=[]; const seen=new Set();
  // Probeer eerst alle article blocks te vinden met datum
  // Pattern 1: <article ...> ... <time datetime="..."> ... <a href="/actueel/...">Title</a>
  const articleBlocks = [...html.matchAll(/<article[^>]*>([\s\S]{0,2000}?)<\/article>/gi)];
  for(let idx=0; idx<articleBlocks.length && items.length<15; idx++){
    const block=articleBlocks[idx][1];
    const linkMatch = block.match(/<a[^>]+href=["']([^"']*\/actueel\/[^"']+)["'][^>]*>([^<]{10,200})<\/a>/i);
    if(!linkMatch) continue;
    let link=linkMatch[1]; if(link.startsWith('/')) link='https://www.ommen.nl'+link;
    if(seen.has(link)) continue;
    const title=linkMatch[2].trim();
    // zoek datum in block
    let pubDate=null;
    // time datetime="2024-05-13"
    const timeMatch = block.match(/<time[^>]+datetime=["']([^"']+)["']/i) || block.match(/<time[^>]*>([^<]+)<\/time>/i);
    if(timeMatch){ pubDate=parseDutchDate(timeMatch[1]); }
    // span met date class
    if(!pubDate){
      const dateSpan = block.match(/class="[^"]*date[^"]*"[^>]*>([^<]{5,40})</i);
      if(dateSpan) pubDate=parseDutchDate(dateSpan[1]);
    }
    // fallback: zoek datum string in buurt van link (100 chars ervoor)
    if(!pubDate){
      const linkPos = block.indexOf(linkMatch[0]);
      const snippet = block.substring(Math.max(0,linkPos-200), linkPos+200);
      // zoek datum pattern in snippet
      const dateInSnippet = snippet.match(/\d{1,2}\s+[a-z]+\s+\d{4}/i) || snippet.match(/\d{4}-\d{2}-\d{2}/);
      if(dateInSnippet) pubDate=parseDutchDate(dateInSnippet[0]);
    }
    if(!pubDate){
      // GEEN echte datum gevonden -> gebruik aflopende datum ipv nu, zodat niet alles als vandaag telt
      // Oudste artikel krijgt oudste datum (nu - index*3 dagen) zodat VANDAAG filter niet alles pakt
      const daysAgo = idx*3 + Math.floor(Math.random()*2);
      pubDate = new Date(Date.now() - daysAgo*24*60*60*1000);
      pubDate.setHours(10,0,0,0);
    }
    seen.add(link);
    items.push({title, link, pubDate, description:title+' [...]'});
  }
  
  // Fallback: oude simpele regex als bovenstaand niks vond (voor andere layout)
  if(items.length===0){
    const re=/<a[^>]+href=["']([^"']+\/actueel\/[^"']+)["'][^>]*>([^<]{10,200})<\/a>/gi; let m; let idx=0;
    while((m=re.exec(html))!==null && items.length<15){
      let link=m[1]; if(link.startsWith('/')) link='https://www.ommen.nl'+link;
      if(seen.has(link)) continue; seen.add(link);
      const title=m[2].trim();
      // probeer datum te vinden rondom deze match
      let pubDate=null;
      const pos=m.index;
      const context = html.substring(Math.max(0,pos-500), pos+500);
      const timeMatch = context.match(/<time[^>]+datetime=["']([^"']+)["']/i);
      if(timeMatch) pubDate=parseDutchDate(timeMatch[1]);
      if(!pubDate){
        const dutch = context.match(/(\d{1,2}\s+[a-z]+\s+\d{4})/i);
        if(dutch) pubDate=parseDutchDate(dutch[1]);
      }
      if(!pubDate){
        // aflopende datum fallback
        pubDate = new Date(Date.now() - idx*3*24*60*60*1000);
        pubDate.setHours(10,0,0,0);
      }
      idx++;
      items.push({title, link, pubDate, description:title+' [...]'});
    }
  }
  
  // Sorteer op echte datum (nieuwste eerst)
  items.sort((a,b)=> b.pubDate - a.pubDate);
  console.log('[v302] Gemeente parsed', items.length, 'met echte datums:', items.slice(0,3).map(i=>i.title.slice(0,30)+' @ '+i.pubDate.toLocaleDateString()));
  return items;
}

function parseNieuwsbrief(json){ try{ const data=typeof json==='string'?JSON.parse(json):json; const items=data.items||[]; return items.map(it=>{ let pd=new Date(); if(it.pubDate){ const d=new Date(it.pubDate); if(!isNaN(d.getTime())) pd=d; } return {title:(it.title||'Nieuwsbrief').slice(0,120), link:it.link||'https://nieuwommen.leeuw008.nl/', pubDate:pd, description:(it.description||it.title||'').slice(0,200)+' [...]', source:'Nieuwsbrief', id:'Nieuwsbrief'}; }).slice(0,10); }catch{ return []; } }
function parseVechtdalCentraal(html){ const items=[]; let re=/<h3 class="entry-title[^>]*>\s*<a href="([^"]+)"[^>]*>([^<]+)<\/a>/gi; let m; while((m=re.exec(html))!==null && items.length<25){ let link=m[1]; if(link.startsWith('/')) link='https://www.vechtdalcentraal.nl'+link; items.push({title:m[2].replace(/&#8217;/g,"'").trim(), link, pubDate:new Date(), description:m[2].trim()+' [...]'}); } return items; }
function parseRTVVechtdal(html){ const items=[]; const re=/<div class="allmode_date">([^<]+)<\/div>[\s\S]{0,600}?<h3 class="allmode_title"><a href="([^"]+)">([^<]+)<\/a>/gi; let m; while((m=re.exec(html))!==null && items.length<20){ let link=m[2]; if(!link.startsWith('http')) link='https://www.rtvvechtdal.nl'+link; items.push({title:m[3].trim().slice(0,120), link, pubDate:new Date(), description:m[3].trim().slice(0,200)+' [...]'}); } return items; }
// FIX voor app.js - vervang parseRTVOostECHT door dit
function parseRTVOostECHT(html){
  const items=[]; let m;
  const reReal = /<div[^>]*publishedAt=["']([^"']+)["'][^>]*>[\s\S]*?<a[^>]+href=["'](\/nieuws\/\d+\/[^"']{5,180})["'][^>]*>[\s\S]*?<div[^>]*class="[^"]*name-label[^"]*"[^>]*>([^<]{2,25})<\/div>[\s\S]*?<h3[^>]*>([^<]{12,400})<\/h3>/gi;
  while((m=reReal.exec(html))!==null && items.length<10){
    let dateStr=m[1]; let link=m[2]; if(link.startsWith('/')) link='https://www.oost.nl'+link;
    let category=m[3].trim().toUpperCase(); let title=m[4].trim();
    if(title.toUpperCase()==='ALLE NIEUWS') continue;
    let pd=new Date(dateStr); if(isNaN(pd.getTime())) pd=new Date();
    let finalTitle = ['NIEUWS','112','ECONOMIE','SPORT','CULTUUR','NATUUR','POLITIEK','WEER'].includes(category) ? category+': '+title : title;
    if(!items.find(x=>x.link===link)) items.push({title:finalTitle, link, pubDate:pd, description:'', _cat:category, _needsEnrich:true});
  }
  if(items.length>0){ items.sort((a,b)=>b.pubDate-a.pubDate); return items; }
  return items;
}
function extractOostDesc(html){
  let m=html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']{20,800})["']/i);
  if(m) return m[1].replace(/&quot;/g,'"').replace(/&amp;/g,'&').trim();
  m=html.match(/<p[^>]*>\s*<strong[^>]*>([^<]{30,800})<\/strong>\s*<\/p>/i);
  if(m) return m[1].replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
  return '';
}
async function enrichRTVOostWithDetail(arts){
  const cache={};
  try{ Object.assign(cache, JSON.parse(localStorage.getItem('oost_desc_v3')||'{}')); }catch{}
  for(const a of arts.slice(0,5)){
    if(!a._needsEnrich) continue;
    try{
      const html=await fetchViaWorker(a.link);
      let d=extractOostDesc(html);
      if(d){ if(d.length>220) d=d.slice(0,217)+'...'; a.description=d+' [...]'; cache[a.link]={desc:a.description, ts:Date.now()}; }
      else a.description='Lees het volledige artikel op RTV Oost - '+(a._cat||'');
    }catch{ a.description='Lees het volledige artikel op RTV Oost'; }
    await new Promise(r=>setTimeout(r,600));
  }
  try{ localStorage.setItem('oost_desc_v3', JSON.stringify(cache)); }catch{}
  try{ renderArticles(); }catch{}
}

const GEMEENTE_ZOEK = ['ommen','lemele','vilsteren','beerze','witharen','archem','besthmen','giethmen','junne'].map(s=>s.toLowerCase());
function isGemeenteArtikel(a){ const txt = (a.title + ' ' + a.description).toLowerCase(); return GEMEENTE_ZOEK.some(pl => txt.includes(pl)); }

function loadState(){ try{ const v2=localStorage.getItem('nieuwsommen_bronnen_v2'); if(v2){ let p=JSON.parse(v2); if(Array.isArray(p)){ const ns={}; BRONNEN.forEach(b=>{ ns[b.id]={aan:p.includes(b.id), vandaag:false, scope:'gemeente'}; }); state=ns; } else state=p; BRONNEN.forEach(b=>{ if(!state[b.id]) state[b.id]={aan:true,vandaag:false,scope:'gemeente'}; }); } else BRONNEN.forEach(b=> state[b.id]={aan:true,vandaag:false,scope:'gemeente'}); }catch{ BRONNEN.forEach(b=> state[b.id]={aan:true,vandaag:false,scope:'gemeente'}); } }
function saveState(){ localStorage.setItem('nieuwsommen_bronnen_v2', JSON.stringify(state)); updateHiddenCompat(); updateHeaderCount(); }
function updateHiddenCompat(){ const cont=document.getElementById('compat-sources'); if(!cont) return; cont.innerHTML=''; BRONNEN.forEach(b=>{ const s=state[b.id]||{aan:true}; let cb=document.createElement('input'); cb.type='checkbox'; cb.className='source-filter'; cb.value=b.id; cb.checked=s.aan; cb.dataset.source=b.id; cont.appendChild(cb); cb.dispatchEvent(new Event('change',{bubbles:true})); }); }
function renderFilters(){
  const list=document.getElementById('source-list'); if(!list) return; list.innerHTML='';
  BRONNEN.forEach(b=>{
    const s=state[b.id]||{aan:true,vandaag:false,scope:'gemeente'}; const row=document.createElement('div'); row.className='source-row'+(s.aan?'':' off'); row.dataset.id=b.id; const scopeIsGemeente=s.scope==='gemeente'; const allForBron=allArticles.filter(a=>a.id===b.id && !a.isFallback); const loadedCount=allForBron.length; let selectedCount=allForBron.length; if(s.vandaag){ const today=new Date(); selectedCount=allForBron.filter(a=>a.pubDate && isSameDay(a.pubDate,today)).length; } if(s.scope==='gemeente'){ selectedCount=allForBron.filter(a=>isGemeenteArtikel(a)).length; } const isNieuwsbrief=b.id==='Nieuwsbrief'; row.innerHTML=`<div class="source-meta" style="display:flex;align-items:center;gap:8px;flex:1;min-width:0;"><div style="display:flex;flex-direction:column;flex:1;min-width:0;"><div class="source-name" style="display:flex;align-items:center;gap:8px;"><span style="flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${isNieuwsbrief?'📰 ':''}${b.name}</span><span class="source-led loading" data-id="${b.id}" style="width:12px;height:12px;border-radius:999px;background:#ef4444;display:block;"></span><span style="font-size:11px;font-weight:700;background:#f3f4f6;padding:2px 7px;border-radius:99px;min-width:52px;text-align:center;">${loadedCount} / ${selectedCount}</span></div><div class="source-sub">${b.sub}</div></div></div><div class="toggles"><div class="toggle-col"><label class="mini-switch ${s.vandaag?'checked':''}"><input type="checkbox" ${s.vandaag?'checked':''} data-type="vandaag" data-id="${b.id}"><span class="mini-slider"></span></label><span class="mini-label">${s.vandaag?'VANDAAG':'MEER'}</span></div><div class="toggle-col"><label class="mini-switch ${scopeIsGemeente?'checked':''}" style="background:${scopeIsGemeente?'#0b5bd3':'#7c3aed'}"><input type="checkbox" ${scopeIsGemeente?'checked':''} data-type="scope" data-id="${b.id}"><span class="mini-slider"></span></label><span class="mini-label">${scopeIsGemeente?'GEMEENTE':'REGIO'}</span></div><div class="toggle-col"><label class="mini-switch ${s.aan?'checked':''}"><input type="checkbox" ${s.aan?'checked':''} data-type="aan" data-id="${b.id}"><span class="mini-slider"></span></label><span class="mini-label">${s.aan?'AAN':'UIT'}</span></div></div>`;
    list.appendChild(row);
  });
  list.querySelectorAll('input').forEach(inp=>{ inp.addEventListener('change',e=>{ const id=e.target.dataset.id; const type=e.target.dataset.type; if(!state[id]) state[id]={aan:true,vandaag:false,scope:'gemeente'}; if(type==='vandaag') state[id].vandaag=e.target.checked; if(type==='scope') state[id].scope=e.target.checked?'gemeente':'regio'; if(type==='aan') state[id].aan=e.target.checked; saveState(); renderFilters(); filterNews(); }); });
}
function updateHeaderCount(){ const aan=Object.values(state).filter(s=>s.aan).length; const el=document.getElementById('header-count'); if(el) el.textContent=`${loadedSources.size||aan} v/d ${BRONNEN.length} bronnen`; }
function openPanel(){ document.getElementById('filter-header')?.classList.add('open'); document.getElementById('source-panel')?.classList.add('open'); }
function closePanel(){ document.getElementById('filter-header')?.classList.remove('open'); document.getElementById('source-panel')?.classList.remove('open'); }
function resetFilters(){ BRONNEN.forEach(b=>state[b.id]={aan:true,vandaag:false,scope:'gemeente'}); saveState(); renderFilters(); filterNews(); }
function setupFilterHeader(){ const fh=document.getElementById('filter-header'); if(!fh) return; fh.addEventListener('click',e=>{ if(e.target.closest('#bell-slot')) return; if(e.target.id==='btn-all' || e.target.closest('#btn-all')){ e.stopPropagation(); const allOn=Object.values(state).every(s=>s.aan); BRONNEN.forEach(b=>state[b.id].aan=!allOn); saveState(); renderFilters(); filterNews(); return; } const p=document.getElementById('source-panel'); if(p.classList.contains('open')) closePanel(); else openPanel(); }); }

const WORKER='https://ommen-push-v2.leeuw008.workers.dev';
async function fetchViaWorker(url){ try{ const r=await fetch(`${WORKER}/proxy?url=${encodeURIComponent(url)}&t=${Date.now()}`); if(r.ok){ const t=await r.text(); if(t.length>150) return t; } }catch{} try{ const r2=await fetch(url); if(r2.ok){ const t2=await r2.text(); if(t2.length>200) return t2; } }catch{} throw new Error('fail'); }
async function loadOneSource(b){
  const cfg=BRON_URLS[b.id]; try{
    let arts=[];
    if(b.id==='Nieuwsbrief'){ const j=await fetchViaWorker(cfg.url); arts=parseNieuwsbrief(j); }
    else if(cfg.type==='gemeente'){ const h=await fetchViaWorker(cfg.url); arts=parseGemeenteOverviewV302(h); } // v302 FIX
    else if(cfg.type==='oost'){ const h=await fetchViaWorker(cfg.url); arts=parseRTVOostECHT(h); }
    if(b.id==='RTV Oost' && arts.length>0 && arts[0]._needsEnrich){
      const tmp = arts.map(a=>({...a, source:b.name, id:b.id}));
      setTimeout(()=>{ enrichRTVOostWithDetail(tmp); }, 100);
    }
    else if(b.id==='RTV Vechtdal'){ try{ const h=await fetchViaWorker(cfg.url); arts=parseRTVVechtdal(h); }catch{} if(arts.length===0){ const x=await fetchViaWorker(cfg.url); arts=parseRSS(x); } }
    else if(b.id==='Vechtdal Centraal'){ try{ const x=await fetchViaWorker(cfg.url); arts=parseRSS(x); if(arts.length===0){ const h2=await fetchViaWorker(cfg.fallback); arts=parseVechtdalCentraal(h2); } }catch{ const h2=await fetchViaWorker(cfg.fallback); arts=parseVechtdalCentraal(h2); } }
    else { const x=await fetchViaWorker(cfg.url); arts=parseRSS(x); }
    if(arts.length===0) throw new Error('empty'); return arts.map(a=>({...a, source:b.name, id:b.id, isFallback:false}));
  }catch{ return [{title:b.name, link:cfg.homepage, pubDate:new Date(0), description:'Bron tijdelijk offline', source:b.name, id:b.id, isFallback:true}]; }
}
function isSameDay(d1,d2){ return d1 && d2 && d1.getFullYear()===d2.getFullYear() && d1.getMonth()===d2.getMonth() && d1.getDate()===d2.getDate(); }
function formatDate(d){ if(!d || d.getTime()===0) return ''; return d.toLocaleDateString('nl-NL',{day:'numeric',month:'short'})+' '+d.toLocaleTimeString('nl-NL',{hour:'2-digit',minute:'2-digit'}); }

function renderArticles(){
  const container=document.getElementById('news-container'); if(!container) return;
  const search=(document.getElementById('search-input')?.value||'').toLowerCase();
  const today=new Date();
  let filtered=allArticles.filter(a=>{ const s=state[a.id]; if(!s||!s.aan) return false; if(s.vandaag && (a.isFallback || !isSameDay(a.pubDate,today))) return false; if(s.scope==='gemeente' && !isGemeenteArtikel(a)) return false; return true; });
  if(search) filtered=filtered.filter(a=> (a.title+' '+a.description).toLowerCase().includes(search));
  filtered=filtered.sort((a,b)=>b.pubDate-a.pubDate);

  const highlightInfo=getHighlightFromUrl();
  if(highlightInfo){ highlightedLink=highlightInfo.link; fromPush=highlightInfo.fromPush; localStorage.setItem('ommen_highlight_link', highlightedLink); if(fromPush) localStorage.setItem('ommen_from_push','1'); }

  let html=''; let bannerHtml='';
  if(highlightedLink && fromPush){
    let highlightedArticle=filtered.find(a=> a.link===highlightedLink || highlightedLink.includes(a.link) || a.link.includes(highlightedLink)) || allArticles.find(a=> a.link===highlightedLink || highlightedLink.includes(a.link));
    if(!highlightedArticle){
      const urlParams=new URLSearchParams(window.location.search);
      const pushTitle=urlParams.get('pushTitle')?decodeURIComponent(urlParams.get('pushTitle')):'Nieuw artikel via push';
      const pushSource=urlParams.get('pushSource')?decodeURIComponent(urlParams.get('pushSource')):'';
      highlightedArticle={title:pushTitle, link:highlightedLink, pubDate:new Date(), description:'Dit artikel is via push melding geopend.', source:pushSource||'Via push', id:'highlighted'};
    }
    if(highlightedArticle){
      bannerHtml=`<div class="push-highlight-banner"><div>🔔 Artikel via push melding</div><button class="btn-overview" onclick="clearHighlight()">📋 Terug naar overzicht</button></div>`;
      html+=`<div class="article highlighted-push"><div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;"><span style="background:#16a34a;color:white;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;">NIEUW via push</span><small style="color:#16a34a;font-weight:600;">${highlightedArticle.source}</small></div><h2><a href="${highlightedArticle.link}" target="_blank">${highlightedArticle.title}</a></h2><small>${highlightedArticle.source} - ${formatDate(highlightedArticle.pubDate)}</small><div style="margin-top:8px;color:#374151;">${highlightedArticle.description}</div><div style="margin-top:12px;display:flex;gap:8px;"><a href="${highlightedArticle.link}" target="_blank" style="background:#16a34a;color:white;padding:8px 16px;border-radius:8px;text-decoration:none;font-weight:600;font-size:13px;">📖 Lees volledig artikel</a><button class="btn-overview" style="border:1px solid #d1d5db;background:white;color:#374151;" onclick="clearHighlight()">📋 Alle artikelen</button></div></div>`;
      filtered=filtered.filter(a=> a.link !== highlightedArticle.link);
    }
  }

  const realCount=filtered.filter(a=>!a.isFallback).length;
  const countHtml=`<div class="articles-count">${realCount} artikelen - ${loadedSources.size} v/d ${BRONNEN.length} bronnen geladen</div>`;
  if(filtered.length===0 && !highlightedLink){ container.innerHTML=countHtml+'<div class="article">Geen artikelen</div>'; return; }
  const articlesHtml=filtered.map(a=>`<div class="article ${highlightedLink && (a.link===highlightedLink)?'highlighted-push':''}" data-link="${a.link}"><h2><a href="${a.link}" target="_blank">${a.title.replace(/^\[[^\]]+\]\s*/,'').trim()}</a></h2><small>${a.source} - ${formatDate(a.pubDate)}</small><div style="margin-top:6px;color:#555;">${a.description}</div></div>`).join('');
  container.innerHTML=bannerHtml+countHtml+html+articlesHtml;
  if(highlightedLink && fromPush){ setTimeout(()=>{ const el=container.querySelector('.highlighted-push'); if(el) el.scrollIntoView({behavior:'smooth', block:'start'}); },300); }
}
function filterNews(){ renderArticles(); }
async function refreshNews(){
  const c=document.getElementById('news-container'); c.innerHTML='<div class="article">Bezig met laden... (10 bronnen)</div>';
  allArticles=[]; loadedSources=new Set();
  const results=await Promise.allSettled(BRONNEN.map(async b=>{ const arts=await loadOneSource(b); return {b, arts}; }));
  const freshArts=[]; results.forEach(r=>{ if(r.status==='fulfilled'){ const {b, arts}=r.value; if(arts.length>0) freshArts.push(...arts); loadedSources.add(b.id); } });
  allArticles=freshArts; updateHeaderCount(); renderArticles(); renderFilters();
}
document.addEventListener('DOMContentLoaded', ()=>{
  loadState(); renderFilters(); saveState();
  document.getElementById('search-input')?.addEventListener('input', filterNews);
  const hl=getHighlightFromUrl(); if(hl){ highlightedLink=hl.link; fromPush=hl.fromPush; }
  setTimeout(()=>refreshNews(),200);
  if('serviceWorker' in navigator){
    navigator.serviceWorker.addEventListener('message', event=>{
      if(event.data && event.data.type==='PUSH_CLICKED'){
        const link=event.data.link||event.data.url;
        if(link){
          highlightedLink=link; fromPush=true;
          localStorage.setItem('ommen_highlight_link', link); localStorage.setItem('ommen_from_push','1');
          try{ const url=new URL(window.location); url.searchParams.set('highlight', link); url.searchParams.set('fromPush','1'); if(event.data.title) url.searchParams.set('pushTitle', event.data.title); if(event.data.source) url.searchParams.set('pushSource', event.data.source); window.history.replaceState({},'',url.toString()); }catch{}
          renderArticles();
        }
      }
    });
  }
  setupFilterHeader();
});
window.clearHighlight=clearHighlight; window.closePanel=closePanel; window.resetFilters=resetFilters; window.BRONNEN=BRONNEN; window.filterNews=filterNews; window.refreshNews=refreshNews;
function restorePanelState(){ try{ const open=localStorage.getItem('ommen_filter_panel_open'); if(open==='1') openPanel(); else closePanel(); }catch{ closePanel(); } }
