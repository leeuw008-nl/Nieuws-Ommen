// app.js v227 - FIX Gemeente filter hersteld + FILTER BRIDGE voor SW v231
// Gebaseerd op v226 + toegevoegd: SW kan filters opvragen voor notificatie filtering
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
];
const MAX_PER_BRON = {'De Stentor':25,'RondOmmen':20,'Ommen City':10,'OudOmmen':10,'Vechtdal Centraal':10,'Natuurlijk Ommen':10,'Gemeente Ommen':10,'RTV Oost':10,'RTV Vechtdal':10};
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
};
// PLAATSEN FILTER - HERSTELD: alle kernen en buurtschappen gemeente Ommen

// ===== v238 DEFINITIEF - ECHTE HTML PARSERS =====
function parseVechtdalCentraalECHT(html){
  const items=[]; const seen=new Set();
  let re=/<h3 class="entry-title[^>]*>\s*<a href="([^"]+)"[^>]*>([^<]+)<\/a>/gi; let m;
  while((m=re.exec(html))!==null && items.length<25){
    let link=m[1]; if(link.startsWith('/')) link='https://www.vechtdalcentraal.nl'+link;
    if(seen.has(link)) continue; seen.add(link);
    const title=m[2].replace(/&#8217;/g,"'").replace(/&amp;/g,"&").trim();
    if(title.length>4) items.push({title, link, pubDate:new Date(), description:title+' [...]'});
  }
  return items;
}
function getVechtdalCache(){try{return JSON.parse(localStorage.getItem('ommen_vechtdal_poll')||'{}');}catch{return {};}}
function setVechtdalCache(c){try{localStorage.setItem('ommen_vechtdal_poll',JSON.stringify(c));}catch{}}
function parseRTVVechtdalECHT(html){
  const items=[];
  const now = new Date(); const pollCache=getVechtdalCache(); let dirty=false; const pollingMoment=now;
  const today = new Date();
  today.setHours(0,0,0,0);
  const reFull=/<div class="allmode_date">([^<]+)<\/div>[\s\S]{0,600}?<h3 class="allmode_title"><a href="([^"]+)">([^<]+)<\/a>[\s\S]{0,800}?<div class="allmode_(?:intro|text|introtext)[^>]*>([\s\S]*?)<\/div>/gi;
  let m;
  while((m=reFull.exec(html))!==null && items.length<20){
    const dparts=m[1].split('-'); 
    let pd=null;
    let isToday=false;
    if(dparts.length===3){
      const d = new Date(parseInt(dparts[2]), parseInt(dparts[1])-1, parseInt(dparts[0]), 0,0,0);
      const dMidnight = new Date(d); dMidnight.setHours(0,0,0,0);
      isToday = dMidnight.getTime() === today.getTime();
      if(isToday){
        pd = new Date(pollingMoment);
      }else{
        pd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0,0,0);
      }
    }else{
      pd = new Date(pollingMoment);
    }
    let link=m[2].replace(/&amp;/g,'&'); if(!link.startsWith('http')) link='https://www.rtvvechtdal.nl'+link;
    let intro=m[4].replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
    if(intro.length>200) intro=intro.slice(0,200)+' [...]'; else if(intro) intro=intro+' [...]'; else intro=m[3].trim()+' [...]';
    if(pollCache[link]==null){pollCache[link]=pd.toISOString(); dirty=true;} else if(pd.getHours()!=0 || pd.getMinutes()!=0){pd=new Date(pollCache[link]);} if(dirty) setVechtdalCache(pollCache); items.push({title:m[3].trim(), link, pubDate:pd, description:intro});
  }
  if(items.length===0){
    const re=/<div class="allmode_date">([^<]+)<\/div>[\s\S]{0,500}?<h3 class="allmode_title"><a href="([^"]+)">([^<]+)<\/a>/gi;
    while((m=re.exec(html))!==null && items.length<15){
      const dparts=m[1].split('-'); 
      let pd=null;
      let isToday=false;
      if(dparts.length===3){
        const d = new Date(parseInt(dparts[2]), parseInt(dparts[1])-1, parseInt(dparts[0]), 0,0,0);
        const dMidnight = new Date(d); dMidnight.setHours(0,0,0,0);
        isToday = dMidnight.getTime() === today.getTime();
        if(isToday){
          pd = new Date(pollingMoment);
        }else{
          pd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0,0,0);
        }
      }else{
        pd = new Date(pollingMoment);
      }
      let link=m[2].replace(/&amp;/g,'&'); if(!link.startsWith('http')) link='https://www.rtvvechtdal.nl'+link;
      items.push({title:m[3].trim(), link, pubDate:pd, description:m[3].trim()+' [...]'});
    }
  }
  return items;
}

async function enrichVechtdalWithDetail(arts){
  console.log('[v228] RTV Vechtdal enrich DISABLED - polling moment gebruikt, geen extra fetches');
  return arts;
}


function getOostPollCache(){try{return JSON.parse(localStorage.getItem('ommen_oost_poll')||'{}');}catch{return {};}}
function setOostPollCache(c){try{localStorage.setItem('ommen_oost_poll', JSON.stringify(c));}catch{}}
function parseRTVOostECHT(html){
  const items=[]; let m;
  console.log('[RTV Oost vechtdal] HTML len', html.length);
  const reReal = /<div[^>]*publishedAt=["']([^"']+)["'][^>]*>[\s\S]*?<a[^>]+href=["'](\/nieuws\/(?!zwolle|twente|enschede|vechtdal|salland|kop-van-overijssel)[^"']{10,150})["'][^>]*>[\s\S]*?<div[^>]*class="[^"]*name-label[^"]*"[^>]*>([^<]{2,20})<\/div>[\s\S]*?<h3[^>]*>([^<]{12,200})<\/h3>/gi;
  while((m=reReal.exec(html))!==null && items.length<25){
    let dateStr=m[1]; let link=m[2]; if(link.startsWith('/')) link='https://www.oost.nl'+link;
    let category=m[3].trim().toUpperCase(); let title=m[4].trim();
    if(['ALLE NIEUWS','ZWOLLE','TWENTE'].includes(title.toUpperCase())) continue;
    let pd=new Date(dateStr); if(isNaN(pd.getTime())) pd=new Date();
    let finalTitle = ['NIEUWS','112','ECONOMIE','SPORT'].includes(category) ? category+': '+title : title;
    if(!items.find(x=>x.link===link)) items.push({title:finalTitle, link, pubDate:pd, description:title+' [...]'});
  }
  if(items.length===0){
    const re2 = /<div[^>]*publishedAt=["']([^"']+)["'][^>]*>[\s\S]*?<a[^>]+href=["'](\/nieuws\/[^"']{10,150})["'][^>]*>[\s\S]*?<h3[^>]*>([^<]{12,200})<\/h3>/gi;
    while((m=re2.exec(html))!==null && items.length<25){
      let dateStr=m[1]; let link=m[2]; if(link.startsWith('/')) link='https://www.oost.nl'+link;
      let title=m[3].trim(); if(title.toLowerCase().includes('alle nieuws')) continue;
      let pd=new Date(dateStr); if(isNaN(pd.getTime())) continue;
      if(!items.find(x=>x.link===link)) items.push({title, link, pubDate:pd, description:title+' [...]'});
    }
  }
  if(items.length>0){ items.sort((a,b)=>b.pubDate-a.pubDate); console.log('[RTV Oost] gevonden', items.length, 'met echte publishedAt'); return items; }
  const pollCache=getOostPollCache(); let dirty=false; const now=new Date();
  function getPoll(link){ if(pollCache[link]){const d=new Date(pollCache[link]); if(!isNaN(d.getTime())) return d;} const d=new Date(now); pollCache[link]=d.toISOString(); dirty=true; return d; }
  const reBlock = /<a[^>]+href=["'](\/nieuws\/(?!zwolle|twente|enschede|vechtdal|salland|kop-van-overijssel)[^"']{10,150})["'][^>]*>([\s\S]*?)<\/a>/gi;
  let blockMatch; while((blockMatch=reBlock.exec(html))!==null && items.length<20){
    let link=blockMatch[1]; if(link.startsWith('/')) link='https://www.oost.nl'+link;
    let inner=blockMatch[2]; let catMatch=inner.match(/<(?:span|div)[^>]*>\s*(NIEUWS|112|ECONOMIE|SPORT)\s*<\/(?:span|div)>/i); let category=catMatch?catMatch[1].toUpperCase():''; let titleMatch=inner.match(/<h[23][^>]*>([^<]{12,180})<\/h[23]>/i); let title=titleMatch?titleMatch[1].trim():''; if(!title||title.length<12) continue;
    if(['alle nieuws','zwolle','twente','enschede','vechtdal','salland','kop van overijssel'].includes(title.toLowerCase())) continue;
    let finalTitle=category?category+': '+title:title;
    if(!items.find(x=>x.link===link)) items.push({title:finalTitle, link, pubDate:getPoll(link), description:title+' [...]'});
  }
  if(dirty) setOostPollCache(pollCache);
  items.sort((a,b)=>b.pubDate-a.pubDate);
  console.log('[RTV Oost] gevonden', items.length, 'met fallback');
  return items;
}

function parseOostFull_OLD(html){
  const max = MAX_PER_BRON['RTV Oost'];
  const patterns = [
    /<a[^>]+href=["'](\/nieuws\/[^"']*ommen[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi,
    /<a[^>]+href=["'](https:\/\/www\.oost\.nl\/nieuws\/[^"']*ommen[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi,
  ];
  const uniqMap=new Map();
  for(const re of patterns){
    let mm;
    while((mm=re.exec(html))!==null && uniqMap.size<max){
      const href=mm[1]; let text=mm[2].replace(/<[^>]*>/g,'').trim();
      if(text.length<10 || text.length>200) continue;
      const full=href.startsWith('http')?href:'https://www.rtvoost.nl'+href;
      if(!uniqMap.has(full)) uniqMap.set(full, text);
    }
  }
  return Array.from(uniqMap.entries()).slice(0,max).map(([link,title])=>({title:title.slice(0,120), link, pubDate:new Date(), description:'[...]'}));
}
function parseVechtdalCentraalFallback_OLD(html){
  const max = MAX_PER_BRON['Vechtdal Centraal'];
  const re = /<a[^>]+href=["']([^"']*\/[^"']+)["'][^>]*>\s*<h[23][^>]*>([^<]{8,120})<\/h[23]>/gi;
  const map=new Map();
  let m;
  while((m=re.exec(html))!==null && map.size<max){
    let href=m[1], title=m[2].trim();
    if(href.startsWith('/')) href='https://www.vechtdalcentraal.nl'+href;
    if(!href.includes('vechtdalcentraal.nl')) continue;
    if(href.includes('/category/') || href.includes('/tag/') || href.includes('#')) continue;
    if(!map.has(href)) map.set(href, title);
  }
  return Array.from(map.entries()).slice(0,max).map(([link,title])=>({title, link, pubDate:new Date(), description:'[...]'}));
}
function parseOostFull(html){
  const echt = parseRTVOostECHT(html);
  if(echt.length>0) return echt;
  return parseOostFull_OLD(html);
}
function parseVechtdalCentraalFallback(html){
  const echt = parseVechtdalCentraalECHT(html);
  if(echt.length>0) return echt;
  return parseVechtdalCentraalFallback_OLD(html);
}
function parseRTVVechtdalFull(html){
  return parseRTVVechtdalECHT(html);
}


const GEMEENTE_PLAATSEN = [
  'Ommen','Lemele','Vilsteren','Beerze','Beerzerveld','Witharen','Archem','Arriën','Arriërveld',
  'Besthmen','Dalmsholte','Eerde','Emsland','Giethmen','Hoogengraven','Junne','Nieuwebrug',
  'Ommerbosch','Ommerkanaal','Ommerschans','Ommerveld','Rotbrink','Stegeren','Stegerveld',
  'Varsen','Vinkenbuurt','Zeesse','Stegeren','Beerzerpoort','Ommerschans'
];
const GEMEENTE_ZOEK = GEMEENTE_PLAATSEN.map(p=>p.toLowerCase());

function isGemeenteArtikel(art){
  const txt = (art.title + ' ' + (art.description||'')).toLowerCase();
  return GEMEENTE_ZOEK.some(pl => txt.includes(pl));
}

let state = {}; let allArticles = []; let loadedSources = new Set();
function loadState(){
  try{
    const v2 = localStorage.getItem('nieuwsommen_bronnen_v2');
    if(v2){ state = JSON.parse(v2); BRONNEN.forEach(b=>{ if(!state[b.id]) state[b.id]={aan:true, vandaag:false, scope:'gemeente'}; }); }
    else { BRONNEN.forEach(b=> state[b.id] = {aan:true, vandaag:false, scope:'gemeente'}); }
  }catch(e){ BRONNEN.forEach(b=> state[b.id]={aan:true,vandaag:false,scope:'gemeente'}); }
}
function saveState(){
  localStorage.setItem('nieuwsommen_bronnen_v2', JSON.stringify(state));
  updateHiddenCompat(); updateHeaderCount();
  if(window.updatePushBell) window.updatePushBell();
  // v227 - push filters naar SW voor notificatie filtering
  try{
    if(window.pushFiltersToSW) window.pushFiltersToSW();
  }catch(e){}
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
    const row = document.createElement('div');
    row.className='source-row'+(s.aan?'':' off');
    const scopeIsGemeente = s.scope==='gemeente';
    row.innerHTML = `<div class="source-meta"><div class="source-name">${b.name}</div><div class="source-sub">${b.sub}</div></div>
      <div class="toggles">
        <div class="toggle-col"><label class="mini-switch vandaag ${s.vandaag?'checked':''}"><input type="checkbox" ${s.vandaag?'checked':''} data-type="vandaag" data-id="${b.id}"><span class="mini-slider"></span></label><span class="mini-label">${s.vandaag?'VANDAAG':'MEER'}</span></div>
        <div class="toggle-col"><label class="mini-switch ${scopeIsGemeente?'checked':''} ${scopeIsGemeente?'scope-gemeente':'scope-regio'}" style="background:${scopeIsGemeente?'#0b5bd3':'#7c3aed'}"><input type="checkbox" ${scopeIsGemeente?'checked':''} data-type="scope" data-id="${b.id}"><span class="mini-slider"></span></label><span class="mini-label">${scopeIsGemeente?'GEMEENTE':'REGIO'}</span></div>
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
function setupFilterHeader(){
  const fh = document.getElementById('filter-header'); if(!fh) return;
  fh.addEventListener('click', (e)=>{
    if(e.target.closest('#bell-slot') || e.target.closest('#push-bell-btn')) return;
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
const WORKER = 'https://ommen-push-v2.leeuw008.workers.dev';
// PERFORMANCE OPTIMALISATIE v2 - zonder RTV Oost te breken
// - cache 5 min, stale-while-revalidate
// - timeout 6s ipv 9s, max 1 fallback ipv 3
// - geen rss2json extra call voor VC/Oost (was 1-2 sec extra)
const SOURCE_CACHE_TTL = 1000 * 60 * 5; // 5 minuten
const SOURCE_CACHE_KEY = 'ommen_source_cache_v1';
function getSourceCache(){ try{return JSON.parse(localStorage.getItem(SOURCE_CACHE_KEY)||'{}');}catch{return {};}}
function setSourceCache(cache){ try{localStorage.setItem(SOURCE_CACHE_KEY, JSON.stringify(cache));}catch{}}
function getCachedSource(url){
  const cache=getSourceCache();
  const entry=cache[url];
  if(!entry) return null;
  if(Date.now() - entry.ts > SOURCE_CACHE_TTL) return null; // expired, maar we gebruiken hem wel als stale
  return entry.data;
}
function getStaleSource(url){
  const cache=getSourceCache();
  const entry=cache[url];
  if(!entry) return null;
  // stale mag tot 60 min oud zijn voor directe weergave
  if(Date.now() - entry.ts > 1000*60*60) return null;
  return entry.data;
}
function putCachedSource(url, data){
  if(!data || data.length<200) return;
  const cache=getSourceCache();
  cache[url]={data, ts:Date.now()};
  // max 20 entries
  const keys=Object.keys(cache);
  if(keys.length>20){ const oldest=keys.sort((a,b)=>cache[a].ts-cache[b].ts)[0]; delete cache[oldest]; }
  setSourceCache(cache);
}
async function fetchViaWorker(url){
  // 1. Probeer cache eerst voor snelle stale check (wordt in loadOneSource afgehandeld)
  const controller = new AbortController();
  const to = setTimeout(()=>controller.abort(), 6000);
  try{
    const r = await fetch(`${WORKER}/proxy?url=${encodeURIComponent(url)}&t=${Date.now()}`, {cache:'no-store', signal:controller.signal});
    clearTimeout(to);
    if(!r.ok) throw new Error('proxy fail '+r.status);
    const t = await r.text();
    if(t.length<150) throw new Error('proxy empty len '+t.length);
    if(t.includes('Proxy blocked')||t.includes('Proxy error')||t.startsWith('Proxy err')) throw new Error(t.slice(0,200));
    if(t.includes('<title>Just a moment</title>')||t.includes('Attention Required')) throw new Error('cf challenge');
    putCachedSource(url, t);
    return t;
  }catch(e1){
    clearTimeout(to);
    console.log('[perf] worker fail, 1 fallback', url, e1.message);
    // Alleen 1 snelle fallback, geen 3 trage achter elkaar
    try{
      const ctrl2=new AbortController();
      const to2=setTimeout(()=>ctrl2.abort(), 5000);
      const fallbackUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}&t=${Date.now()}`;
      const r2 = await fetch(fallbackUrl, {cache:'no-store', signal:ctrl2.signal});
      clearTimeout(to2);
      if(r2.ok){
        const j = await r2.json();
        if(j.contents && j.contents.length>200) {
          putCachedSource(url, j.contents);
          console.log('[perf] fallback allorigins OK', url);
          return j.contents;
        }
      }
    }catch(e2){ console.log('[perf] allorigins fail', e2.message); }
    throw e1;
  }
}
function parseRSSFull(xml, bronId){
  const max = MAX_PER_BRON[bronId] || 10;
  let items = [...xml.matchAll(/<item[^>]*>([\s\S]*?)<\/item>/gi)];
  if(items.length===0) items = [...xml.matchAll(/<entry[^>]*>([\s\S]*?)<\/entry>/gi)];
  items = items.slice(0,max);
  return items.map(m=>{
    const it=m[0];
    let title=(it.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i)||[])[1]||'';
    title=title.replace(/<[^>]*>/g,'').trim();
    let link=(it.match(/<link[^>]*>([\s\S]*?)<\/link>/i)||[])[1]||'';
    if(!link || link.includes('<')) {
      const hrefMatch = it.match(/<link[^>]+href=["']([^"']+)["']/i);
      if(hrefMatch) link=hrefMatch[1];
    }
    link=link.replace(/<!\[CDATA\[/g,'').replace(/\]\]>/g,'').trim();
    if(!link.startsWith('http')){ const mm=it.match(/https?:\/\/[^\s<"\]]+/); if(mm) link=mm[0]; }
    let pub=(it.match(/<(pubDate|published|updated)[^>]*>([\s\S]*?)<\/(pubDate|published|updated)>/i)||[])[2]||'';
    let desc=(it.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i)||[])[1]||'';
    let content=(it.match(/<content:encoded[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/content:encoded>/i)||[])[1]||'';
    if(!desc) {
      const summ = (it.match(/<summary[^>]*>([\s\S]*?)<\/summary>/i)||[])[1]||'';
      desc=summ;
    }
    let useDesc = (content || desc || '').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
    if(useDesc.length>180) useDesc=useDesc.slice(0,177)+' [...]';
    else if(useDesc) useDesc=useDesc+' [...]';
    return {title, link, pubDate:pub?new Date(pub):new Date(), description:useDesc};
  }).filter(x=>x.link && x.title);
}
function extractGemeenteDate(html){
  let m = html.match(/(\d{1,2})\s+(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\s+(\d{4})\s*,\s*(\d{1,2}):(\d{2})/i);
  if(m){
    const months={januari:0,februari:1,maart:2,april:3,mei:4,juni:5,juli:6,augustus:7,september:8,oktober:9,november:10,december:11};
    return new Date(parseInt(m[3]), months[m[2].toLowerCase()], parseInt(m[1]), parseInt(m[4]), parseInt(m[5]));
  }
  m = html.match(/<time[^>]+datetime=["']([^"']+)["']/i);
  if(m){
    const d=new Date(m[1]);
    if(!isNaN(d.getTime())) return d;
  }
  return null;
}
function extractDescAfter(pos, clean){
  const slice = clean.substring(pos, pos+1500);
  const re = /<(p|div)[^>]*>([\s\S]*?)<\/\1>/gi;
  let mm;
  while((mm=re.exec(slice))!==null){
    let txt = mm[2].replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
    if(txt.length<30) continue;
    if(txt.length>400) continue;
    if(/^\d{1,2}\s+\w+\s+\d{4}/.test(txt)) continue;
    if(txt.includes('Facebook') && txt.includes('Instagram')) continue;
    if(txt.includes('prefetch') || txt.includes('wp-admin')) continue;
    if(/^(Lees meer|Meer lezen|Home|Actueel)$/i.test(txt)) continue;
    if(txt.length>180) txt=txt.slice(0,177)+' [...]'; else txt=txt+' [...]';
    return txt;
  }
  return ' [...]';
}
function parseGemeenteOverview(html){
  const max = MAX_PER_BRON['Gemeente Ommen'];
  let clean = html.replace(/<!--[\s\S]*?-->/g,' ');
  const results=[]; const seen=new Set();
  const titleRe = /<h[23][^>]*>\s*<a[^>]+href=["']([^"']*\/actueel\/[^"'?#]+)["'][^>]*>([\s\S]*?)<\/a>\s*<\/h[23]>/gi;
  let m;
  while((m=titleRe.exec(clean))!==null && results.length<max){
    let href=m[1], title=m[2].replace(/<[^>]*>/g,'').trim();
    if(title.length<8) continue;
    const full = href.startsWith('http')?href:'https://www.ommen.nl'+href;
    if(seen.has(full)) continue;
    seen.add(full);
    const desc = extractDescAfter(m.index, clean);
    const block = clean.substring(Math.max(0,m.index-500), m.index+2500);
    let tempDate = extractGemeenteDate(block);
    results.push({title:title.slice(0,130), link:full, pubDate:tempDate, description:desc});
  }
  return results.slice(0,max);
}
function getGemeenteCache(){
  try{ return JSON.parse(localStorage.getItem('ommen_gemeente_cache')||'{}'); }catch{ return {}; }
}
function setGemeenteCache(cache){
  localStorage.setItem('ommen_gemeente_cache', JSON.stringify(cache));
}
async function enrichGemeenteWithDetail(arts){
  const cache=getGemeenteCache();
  const now=Date.now();
  const CACHE_TTL=1000*60*60*2;
  // Alleen artikelen zonder goede tijd verrijken, max 3
  const needEnrich=arts.filter(a=>{
    const cached=cache[a.link];
    if(cached && (now - cached.ts) < CACHE_TTL && cached.iso) return false;
    if(a.pubDate && !isNaN(a.pubDate.getTime()) && a.pubDate.getHours()!==0) return false;
    return true;
  }).slice(0,3);
  if(needEnrich.length===0){
    // vul cache wel met bestaande datums
    arts.forEach(a=>{ if(a.pubDate && !isNaN(a.pubDate.getTime()) && a.pubDate.getHours()!==0) cache[a.link]={iso:a.pubDate.toISOString(), ts:now}; });
    setGemeenteCache(cache);
    return arts;
  }
  const results=[];
  await Promise.allSettled(needEnrich.map(async (a)=>{
    try{
      const html = await fetchViaWorker(a.link);
      const realDate = extractGemeenteDate(html);
      if(realDate){
        a.pubDate=realDate;
        cache[a.link]={iso:realDate.toISOString(), ts:now};
      }
    }catch(e){}
    results.push(a);
  }));
  // merge
  arts.forEach(a=>{ if(a.pubDate && !isNaN(a.pubDate.getTime()) && a.pubDate.getHours()!==0) cache[a.link]={iso:a.pubDate.toISOString(), ts:now}; });
  setGemeenteCache(cache);
  return arts;
}
function parseOostFull_OLD(html){
  const max = MAX_PER_BRON['RTV Oost'];
  const patterns = [
    /<a[^>]+href=["'](\/nieuws\/[^"']*ommen[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi,
    /<a[^>]+href=["'](https:\/\/www\.oost\.nl\/nieuws\/[^"']*ommen[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi,
  ];
  const uniqMap=new Map();
  for(const re of patterns){
    let mm;
    while((mm=re.exec(html))!==null && uniqMap.size<max){
      const href=mm[1]; let text=mm[2].replace(/<[^>]*>/g,'').trim();
      if(text.length<10 || text.length>200) continue;
      const full=href.startsWith('http')?href:'https://www.rtvoost.nl'+href;
      if(!uniqMap.has(full)) uniqMap.set(full, text);
    }
  }
  return Array.from(uniqMap.entries()).slice(0,max).map(([link,title])=>({title:title.slice(0,120), link, pubDate:new Date(), description:'[...]'}));
}
function parseVechtdalCentraalFallback_OLD(html){
  const max = MAX_PER_BRON['Vechtdal Centraal'];
  const re = /<a[^>]+href=["']([^"']*\/[^"']+)["'][^>]*>\s*<h[23][^>]*>([^<]{8,120})<\/h[23]>/gi;
  const map=new Map();
  let m;
  while((m=re.exec(html))!==null && map.size<max){
    let href=m[1], title=m[2].trim();
    if(href.startsWith('/')) href='https://www.vechtdalcentraal.nl'+href;
    if(!href.includes('vechtdalcentraal.nl')) continue;
    if(href.includes('/category/') || href.includes('/tag/') || href.includes('#')) continue;
    if(!map.has(href)) map.set(href, title);
  }
  return Array.from(map.entries()).slice(0,max).map(([link,title])=>({title, link, pubDate:new Date(), description:'[...]'}));
}
function parseOostFull(html){
  const echt = parseRTVOostECHT(html);
  if(echt.length>0) return echt;
  return parseOostFull_OLD(html);
}
function parseVechtdalCentraalFallback(html){
  const echt = parseVechtdalCentraalECHT(html);
  if(echt.length>0) return echt;
  return parseVechtdalCentraalFallback_OLD(html);
}
function parseRTVVechtdalFull(html){
  return parseRTVVechtdalECHT(html);
}
async function loadOneSource(b){
  const cfg = BRON_URLS[b.id];
  try{
    let arts=[];
    if(cfg.type==='gemeente'){
      // Probeer eerst cache voor instant load
      let html=null;
      const cached=getCachedSource(cfg.url);
      const stale=getStaleSource(cfg.url);
      if(cached){ html=cached; }
      else if(stale){ html=stale; }
      else { html=await fetchViaWorker(cfg.url); }
      let overview = parseGemeenteOverview(html);
      if(overview.length){
        const tempArts=overview.map(a=>({...a, source:b.name, id:b.id, isFallback:false, pubDate:a.pubDate||new Date()}));
        allArticles = allArticles.filter(x=>x.id!==b.id).concat(tempArts);
        loadedSources.add(b.id); updateHeaderCount(); renderArticles();
      }
      // Enrich op de achtergrond, niet blokkerend, max 3 parallel en alleen als geen datum
      if(!cached){
        // background enrich, fire and forget
        enrichGemeenteWithDetail(overview).then(enriched=>{
          const enrichedArts=enriched.map(a=>({...a, source:b.name, id:b.id, isFallback:false}));
          allArticles = allArticles.filter(x=>x.id!==b.id).concat(enrichedArts);
          renderArticles();
        }).catch(()=>{});
      }
      arts = overview;
    }
    else if(cfg.type==='oost'){ 
      const html=await fetchViaWorker(cfg.url); 
      arts=parseOostFull(html); 
    }
    else if(b.id==='RTV Vechtdal'){ 
      try{
        const html=await fetchViaWorker(cfg.homepage || 'https://www.rtvvechtdal.nl/');
        let overview=parseRTVVechtdalFull(html); 
        if(overview.length>0){
          const tempArts=overview.map(a=>({...a, source:b.name, id:b.id, isFallback:false}));
          allArticles = allArticles.filter(x=>x.id!==b.id).concat(tempArts);
          loadedSources.add(b.id); updateHeaderCount(); renderArticles();
          // v228: geen enrich meer, polling moment al gezet
          arts = overview;
        } else {
          arts = overview;
        }
      }catch(e){ console.log('vd load fail', e.message); }
      if(arts.length===0){ 
        try{ const xml=await fetchViaWorker(cfg.url); arts=parseRSSFull(xml,b.id); }catch(e){}
      }
    }
    else if(b.id==='Vechtdal Centraal'){
      try{
        const xml=await fetchViaWorker(cfg.url);
        if(xml.includes('<rss')||xml.includes('<feed')||xml.includes('<item')){
          arts=parseRSSFull(xml,b.id);
        } else {
          arts=parseVechtdalCentraalFallback(xml);
        }
      }catch(e){ console.log('vc feed fail', e.message); }
      if(arts.length===0){
        try{
          const html=await fetchViaWorker(cfg.fallback || cfg.homepage);
          arts=parseVechtdalCentraalFallback(html);
        }catch(e){ console.log('vc html fail', e.message); }
      }
    }
    else {
      try{
        const xml=await fetchViaWorker(cfg.url);
        arts=parseRSSFull(xml, b.id);
        if(arts.length===0 && cfg.fallback){
          const html2=await fetchViaWorker(cfg.fallback);
          arts=parseVechtdalCentraalFallback(html2);
        }
      }catch(e){
        if(cfg.fallback){
          const html2=await fetchViaWorker(cfg.fallback);
          arts=parseVechtdalCentraalFallback(html2);
        } else throw e;
      }
    }
    if(arts.length===0) throw new Error('empty');
    return arts.map(a=>({...a, source:b.name, id:b.id, isFallback:false}));
  }catch(e){
    console.log('load fail', b.id, e.message);
    return [{title:b.name, link:cfg.homepage, pubDate:new Date(0), description:'Bron tijdelijk offline - homepage [...]', source:b.name, id:b.id, isFallback:true}];
  }
}
function isSameDay(d1,d2){
  if(!d1 || !d2 || isNaN(d1.getTime()) || isNaN(d2.getTime())) return false;
  return d1.getFullYear()===d2.getFullYear() && d1.getMonth()===d2.getMonth() && d1.getDate()===d2.getDate();
}
function formatDate(d, sourceId){
  if(!d || isNaN(d.getTime()) || d.getTime()===0) return '';
  const dateStr = d.toLocaleDateString('nl-NL',{day:'numeric', month:'short'});
  if(d.getHours()===0 && d.getMinutes()===0 && d.getSeconds()===0){
    return dateStr;
  }
  const timeStr = d.toLocaleTimeString('nl-NL',{hour:'2-digit', minute:'2-digit'});
  return `${dateStr} ${timeStr}`;
}
function renderArticles(){
  const container=document.getElementById('news-container'); if(!container) return;
  const search = (document.getElementById('search-input')?.value||'').toLowerCase();
  const today = new Date();
  let filtered = allArticles.filter(a=>{
    const s=state[a.id];
    if(!s || !s.aan) return false;
    if(s.vandaag){
      if(a.isFallback) return false;
      if(!a.pubDate || isNaN(a.pubDate.getTime())) return false;
      if(!isSameDay(a.pubDate, today)) return false;
    }
    if(s.scope==='gemeente'){
      if(!isGemeenteArtikel(a)) return false;
    }
    return true;
  });
  if(search) filtered = filtered.filter(a=> (a.title+' '+a.description+' '+a.source).toLowerCase().includes(search));
  filtered = filtered.sort((a,b)=>b.pubDate - a.pubDate);
  const realCount = filtered.filter(a=>!a.isFallback).length;
  const vandaagActive = Object.values(state).some(s=>s.aan && s.vandaag);
  const gemeenteActive = Object.values(state).some(s=>s.aan && s.scope==='gemeente');
  let filterLabel = '';
  if(vandaagActive) filterLabel += ' (alleen vandaag)';
  if(gemeenteActive) filterLabel += vandaagActive ? ' + gemeente' : ' (alleen gemeente Ommen)';
  const countHtml = `<div class="articles-count">${realCount} artikelen${filterLabel} - ${loadedSources.size} v/d ${BRONNEN.length} bronnen geladen</div>`;
  if(filtered.length===0){
    if(vandaagActive || gemeenteActive) container.innerHTML = countHtml + '<div class="article" style="color:#666;padding:20px;text-align:center;">Geen artikelen gevonden met dit filter.<br>Zet op REGIO of MEER om meer te zien.</div>';
    else container.innerHTML = countHtml + '<div class="article">Geen artikelen</div>';
    return;
  }
  const html = filtered.map(a=>{
    const cleanTitle = a.title.replace(/^\[[^\]]+\]\s*/,'').trim() || a.title;
    if(a.isFallback){
      return `<div class="article fallback" data-source="${a.id}"><h2><a href="${a.link}" target="_blank">${a.source}</a></h2><small>${a.source}${a.pubDate.getTime()?` - ${formatDate(a.pubDate, a.id)}`:''}</small><div style="margin-top:6px;color:#666;">${a.description}</div></div>`;
    }
    return `<div class="article" data-source="${a.id}"><h2><a href="${a.link}" target="_blank">${cleanTitle}</a></h2><small>${a.source} - ${formatDate(a.pubDate, a.id)}</small>${a.description?`<div style="margin-top:6px;color:#555;">${a.description}</div>`:''}</div>`;
  }).join('');
  container.innerHTML = countHtml + html;
  window.getAllArticles = ()=> filtered;
}
function filterNews(){ renderArticles(); }
async function refreshNews(){
  const c=document.getElementById('news-container'); 
  // 1. Direct cache tonen als die er is -> <200ms eerste paint
  const staleCache=getSourceCache();
  let hasStale=false;
  const initialArts=[];
  for(const b of BRONNEN){
    const cfg=BRON_URLS[b.id];
    const cachedData=getCachedSource(cfg.url) || getStaleSource(cfg.url);
    if(cachedData){
      try{
        let arts=[];
        if(cfg.type==='gemeente') arts=parseGemeenteOverview(cachedData);
        else if(cfg.type==='oost') arts=parseOostFull(cachedData);
        else if(b.id==='RTV Vechtdal'){ 
          try{ arts=parseRTVVechtdalFull(cachedData); }catch{}
          if(arts.length===0) arts=parseRSSFull(cachedData,b.id);
        }
        else if(b.id==='Vechtdal Centraal'){
          if(cachedData.includes('<rss')||cachedData.includes('<item')) arts=parseRSSFull(cachedData,b.id);
          else arts=parseVechtdalCentraalFallback(cachedData);
        }
        else arts=parseRSSFull(cachedData,b.id);
        if(arts.length>0){
          initialArts.push(...arts.map(a=>({...a, source:b.name, id:b.id, isFallback:false})));
          hasStale=true;
        }
      }catch(e){}
    }
  }
  if(hasStale){
    allArticles=initialArts;
    BRONNEN.forEach(b=>loadedSources.add(b.id));
    updateHeaderCount();
    renderArticles();
    if(c) c.innerHTML = document.getElementById('news-container').innerHTML; // keep
    console.log('[perf] stale cache getoond', initialArts.length);
  } else {
    if(c) c.innerHTML='<div class="article">Bezig met laden... (9 bronnen) - cache wordt opgebouwd</div>';
  }
  // 2. Daarna verse data op achtergrond parallel ophalen
  allArticles = hasStale ? initialArts : [];
  loadedSources = hasStale ? new Set(BRONNEN.map(b=>b.id)) : new Set();
  if(!hasStale) updateHeaderCount();
  const loadWithTimeout = async (b) => {
    try {
      const timeout = new Promise((_,rej)=> setTimeout(()=>rej(new Error('timeout '+b.id)), 8000));
      const arts = await Promise.race([loadOneSource(b), timeout]);
      return {b, arts};
    } catch(e){
      console.log('load timeout/fail', b.id, e.message);
      // als we al stale hadden, toon geen fallback
      if(hasStale) return {b, arts:[]};
      return {b, arts:[{title:b.name, link:BRON_URLS[b.id].homepage, pubDate:new Date(0), description:'Bron tijdelijk offline - '+e.message.slice(0,80)+' [...]', source:b.name, id:b.id, isFallback:true}]};
    }
  };
  const results = await Promise.allSettled(BRONNEN.map(b=>loadWithTimeout(b)));
  const freshArts=[];
  results.forEach(r=>{
    if(r.status==='fulfilled'){
      const {b, arts}=r.value;
      if(arts.length>0) freshArts.push(...arts);
      loadedSources.add(b.id);
    }
  });
  if(freshArts.length>0){
    allArticles=freshArts;
  }
  updateHeaderCount();
  renderArticles();
  console.log('refreshNews klaar,', allArticles.length, 'artikelen (perf v2)');
}
document.addEventListener('DOMContentLoaded', ()=>{
  loadState(); renderFilters(); saveState(); closePanel(); setupFilterHeader();
  document.getElementById('search-input')?.addEventListener('input', filterNews);
  setTimeout(()=>refreshNews(), 200);
});
window.closePanel=closePanel; window.resetFilters=resetFilters; window.BRONNEN=BRONNEN; window.getAppState=()=>state;
window.filterNews=filterNews; window.refreshNews=refreshNews;

// ===== v226.2 LIVE SYNC + NOTIFICATIE =====
(function(){
  const SYNC_ENABLED = true;
  const SYNC_INTERVAL_MS = 30000;
  let currentUser = null;
  let authToken = localStorage.getItem('ommen_auth_token') || null;
  let lastRemoteUpdated = parseInt(localStorage.getItem('ommen_last_sync')||'0', 10);
  let isSyncing = false;
  let notifPermissionAsked = false;

  function getAuthHeaders(){
    return authToken ? {'Authorization': 'Bearer '+authToken, 'Content-Type':'application/json'} : {'Content-Type':'application/json'};
  }

  async function checkLogin(){
    if(!authToken) return null;
    try{
      const r = await fetch(WORKER+'/auth/me', {headers: getAuthHeaders()});
      if(!r.ok){ logout(); return null; }
      const u = await r.json();
      currentUser = u.user || u;
      return currentUser;
    }catch{ return null; }
  }

  window.loginOmmen = async function(email, password){
    const r = await fetch(WORKER+'/auth/login', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({email, password})});
    const j = await r.json();
    if(!r.ok) throw new Error(j.error||'Login mislukt');
    authToken = j.token;
    localStorage.setItem('ommen_auth_token', authToken);
    currentUser = {id:j.id||j.user?.id, email:j.email||j.user?.email};
    await loadFromCloud(true);
    updateAuthUI();
    startLiveSync();
    ensureNotificationPermission();
    return j;
  };

  window.registerOmmen = async function(email, password){
    const r = await fetch(WORKER+'/auth/register', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({email, password})});
    const j = await r.json();
    if(!r.ok) throw new Error(j.error||'Registratie mislukt');
    authToken = j.token;
    localStorage.setItem('ommen_auth_token', authToken);
    currentUser = {id:j.id||j.user?.id, email:j.email||j.user?.email};
    await saveToCloud();
    updateAuthUI();
    startLiveSync();
    ensureNotificationPermission();
    return j;
  };

  window.logoutOmmen = function(){
    if(authToken) fetch(WORKER+'/auth/logout', {method:'POST', headers: getAuthHeaders(), body: JSON.stringify({token: authToken})}).catch(()=>{});
    authToken = null;
    currentUser = null;
    localStorage.removeItem('ommen_auth_token');
    localStorage.removeItem('ommen_last_sync');
    lastRemoteUpdated = 0;
    stopLiveSync();
    updateAuthUI();
  };

  async function ensureNotificationPermission(){
    if(!('Notification' in window)) return;
    if(Notification.permission === 'default' && !notifPermissionAsked){
      notifPermissionAsked = true;
      try{ await Notification.requestPermission(); }catch{}
    }
  }

  function showSyncNotification(isBackground){
    try{
      if(navigator.serviceWorker && navigator.serviceWorker.controller){
        navigator.serviceWorker.controller.postMessage({type: 'SYNC_UPDATED'});
      } else if(navigator.serviceWorker && navigator.serviceWorker.ready){
        navigator.serviceWorker.ready.then(reg => {
          if(reg.active) reg.active.postMessage({type: 'SYNC_UPDATED'});
        });
      }
    }catch{}

    if(!isBackground){
      const toast = document.createElement('div');
      toast.textContent = '✓ Filters gesynchroniseerd';
      toast.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#065f46;color:white;padding:10px 18px;border-radius:999px;font-size:13px;font-weight:600;z-index:99999;box-shadow:0 6px 20px rgba(0,0,0,0.2);opacity:0;transition:opacity 0.3s';
      document.body.appendChild(toast);
      setTimeout(()=>{ toast.style.opacity='1'; }, 50);
      setTimeout(()=>{ toast.style.opacity='0'; setTimeout(()=>toast.remove(), 400); }, 3000);
    }
  }

  async function saveToCloud(){
    if(!authToken || !SYNC_ENABLED || isSyncing) return;
    try{
      isSyncing = true;
      const r = await fetch(WORKER+'/sync/save', {method:'POST', headers: getAuthHeaders(), body: JSON.stringify({state})});
      const j = await r.json().catch(()=>({}));
      if(j.updated){
        lastRemoteUpdated = j.updated;
        localStorage.setItem('ommen_last_sync', String(j.updated));
      } else {
        const now = Date.now();
        lastRemoteUpdated = now;
        localStorage.setItem('ommen_last_sync', String(now));
      }
    }catch(e){ console.log('Sync save fail', e.message); }
    finally{ isSyncing = false; }
  }

  async function loadFromCloud(force=false){
    if(!authToken || isSyncing) return false;
    let didUpdate = false;
    try{
      isSyncing = true;
      const r = await fetch(WORKER+'/sync/load', {headers: getAuthHeaders()});
      if(!r.ok) return false;
      const data = await r.json();
      if(!data.state) return false;
      const remoteUpdated = data.updated || 0;
      if(!force && remoteUpdated && remoteUpdated <= lastRemoteUpdated){
        return false;
      }
      const localStr = JSON.stringify(state);
      const remoteStr = JSON.stringify(data.state);
      if(localStr === remoteStr){
        if(remoteUpdated) { lastRemoteUpdated = remoteUpdated; localStorage.setItem('ommen_last_sync', String(remoteUpdated)); }
        return false;
      }
      state = data.state;
      localStorage.setItem('nieuwsommen_bronnen_v2', JSON.stringify(state));
      lastRemoteUpdated = remoteUpdated || Date.now();
      localStorage.setItem('ommen_last_sync', String(lastRemoteUpdated));
      if(typeof renderFilters==='function'){ renderFilters(); }
      if(typeof filterNews==='function'){ filterNews(); }
      updateAuthUI();
      didUpdate = true;
      const isBg = document.visibilityState !== 'visible';
      if(!force){
        showSyncNotification(isBg);
      }
    }catch(e){ console.log('Sync load fail', e.message); }
    finally{ isSyncing = false; }
    return didUpdate;
  }

  let liveInterval = null;
  function startLiveSync(){
    stopLiveSync();
    if(!authToken) return;
    liveInterval = setInterval(()=>{ loadFromCloud(false); }, SYNC_INTERVAL_MS);
  }
  function stopLiveSync(){
    if(liveInterval){ clearInterval(liveInterval); liveInterval=null; }
  }

  function updateAuthUI(){
    const btn = document.getElementById('user-icon-btn');
    const oldSlot = document.getElementById('auth-slot');
    if(oldSlot) oldSlot.remove();
    if(!btn) return;
    if(currentUser){
      btn.classList.add('logged-in');
      btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="currentColor" style="display:block;flex-shrink:0"><path fill-rule="evenodd" d="M10 8a3 3 0 100-6 3 3 0 000 6zM3.465 14.493a1.23 1.23 0 00.41 1.412A9.957 9.957 0 0010 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 00-13.074.003z" clip-rule="evenodd"/></svg>';
      btn.title = currentUser.email + ' - ingelogd (● live)';
      btn.onclick = function(){
        const old = document.getElementById('login-modal'); if(old) old.remove();
        const overlay = document.createElement('div');
        overlay.id='login-modal';
        overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
        const box = document.createElement('div');
        box.style.cssText='background:white;border-radius:16px;padding:24px;max-width:360px;width:100%;box-shadow:0 10px 30px rgba(0,0,0,0.2);color:#111';
        const emailSafe = (currentUser.email || currentUser.user?.email || '').replace(/</g,'&lt;');
        box.innerHTML = `<h3 style="margin:0 0 8px;font-size:18px">Ingelogd als</h3>
          <p style="margin:0 0 16px;color:#374151;font-size:13px;word-break:break-all">${emailSafe}<br><span style="font-size:11px;color:#059669;font-weight:700">● live sync elke 30 sec</span></p>
          <div style="display:flex;gap:8px"><button id="btn-sync-now" style="flex:1;padding:10px;background:#0b5bd3;color:white;border:0;border-radius:8px;font-weight:600;cursor:pointer">Sync nu</button><button id="btn-logout-now" style="flex:1;padding:10px;background:#fee2e2;color:#991b1b;border:0;border-radius:8px;font-weight:600;cursor:pointer">Uitloggen</button></div>
          <button id="btn-close-acc" style="width:100%;margin-top:10px;padding:8px;background:transparent;border:0;color:#666;cursor:pointer">Sluiten</button>`;
        overlay.appendChild(box);
        document.body.appendChild(overlay);
        document.getElementById('btn-close-acc').onclick=()=>overlay.remove();
        document.getElementById('btn-logout-now').onclick=()=>{ overlay.remove(); window.logoutOmmen(); };
        document.getElementById('btn-sync-now').onclick=()=>{ saveToCloud(); loadFromCloud(true); overlay.remove(); };
        overlay.onclick=(e)=>{ if(e.target===overlay) overlay.remove(); };
      };
    } else {
      btn.classList.remove('logged-in');
      btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="currentColor" style="display:block;flex-shrink:0"><path fill-rule="evenodd" d="M10 8a3 3 0 100-6 3 3 0 000 6zM3.465 14.493a1.23 1.23 0 00.41 1.412A9.957 9.957 0 0010 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 00-13.074.003z" clip-rule="evenodd"/></svg>';
      btn.title = 'Inloggen / Account maken';
      btn.onclick = openLoginModal;
    }
  }

  function openLoginModal(){
    const old = document.getElementById('login-modal'); if(old) old.remove();
    const overlay = document.createElement('div');
    overlay.id='login-modal';
    overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
    const box = document.createElement('div');
    box.style.cssText='background:white;border-radius:16px;padding:24px;max-width:360px;width:100%;box-shadow:0 10px 30px rgba(0,0,0,0.2)';
    const h3 = document.createElement('h3'); h3.textContent='Inloggen voor sync & nieuwsbrief'; h3.style.margin='0 0 8px'; h3.style.fontSize='18px';
    const p = document.createElement('p'); p.textContent='Je filters worden live gesynchroniseerd én je ontvangt de nieuwsbrief met belangrijke updates (max 1-2 per maand).'; p.style.cssText='margin:0 0 16px;color:#666;font-size:13px';
    const inpEmail = document.createElement('input'); inpEmail.type='email'; inpEmail.placeholder='Email'; inpEmail.id='auth-email'; inpEmail.style.cssText='width:100%;padding:10px;border:1px solid #ddd;border-radius:8px;margin-bottom:10px;box-sizing:border-box';
    const inpPass = document.createElement('input'); inpPass.type='password'; inpPass.placeholder='Wachtwoord (min 6 tekens)'; inpPass.id='auth-pass'; inpPass.style.cssText='width:100%;padding:10px;border:1px solid #ddd;border-radius:8px;margin-bottom:16px;box-sizing:border-box';
    const row = document.createElement('div'); row.style.cssText='display:flex;gap:8px';
    const btnLogin = document.createElement('button'); btnLogin.textContent='Inloggen'; btnLogin.style.cssText='flex:1;padding:10px;background:#0b5bd3;color:white;border:0;border-radius:8px;font-weight:600;cursor:pointer';
    const btnReg = document.createElement('button'); btnReg.textContent='Account maken'; btnReg.style.cssText='flex:1;padding:10px;background:#e8eef8;color:#0b5bd3;border:0;border-radius:8px;font-weight:600;cursor:pointer';
    const btnClose = document.createElement('button'); btnClose.textContent='Annuleren'; btnClose.style.cssText='width:100%;margin-top:10px;padding:8px;background:transparent;border:0;color:#666;cursor:pointer';
    const errDiv = document.createElement('div'); errDiv.id='auth-error'; errDiv.style.cssText='margin-top:10px;color:#c00;font-size:13px';
    btnClose.onclick=function(){ overlay.remove(); };
    btnLogin.onclick=async function(){
      const email=inpEmail.value.trim(); const pass=inpPass.value;
      errDiv.textContent='Bezig...';
      try{ await window.loginOmmen(email, pass); overlay.remove(); }catch(e){ errDiv.textContent=e.message; }
    };
    btnReg.onclick=async function(){
      const email=inpEmail.value.trim(); const pass=inpPass.value;
      errDiv.textContent='Bezig...';
      try{ await window.registerOmmen(email, pass); overlay.remove(); }catch(e){ errDiv.textContent=e.message; }
    };
    row.appendChild(btnLogin); row.appendChild(btnReg);
    box.appendChild(h3); box.appendChild(p); box.appendChild(inpEmail); box.appendChild(inpPass); box.appendChild(row); box.appendChild(btnClose); box.appendChild(errDiv);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
  }

  if(typeof saveState === 'function'){
    const origSave = saveState;
    window.saveState = function(){
      try{ origSave(); }catch{}
      localStorage.setItem('nieuwsommen_bronnen_v2', JSON.stringify(state));
      try{ if(typeof updateHiddenCompat==='function') updateHiddenCompat(); }catch{}
      try{ if(typeof updateHeaderCount==='function') updateHeaderCount(); }catch{}
      try{ if(window.updatePushBell) window.updatePushBell(); }catch{}
      if(authToken) saveToCloud();
    };
  }

  document.addEventListener('DOMContentLoaded', function(){
    setTimeout(async function(){
      const oldAuthSlot = document.getElementById('auth-slot');
      if(oldAuthSlot) oldAuthSlot.remove();
      await checkLogin();
      if(currentUser){
        await loadFromCloud(true);
        startLiveSync();
        ensureNotificationPermission();
      }
      updateAuthUI();
      document.addEventListener('visibilitychange', function(){
        if(document.visibilityState==='visible' && currentUser){
          loadFromCloud(false);
        }
      });
    }, 800);
  });
})();

// ===== v227 FILTER BRIDGE VOOR SERVICE WORKER v231 =====
(function(){
  function getSelectedSourcesForSW(){
    try{
      if(typeof state !== 'object') return [];
      const selected = [];
      for(const bron of BRONNEN){
        const s = state[bron.id];
        if(s && s.aan){
          selected.push(bron.id);
        }
      }
      return selected;
    }catch(e){ return []; }
  }

  window.pushFiltersToSW = function(){
    const sources = getSelectedSourcesForSW();
    // 1. Naar Service Worker
    try{
      if(navigator.serviceWorker && navigator.serviceWorker.controller){
        navigator.serviceWorker.controller.postMessage({type:'SET_FILTERS', sources: sources});
      }
      navigator.serviceWorker.ready.then(reg=>{
        if(reg.active) reg.active.postMessage({type:'SET_FILTERS', sources: sources});
      }).catch(()=>{});
    }catch(e){}
    // 2. Naar IndexedDB voor offline fallback
    try{
      const req = indexedDB.open('nieuws-ommen', 1);
      req.onupgradeneeded = (e)=>{
        const db = e.target.result;
        if(!db.objectStoreNames.contains('settings')){
          db.createObjectStore('settings');
        }
      };
      req.onsuccess = (e)=>{
        const db = e.target.result;
        try{
          const tx = db.transaction('settings','readwrite');
          const store = tx.objectStore('settings');
          store.put(sources, 'selectedSources');
        }catch(err){}
      };
    }catch(e){}
    console.log('[v227] Filters naar SW gepusht:', sources);
  };

  // Service Worker vraagt om filters (GET_FILTERS)
  if('serviceWorker' in navigator){
    navigator.serviceWorker.addEventListener('message', event=>{
      if(event.data && event.data.type === 'GET_FILTERS'){
        const sources = getSelectedSourcesForSW();
        if(event.ports && event.ports[0]){
          event.ports[0].postMessage({sources: sources});
        }
      }
    });
  }

  // Bij load ook meteen pushen
  document.addEventListener('DOMContentLoaded', ()=>{
    setTimeout(()=>{ try{ window.pushFiltersToSW(); }catch(e){} }, 1500);
  });

  // Bij visibility change (terugkomen in app) ook pushen
  document.addEventListener('visibilitychange', ()=>{
    if(document.visibilityState === 'visible'){
      try{ window.pushFiltersToSW(); }catch(e){}
    }
  });
})();
