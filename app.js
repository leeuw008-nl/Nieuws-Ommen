// app.js v305 FINAL - ALLE 8 FIXES
// #1 bronselectie bewaren, #2 Alles aan/uit, #3 RTV Oost laatste, #4 RTV Vechtdal datum, #5 NieuwOmmen kleur, #6 lege push guard, #7 push titel+highlight, #8 ECHT omlijnd
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
const MAX_PER_BRON = {'De Stentor':25,'RondOmmen':20,'Ommen City':10,'OudOmmen':10,'Vechtdal Centraal':10,'Nieuwsbrief':20,'Natuurlijk Ommen':10,'Gemeente Ommen':10,'RTV Oost':15,'RTV Vechtdal':10};
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
(function(){ try{ const v=localStorage.getItem('ommen_app_version'); if(v!=='305'){ console.log('[v305 FINAL] all 8 fixes'); localStorage.setItem('ommen_app_version','305'); } }catch(e){} })();

// FIX #7 + #8 highlight helpers
function getHighlightUrl(){
  try{
    const params = new URLSearchParams(window.location.search);
    let h = params.get('highlight') || params.get('echt') || params.get('article') || params.get('url') || params.get('link');
    if(h){ try{ h = decodeURIComponent(h); }catch{} return h; }
  }catch{}
  return null;
}
function getEchtId(){
  try{ const params = new URLSearchParams(window.location.search); return params.get('echt') || null; }catch{ return null; }
}
function clearHighlight(){
  try{
    const url = new URL(window.location.href);
    url.searchParams.delete('highlight'); url.searchParams.delete('article'); url.searchParams.delete('url'); url.searchParams.delete('link'); url.searchParams.delete('echt');
    window.history.replaceState({}, '', url.toString());
  }catch{}
  renderArticles();
}
function getEchtMessages(){ try{ const raw=localStorage.getItem('ommen_echt_messages'); if(raw) return JSON.parse(raw); }catch{} return []; }
function saveEchtMessage(msg){ try{ const all=getEchtMessages(); all.unshift(msg); localStorage.setItem('ommen_echt_messages', JSON.stringify(all.slice(0,20))); }catch{} }
function getLocalEchtAsArticles(){
  const msgs=getEchtMessages();
  return msgs.map(m=>({title:m.title, link:m.link||`/?echt=${encodeURIComponent(m.id)}`, pubDate:new Date(m.pubDate), description:m.description, source:'NieuwOmmen ECHT', id:'Nieuwsbrief', isEcht:true, echtId:m.id, isLocalEcht:true}));
}
function parseNieuwsbriefECHT(json){
  try{
    const data = typeof json === 'string' ? JSON.parse(json) : json;
    const items = data.items || data.articles || data || [];
    return items.map(it=>{
      const isEcht = it.isEcht || it.type==='echt' || it.id?.startsWith('echt-') || it.id?.startsWith('admin-');
      const title = it.title || it.subject || (isEcht?'Belangrijk bericht':'Nieuwsbrief');
      const link = it.link || it.url || (isEcht?`/?echt=${encodeURIComponent(it.id||Date.now())}`:'https://nieuwommen.leeuw008.nl/');
      let pubDate=new Date(); if(it.pubDate||it.date||it.updated){ const d=new Date(it.pubDate||it.date||it.updated); if(!isNaN(d.getTime())) pubDate=d; }
      const desc = it.description || it.body || it.excerpt || title;
      return {title:title.slice(0,150), link, pubDate, description:desc.slice(0,300)+' [...]', source:isEcht?'NieuwOmmen ECHT':'Nieuwsbrief', id:'Nieuwsbrief', isEcht:isEcht, echtId:it.id||it.echtId||null};
    }).slice(0,20);
  }catch(e){ return []; }
}

// #3 + #4 caches
function getVechtdalCache(){try{return JSON.parse(localStorage.getItem('ommen_vechtdal_poll')||'{}');}catch{return {};}}
function setVechtdalCache(c){try{localStorage.setItem('ommen_vechtdal_poll',JSON.stringify(c));}catch{}}
function getVechtdalDetailCache(){try{return JSON.parse(localStorage.getItem('ommen_vechtdal_detail_cache')||'{}');}catch{return {};}}
function setVechtdalDetailCache(c){try{localStorage.setItem('ommen_vechtdal_detail_cache',JSON.stringify(c));}catch{}}
function getOostDetailCache(){try{return JSON.parse(localStorage.getItem('ommen_oost_detail_cache')||'{}');}catch{return {};}}
function setOostDetailCache(c){try{localStorage.setItem('ommen_oost_detail_cache', JSON.stringify(c));}catch{}}

function parseVechtdalCentraalECHT(html){ const items=[]; const seen=new Set(); let re=/<h[2-3] class="entry-title[^>]*>\s*<a href="([^"]+)"[^>]*>([^<]+)<\/a>/gi; let m; while((m=re.exec(html))!==null && items.length<25){ let link=m[1]; if(link.startsWith('/')) link='https://www.vechtdalcentraal.nl'+link; if(seen.has(link)) continue; seen.add(link); const title=m[2].replace(/&#8217;/g,"'").replace(/&amp;/g,"&").trim(); if(title.length>4) items.push({title, link, pubDate:new Date(), description:title+' [...]'}); } return items; }

// #4 RTV Vechtdal parse
function parseRTVVechtdalECHT(html){
  const items=[]; const now=new Date(); const pollCache=getVechtdalCache(); let dirty=false; const today=new Date(); today.setHours(0,0,0,0);
  const reFull=/<div class="allmode_date">([^<]+)<\/div>[\s\S]{0,600}?<h[2-3] class="allmode_title"><a href="([^"]+)">([^<]+)<\/a>[\s\S]{0,800}?<div class="allmode_(?:intro|text|introtext)[^>]*>([\s\S]*?)<\/div>/gi; let m;
  while((m=reFull.exec(html))!==null && items.length<20){
    const dparts=m[1].split('-'); let pd=null;
    if(dparts.length===3){ const d=new Date(parseInt(dparts[2]), parseInt(dparts[1])-1, parseInt(dparts[0]), 0,0,0); const dMidnight=new Date(d); dMidnight.setHours(0,0,0,0); const isToday=dMidnight.getTime()===today.getTime(); if(isToday) pd=new Date(now); else pd=new Date(d.getFullYear(), d.getMonth(), d.getDate(), now.getHours(), now.getMinutes(), now.getSeconds()); }else pd=new Date(now);
    let link=m[2].replace(/&amp;/g,'&'); if(!link.startsWith('http')) link='https://www.rtvvechtdal.nl'+link;
    let intro=m[4].replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim(); if(intro.length>200) intro=intro.slice(0,200)+' [...]'; else intro=intro+' [...]';
    if(pollCache[link]==null){pollCache[link]=pd.toISOString(); dirty=true;} else {pd=new Date(pollCache[link]);}
    if(dirty) setVechtdalCache(pollCache);
    items.push({title:m[3].trim(), link, pubDate:pd, description:intro, _pollDate:pd, _dateStr:m[1]});
  }
  if(items.length===0){
    const re=/<div class="allmode_date">([^<]+)<\/div>[\s\S]{0,500}?<h[2-3] class="allmode_title"><a href="([^"]+)">([^<]+)<\/a>/gi;
    while((m=re.exec(html))!==null && items.length<15){
      const dparts=m[1].split('-'); let pd=null;
      if(dparts.length===3){ const d=new Date(parseInt(dparts[2]), parseInt(dparts[1])-1, parseInt(dparts[0]), 0,0,0); pd=new Date(d.getFullYear(), d.getMonth(), d.getDate(), now.getHours(), now.getMinutes(), now.getSeconds()); }else pd=new Date(now);
      let link=m[2].replace(/&amp;/g,'&'); if(!link.startsWith('http')) link='https://www.rtvvechtdal.nl'+link;
      if(pollCache[link]==null){pollCache[link]=pd.toISOString(); dirty=true;} else {pd=new Date(pollCache[link]);}
      if(dirty) setVechtdalCache(pollCache);
      items.push({title:m[3].trim(), link, pubDate:pd, description:m[3].trim()+' [...]', _pollDate:pd, _dateStr:m[1]});
    }
  }
  return items;
}
function extractVechtdalDetailDate(html){
  let m=html.match(/<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)["']/i);
  if(!m) m=html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']article:published_time["']/i);
  if(m){ const d=new Date(m[1]); if(!isNaN(d.getTime())) return d; }
  m=html.match(/"datePublished"\s*:\s*"([^"]+)"/i); if(m){ const d=new Date(m[1]); if(!isNaN(d.getTime())) return d; }
  m=html.match(/<time[^>]+datetime=["']([^"']+)["']/i); if(m){ const d=new Date(m[1]); if(!isNaN(d.getTime())) return d; }
  return null;
}
async function enrichVechtdalWithDetail(arts){
  if(!arts||arts.length===0) return arts;
  let pollCache=getVechtdalCache(); let detailCache=getVechtdalDetailCache(); const now=Date.now(); const CACHE_TTL=1000*60*60*6;
  arts.forEach(a=>{ const cached=detailCache[a.link]; if(cached && (now-cached.ts)<CACHE_TTL && cached.iso){ const cd=new Date(cached.iso); if(!isNaN(cd.getTime())){ a.pubDate=cd; } a._needsEnrich=false; }else{ a._needsEnrich=true; } });
  const need=arts.filter(a=>a._needsEnrich).slice(0,10);
  if(need.length===0) return arts;
  async function enrichOne(a){
    const originalPollDate=a._pollDate||a.pubDate;
    try{
      const html=await fetchViaWorker(a.link);
      const realDate=extractVechtdalDetailDate(html);
      if(realDate && !isNaN(realDate.getTime())){
        console.log('[v305 #4] RTV Vechtdal echte datum gevonden', a.link, realDate);
        a.pubDate=realDate; pollCache[a.link]=realDate.toISOString(); detailCache[a.link]={iso:realDate.toISOString(), ts:now};
      }else{
        if(originalPollDate) a.pubDate=originalPollDate; // #4: zo laten als niet te achterhalen
      }
    }catch(e){ if(originalPollDate) a.pubDate=originalPollDate; } finally{ a._needsEnrich=false; }
  }
  for(let i=0;i<need.length;i+=2){ const batch=need.slice(i,i+2); await Promise.allSettled(batch.map(a=>enrichOne(a))); if(i+2<need.length) await new Promise(r=>setTimeout(r,400)); }
  setVechtdalCache(pollCache); setVechtdalDetailCache(detailCache); return arts;
}

// #3 RTV Oost
function parseRTVOostECHT(html){
  const items=[]; let m; const reAll=/<div[^>]*publishedAt=["']([^"']+)["'][^>]*>[\s\S]{0,1200}?<a[^>]+href=["'](\/nieuws\/[^"']{5,300})["'][^>]*>[\s\S]{0,1200}?<h[2-3][^>]*>([^<]{6,300})<\/h[2-3]>/gi;
  while((m=reAll.exec(html))!==null && items.length<30){
    let dateStr=m[1]; let link=m[2]; let rawTitle=m[3].trim();
    if(link.startsWith('/')) link='https://www.oost.nl'+link;
    if(rawTitle.length<6 || ['ALLE NIEUWS'].includes(rawTitle.toUpperCase())) continue;
    if(!items.find(x=>x.link===link)){ const pd=new Date(dateStr); if(!isNaN(pd.getTime())) items.push({title:rawTitle, link, pubDate:pd, description:'', _needsEnrich:true, _publishedAt:pd}); }
  }
  return items;
}
function extractOostDate(html){ let m=html.match(/"datePublished"\s*:\s*"([^"]+)"/i); if(m){ const d=new Date(m[1]); if(!isNaN(d.getTime())) return d; } m=html.match(/<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)["']/i); if(m){ const d=new Date(m[1]); if(!isNaN(d.getTime())) return d; } return null; }
function extractOostDescription(html){ let m=html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i); if(!m) m=html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i); if(m) return m[1].trim(); const pRe=/<p[^>]*>([^<]{50,900})<\/p>/gi; let pm; while((pm=pRe.exec(html))!==null){ const txt=pm[1].replace(/<[^>]*>/g,' ').trim(); if(txt.length>50) return txt; } return ''; }
async function enrichOostWithDetail(arts){
  let cache=getOostDetailCache(); const now=Date.now(); const CACHE_TTL=1000*60*60*3;
  arts.forEach(a=>{ const cached=cache[a.link]; if(cached && (now-cached.ts)<CACHE_TTL && cached.desc){ a.description=cached.desc; if(cached.iso){ const cd=new Date(cached.iso); if(!isNaN(cd.getTime())) a.pubDate=cd; } a._needsEnrich=false; }else{ if(a._publishedAt) a.pubDate=a._publishedAt; a._needsEnrich=true; } });
  const need=arts.filter(a=>a._needsEnrich).slice(0,10); if(need.length===0) return arts;
  async function enrichOne(a){
    const originalDate=a.pubDate; const originalPublishedAt=a._publishedAt;
    try{
      const html=await fetchViaWorker(a.link);
      let desc=extractOostDescription(html); let realDate=extractOostDate(html);
      if(realDate && !isNaN(realDate.getTime())){ a.pubDate=realDate; } else if(originalDate){ a.pubDate=originalDate; } else if(originalPublishedAt){ a.pubDate=originalPublishedAt; }
      if(desc){ if(desc.length>220) desc=desc.slice(0,217)+' [...]'; else desc=desc+' [...]'; a.description=desc; cache[a.link]={desc, iso:a.pubDate?a.pubDate.toISOString():null, ts:now}; }
    }catch(e){
      // #3 FIX: nooit refresh datum
      if(originalDate && !isNaN(originalDate.getTime())){ a.pubDate=originalDate; } else if(originalPublishedAt){ a.pubDate=originalPublishedAt; }
      a.description=a.description||'';
    }finally{ a._needsEnrich=false; }
  }
  for(let i=0;i<need.length;i+=3){ const batch=need.slice(i,i+3); await Promise.allSettled(batch.map(a=>enrichOne(a))); if(i+3<need.length) await new Promise(r=>setTimeout(r,300)); }
  setOostDetailCache(cache); return arts;
}
function parseOostFull(html){ return parseRTVOostECHT(html); }
function parseVechtdalCentraalFallback(html){ return parseVechtdalCentraalECHT(html); }
function parseRTVVechtdalFull(html){ return parseRTVVechtdalECHT(html); }

const GEMEENTE_PLAATSEN = ['Ommen','Lemele','Vilsteren','Beerze','Beerzerveld','Witharen','Archem','Arriën','Arriërveld','Besthmen','Dalmsholte','Eerde','Emsland','Giethmen','Hoogengraven','Junne','Nieuwebrug','Ommerbosch','Ommerkanaal','Ommerschans','Ommerveld','Rotbrink','Stegeren','Stegerveld','Varsen','Vinkenbuurt','Zeesse','Beerzerpoort'];
const GEMEENTE_ZOEK = GEMEENTE_PLAATSEN.map(p=>p.toLowerCase());
function isGemeenteArtikel(art){ const txt=(art.title+' '+(art.description||'')).toLowerCase(); return GEMEENTE_ZOEK.some(pl=>txt.includes(pl)); }

let state={}; let allArticles=[]; let loadedSources=new Set();

(function injectStyles(){
  const css=`
.source-row{position:relative}
.source-row.nieuwsbrief-row{background:#e8f5e9 !important;border-left:4px solid #16a34a;border-radius:8px}
.source-row.nieuwsbrief-row .source-sub{color:#15803d;font-weight:600}
.source-led{width:12px;height:12px;border-radius:999px;display:block;flex-shrink:0}
.source-led.loading{background:#ef4444;animation:pulse-red 1.2s infinite}
.source-led.ok{background:#16a34a}
.source-led.fail{background:#ef4444}
.source-led.empty{background:#f59e0b}
@keyframes pulse-red{0%{transform:scale(1)}50%{transform:scale(1.25)}100%{transform:scale(1)}}
.article.highlighted{outline:3px solid #0b5bd3;outline-offset:2px;border-radius:12px;box-shadow:0 0 0 6px rgba(11,91,211,0.15);background:#eff6ff !important;animation:highlight-pulse 2s ease-in-out}
.article.echt-highlighted{outline:3px solid #dc2626 !important;outline-offset:2px;border-radius:12px;box-shadow:0 0 0 6px rgba(220,38,38,0.2) !important;background:#fef2f2 !important;animation:echt-pulse 2s ease-in-out}
@keyframes highlight-pulse{0%{box-shadow:0 0 0 0 rgba(11,91,211,0.4)}50%{box-shadow:0 0 0 12px rgba(11,91,211,0)}100%{box-shadow:0 0 0 6px rgba(11,91,211,0.15)}}
@keyframes echt-pulse{0%{box-shadow:0 0 0 0 rgba(220,38,38,0.5)}50%{box-shadow:0 0 0 14px rgba(220,38,38,0)}100%{box-shadow:0 0 0 6px rgba(220,38,38,0.2)}}
.highlight-banner{background:#0b5bd3;color:white;padding:12px 16px;border-radius:10px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:14px}
.highlight-banner.echt{background:#dc2626}
.highlight-banner button{background:white;color:#0b5bd3;border:0;padding:8px 14px;border-radius:999px;font-weight:700;cursor:pointer}
.highlight-banner.echt button{color:#dc2626}
`;
  const el=document.createElement('style'); el.id='led-status-style-v305'; el.textContent=css; if(!document.getElementById('led-status-style-v305')) document.head.appendChild(el);
})();

function updateSourceLeds(){ try{ BRONNEN.forEach(b=>{ const led=document.querySelector(`.source-led[data-id="${b.id}"]`); if(!led) return; const realArts=allArticles.filter(a=>a.id===b.id && !a.isFallback); const isLoaded=loadedSources.has(b.id); led.classList.remove('loading','ok','fail','empty'); if(!isLoaded){ led.classList.add('loading'); led.style.background='#ef4444'; }else if(realArts.length>0){ led.classList.add('ok'); led.style.background='#16a34a'; }else{ led.classList.add('empty'); led.style.background='#f59e0b'; } }); }catch(e){} }

// #1 FIX: bronselectie bewaren
function loadState(){
  try{
    const raw=localStorage.getItem('nieuwsommen_bronnen_v2');
    if(raw){
      const parsed=JSON.parse(raw);
      if(parsed && typeof parsed==='object' && Object.keys(parsed).length>0){
        state=parsed;
        BRONNEN.forEach(b=>{ if(!state[b.id]) state[b.id]={aan:true, vandaag:false, scope:'gemeente'}; });
        console.log('[v305 #1] bronselectie geladen uit localStorage');
        return;
      }
    }
  }catch(e){ console.log('[v305 #1] loadState error', e); }
  BRONNEN.forEach(b=> state[b.id]={aan:true, vandaag:false, scope:'gemeente'});
}
function saveState(){
  try{ localStorage.setItem('nieuwsommen_bronnen_v2', JSON.stringify(state)); console.log('[v305 #1] bronselectie opgeslagen'); }catch(e){}
  updateHiddenCompat(); updateHeaderCount(); if(window.updatePushBell) window.updatePushBell();
}
function updateHiddenCompat(){ const cont=document.getElementById('compat-sources'); if(!cont) return; cont.innerHTML=''; BRONNEN.forEach(b=>{ const s=state[b.id]||{aan:true,vandaag:false,scope:'gemeente'}; let cb=document.createElement('input'); cb.type='checkbox'; cb.className='source-filter'; cb.value=b.id; cb.checked=s.aan; cb.dataset.source=b.id; cont.appendChild(cb); cb.dispatchEvent(new Event('change',{bubbles:true})); }); }
function renderFilters(){
  const list=document.getElementById('source-list'); if(!list) return; list.innerHTML='';
  BRONNEN.forEach(b=>{
    const s=state[b.id]||{aan:true,vandaag:false,scope:'gemeente'}; const row=document.createElement('div');
    const isNieuwsbrief=b.id==='Nieuwsbrief';
    row.className='source-row'+(s.aan?'':' off')+(isNieuwsbrief?' nieuwsbrief-row':''); // #5
    const scopeIsGemeente=s.scope==='gemeente';
    const allForBron=allArticles.filter(a=>a.id===b.id && !a.isFallback); const loadedCount=allForBron.length;
    let selectedCount=allForBron.length; if(s.vandaag){ const today=new Date(); selectedCount=allForBron.filter(a=>a.pubDate && isSameDay(a.pubDate, today)).length; }
    if(s.scope==='gemeente'){ if(s.vandaag){ const today=new Date(); selectedCount=allForBron.filter(a=>a.pubDate && isSameDay(a.pubDate, today) && isGemeenteArtikel(a)).length; }else{ selectedCount=allForBron.filter(a=>isGemeenteArtikel(a)).length; } }
    row.innerHTML=`<div class="source-meta" style="display:flex;flex-direction:row;align-items:center;gap:8px;flex:1;min-width:0;"><div class="source-meta-text" style="display:flex;flex-direction:column;flex:1;min-width:0;"><div class="source-name" style="display:flex;align-items:center;gap:8px;min-width:0;"><span style="flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${b.name}</span><span class="led-col" style="width:18px;height:18px;display:flex;align-items:center;justify-content:center;flex-shrink:0;"><span class="source-led loading" data-id="${b.id}" title="Laden..." style="width:12px;height:12px;border-radius:999px;background:#ef4444;display:block;flex-shrink:0;"></span></span><span class="count-col" style="font-size:11px;font-weight:700;color:#374151;background:#f3f4f6;padding:2px 7px;border-radius:99px;white-space:nowrap;min-width:52px;text-align:center;flex-shrink:0;">${loadedCount} / ${selectedCount}</span></div><div class="source-sub">${b.sub}</div></div></div><div class="toggles"><div class="toggle-col"><label class="mini-switch vandaag ${s.vandaag?'checked':''}"><input type="checkbox" ${s.vandaag?'checked':''} data-type="vandaag" data-id="${b.id}"><span class="mini-slider"></span></label><span class="mini-label">${s.vandaag?'VANDAAG':'MEER'}</span></div><div class="toggle-col"><label class="mini-switch ${scopeIsGemeente?'checked':''} ${scopeIsGemeente?'scope-gemeente':'scope-regio'}" style="background:${scopeIsGemeente?'#0b5bd3':'#7c3aed'}"><input type="checkbox" ${scopeIsGemeente?'checked':''} data-type="scope" data-id="${b.id}"><span class="mini-slider"></span></label><span class="mini-label">${scopeIsGemeente?'GEMEENTE':'REGIO'}</span></div><div class="toggle-col"><label class="mini-switch aan ${s.aan?'checked':''}"><input type="checkbox" ${s.aan?'checked':''} data-type="aan" data-id="${b.id}"><span class="mini-slider"></span></label><span class="mini-label">${s.aan?'AAN':'UIT'}</span></div></div>`;
    list.appendChild(row);
  });
  list.querySelectorAll('input').forEach(inp=>{
    inp.addEventListener('change', (e)=>{
      const id=e.target.dataset.id; const type=e.target.dataset.type;
      if(!state[id]) state[id]={aan:true,vandaag:false,scope:'gemeente'};
      if(type==='vandaag') state[id].vandaag=e.target.checked;
      if(type==='scope') state[id].scope=e.target.checked?'gemeente':'regio';
      if(type==='aan') state[id].aan=e.target.checked;
      saveState(); renderFilters(); filterNews(); updateSourceLeds();
    });
  });
  setTimeout(()=>{ try{ updateSourceLeds(); }catch{} }, 50);
}
function updateHeaderCount(){ const aan=Object.values(state).filter(s=>s.aan).length; const countEl=document.getElementById('header-count'); if(countEl){ countEl.textContent=`${loadedSources.size||aan} v/d ${BRONNEN.length} bronnen`; } const btn=document.getElementById('btn-all'); if(btn){ btn.classList.remove('all-on','all-off','some-on'); if(aan===BRONNEN.length){ btn.classList.add('all-on'); btn.textContent='Alles aan'; }else if(aan===0){ btn.classList.add('all-off'); btn.textContent='Alles uit'; }else{ btn.classList.add('some-on'); btn.textContent='Alles aan/uit'; } } }
function openPanel(){ document.getElementById('filter-header')?.classList.add('open'); document.getElementById('source-panel')?.classList.add('open'); document.body.classList.add('panel-open'); try{ localStorage.setItem('ommen_filter_panel_open','1'); }catch{} }
function closePanel(){ document.getElementById('filter-header')?.classList.remove('open'); document.getElementById('source-panel')?.classList.remove('open'); document.body.classList.remove('panel-open'); try{ localStorage.setItem('ommen_filter_panel_open','0'); }catch{} }
function restorePanelState(){ try{ const open=localStorage.getItem('ommen_filter_panel_open'); if(open==='1'){ openPanel(); } }catch{} }
function resetFilters(){ BRONNEN.forEach(b=>state[b.id]={aan:true,vandaag:false,scope:'gemeente'}); saveState(); renderFilters(); filterNews(); }

// #2 FIX: Alles aan/uit geen dubbel-fire
function setupFilterHeader(){
  const fh=document.getElementById('filter-header'); if(!fh) return;
  const btnAll=document.getElementById('btn-all');
  if(btnAll && !btnAll.dataset.fixed){
    btnAll.dataset.fixed='1';
    let lastToggle=0;
    const toggleAll=(e)=>{
      if(e){ e.stopPropagation(); if(e.preventDefault) e.preventDefault(); }
      const now=Date.now(); if(now-lastToggle<400) return; // debounce
      lastToggle=now;
      const allOn=Object.values(state).every(s=>s.aan);
      BRONNEN.forEach(b=>{ if(!state[b.id]) state[b.id]={aan:true,vandaag:false,scope:'gemeente'}; state[b.id].aan=!allOn; });
      saveState(); renderFilters(); filterNews(); updateSourceLeds();
    };
    btnAll.addEventListener('click', toggleAll, {passive:false}); // alleen click, geen touchend
    btnAll.style.touchAction='manipulation';
  }
  if(!fh.dataset.headerFixed){
    fh.dataset.headerFixed='1';
    fh.addEventListener('click', (e)=>{
      if(e.target.closest('#bell-slot') || e.target.closest('#push-bell-btn')) return;
      if(e.target.id==='btn-all' || e.target.closest('#btn-all')) return;
      const p=document.getElementById('source-panel'); if(p.classList.contains('open')) closePanel(); else openPanel();
    });
  }
}

const WORKER='https://ommen-push-v2.leeuw008.workers.dev';
const SOURCE_CACHE_TTL=1000*60*5; const SOURCE_CACHE_STALE=1000*60*60; const SOURCE_CACHE_KEY='ommen_source_cache_v1';
function getSourceCache(){ try{return JSON.parse(localStorage.getItem(SOURCE_CACHE_KEY)||'{}');}catch{return {};}}
function setSourceCache(cache){ try{localStorage.setItem(SOURCE_CACHE_KEY, JSON.stringify(cache));}catch{}}
function getCachedSource(url){ const cache=getSourceCache(); const entry=cache[url]; if(!entry) return null; if(Date.now()-entry.ts>SOURCE_CACHE_TTL) return null; return entry.data; }
function getStaleSource(url){ const cache=getSourceCache(); const entry=cache[url]; if(!entry) return null; if(Date.now()-entry.ts>SOURCE_CACHE_STALE) return null; return entry.data; }
function putCachedSource(url, data){ if(!data||data.length<200) return; const cache=getSourceCache(); cache[url]={data, ts:Date.now()}; const keys=Object.keys(cache); if(keys.length>25){ const oldest=keys.sort((a,b)=>cache[a].ts-cache[b].ts)[0]; delete cache[oldest]; } setSourceCache(cache); }
async function fetchViaWorker(url){
  const controller=new AbortController(); const to=setTimeout(()=>controller.abort(), 6000);
  try{
    const r=await fetch(`${WORKER}/proxy?url=${encodeURIComponent(url)}&t=${Date.now()}`, {cache:'no-store', signal:controller.signal});
    clearTimeout(to); if(!r.ok) throw new Error('proxy fail '+r.status);
    const t=await r.text(); if(t.length<150) throw new Error('proxy empty'); if(t.includes('Proxy blocked')||t.includes('Just a moment')) throw new Error('cf challenge');
    putCachedSource(url, t); return t;
  }catch(e1){
    clearTimeout(to);
    try{ const r2=await fetch(url, {cache:'no-store'}); if(r2.ok){ const t2=await r2.text(); if(t2.length>500){ putCachedSource(url, t2); return t2; } } }catch{}
    throw e1;
  }
}
function parseRSSFull(xml, bronId){
  const max=MAX_PER_BRON[bronId]||10;
  let items=[...xml.matchAll(/<item[^>]*>([\s\S]*?)<\/item>/gi)]; if(items.length===0) items=[...xml.matchAll(/<entry[^>]*>([\s\S]*?)<\/entry>/gi)];
  items=items.slice(0,max);
  return items.map(m=>{
    const it=m[0]; let title=(it.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i)||[])[1]||''; title=title.replace(/<[^>]*>/g,'').trim();
    let link=(it.match(/<link[^>]*>([\s\S]*?)<\/link>/i)||[])[1]||''; if(!link||link.includes('<')){ const hrefMatch=it.match(/<link[^>]+href=["']([^"']+)["']/i); if(hrefMatch) link=hrefMatch[1]; }
    link=link.replace(/<!\[CDATA\[/g,'').replace(/\]\]>/g,'').trim(); if(!link.startsWith('http')){ const mm=it.match(/https?:\/\/[^\s<"\]]+/); if(mm) link=mm[0]; }
    let pub=(it.match(/<(pubDate|published|updated)[^>]*>([\s\S]*?)<\/(pubDate|published|updated)>/i)||[])[2]||''; let desc=(it.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i)||[])[1]||'';
    let useDesc=(desc||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim(); if(useDesc.length>180) useDesc=useDesc.slice(0,177)+' [...]'; else if(useDesc) useDesc=useDesc+' [...]';
    return {title, link, pubDate:pub?new Date(pub):new Date(), description:useDesc};
  }).filter(x=>x.link && x.title);
}

async function loadOneSource(b){
  const cfg=BRON_URLS[b.id];
  try{
    let arts=[];
    if(b.id==='Nieuwsbrief'){ const json=await fetchViaWorker(cfg.url); arts=parseNieuwsbriefECHT(json); }
    else if(cfg.type==='oost'){
      const html=await fetchViaWorker(cfg.url);
      let overview=parseOostFull(html);
      if(overview.length){ const tempArts=overview.map(a=>({...a, source:b.name, id:b.id, isFallback:false, pubDate:a.pubDate||new Date(), description:a.description||''})); allArticles=allArticles.filter(x=>x.id!==b.id).concat(tempArts); loadedSources.add(b.id); updateHeaderCount(); renderArticles(); updateSourceLeds(); }
      overview=await enrichOostWithDetail(overview); arts=overview;
    }
    else if(b.id==='RTV Vechtdal'){
      try{
        const html=await fetchViaWorker(cfg.homepage||'https://www.rtvvechtdal.nl/');
        let overview=parseRTVVechtdalFull(html);
        if(overview.length>0){
          const tempArts=overview.map(a=>({...a, source:b.name, id:b.id, isFallback:false, pubDate:a.pubDate, description:a.description}));
          allArticles=allArticles.filter(x=>x.id!==b.id).concat(tempArts); loadedSources.add(b.id); updateHeaderCount(); renderArticles();
          enrichVechtdalWithDetail(overview).then(enriched=>{ const enrichedArts=enriched.map(a=>({...a, source:b.name, id:b.id, isFallback:false})); allArticles=allArticles.filter(x=>x.id!==b.id).concat(enrichedArts); renderArticles(); updateSourceLeds(); }).catch(()=>{});
          arts=overview;
        }
      }catch(e){} if(arts.length===0){ try{ const xml=await fetchViaWorker(cfg.url); arts=parseRSSFull(xml,b.id); }catch(e){} }
    }
    else if(b.id==='Vechtdal Centraal'){ try{ const xml=await fetchViaWorker(cfg.url); if(xml.includes('<rss')||xml.includes('<feed')||xml.includes('<item')) arts=parseRSSFull(xml,b.id); else arts=parseVechtdalCentraalFallback(xml); }catch(e){} if(arts.length===0){ try{ const html=await fetchViaWorker(cfg.fallback||cfg.homepage); arts=parseVechtdalCentraalFallback(html); }catch(e){} } }
    else { try{ const xml=await fetchViaWorker(cfg.url); arts=parseRSSFull(xml, b.id); }catch(e){ throw e; } }
    if(arts.length===0) throw new Error('empty');
    return arts.map(a=>({...a, source:b.name, id:b.id, isFallback:false}));
  }catch(e){ console.log('load fail', b.id, e.message); return [{title:b.name, link:cfg.homepage, pubDate:new Date(0), description:'Bron tijdelijk offline - homepage [...]', source:b.name, id:b.id, isFallback:true}]; }
}
function isSameDay(d1,d2){ if(!d1||!d2||isNaN(d1.getTime())||isNaN(d2.getTime())) return false; return d1.getFullYear()===d2.getFullYear() && d1.getMonth()===d2.getMonth() && d1.getDate()===d2.getDate(); }
function formatDate(d){ if(!d||isNaN(d.getTime())||d.getTime()===0) return ''; const dateStr=d.toLocaleDateString('nl-NL',{day:'numeric', month:'short'}); if(d.getHours()===0&&d.getMinutes()===0&&d.getSeconds()===0) return dateStr; const timeStr=d.toLocaleTimeString('nl-NL',{hour:'2-digit', minute:'2-digit'}); return `${dateStr} ${timeStr}`; }

function renderArticles(){
  const container=document.getElementById('news-container'); if(!container) return;
  const search=(document.getElementById('search-input')?.value||'').toLowerCase();
  const today=new Date();
  const localEcht=getLocalEchtAsArticles();
  let allWithEcht=[...localEcht, ...allArticles];
  let filtered=allWithEcht.filter(a=>{
    const s=state[a.id]; if(!s||!s.aan) return false;
    if(s.vandaag){ if(a.isFallback) return false; if(!a.pubDate||isNaN(a.pubDate.getTime())) return false; if(!isSameDay(a.pubDate, today)) return false; }
    if(s.scope==='gemeente'){ if(!a.isEcht && !isGemeenteArtikel(a)) return false; }
    return true;
  });
  if(search) filtered=filtered.filter(a=> (a.title+' '+a.description+' '+a.source).toLowerCase().includes(search));
  filtered=filtered.sort((a,b)=>b.pubDate-a.pubDate);

  const highlightUrl=getHighlightUrl(); const echtId=getEchtId();
  let highlightActive=false; let isEchtHighlight=false; let bannerHtml='';
  if(highlightUrl||echtId){
    const searchVal=highlightUrl||echtId;
    const found=filtered.find(a=> a.link===searchVal || (a.echtId && (a.echtId===searchVal || searchVal.includes(a.echtId))) || a.link.includes(searchVal) || searchVal.includes(a.link)) || allWithEcht.find(a=> a.echtId===searchVal || a.link===searchVal || a.link.includes(searchVal));
    if(found){
      highlightActive=true; isEchtHighlight=found.isEcht||false;
      const bannerClass=isEchtHighlight?'highlight-banner echt':'highlight-banner';
      const bannerText=isEchtHighlight?'🔴 Belangrijk ECHT bericht':'🔔 Nieuw artikel via push';
      bannerHtml=`<div class="${bannerClass}"><span>${bannerText}</span><button onclick="clearHighlight()">Toon overzicht</button></div>`;
      filtered=[found];
    }else if(searchVal && searchVal.startsWith('http')){
      highlightActive=true;
      bannerHtml=`<div class="highlight-banner"><span>🔔 Nieuw artikel</span><div style="display:flex;gap:8px"><a href="${searchVal}" target="_blank" style="background:white;color:#0b5bd3;padding:8px 14px;border-radius:999px;font-weight:700;text-decoration:none">Open artikel</a><button onclick="clearHighlight()">Toon overzicht</button></div></div>`;
      filtered=[];
    }
  }

  const realCount=filtered.filter(a=>!a.isFallback).length;
  const countHtml=highlightActive?bannerHtml:`<div class="articles-count">${realCount} artikelen - ${loadedSources.size} v/d ${BRONNEN.length} bronnen geladen</div>`;
  if(filtered.length===0 && !highlightActive){ container.innerHTML=countHtml+'<div class="article">Geen artikelen</div>'; return; }
  if(filtered.length===0 && highlightActive){ container.innerHTML=countHtml+`<div class="article" style="padding:20px;text-align:center;color:#666">Artikel wordt geladen...<br><br><a href="${highlightUrl}" target="_blank" style="color:#0b5bd3;font-weight:700">Direct openen</a></div>`; return; }
  const html=filtered.map(a=>{
    const cleanTitle=a.title.replace(/^\[[^\]]+\]\s*/,'').trim()||a.title;
    let hlClass=''; if(highlightActive){ hlClass=a.isEcht?' echt-highlighted':' highlighted'; }
    if(a.isFallback){ return `<div class="article fallback${hlClass}" data-source="${a.id}"><h2><a href="${a.link}" target="_blank">${a.source}</a></h2><small>${a.source}${a.pubDate.getTime()?` - ${formatDate(a.pubDate)}`:''}</small><div style="margin-top:6px;color:#666;">${a.description}</div></div>`; }
    const descHtml=a.description && a.description.trim().length>5?`<div style="margin-top:6px;color:#555;">${a.description}</div>`:'';
    const echtBadge=a.isEcht?`<span style="background:#dc2626;color:white;font-size:10px;padding:2px 6px;border-radius:99px;margin-left:8px;font-weight:800">ECHT</span>`:'';
    return `<div class="article${hlClass}" data-source="${a.id}"><h2><a href="${a.link}" target="_blank">${cleanTitle}</a>${echtBadge}</h2><small>${a.source} - ${formatDate(a.pubDate)}</small>${descHtml}</div>`;
  }).join('');
  container.innerHTML=countHtml+html;
  if(highlightActive){ setTimeout(()=>{ const el=document.querySelector('.article.highlighted, .article.echt-highlighted'); if(el) el.scrollIntoView({behavior:'smooth', block:'center'}); }, 300); }
  window.getAllArticles=()=>filtered;
  try{ if(typeof updateSourceLeds==='function') setTimeout(()=>updateSourceLeds(),20); }catch{}
}
function filterNews(){ renderArticles(); }
async function refreshNews(){
  const c=document.getElementById('news-container'); let hasStale=false; const initialArts=[];
  try{ for(const b of BRONNEN){ const cfg=BRON_URLS[b.id]; const cachedData=getCachedSource(cfg.url)||getStaleSource(cfg.url); if(cachedData){ try{ let arts=[]; if(b.id==='Nieuwsbrief'){ arts=[]; } else if(cfg.type==='oost') arts=parseOostFull(cachedData); else if(b.id==='RTV Vechtdal'){ try{ arts=parseRTVVechtdalFull(cachedData); }catch{} if(arts.length===0) arts=parseRSSFull(cachedData,b.id); } else if(b.id==='Vechtdal Centraal'){ if(cachedData.includes('<rss')||cachedData.includes('<item')) arts=parseRSSFull(cachedData,b.id); else arts=parseVechtdalCentraalFallback(cachedData); } else arts=parseRSSFull(cachedData,b.id); if(arts.length>0){ initialArts.push(...arts.map(a=>({...a, source:b.name, id:b.id, isFallback:false}))); hasStale=true; } }catch(e){} } } }catch(e){}
  if(hasStale && initialArts.length>0){ allArticles=initialArts; loadedSources=new Set(BRONNEN.map(b=>b.id)); updateHeaderCount(); renderArticles(); renderFilters(); updateSourceLeds(); }else{ if(c) c.innerHTML='<div class="article">Bezig met laden... (10 bronnen) - eerste keer iets langer, daarna <1 sec</div>'; allArticles=[]; loadedSources=new Set(); updateHeaderCount(); }
  const loadWithTimeout=async(b)=>{ try{ const timeout=new Promise((_,rej)=> setTimeout(()=>rej(new Error('timeout '+b.id)), 8000)); const arts=await Promise.race([loadOneSource(b), timeout]); return {b, arts}; }catch(e){ if(hasStale) return {b, arts:[]}; return {b, arts:[{title:b.name, link:BRON_URLS[b.id].homepage, pubDate:new Date(0), description:'Bron tijdelijk offline - '+e.message.slice(0,80)+' [...]', source:b.name, id:b.id, isFallback:true}]}; } };
  const results=await Promise.allSettled(BRONNEN.map(b=>loadWithTimeout(b))); const freshArts=[]; results.forEach(r=>{ if(r.status==='fulfilled'){ const {b, arts}=r.value; if(arts.length>0) freshArts.push(...arts); loadedSources.add(b.id); } }); if(freshArts.length>0) allArticles=freshArts; updateHeaderCount(); renderArticles(); renderFilters(); updateSourceLeds(); console.log('refreshNews klaar v305 FINAL', allArticles.length);
}
document.addEventListener('DOMContentLoaded', ()=>{ loadState(); renderFilters(); saveState(); restorePanelState(); setupFilterHeader(); document.getElementById('search-input')?.addEventListener('input', filterNews); setTimeout(()=>refreshNews(), 200); });
window.clearHighlight=clearHighlight; window.closePanel=closePanel; window.resetFilters=resetFilters; window.BRONNEN=BRONNEN; window.getAppState=()=>state; window.filterNews=filterNews; window.refreshNews=refreshNews; window.saveEchtMessage=saveEchtMessage;
(function(){
  const SYNC_ENABLED=true; let currentUser=null; let authToken=localStorage.getItem('ommen_auth_token')||null; let lastRemoteUpdated=parseInt(localStorage.getItem('ommen_last_sync')||'0',10); let isSyncing=false; let lastSavedStateStr=''; try{ lastSavedStateStr=localStorage.getItem('nieuwsommen_bronnen_v2')||''; }catch{}
  function getAuthHeaders(){ return authToken?{'Authorization': 'Bearer '+authToken, 'Content-Type':'application/json'}:{'Content-Type':'application/json'}; }
  async function checkLogin(){ if(!authToken) return null; try{ const r=await fetch(WORKER+'/auth/me',{headers:getAuthHeaders()}); if(!r.ok) return null; const u=await r.json(); currentUser=u.user||u; return currentUser; }catch{ return null; } }
  window.loginOmmen=async function(email,password){ const r=await fetch(WORKER+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})}); const j=await r.json(); if(!r.ok) throw new Error(j.error||'Login mislukt'); authToken=j.token; localStorage.setItem('ommen_auth_token',authToken); currentUser={id:j.id||j.user?.id,email:j.email||j.user?.email}; await loadFromCloud(true); updateAuthUI(); return j; };
  window.registerOmmen=async function(email,password){ const r=await fetch(WORKER+'/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})}); const j=await r.json(); if(!r.ok) throw new Error(j.error||'Registratie mislukt'); authToken=j.token; localStorage.setItem('ommen_auth_token',authToken); currentUser={id:j.id||j.user?.id,email:j.email||j.user?.email}; await saveToCloud(); updateAuthUI(); return j; };
  window.logoutOmmen=function(){ if(authToken) fetch(WORKER+'/auth/logout',{method:'POST',headers:getAuthHeaders(),body:JSON.stringify({token:authToken})}).catch(()=>{}); authToken=null; currentUser=null; localStorage.removeItem('ommen_auth_token'); localStorage.removeItem('ommen_last_sync'); lastRemoteUpdated=0; updateAuthUI(); };
  let pendingSave=false;
  async function saveToCloud(){
    if(!authToken||!SYNC_ENABLED) return; const currentStr=JSON.stringify(state); if(currentStr===lastSavedStateStr) return; if(isSyncing){ pendingSave=true; return; }
    try{ isSyncing=true; const r=await fetch(WORKER+'/sync/save',{method:'POST',headers:getAuthHeaders(),body:JSON.stringify({state})}); const j=await r.json().catch(()=>({})); if(r.ok && (j.ok||j.updated)){ const updated=j.updated||Date.now(); lastRemoteUpdated=updated; localStorage.setItem('ommen_last_sync',String(updated)); lastSavedStateStr=currentStr; try{ localStorage.setItem('nieuwsommen_bronnen_v2',currentStr); }catch{} } }catch(e){} finally{ isSyncing=false; if(pendingSave){ pendingSave=false; setTimeout(()=>saveToCloud(),300); } }
  }
  async function loadFromCloud(force=false){
    if(!authToken) return false; if(isSyncing && !force) return false; let didUpdate=false;
    try{
      if(!force) isSyncing=true;
      const r=await fetch(WORKER+'/sync/load',{headers:getAuthHeaders()}); if(!r.ok) return false; const data=await r.json(); if(!data.state) return false;
      const remoteUpdated=data.updated||0; const localSaved=parseInt(localStorage.getItem('ommen_last_sync')||'0',10);
      if(!force && remoteUpdated && localSaved && remoteUpdated<=localSaved) return false;
      if(!force && remoteUpdated && remoteUpdated<=lastRemoteUpdated && lastRemoteUpdated!==0) return false;
      const localStr=JSON.stringify(state); const remoteStr=JSON.stringify(data.state);
      if(localStr===remoteStr){ if(remoteUpdated){ lastRemoteUpdated=remoteUpdated; localStorage.setItem('ommen_last_sync',String(remoteUpdated)); lastSavedStateStr=localStr; } return false; }
      if(!force && lastSavedStateStr && localStr!==lastSavedStateStr) return false; // #1 FIX: lokale wijziging wint
      state=data.state; try{ BRONNEN.forEach(b=>{ if(!state[b.id]) state[b.id]={aan:true, vandaag:false, scope:'gemeente'}; }); }catch{}
      localStorage.setItem('nieuwsommen_bronnen_v2', JSON.stringify(state)); lastRemoteUpdated=remoteUpdated||Date.now(); localStorage.setItem('ommen_last_sync',String(lastRemoteUpdated)); lastSavedStateStr=JSON.stringify(state);
      if(typeof renderFilters==='function'){ renderFilters(); } if(typeof filterNews==='function'){ filterNews(); } if(typeof updateHiddenCompat==='function'){ updateHiddenCompat(); } if(typeof updateHeaderCount==='function'){ updateHeaderCount(); }
      didUpdate=true;
    }catch(e){} finally{ isSyncing=false; } return didUpdate;
  }
  let liveInterval=null; function startLiveSync(){ stopLiveSync(); if(!authToken) return; } function stopLiveSync(){ if(liveInterval){ clearInterval(liveInterval); liveInterval=null; } }
  function updateAuthUI(){ const btn=document.getElementById('user-icon-btn'); if(!btn) return; if(currentUser){ btn.classList.add('logged-in'); btn.title=currentUser.email+' - ingelogd'; }else{ btn.classList.remove('logged-in'); btn.title='Inloggen / Account maken'; } }
  if(typeof saveState==='function'){ const origSave=saveState; let saveTimeout=null; window.saveState=function(){ try{ origSave(); }catch{} const cur=JSON.stringify(state); lastSavedStateStr=cur; try{ localStorage.setItem('nieuwsommen_bronnen_v2',cur); }catch{} if(authToken){ if(saveTimeout) clearTimeout(saveTimeout); saveTimeout=setTimeout(()=>{saveToCloud();},1000); } }; }
  document.addEventListener('DOMContentLoaded', function(){ setTimeout(async function(){ try{ lastSavedStateStr=localStorage.getItem('nieuwsommen_bronnen_v2')||JSON.stringify(state); }catch{} await checkLogin(); if(currentUser){ await loadFromCloud(true); } updateAuthUI(); },800); });
})();
(function(){
  function getSelectedSourcesForSW(){ try{ if(typeof state!=='object') return []; const selected=[]; for(const bron of BRONNEN){ const s=state[bron.id]; if(s&&s.aan){ selected.push(bron.id); } } return selected; }catch(e){ return []; } }
  window.pushFiltersToSW=function(){ const sources=getSelectedSourcesForSW(); try{ if(navigator.serviceWorker&&navigator.serviceWorker.controller){ navigator.serviceWorker.controller.postMessage({type:'SET_FILTERS',sources:sources}); } navigator.serviceWorker.ready.then(reg=>{ if(reg.active) reg.active.postMessage({type:'SET_FILTERS',sources:sources}); }).catch(()=>{}); }catch(e){} };
  document.addEventListener('DOMContentLoaded', ()=>{ setTimeout(()=>{ try{ window.pushFiltersToSW(); }catch(e){} },1500); });
})();
