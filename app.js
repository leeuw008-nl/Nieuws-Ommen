// app.js v307 - FIX Gemeente titel 2x -> echte beschrijving terug, zoals vroeger
// Alleen verschil met v306: parseGemeente haalt nu ook echte beschrijving uit detail pagina
// Opmaak NieuwOmmen vet + Nieuwsbrief updates & releases klein blijft
// Gemeente datum+tijd fix blijft

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

(function(){ const v='v307'; if(localStorage.getItem('ommen_app_version')!==v){ localStorage.removeItem('ommen_source_cache_v1'); localStorage.setItem('ommen_app_version', v); } })();

function parseGemeenteDateTime(str){
  if(!str) return null;
  try{
    const months={januari:0,februari:1,maart:2,april:3,mei:4,juni:5,juli:6,augustus:7,september:8,oktober:9,november:10,december:11};
    let m = str.toLowerCase().match(/(\d{1,2})\s+([a-z]+)\s+(\d{4}),?\s*(\d{1,2}):(\d{2})/);
    if(m && months[m[2]]!==undefined) return new Date(parseInt(m[3]), months[m[2]], parseInt(m[1]), parseInt(m[4]), parseInt(m[5]));
    m = str.toLowerCase().match(/(\d{1,2})\s+([a-z]+)\s+(\d{4})/);
    if(m && months[m[2]]!==undefined) return new Date(parseInt(m[3]), months[m[2]], parseInt(m[1]), 10,0,0);
    m = str.match(/(\d{4})-(\d{2})-(\d{2})/);
    if(m) return new Date(parseInt(m[1]), parseInt(m[2])-1, parseInt(m[3]), 10,0,0);
  }catch{} return null;
}

function extractGemeenteDescription(html){
  try{
    // Probeer meta description
    let m = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
    if(m && m[1].length>20) return m[1].trim().slice(0,200);
    m = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
    if(m && m[1].length>20) return m[1].trim().slice(0,200);
    // Probeer eerste paragraaf na h1
    m = html.match(/<h1[^>]*>[\s\S]*?<\/h1>[\s\S]{0,500}?<p[^>]*>([^<]{20,400})<\/p>/i);
    if(m){
      let txt = m[1].replace(/<[^>]*>/g,'').trim();
      if(txt.length>20) return txt.slice(0,200);
    }
    // Probeer article content eerste p
    m = html.match(/<article[^>]*>[\s\S]*?<p[^>]*>([^<]{20,400})<\/p>/i);
    if(m){
      let txt = m[1].replace(/<[^>]*>/g,'').trim();
      if(txt.length>20) return txt.slice(0,200);
    }
    // Fallback: zoek langste p tag
    const ps = [...html.matchAll(/<p[^>]*>([^<]{30,400})<\/p>/gi)].map(x=>x[1].replace(/<[^>]*>/g,'').trim()).filter(t=>t.length>30 && !t.toLowerCase().includes('cookie') && !t.toLowerCase().includes('gemeente ommen gebruikt'));
    if(ps.length>0) return ps[0].slice(0,200);
  }catch{}
  return null;
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
      if(i<8){
        const html = await fetchViaWorker(item.link);
        // datum + tijd
        let match = html.match(/(\d{1,2}\s+[a-z]+\s+\d{4},?\s*\d{1,2}:\d{2})/i) || html.match(/<time[^>]*>([^<]+)<\/time>/i);
        if(match){
          const parsed = parseGemeenteDateTime(match[1]||match[0]);
          if(parsed) item.pubDate = parsed;
        }
        // v307 FIX: echte beschrijving uit detail pagina, niet titel 2x
        const realDesc = extractGemeenteDescription(html);
        if(realDesc){
          console.log('[v307] Gemeente echte beschrijving gevonden voor', item.title.slice(0,30), '->', realDesc.slice(0,50));
          item.description = realDesc + ' [...]';
        } else {
          console.log('[v307] Gemeente geen beschrijving gevonden, gebruik fallback');
          item.description = item.title.slice(0,100) + ' - Lees meer op ommen.nl [...]';
        }
        await new Promise(r=>setTimeout(r, 250));
      }
      if(!item.description){
        item.description = item.title.slice(0,100) + ' [...]';
      }
    }catch(e){
      if(!item.description) item.description = item.title.slice(0,100) + ' [...]';
    }
    enriched.push(item);
  }
  enriched.sort((a,b)=> b.pubDate - a.pubDate);
  return enriched;
}

function parseNieuwsbriefECHT(json){ try{ const data=typeof json==='string'?JSON.parse(json):json; const items=data.items||[]; return items.map(it=>{ let pd=new Date(); if(it.pubDate){ const d=new Date(it.pubDate); if(!isNaN(d.getTime())) pd=d; } return {title:(it.title||'Nieuwsbrief').slice(0,120), link:it.link||'https://nieuwommen.leeuw008.nl/', pubDate:pd, description:(it.description||it.title||'').slice(0,200)+' [...]', source:'Nieuwsbrief', id:'Nieuwsbrief'}; }).slice(0,10); }catch{ return []; } }
function parseRSSFull(xml){ const items=[...xml.matchAll(/<item[^>]*>([\s\S]*?)<\/item>/gi)].slice(0,25); return items.map(m=>{ const it=m[1]; const title=(it.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i)||[])[1]||''; let link=(it.match(/<link[^>]*>([\s\S]*?)<\/link>/i)||[])[1]||''; link=link.replace(/<!\[CDATA\[|\]\]>/g,'').trim(); if(!link.startsWith('http')){ const mm=it.match(/https?:\/\/[^\s<"]+/); if(mm) link=mm[0]; } const desc=(it.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i)||[])[1]||''; const pub=(it.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)||[])[1]||''; let pd=new Date(); if(pub){ const d=new Date(pub); if(!isNaN(d.getTime())) pd=d; } return {title:title.replace(/<[^>]*>/g,'').trim().slice(0,120), link, pubDate:pd, description:desc.replace(/<[^>]*>/g,' ').trim().slice(0,200)+' [...]'}; }).filter(x=>x.link && x.title); }

const GEMEENTE_PLAATSEN = ['Ommen','Lemele','Vilsteren','Beerze','Beerzerveld','Witharen','Archem','Arriën','Arriërveld','Besthmen','Dalmsholte','Eerde','Emsland','Giethmen','Hoogengraven','Junne','Nieuwebrug','Ommerbosch','Ommerkanaal','Ommerschans','Ommerveld','Rotbrink','Stegeren','Stegerveld','Varsen','Vinkenbuurt','Zeesse','Stegeren','Beerzerpoort','Ommerschans'];
const GEMEENTE_ZOEK = GEMEENTE_PLAATSEN.map(p=>p.toLowerCase());
function isGemeenteArtikel(art){ const txt = (art.title + ' ' + (art.description||'')).toLowerCase(); return GEMEENTE_ZOEK.some(pl => txt.includes(pl)); }

let state = {}; let allArticles = []; let loadedSources = new Set();

(function injectStyles(){
  const css = `.source-led{width:12px;height:12px;border-radius:999px;display:block}.source-led.loading{background:#ef4444;animation:pulse-red 1.2s infinite}.source-led.ok{background:#16a34a}.source-led.fail{background:#ef4444}.source-led.empty{background:#f59e0b}@keyframes pulse-red{0%{transform:scale(1)}50%{transform:scale(1.25)}100%{transform:scale(1)}}.source-row[data-id="Nieuwsbrief"]{background:linear-gradient(90deg,#f0fdf4 0%,#fff 100%);border-left:3px solid #16a34a;}.source-row[data-id="Nieuwsbrief"] .source-name span:first-child{font-weight:800;}`;
  const el=document.createElement('style'); el.id='led-v307'; el.textContent=css; if(!document.getElementById('led-v307')) document.head.appendChild(el);
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
function restorePanelState(){ try{ const open=localStorage.getItem('ommen_filter_panel_open'); if(open===null){ openPanel(); return; } if(open==='1') openPanel(); else closePanel(); }catch{ openPanel(); } }
function resetFilters(){ BRONNEN.forEach(b=>state[b.id]={aan:true,vandaag:false,scope:'gemeente'}); saveState(); renderFilters(); filterNews(); }
function setupFilterHeader(){ const fh=document.getElementById('filter-header'); if(!fh) return; fh.addEventListener('click',e=>{ if(e.target.closest('#bell-slot')) return; if(e.target.id==='btn-all' || e.target.closest('#btn-all')){ e.stopPropagation(); const allOn=Object.values(state).every(s=>s.aan); BRONNEN.forEach(b=>state[b.id].aan=!allOn); saveState(); renderFilters(); filterNews(); return; } const p=document.getElementById('source-panel'); if(p.classList.contains('open')) closePanel(); else openPanel(); }); }

const WORKER='https://ommen-push-v2.leeuw008.workers.dev';
const SOURCE_CACHE_TTL = 1000 * 60 * 5; const SOURCE_CACHE_STALE = 1000 * 60 * 60; const SOURCE_CACHE_KEY = 'ommen_source_cache_v1';
function getSourceCache(){ try{return JSON.parse(localStorage.getItem(SOURCE_CACHE_KEY)||'{}');}catch{return {};}}
function setSourceCache(c){ try{localStorage.setItem(SOURCE_CACHE_KEY, JSON.stringify(c));}catch{}}
function getCachedSource(u){ const cache=getSourceCache(); const e=cache[u]; if(!e) return null; if(Date.now()-e.ts>SOURCE_CACHE_TTL) return null; return e.data; }
function getStaleSource(u){ const cache=getSourceCache(); const e=cache[u]; if(!e) return null; if(Date.now()-e.ts>SOURCE_CACHE_STALE) return null; return e.data; }
function putCachedSource(u,d){ if(!d||d.length<200) return; const c=getSourceCache(); c[u]={data:d, ts:Date.now()}; setSourceCache(c); }
async function fetchViaWorker(url){
  const ctrl=new AbortController(); const to=setTimeout(()=>ctrl.abort(), 6000);
  try{
    const r=await fetch(`${WORKER}/proxy?url=${encodeURIComponent(url)}&t=${Date.now()}`, {cache:'no-store', signal:ctrl.signal});
    clearTimeout(to); if(!r.ok) throw new Error('proxy fail'); const t=await r.text(); if(t.length<150) throw new Error('empty'); putCachedSource(url,t); return t;
  }catch(e1){
    clearTimeout(to);
    try{ const r2=await fetch(url, {cache:'no-store'}); if(r2.ok){ const t2=await r2.text(); if(t2.length>500){ putCachedSource(url,t2); return t2; } } }catch{}
    throw e1;
  }
}
async function loadOneSource(b){
  const cfg=BRON_URLS[b.id];
  try{
    let arts=[];
    if(b.id==='Nieuwsbrief'){ const j=await fetchViaWorker(cfg.url); arts=parseNieuwsbriefECHT(j); }
    else if(cfg.type==='gemeente'){ const html=await fetchViaWorker(cfg.url); const overview=parseGemeenteOverviewWithDate(html); arts=await enrichGemeenteWithTimeAndDesc(overview, fetchViaWorker); }
    else { const xml=await fetchViaWorker(cfg.url); arts=parseRSSFull(xml); }
    if(arts.length===0) throw new Error('empty'); return arts.map(a=>({...a, source:b.name, id:b.id, isFallback:false}));
  }catch(e){ return [{title:b.name, link:cfg.homepage, pubDate:new Date(0), description:'Bron tijdelijk offline', source:b.name, id:b.id, isFallback:true}]; }
}
function isSameDay(d1,d2){ if(!d1||!d2||isNaN(d1.getTime())) return false; return d1.getFullYear()===d2.getFullYear() && d1.getMonth()===d2.getMonth() && d1.getDate()===d2.getDate(); }
function formatDate(d){ if(!d||isNaN(d.getTime())||d.getTime()===0) return ''; return d.toLocaleDateString('nl-NL',{day:'numeric', month:'short'})+' '+d.toLocaleTimeString('nl-NL',{hour:'2-digit', minute:'2-digit'}); }
function renderArticles(){
  const c=document.getElementById('news-container'); if(!c) return;
  const search=(document.getElementById('search-input')?.value||'').toLowerCase();
  const today=new Date();
  let filtered=allArticles.filter(a=>{ const s=state[a.id]; if(!s||!s.aan) return false; if(s.vandaag){ if(a.isFallback) return false; if(!isSameDay(a.pubDate,today)) return false; } if(s.scope==='gemeente' && !isGemeenteArtikel(a)) return false; return true; });
  if(search) filtered=filtered.filter(a=> (a.title+' '+a.description).toLowerCase().includes(search));
  filtered=filtered.sort((a,b)=>b.pubDate-a.pubDate);
  const realCount=filtered.filter(a=>!a.isFallback).length;
  const countHtml=`<div class="articles-count">${realCount} artikelen - ${loadedSources.size} v/d ${BRONNEN.length} bronnen geladen</div>`;
  if(filtered.length===0){ c.innerHTML=countHtml+'<div class="article">Geen artikelen</div>'; return; }
  c.innerHTML=countHtml+filtered.map(a=>{
    const t=a.title.replace(/^\[[^\]]+\]\s*/,'').trim();
    if(a.isFallback) return `<div class="article fallback"><h2><a href="${a.link}" target="_blank">${a.source}</a></h2><small>${a.source}</small><div style="margin-top:6px;color:#666;">${a.description}</div></div>`;
    return `<div class="article" data-source="${a.id}"><h2><a href="${a.link}" target="_blank">${t}</a></h2><small>${a.source} - ${formatDate(a.pubDate)}</small><div style="margin-top:6px;color:#555;">${a.description}</div></div>`;
  }).join('');
}
function filterNews(){ renderArticles(); }
async function refreshNews(){
  const c=document.getElementById('news-container'); c.innerHTML='<div class="article">Bezig met laden... Gemeente fix v307 (echte beschrijving)...</div>';
  allArticles=[]; loadedSources=new Set();
  const results=await Promise.allSettled(BRONNEN.map(async b=>{ const arts=await loadOneSource(b); return {b, arts}; }));
  const fresh=[]; results.forEach(r=>{ if(r.status==='fulfilled'){ const {b, arts}=r.value; if(arts.length>0) fresh.push(...arts); loadedSources.add(b.id); } });
  allArticles=fresh; updateHeaderCount(); renderArticles(); renderFilters(); updateSourceLeds();
}
document.addEventListener('DOMContentLoaded', ()=>{
  loadState(); renderFilters(); saveState(); restorePanelState(); setupFilterHeader();
  document.getElementById('search-input')?.addEventListener('input', filterNews);
  setTimeout(()=>refreshNews(), 200);
  console.log('[v307] Gemeente beschrijving fix + NieuwOmmen opmaak');
});
window.closePanel=closePanel; window.openPanel=openPanel; window.resetFilters=resetFilters; window.BRONNEN=BRONNEN;
