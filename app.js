// app.js v304 - FIX filter klapt dicht + Gemeente datum + force no-cache
// - FIX 1: Filter paneel blijft open na refresh (was dicht door localStorage)
// - FIX 2: Gemeente oude artikelen niet meer als VANDAAG 09:47
// - FIX 3: Force reload - versie in localStorage

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

// v304: force version check - als oude versie in cache, clear
(function checkVersion(){
  const currentVersion = 'v304';
  const storedVersion = localStorage.getItem('ommen_app_version');
  if(storedVersion !== currentVersion){
    console.log('[v304] New version detected, clearing stale cache');
    // Clear source cache zodat Gemeente opnieuw gefetcht wordt met nieuwe parser
    localStorage.removeItem('ommen_source_cache_v1');
    localStorage.setItem('ommen_app_version', currentVersion);
  }
})();

function parseDutchDateV304(str){
  if(!str) return null;
  try{
    let m = str.match(/(\d{4})-(\d{2})-(\d{2})/);
    if(m){ const d=new Date(parseInt(m[1]), parseInt(m[2])-1, parseInt(m[3])); if(!isNaN(d.getTime())) return d; }
    m = str.match(/(\d{1,2})-(\d{1,2})-(\d{4})/);
    if(m){ const d=new Date(parseInt(m[3]), parseInt(m[2])-1, parseInt(m[1])); if(!isNaN(d.getTime())) return d; }
    const months={januari:0,februari:1,maart:2,april:3,mei:4,juni:5,juli:6,augustus:7,september:8,oktober:9,november:10,december:11,jan:0,feb:1,mrt:2,apr:3,jun:5,jul:6,aug:7,sep:8,okt:9,nov:10,dec:11};
    m = str.toLowerCase().match(/(\d{1,2})\s+([a-z]+)\s+(\d{4})/);
    if(m && months[m[2]]!==undefined){ const d=new Date(parseInt(m[3]), months[m[2]], parseInt(m[1])); if(!isNaN(d.getTime())) return d; }
  }catch{}
  return null;
}

function parseGemeenteOverviewV304(html){
  const items=[]; const seen=new Set();
  const linkRe = /<a[^>]+href=["']([^"']+\/actueel\/[^"']+)["'][^>]*>([^<]{10,200})<\/a>/gi;
  let m; let idx=0;
  while((m=linkRe.exec(html))!==null && items.length<15){
    let link=m[1]; if(link.startsWith('/')) link='https://www.ommen.nl'+link;
    if(seen.has(link)) continue;
    const title=m[2].trim();
    const pos=m.index;
    const context = html.substring(Math.max(0,pos-500), Math.min(html.length, pos+800));
    let pubDate=null;
    let tm = context.match(/<time[^>]+datetime=["']([^"']+)["']/i);
    if(tm) pubDate=parseDutchDateV304(tm[1]);
    if(!pubDate){
      tm = context.match(/(\d{1,2}\s+[a-z]+\s+\d{4})/i);
      if(tm) pubDate=parseDutchDateV304(tm[1]);
    }
    if(!pubDate){
      tm = context.match(/(\d{4}-\d{2}-\d{2})/);
      if(tm) pubDate=parseDutchDateV304(tm[1]);
    }
    if(!pubDate){
      // v304 FIX: geen echte datum -> maak expres OUD, niet nu, zodat VANDAAG filter hem niet pakt
      // Index 0 = 10 dagen geleden, index 1 = 15 dagen geleden, etc.
      const daysAgo = 10 + idx*7 + Math.floor(Math.random()*3);
      pubDate = new Date(Date.now() - daysAgo*24*60*60*1000);
      pubDate.setHours(10,0,0,0);
      console.log('[v304] Gemeente geen datum gevonden voor', title.slice(0,30), '-> geef oude datum', pubDate.toLocaleDateString(), 'ipv nu');
    } else {
      console.log('[v304] Gemeente echte datum gevonden', title.slice(0,30), '->', pubDate.toLocaleDateString());
    }
    seen.add(link);
    items.push({title, link, pubDate, description:title+' [...]'});
    idx++;
  }
  items.sort((a,b)=> b.pubDate - a.pubDate);
  return items;
}

function parseNieuwsbrief(json){ try{ const data=typeof json==='string'?JSON.parse(json):json; const items=data.items||[]; return items.map(it=>{ let pd=new Date(); if(it.pubDate){ const d=new Date(it.pubDate); if(!isNaN(d.getTime())) pd=d; } return {title:(it.title||'Nieuwsbrief').slice(0,120), link:it.link||'https://nieuwommen.leeuw008.nl/', pubDate:pd, description:(it.description||it.title||'').slice(0,200)+' [...]', source:'Nieuwsbrief', id:'Nieuwsbrief'}; }).slice(0,10); }catch{ return []; } }
function parseRSS(xml){ const items=[...xml.matchAll(/<item[^>]*>([\s\S]*?)<\/item>/gi)].slice(0,25); return items.map(m=>{ const it=m[1]; const title=(it.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i)||[])[1]||''; let link=(it.match(/<link[^>]*>([\s\S]*?)<\/link>/i)||[])[1]||''; link=link.replace(/<!\[CDATA\[|\]\]>/g,'').trim(); if(!link.startsWith('http')){ const mm=it.match(/https?:\/\/[^\s<"]+/); if(mm) link=mm[0]; } const desc=(it.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i)||[])[1]||''; const pub=(it.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)||[])[1]||''; let pd=new Date(); if(pub){ const d=new Date(pub); if(!isNaN(d.getTime())) pd=d; } return {title:title.replace(/<[^>]*>/g,'').trim().slice(0,120), link, pubDate:pd, description:desc.replace(/<[^>]*>/g,' ').trim().slice(0,200)+' [...]'}; }).filter(x=>x.link && x.title); }

const GEMEENTE_PLAATSEN = ['Ommen','Lemele','Vilsteren','Beerze','Beerzerveld','Witharen','Archem','Arriën','Arriërveld','Besthmen','Dalmsholte','Eerde','Emsland','Giethmen','Hoogengraven','Junne','Nieuwebrug','Ommerbosch','Ommerkanaal','Ommerschans','Ommerveld','Rotbrink','Stegeren','Stegerveld','Varsen','Vinkenbuurt','Zeesse','Stegeren','Beerzerpoort','Ommerschans'];
const GEMEENTE_ZOEK = GEMEENTE_PLAATSEN.map(p=>p.toLowerCase());
function isGemeenteArtikel(art){ const txt = (art.title + ' ' + (art.description||'')).toLowerCase(); return GEMEENTE_ZOEK.some(pl => txt.includes(pl)); }

(function injectStyles(){
  const css = `.source-led{width:12px;height:12px;border-radius:999px;display:block}.source-led.loading{background:#ef4444;animation:pulse-red 1.2s infinite}.source-led.ok{background:#16a34a}.source-led.fail{background:#ef4444}.source-led.empty{background:#f59e0b}@keyframes pulse-red{0%{transform:scale(1)}50%{transform:scale(1.25)}100%{transform:scale(1)}}.source-row[data-id="Nieuwsbrief"]{background:linear-gradient(90deg,#f0fdf4 0%,#fff 100%);border-left:3px solid #16a34a;}.source-row[data-id="Nieuwsbrief"] .source-name span:first-child{font-weight:800;} .push-highlight-banner{background:linear-gradient(90deg,#16a34a 0%,#15803d 100%);color:white;padding:10px 16px;border-radius:8px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:13px;font-weight:600;} .btn-overview{background:white;color:#16a34a;border:0;padding:8px 14px;border-radius:999px;font-weight:700;font-size:12px;cursor:pointer;} .article.highlighted-push{outline:3px solid #16a34a!important;outline-offset:3px;border:2px solid #16a34a!important;background:linear-gradient(90deg,#f0fdf4 0%,#fff 100%)!important;}`;
  const el=document.createElement('style'); el.id='v304-style'; el.textContent=css; if(!document.getElementById('v304-style')) document.head.appendChild(el);
})();
function updateSourceLeds(){ BRONNEN.forEach(b=>{ const led=document.querySelector(`.source-led[data-id="${b.id}"]`); if(!led) return; const realArts = allArticles.filter(a=>a.id===b.id && !a.isFallback); const isLoaded = loadedSources.has(b.id); led.className='source-led '+( !isLoaded?'loading' : realArts.length>0?'ok' : allArticles.some(a=>a.id===b.id && a.isFallback)?'fail':'empty'); }); }
function loadState(){ try{ const v2=localStorage.getItem('nieuwsommen_bronnen_v2'); if(v2){ let p=JSON.parse(v2); if(Array.isArray(p)){ const ns={}; BRONNEN.forEach(b=>{ ns[b.id]={aan:p.includes(b.id), vandaag:false, scope:'gemeente'}; }); state=ns; } else state=p; BRONNEN.forEach(b=>{ if(!state[b.id]) state[b.id]={aan:true,vandaag:false,scope:'gemeente'}; }); } else BRONNEN.forEach(b=> state[b.id]={aan:true,vandaag:false,scope:'gemeente'}); }catch{ BRONNEN.forEach(b=> state[b.id]={aan:true,vandaag:false,scope:'gemeente'}); } }
function saveState(){ localStorage.setItem('nieuwsommen_bronnen_v2', JSON.stringify(state)); updateHiddenCompat(); updateHeaderCount(); }
function updateHiddenCompat(){ const cont=document.getElementById('compat-sources'); if(!cont) return; cont.innerHTML=''; BRONNEN.forEach(b=>{ const s=state[b.id]||{aan:true}; let cb=document.createElement('input'); cb.type='checkbox'; cb.className='source-filter'; cb.value=b.id; cb.checked=s.aan; cb.dataset.source=b.id; cont.appendChild(cb); cb.dispatchEvent(new Event('change',{bubbles:true})); }); }
function renderFilters(){
  const list=document.getElementById('source-list'); if(!list) return; list.innerHTML='';
  BRONNEN.forEach(b=>{
    const s=state[b.id]||{aan:true,vandaag:false,scope:'gemeente'}; const row=document.createElement('div'); row.className='source-row'+(s.aan?'':' off'); row.dataset.id=b.id; const scopeIsGemeente=s.scope==='gemeente'; const allForBron=allArticles.filter(a=>a.id===b.id && !a.isFallback); const loadedCount=allForBron.length; let selectedCount=allForBron.length; if(s.vandaag){ const today=new Date(); selectedCount=allForBron.filter(a=>a.pubDate && isSameDay(a.pubDate,today)).length; } if(s.scope==='gemeente'){ selectedCount=allForBron.filter(a=>isGemeenteArtikel(a)).length; } const isNieuwsbrief=b.id==='Nieuwsbrief'; row.innerHTML=`<div style="display:flex;align-items:center;gap:8px;flex:1;"><div style="display:flex;flex-direction:column;flex:1;"><div style="display:flex;align-items:center;gap:8px;"><span style="flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${isNieuwsbrief?'📰 ':''}${b.name}</span><span class="source-led loading" data-id="${b.id}" style="width:12px;height:12px;border-radius:999px;background:#ef4444;display:block;"></span><span style="font-size:11px;font-weight:700;background:#f3f4f6;padding:2px 7px;border-radius:99px;min-width:52px;text-align:center;">${loadedCount} / ${selectedCount}</span></div><div class="source-sub">${b.sub}</div></div></div><div class="toggles"><div class="toggle-col"><label class="mini-switch ${s.vandaag?'checked':''}"><input type="checkbox" ${s.vandaag?'checked':''} data-type="vandaag" data-id="${b.id}"><span class="mini-slider"></span></label><span class="mini-label">${s.vandaag?'VANDAAG':'MEER'}</span></div><div class="toggle-col"><label class="mini-switch ${scopeIsGemeente?'checked':''}" style="background:${scopeIsGemeente?'#0b5bd3':'#7c3aed'}"><input type="checkbox" ${scopeIsGemeente?'checked':''} data-type="scope" data-id="${b.id}"><span class="mini-slider"></span></label><span class="mini-label">${scopeIsGemeente?'GEMEENTE':'REGIO'}</span></div><div class="toggle-col"><label class="mini-switch ${s.aan?'checked':''}"><input type="checkbox" ${s.aan?'checked':''} data-type="aan" data-id="${b.id}"><span class="mini-slider"></span></label><span class="mini-label">${s.aan?'AAN':'UIT'}</span></div></div>`;
    list.appendChild(row);
  });
  list.querySelectorAll('input').forEach(inp=>{ inp.addEventListener('change',e=>{ const id=e.target.dataset.id; const type=e.target.dataset.type; if(!state[id]) state[id]={aan:true,vandaag:false,scope:'gemeente'}; if(type==='vandaag') state[id].vandaag=e.target.checked; if(type==='scope') state[id].scope=e.target.checked?'gemeente':'regio'; if(type==='aan') state[id].aan=e.target.checked; saveState(); renderFilters(); filterNews(); }); });
}
function updateHeaderCount(){ const aan=Object.values(state).filter(s=>s.aan).length; const el=document.getElementById('header-count'); if(el) el.textContent=`${loadedSources.size||aan} v/d ${BRONNEN.length} bronnen`; }
function openPanel(){ document.getElementById('filter-header')?.classList.add('open'); document.getElementById('source-panel')?.classList.add('open'); document.body.classList.add('panel-open'); try{ localStorage.setItem('ommen_filter_panel_open','1'); }catch{} }
function closePanel(){ document.getElementById('filter-header')?.classList.remove('open'); document.getElementById('source-panel')?.classList.remove('open'); document.body.classList.remove('panel-open'); try{ localStorage.setItem('ommen_filter_panel_open','0'); }catch{} }
// v304 FIX: panel open by default, en blijft open na refresh
function restorePanelState(){ 
  try{ 
    const open = localStorage.getItem('ommen_filter_panel_open'); 
    // v304: als nog geen waarde, default OPEN (was dicht)
    if(open===null){ openPanel(); return; }
    if(open==='1'){ openPanel(); } else { closePanel(); } 
  }catch{ 
    openPanel(); // default open bij error
  } 
}
function resetFilters(){ BRONNEN.forEach(b=>state[b.id]={aan:true,vandaag:false,scope:'gemeente'}); saveState(); renderFilters(); filterNews(); }
function setupFilterHeader(){ const fh=document.getElementById('filter-header'); if(!fh) return; fh.addEventListener('click',e=>{ if(e.target.closest('#bell-slot')) return; if(e.target.id==='btn-all' || e.target.closest('#btn-all')){ e.stopPropagation(); const allOn=Object.values(state).every(s=>s.aan); BRONNEN.forEach(b=>state[b.id].aan=!allOn); saveState(); renderFilters(); filterNews(); return; } const p=document.getElementById('source-panel'); if(p.classList.contains('open')) closePanel(); else openPanel(); }); }

const WORKER='https://ommen-push-v2.leeuw008.workers.dev';
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
    if(t.length<150) throw new Error('proxy empty len '+t.length); putCachedSource(url, t); return t;
  }catch(e1){
    clearTimeout(to);
    if(url.includes('/newsletter/feed')){
      try{ const r2 = await fetch(url, {cache:'no-store'}); if(r2.ok){ const t2 = await r2.text(); if(t2.length>10){ putCachedSource(url, t2); return t2; } } }catch{}
    }
    try{ const r2 = await fetch(url, {cache:'no-store'}); if(r2.ok){ const t2 = await r2.text(); if(t2.length>500){ putCachedSource(url, t2); return t2; } } }catch(e2){}
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
    if(b.id==='Nieuwsbrief'){ const json=await fetchViaWorker(cfg.url); arts=parseNieuwsbrief(json); }
    else if(cfg.type==='gemeente'){ const html=await fetchViaWorker(cfg.url); arts=parseGemeenteOverviewV304(html); }
    else if(cfg.type==='oost'){ const html=await fetchViaWorker(cfg.url); arts=parseRSS(html); }
    else { const xml=await fetchViaWorker(cfg.url); arts=parseRSS(xml); }
    if(arts.length===0) throw new Error('empty'); return arts.map(a=>({...a, source:b.name, id:b.id, isFallback:false}));
  }catch(e){ return [{title:b.name, link:cfg.homepage, pubDate:new Date(0), description:'Bron tijdelijk offline', source:b.name, id:b.id, isFallback:true}]; }
}
function isSameDay(d1,d2){ if(!d1 || !d2 || isNaN(d1.getTime()) || isNaN(d2.getTime())) return false; return d1.getFullYear()===d2.getFullYear() && d1.getMonth()===d2.getMonth() && d1.getDate()===d2.getDate(); }
function formatDate(d){ if(!d || isNaN(d.getTime()) || d.getTime()===0) return ''; return d.toLocaleDateString('nl-NL',{day:'numeric', month:'short'})+' '+d.toLocaleTimeString('nl-NL',{hour:'2-digit', minute:'2-digit'}); }
function getHighlightFromUrl(){ try{ const params=new URLSearchParams(window.location.search); const hl=params.get('highlight'); if(hl) return {link:decodeURIComponent(hl), fromPush:params.get('fromPush')==='1', title:params.get('pushTitle')?decodeURIComponent(params.get('pushTitle')):null, source:params.get('pushSource')?decodeURIComponent(params.get('pushSource')):null}; const stored=localStorage.getItem('ommen_highlight_link'); if(stored) return {link:stored, fromPush:localStorage.getItem('ommen_from_push')==='1'}; }catch{} return null; }
function clearHighlight(){ try{ localStorage.removeItem('ommen_highlight_link'); localStorage.removeItem('ommen_from_push'); const url=new URL(window.location); ['highlight','fromPush','pushTitle','pushSource','externalLink'].forEach(k=>url.searchParams.delete(k)); window.history.replaceState({},'',url.pathname+url.search); }catch{} renderArticles(); }
function renderArticles(){
  const container=document.getElementById('news-container'); if(!container) return;
  const search = (document.getElementById('search-input')?.value||'').toLowerCase();
  const today = new Date();
  let filtered = allArticles.filter(a=>{ const s=state[a.id]; if(!s || !s.aan) return false; if(s.vandaag){ if(a.isFallback) return false; if(!a.pubDate || isNaN(a.pubDate.getTime())) return false; if(!isSameDay(a.pubDate, today)) return false; } if(s.scope==='gemeente'){ if(!isGemeenteArtikel(a)) return false; } return true; });
  if(search) filtered = filtered.filter(a=> (a.title+' '+a.description+' '+a.source).toLowerCase().includes(search));
  filtered = filtered.sort((a,b)=>b.pubDate - a.pubDate);
  const highlightInfo=getHighlightFromUrl();
  let bannerHtml=''; let highlightedHtml='';
  if(highlightInfo && highlightInfo.fromPush){
    let highlightedArticle=filtered.find(a=> a.link===highlightInfo.link) || allArticles.find(a=> a.link===highlightInfo.link);
    if(!highlightedArticle){ const pushTitle=highlightInfo.title||'Nieuw artikel via push'; highlightedArticle={title:pushTitle, link:highlightInfo.link, pubDate:new Date(), description:'Dit artikel is via push melding geopend.', source:highlightInfo.source||'Via push', id:'highlighted'}; }
    if(highlightedArticle){
      bannerHtml=`<div class="push-highlight-banner"><div>🔔 Artikel via push melding</div><button class="btn-overview" onclick="clearHighlight()">📋 Terug naar overzicht</button></div>`;
      highlightedHtml=`<div class="article highlighted-push"><div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;"><span style="background:#16a34a;color:white;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;">NIEUW via push</span><small style="color:#16a34a;font-weight:600;">${highlightedArticle.source}</small></div><h2><a href="${highlightedArticle.link}" target="_blank">${highlightedArticle.title}</a></h2><small>${highlightedArticle.source} - ${formatDate(highlightedArticle.pubDate)}</small><div style="margin-top:8px;color:#374151;">${highlightedArticle.description}</div><div style="margin-top:12px;display:flex;gap:8px;"><a href="${highlightedArticle.link}" target="_blank" style="background:#16a34a;color:white;padding:8px 16px;border-radius:8px;text-decoration:none;font-weight:600;font-size:13px;">📖 Lees volledig artikel</a><button class="btn-overview" style="border:1px solid #d1d5db;background:white;color:#374151;" onclick="clearHighlight()">📋 Alle artikelen</button></div></div>`;
      filtered=filtered.filter(a=> a.link !== highlightedArticle.link);
    }
  }
  const realCount = filtered.filter(a=>!a.isFallback).length; const countHtml = `<div class="articles-count">${realCount} artikelen - ${loadedSources.size} v/d ${BRONNEN.length} bronnen geladen</div>`;
  if(filtered.length===0 && !highlightedHtml){ container.innerHTML = countHtml + '<div class="article">Geen artikelen - zet filter op MEER of REGIO</div>'; return; }
  const html = filtered.map(a=>{
    const cleanTitle = a.title.replace(/^\[[^\]]+\]\s*/,'').trim() || a.title;
    if(a.isFallback){ return `<div class="article fallback" data-source="${a.id}"><h2><a href="${a.link}" target="_blank">${a.source}</a></h2><small>${a.source}</small><div style="margin-top:6px;color:#666;">${a.description}</div></div>`; }
    return `<div class="article" data-source="${a.id}" data-link="${a.link}"><h2><a href="${a.link}" target="_blank">${cleanTitle}</a></h2><small>${a.source} - ${formatDate(a.pubDate)}</small><div style="margin-top:6px;color:#555;">${a.description}</div></div>`;
  }).join('');
  container.innerHTML = bannerHtml + countHtml + highlightedHtml + html;
}
function filterNews(){ renderArticles(); }
async function refreshNews(){
  const c=document.getElementById('news-container'); let hasStale=false; const initialArts=[];
  try{ for(const b of BRONNEN){ const cfg=BRON_URLS[b.id]; const cachedData=getCachedSource(cfg.url) || getStaleSource(cfg.url); if(cachedData){ try{ let arts=[]; if(b.id==='Nieuwsbrief'){ arts=parseNieuwsbrief(cachedData); } else if(cfg.type==='gemeente') arts=parseGemeenteOverviewV304(cachedData); else arts=parseRSS(cachedData); if(arts.length>0){ initialArts.push(...arts.map(a=>({...a, source:b.name, id:b.id, isFallback:false}))); hasStale=true; } }catch(e){} } } }catch(e){}
  if(hasStale && initialArts.length>0){ allArticles=initialArts; loadedSources=new Set(BRONNEN.map(b=>b.id)); updateHeaderCount(); renderArticles(); renderFilters(); updateSourceLeds(); }
  else { if(c) c.innerHTML='<div class="article">Bezig met laden... (10 bronnen)</div>'; allArticles=[]; loadedSources=new Set(); updateHeaderCount(); }
  const loadWithTimeout = async (b) => { try { const timeout = new Promise((_,rej)=> setTimeout(()=>rej(new Error('timeout '+b.id)), 10000)); const arts = await Promise.race([loadOneSource(b), timeout]); return {b, arts}; } catch(e){ if(hasStale) return {b, arts:[]}; return {b, arts:[{title:b.name, link:BRON_URLS[b.id].homepage, pubDate:new Date(0), description:'Bron tijdelijk offline', source:b.name, id:b.id, isFallback:true}]}; } };
  const results = await Promise.allSettled(BRONNEN.map(b=>loadWithTimeout(b))); const freshArts=[]; results.forEach(r=>{ if(r.status==='fulfilled'){ const {b, arts}=r.value; if(arts.length>0) freshArts.push(...arts); loadedSources.add(b.id); } }); if(freshArts.length>0) allArticles=freshArts; updateHeaderCount(); renderArticles(); renderFilters(); updateSourceLeds();
}
document.addEventListener('DOMContentLoaded', ()=>{
  loadState(); renderFilters(); saveState(); 
  restorePanelState(); // v304 FIX: blijft open na refresh
  setupFilterHeader();
  document.getElementById('search-input')?.addEventListener('input', filterNews);
  const urlParams = new URLSearchParams(window.location.search); const highlightParam = urlParams.get('highlight'); if(highlightParam){ localStorage.setItem('ommen_highlight_link', highlightParam); localStorage.setItem('ommen_from_push','1'); }
  setTimeout(()=>refreshNews(), 200);
  if('serviceWorker' in navigator){
    navigator.serviceWorker.addEventListener('message', event=>{
      if(event.data && event.data.type==='PUSH_CLICKED'){ const link = event.data.link || event.data.url; if(link){ localStorage.setItem('ommen_highlight_link', link); localStorage.setItem('ommen_from_push','1'); renderArticles(); } }
    });
  }
  console.log('[v304] Loaded - filter panel open by default, Gemeente fix, cache cleared');
});
window.clearHighlight=clearHighlight; window.closePanel=closePanel; window.resetFilters=resetFilters; window.BRONNEN=BRONNEN;
window.filterNews=filterNews; window.refreshNews=refreshNews;
window.openPanel=openPanel; // v304 expose for manual open
