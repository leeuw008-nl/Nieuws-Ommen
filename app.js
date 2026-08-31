// app.js v305 - FIX Gemeente Ommen datum + tijd - we hadden dit eerder opgelost
// Gebaseerd op v297b (stabiel groen) + alleen Gemeente parser fix
// Overzicht https://www.ommen.nl/actueel/ heeft datum zonder tijd
// Artikel pagina https://www.ommen.nl/actueel/xxx heeft datum + tijd zoals "9 maart 2026, 11:25"
// FIX v305: 2-staps: eerst overzicht voor datum, daarna per artikel detail pagina fetchen voor tijd

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

// Helper: parse Dutch date + optional time
function parseGemeenteDateTime(str){
  if(!str) return null;
  try{
    const months={januari:0,februari:1,maart:2,april:3,mei:4,juni:5,juli:6,augustus:7,september:8,oktober:9,november:10,december:11};
    // Format: "9 maart 2026, 11:25" or "11 juli 2025, 14:20" or "9 maart 2026" or "2026-03-09"
    // Try with time first
    let m = str.toLowerCase().match(/(\d{1,2})\s+([a-z]+)\s+(\d{4}),?\s+(\d{1,2}):(\d{2})/);
    if(m && months[m[2]]!==undefined){
      const d=new Date(parseInt(m[3]), months[m[2]], parseInt(m[1]), parseInt(m[4]), parseInt(m[5]));
      if(!isNaN(d.getTime())) return d;
    }
    m = str.toLowerCase().match(/(\d{1,2})\s+([a-z]+)\s+(\d{4})/);
    if(m && months[m[2]]!==undefined){
      const d=new Date(parseInt(m[3]), months[m[2]], parseInt(m[1]), 10, 0, 0); // default 10:00 als geen tijd
      if(!isNaN(d.getTime())) return d;
    }
    m = str.match(/(\d{4})-(\d{2})-(\d{2})/);
    if(m){ const d=new Date(parseInt(m[1]), parseInt(m[2])-1, parseInt(m[3]), 10,0,0); if(!isNaN(d.getTime())) return d; }
    // ISO datetime
    m = str.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/);
    if(m){ const d=new Date(m[1]); if(!isNaN(d.getTime())) return d; }
  }catch{}
  return null;
}

// v305 FIX: overzicht + detail
function parseGemeenteOverviewWithDate(html){
  const items=[]; const seen=new Set();
  // Op overzicht staan artikelen als: <a href="/actueel/xxx">Titel</a> met datum in buurt
  // Zoek pattern: datum staat vaak als "6 mei 2026" vlakbij link
  const re = /<a[^>]+href=["']([^"']+\/actueel\/[^"']+)["'][^>]*>([^<]{10,200})<\/a>/gi;
  let m; let idx=0;
  while((m=re.exec(html))!==null && items.length<15){
    let link=m[1]; if(link.startsWith('/')) link='https://www.ommen.nl'+link;
    if(seen.has(link)) continue;
    const title=m[2].trim();
    // Zoek datum in 600 chars rond link
    const pos=m.index;
    const context = html.substring(Math.max(0,pos-300), Math.min(html.length, pos+800));
    let pubDate=null;
    // Probeer datum te vinden in context (overzicht heeft alleen datum, geen tijd)
    let dateMatch = context.match(/(\d{1,2}\s+[a-z]+\s+\d{4})/i);
    if(dateMatch) pubDate=parseGemeenteDateTime(dateMatch[1]);
    if(!pubDate){
      dateMatch = context.match(/(\d{4}-\d{2}-\d{2})/);
      if(dateMatch) pubDate=parseGemeenteDateTime(dateMatch[1]);
    }
    if(!pubDate){
      // fallback: geen datum in overzicht -> geef oude datum, wordt later overschreven door detail pagina
      pubDate = new Date(Date.now() - (idx*3+5)*24*60*60*1000);
      pubDate.setHours(10,0,0,0);
    }
    seen.add(link);
    items.push({title, link, pubDate, description:title+' [...]', _needsDetail:true, _overviewDate:pubDate});
    idx++;
  }
  return items;
}

async function enrichGemeenteWithTime(items, fetchViaWorker){
  // Voor elk artikel: fetch detail pagina voor echte tijd zoals "9 maart 2026, 11:25"
  const enriched=[];
  for(let i=0; i<items.length; i++){
    const item=items[i];
    try{
      // Alleen detail fetchen voor eerste 8 artikelen om niet te veel requests te doen
      if(i<8){
        const html = await fetchViaWorker(item.link);
        // In artikel pagina staat datum + tijd als "9 maart 2026, 11:25" of "11 juli 2025,\n 14:20"
        // Zoek: <div>9 maart 2026, 11:25</div> of vergelijkbaar
        let dateTimeMatch = html.match(/(\d{1,2}\s+[a-z]+\s+\d{4},?\s*\d{1,2}:\d{2})/i);
        if(!dateTimeMatch){
          // Probeer met newline tussen datum en tijd
          dateTimeMatch = html.match(/(\d{1,2}\s+[a-z]+\s+\d{4},?\s*\n?\s*\d{1,2}:\d{2})/i);
        }
        if(!dateTimeMatch){
          // Zoek time tag
          const timeTag = html.match(/<time[^>]*>([^<]+)<\/time>/i);
          if(timeTag) dateTimeMatch = [null, timeTag[1]];
        }
        if(dateTimeMatch){
          const parsed = parseGemeenteDateTime(dateTimeMatch[1]);
          if(parsed){
            console.log('[v305] Gemeente detail datum+tijd gevonden voor', item.title.slice(0,30), ':', dateTimeMatch[1], '->', parsed.toLocaleString('nl-NL'));
            item.pubDate = parsed;
            item._hasRealTime = true;
          } else {
            console.log('[v305] Gemeente kon datum niet parsen:', dateTimeMatch[1], 'behoud overzicht datum', item._overviewDate.toLocaleDateString());
          }
        } else {
          console.log('[v305] Gemeente geen tijd gevonden op detail pagina voor', item.title.slice(0,30), 'behoud overzicht datum');
        }
        // Kleine delay om server niet te spammen
        await new Promise(r=>setTimeout(r, 300));
      }
    }catch(e){
      console.log('[v305] Gemeente detail fetch fail voor', item.link, e.message);
    }
    enriched.push(item);
  }
  // Sorteer op echte datum+tijd nieuwste eerst
  enriched.sort((a,b)=> b.pubDate - a.pubDate);
  return enriched;
}

function parseNieuwsbriefECHT(json){
  try{
    const data = typeof json === 'string' ? JSON.parse(json) : json;
    const items = data.items || [];
    return items.map(it=>{
      let pubDate = new Date(); if(it.pubDate){ const d=new Date(it.pubDate); if(!isNaN(d.getTime())) pubDate=d; }
      return {title: (it.title||'Nieuwsbrief').slice(0,120), link:it.link||'https://nieuwommen.leeuw008.nl/', pubDate, description:(it.description||it.title||'').slice(0,200)+' [...]', source:'Nieuwsbrief', id:'Nieuwsbrief'};
    }).slice(0,10);
  }catch{ return []; }
}
function parseRSSFull(xml){ const items=[...xml.matchAll(/<item[^>]*>([\s\S]*?)<\/item>/gi)].slice(0,25); return items.map(m=>{ const it=m[1]; const title=(it.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i)||[])[1]||''; let link=(it.match(/<link[^>]*>([\s\S]*?)<\/link>/i)||[])[1]||''; link=link.replace(/<!\[CDATA\[|\]\]>/g,'').trim(); if(!link.startsWith('http')){ const mm=it.match(/https?:\/\/[^\s<"]+/); if(mm) link=mm[0]; } const desc=(it.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i)||[])[1]||''; const pub=(it.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)||[])[1]||''; let pd=new Date(); if(pub){ const d=new Date(pub); if(!isNaN(d.getTime())) pd=d; } return {title:title.replace(/<[^>]*>/g,'').trim().slice(0,120), link, pubDate:pd, description:desc.replace(/<[^>]*>/g,' ').trim().slice(0,200)+' [...]'}; }).filter(x=>x.link && x.title); }

const GEMEENTE_PLAATSEN = ['Ommen','Lemele','Vilsteren','Beerze','Beerzerveld','Witharen','Archem','Arriën','Arriërveld','Besthmen','Dalmsholte','Eerde','Emsland','Giethmen','Hoogengraven','Junne','Nieuwebrug','Ommerbosch','Ommerkanaal','Ommerschans','Ommerveld','Rotbrink','Stegeren','Stegerveld','Varsen','Vinkenbuurt','Zeesse','Stegeren','Beerzerpoort','Ommerschans'];
const GEMEENTE_ZOEK = GEMEENTE_PLAATSEN.map(p=>p.toLowerCase());
function isGemeenteArtikel(art){ const txt = (art.title + ' ' + (art.description||'')).toLowerCase(); return GEMEENTE_ZOEK.some(pl => txt.includes(pl)); }

let state = {}; let allArticles = []; let loadedSources = new Set();

(function injectLedStyles(){
  const css = `.source-row{position:relative}.source-led{width:12px;height:12px;border-radius:999px;display:block;flex-shrink:0}.source-led.loading{background:#ef4444;animation:pulse-red 1.2s infinite}.source-led.ok{background:#16a34a}.source-led.fail{background:#ef4444}.source-led.empty{background:#f59e0b}@keyframes pulse-red{0%{transform:scale(1)}50%{transform:scale(1.25)}100%{transform:scale(1)}}.source-row[data-id="Nieuwsbrief"]{background:linear-gradient(90deg,#f0fdf4 0%,#fff 100%);border-left:3px solid #16a34a;}.source-row[data-id="Nieuwsbrief"] .source-name span:first-child{font-weight:800;}`;
  const el=document.createElement('style'); el.id='led-style-v305'; el.textContent=css; if(!document.getElementById('led-style-v305')) document.head.appendChild(el);
})();
function updateSourceLeds(){ BRONNEN.forEach(b=>{ const led=document.querySelector(`.source-led[data-id="${b.id}"]`); if(!led) return; const realArts = allArticles.filter(a=>a.id===b.id && !a.isFallback); const isLoaded = loadedSources.has(b.id); led.className='source-led '+( !isLoaded?'loading' : realArts.length>0?'ok' : 'fail'); }); }
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
function openPanel(){ document.getElementById('filter-header')?.classList.add('open'); document.getElementById('source-panel')?.classList.add('open'); }
function closePanel(){ document.getElementById('filter-header')?.classList.remove('open'); document.getElementById('source-panel')?.classList.remove('open'); }
function resetFilters(){ BRONNEN.forEach(b=>state[b.id]={aan:true,vandaag:false,scope:'gemeente'}); saveState(); renderFilters(); filterNews(); }
function setupFilterHeader(){ const fh=document.getElementById('filter-header'); if(!fh) return; fh.addEventListener('click',e=>{ if(e.target.closest('#bell-slot')) return; if(e.target.id==='btn-all' || e.target.closest('#btn-all')){ e.stopPropagation(); const allOn=Object.values(state).every(s=>s.aan); BRONNEN.forEach(b=>state[b.id].aan=!allOn); saveState(); renderFilters(); filterNews(); return; } const p=document.getElementById('source-panel'); if(p.classList.contains('open')) closePanel(); else openPanel(); }); }

const WORKER='https://ommen-push-v2.leeuw008.workers.dev';
const SOURCE_CACHE_TTL = 1000 * 60 * 5; const SOURCE_CACHE_STALE = 1000 * 60 * 60; const SOURCE_CACHE_KEY = 'ommen_source_cache_v1';
function getSourceCache(){ try{return JSON.parse(localStorage.getItem(SOURCE_CACHE_KEY)||'{}');}catch{return {};}}
function setSourceCache(cache){ try{localStorage.setItem(SOURCE_CACHE_KEY, JSON.stringify(cache));}catch{}}
function getCachedSource(url){ const cache=getSourceCache(); const entry=cache[url]; if(!entry) return null; if(Date.now() - entry.ts > SOURCE_CACHE_TTL) return null; return entry.data; }
function getStaleSource(url){ const cache=getSourceCache(); const entry=cache[url]; if(!entry) return null; if(Date.now() - entry.ts > SOURCE_CACHE_STALE) return null; return entry.data; }
function putCachedSource(url, data){ if(!data || data.length<200) return; const cache=getSourceCache(); cache[url]={data, ts:Date.now()}; setSourceCache(cache); }
async function fetchViaWorker(url){
  const controller = new AbortController(); const to = setTimeout(()=>controller.abort(), 8000);
  try{
    const r = await fetch(`${WORKER}/proxy?url=${encodeURIComponent(url)}&t=${Date.now()}`, {cache:'no-store', signal:controller.signal});
    clearTimeout(to); if(!r.ok) throw new Error('proxy fail '+r.status); const t = await r.text();
    if(t.length<150) throw new Error('proxy empty'); putCachedSource(url, t); return t;
  }catch(e1){
    clearTimeout(to);
    try{ const r2 = await fetch(url, {cache:'no-store'}); if(r2.ok){ const t2 = await r2.text(); if(t2.length>500){ putCachedSource(url, t2); return t2; } } }catch{}
    throw e1;
  }
}

async function loadOneSource(b){
  const cfg=BRON_URLS[b.id];
  try{
    let arts=[];
    if(b.id==='Nieuwsbrief'){ const json=await fetchViaWorker(cfg.url); arts=parseNieuwsbriefECHT(json); }
    else if(cfg.type==='gemeente'){
      const html=await fetchViaWorker(cfg.url);
      const overviewItems=parseGemeenteOverviewWithDate(html);
      console.log('[v305] Gemeente overzicht', overviewItems.length, 'artikelen, nu detail tijd ophalen...');
      arts=await enrichGemeenteWithTime(overviewItems, fetchViaWorker);
    }
    else { const xml=await fetchViaWorker(cfg.url); arts=parseRSSFull(xml); }
    if(arts.length===0) throw new Error('empty'); return arts.map(a=>({...a, source:b.name, id:b.id, isFallback:false}));
  }catch(e){ console.log('load fail', b.id, e.message); return [{title:b.name, link:cfg.homepage, pubDate:new Date(0), description:'Bron tijdelijk offline', source:b.name, id:b.id, isFallback:true}]; }
}
function isSameDay(d1,d2){ if(!d1 || !d2 || isNaN(d1.getTime())) return false; return d1.getFullYear()===d2.getFullYear() && d1.getMonth()===d2.getMonth() && d1.getDate()===d2.getDate(); }
function formatDate(d){ if(!d || isNaN(d.getTime()) || d.getTime()===0) return ''; return d.toLocaleDateString('nl-NL',{day:'numeric', month:'short'})+' '+d.toLocaleTimeString('nl-NL',{hour:'2-digit', minute:'2-digit'}); }
function renderArticles(){
  const container=document.getElementById('news-container'); if(!container) return;
  const search = (document.getElementById('search-input')?.value||'').toLowerCase();
  const today = new Date();
  let filtered = allArticles.filter(a=>{ const s=state[a.id]; if(!s || !s.aan) return false; if(s.vandaag){ if(a.isFallback) return false; if(!isSameDay(a.pubDate, today)) return false; } if(s.scope==='gemeente'){ if(!isGemeenteArtikel(a)) return false; } return true; });
  if(search) filtered = filtered.filter(a=> (a.title+' '+a.description+' '+a.source).toLowerCase().includes(search));
  filtered = filtered.sort((a,b)=>b.pubDate - a.pubDate);
  const realCount = filtered.filter(a=>!a.isFallback).length;
  const countHtml = `<div class="articles-count">${realCount} artikelen - ${loadedSources.size} v/d ${BRONNEN.length} bronnen geladen</div>`;
  if(filtered.length===0){ container.innerHTML = countHtml + '<div class="article">Geen artikelen - zet filter op MEER of REGIO</div>'; return; }
  container.innerHTML = countHtml + filtered.map(a=>{
    const cleanTitle = a.title.replace(/^\[[^\]]+\]\s*/,'').trim() || a.title;
    return `<div class="article" data-source="${a.id}"><h2><a href="${a.link}" target="_blank">${cleanTitle}</a></h2><small>${a.source} - ${formatDate(a.pubDate)}</small><div style="margin-top:6px;color:#555;">${a.description}</div></div>`;
  }).join('');
}
function filterNews(){ renderArticles(); }
async function refreshNews(){
  const c=document.getElementById('news-container'); c.innerHTML='<div class="article">Bezig met laden... Gemeente met datum+tijd fix v305 (duurt 5 sec langer door detail fetches)...</div>';
  allArticles=[]; loadedSources=new Set();
  const results=await Promise.allSettled(BRONNEN.map(async b=>{ const arts=await loadOneSource(b); return {b, arts}; }));
  const freshArts=[]; results.forEach(r=>{ if(r.status==='fulfilled'){ const {b, arts}=r.value; if(arts.length>0) freshArts.push(...arts); loadedSources.add(b.id); } });
  allArticles=freshArts; updateHeaderCount(); renderArticles(); renderFilters();
}
document.addEventListener('DOMContentLoaded', ()=>{
  loadState(); renderFilters(); saveState(); setupFilterHeader();
  document.getElementById('search-input')?.addEventListener('input', filterNews);
  setTimeout(()=>refreshNews(), 200);
});
window.closePanel=closePanel; window.resetFilters=resetFilters; window.BRONNEN=BRONNEN;
