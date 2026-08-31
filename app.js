// app.js v301 - FIX omlijnd artikel bij push click + knop naar overzicht
// CHANGELOG v301:
// - FIX: Klik op push melding -> artikel omlijnd bovenaan met groene rand + pulse + "NIEUW via push" badge
// - NIEUW: Knop "📋 Terug naar overzicht (alle artikelen)" bij omlijnd artikel
// - NieuwOmmen vet + Nieuwsbrief updates & releases klein (v299 opmaak behouden)
// - Werkt via ?highlight= param vanuit Service Worker v301
// - Alle "test omlijnd" teksten verwijderd, nu definitieve werking

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
let highlightedLink = null; // v301: link van gepushte artikel dat omlijnd moet
let fromPush = false;

(function injectHighlightStyles(){
  const css = `
  .source-row{position:relative}
  .source-led{width:12px;height:12px;border-radius:999px;display:block;flex-shrink:0}
  .source-led.loading{background:#ef4444;box-shadow:0 0 0 2px rgba(239,68,68,.25);animation:pulse-red 1.2s infinite}
  .source-led.ok{background:#16a34a;box-shadow:0 0 0 2px rgba(22,163,74,.22)}
  .source-led.fail{background:#ef4444;box-shadow:0 0 0 2px rgba(239,68,68,.2)}
  .source-led.empty{background:#f59e0b;box-shadow:0 0 0 2px rgba(245,158,11,.2)}
  @keyframes pulse-red{0%{transform:scale(1)}50%{transform:scale(1.25)}100%{transform:scale(1)}}
  .source-row[data-id="Nieuwsbrief"]{background:linear-gradient(90deg, #f0fdf4 0%, #ffffff 100%); border-left:3px solid #16a34a;}
  .source-row[data-id="Nieuwsbrief"] .source-name span:first-child{font-weight:800;}
  /* v301 FIX omlijnd artikel */
  .article.highlighted-push{
    outline: 3px solid #16a34a !important;
    outline-offset: 3px;
    border: 2px solid #16a34a !important;
    background: linear-gradient(90deg, #f0fdf4 0%, #ffffff 100%) !important;
    box-shadow: 0 0 0 4px rgba(22,163,74,0.15), 0 4px 12px rgba(22,163,74,0.2) !important;
    animation: highlight-pulse-v301 2s ease-in-out infinite;
    position: relative;
    z-index: 10;
  }
  @keyframes highlight-pulse-v301{
    0%{box-shadow: 0 0 0 4px rgba(22,163,74,0.15), 0 4px 12px rgba(22,163,74,0.2);}
    50%{box-shadow: 0 0 0 8px rgba(22,163,74,0.25), 0 8px 20px rgba(22,163,74,0.3);}
    100%{box-shadow: 0 0 0 4px rgba(22,163,74,0.15), 0 4px 12px rgba(22,163,74,0.2);}
  }
  .push-highlight-banner{
    background: linear-gradient(90deg, #16a34a 0%, #15803d 100%);
    color: white;
    padding: 10px 16px;
    border-radius: 8px;
    margin-bottom: 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    font-size: 13px;
    font-weight: 600;
    box-shadow: 0 2px 8px rgba(22,163,74,0.3);
  }
  .push-highlight-banner .left{display:flex;align-items:center;gap:8px;}
  .btn-overview{
    background: white;
    color: #16a34a;
    border: 0;
    padding: 8px 14px;
    border-radius: 999px;
    font-weight: 700;
    font-size: 12px;
    cursor: pointer;
    white-space: nowrap;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  }
  .btn-overview:hover{background:#f0fdf4;}
  `;
  const el=document.createElement('style'); el.id='highlight-style-v301'; el.textContent=css;
  if(!document.getElementById('highlight-style-v301')) document.head.appendChild(el);
})();

function getHighlightFromUrl(){
  try{
    const params = new URLSearchParams(window.location.search);
    const hl = params.get('highlight');
    const fp = params.get('fromPush');
    const pushTitle = params.get('pushTitle');
    const pushSource = params.get('pushSource');
    const external = params.get('externalLink');
    if(hl){
      return {link: decodeURIComponent(hl), fromPush: fp==='1', title: pushTitle ? decodeURIComponent(pushTitle) : null, source: pushSource ? decodeURIComponent(pushSource) : null, external: external ? decodeURIComponent(external) : null};
    }
    // check localStorage fallback
    const stored = localStorage.getItem('ommen_highlight_link');
    if(stored){
      const fromPushStored = localStorage.getItem('ommen_from_push') === '1';
      return {link: stored, fromPush: fromPushStored};
    }
  }catch(e){}
  return null;
}

function clearHighlight(){
  highlightedLink = null;
  fromPush = false;
  localStorage.removeItem('ommen_highlight_link');
  localStorage.removeItem('ommen_from_push');
  localStorage.removeItem('ommen_push_title');
  // verwijder params uit URL zonder reload
  try{
    const url = new URL(window.location);
    url.searchParams.delete('highlight');
    url.searchParams.delete('fromPush');
    url.searchParams.delete('pushTitle');
    url.searchParams.delete('pushSource');
    url.searchParams.delete('externalLink');
    window.history.replaceState({}, '', url.pathname + url.search);
  }catch{}
  renderArticles();
}

function parseNieuwsbrief(json){
  try{
    const data = typeof json === 'string' ? JSON.parse(json) : json;
    const items = data.items || [];
    return items.map(it=>{
      let pubDate = new Date(); if(it.pubDate){ const d=new Date(it.pubDate); if(!isNaN(d.getTime())) pubDate=d; }
      return {title: (it.title||'Nieuwsbrief').slice(0,120), link: it.link||'https://nieuwommen.leeuw008.nl/', pubDate, description: (it.description||it.title||'').slice(0,200)+' [...]', source:'Nieuwsbrief', id:'Nieuwsbrief'};
    }).slice(0,10);
  }catch(e){ return []; }
}
function parseVechtdalCentraal(html){ const items=[]; let re=/<h3 class="entry-title[^>]*>\s*<a href="([^"]+)"[^>]*>([^<]+)<\/a>/gi; let m; while((m=re.exec(html))!==null && items.length<25){ let link=m[1]; if(link.startsWith('/')) link='https://www.vechtdalcentraal.nl'+link; items.push({title:m[2].replace(/&#8217;/g,"'").trim(), link, pubDate:new Date(), description:m[2].trim()+' [...]'}); } return items; }
function parseRTVVechtdal(html){ const items=[]; const re=/<div class="allmode_date">([^<]+)<\/div>[\s\S]{0,600}?<h3 class="allmode_title"><a href="([^"]+)">([^<]+)<\/a>/gi; let m; while((m=re.exec(html))!==null && items.length<20){ let link=m[2]; if(!link.startsWith('http')) link='https://www.rtvvechtdal.nl'+link; items.push({title:m[3].trim().slice(0,120), link, pubDate:new Date(), description:m[3].trim().slice(0,200)+' [...]'}); } return items; }
function parseGemeente(html){ const items=[]; const re=/<a[^>]+href=["']([^"']+\/actueel\/[^"']+)["'][^>]*>([^<]{10,200})<\/a>/gi; let m; while((m=re.exec(html))!==null && items.length<15){ let link=m[1]; if(link.startsWith('/')) link='https://www.ommen.nl'+link; items.push({title:m[2].trim(), link, pubDate:new Date(), description:m[2].trim()+' [...]'}); } return items; }
function parseRTVOost(html){ const items=[]; const re=/<a[^>]+href=["'](\/nieuws\/[^"']{10,})["'][^>]*>[\s\S]*?<h3[^>]*>([^<]{12,})<\/h3>/gi; let m; while((m=re.exec(html))!==null && items.length<15){ items.push({title:m[2].trim(), link:'https://www.oost.nl'+m[1], pubDate:new Date(), description:m[2].trim()+' [...]'}); } return items; }
function parseRSS(xml){ const items=[...xml.matchAll(/<item[^>]*>([\s\S]*?)<\/item>/gi)].slice(0,25); return items.map(m=>{ const it=m[1]; const title=(it.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i)||[])[1]||''; let link=(it.match(/<link[^>]*>([\s\S]*?)<\/link>/i)||[])[1]||''; link=link.replace(/<!\[CDATA\[|\]\]>/g,'').trim(); if(!link.startsWith('http')){ const mm=it.match(/https?:\/\/[^\s<"]+/); if(mm) link=mm[0]; } const desc=(it.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i)||[])[1]||''; const pub=(it.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)||[])[1]||''; let pd=new Date(); if(pub){ const d=new Date(pub); if(!isNaN(d.getTime())) pd=d; } return {title:title.replace(/<[^>]*>/g,'').trim().slice(0,120), link, pubDate:pd, description:desc.replace(/<[^>]*>/g,' ').trim().slice(0,200)+' [...]'}; }).filter(x=>x.link && x.title); }

const GEMEENTE_ZOEK = ['ommen','lemele','vilsteren','beerze','witharen','archem','besthmen','giethmen','junne'].map(s=>s.toLowerCase());
function isGemeenteArtikel(a){ const txt = (a.title + ' ' + a.description).toLowerCase(); return GEMEENTE_ZOEK.some(pl => txt.includes(pl)); }

function loadState(){
  try{
    const v2 = localStorage.getItem('nieuwsommen_bronnen_v2');
    if(v2){ let p = JSON.parse(v2); if(Array.isArray(p)){ const ns={}; BRONNEN.forEach(b=>{ ns[b.id]={aan:p.includes(b.id), vandaag:false, scope:'gemeente'}; }); state=ns; } else state=p; BRONNEN.forEach(b=>{ if(!state[b.id]) state[b.id]={aan:true,vandaag:false,scope:'gemeente'}; }); }
    else BRONNEN.forEach(b=> state[b.id]={aan:true,vandaag:false,scope:'gemeente'});
  }catch{ BRONNEN.forEach(b=> state[b.id]={aan:true,vandaag:false,scope:'gemeente'}); }
}
function saveState(){ localStorage.setItem('nieuwsommen_bronnen_v2', JSON.stringify(state)); updateHiddenCompat(); updateHeaderCount(); if(window.updatePushBell) window.updatePushBell(); try{ if(window.pushFiltersToSW) window.pushFiltersToSW(); }catch{} }
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
async function fetchViaWorker(url){
  try{ const r=await fetch(`${WORKER}/proxy?url=${encodeURIComponent(url)}&t=${Date.now()}`); if(r.ok){ const t=await r.text(); if(t.length>150) return t; } }catch{}
  try{ const r2=await fetch(url); if(r2.ok){ const t2=await r2.text(); if(t2.length>200) return t2; } }catch{}
  throw new Error('fail');
}
async function loadOneSource(b){
  const cfg=BRON_URLS[b.id]; try{
    let arts=[];
    if(b.id==='Nieuwsbrief'){ const j=await fetchViaWorker(cfg.url); arts=parseNieuwsbrief(j); }
    else if(cfg.type==='gemeente'){ const h=await fetchViaWorker(cfg.url); arts=parseGemeente(h); }
    else if(cfg.type==='oost'){ const h=await fetchViaWorker(cfg.url); arts=parseRTVOost(h); }
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

  // v301 FIX: omlijnd artikel logica
  const highlightInfo = getHighlightFromUrl();
  if(highlightInfo){
    highlightedLink = highlightInfo.link;
    fromPush = highlightInfo.fromPush;
    // Sla op voor later
    localStorage.setItem('ommen_highlight_link', highlightedLink);
    if(fromPush) localStorage.setItem('ommen_from_push','1');
  }

  let html = '';
  let bannerHtml = '';
  
  if(highlightedLink && fromPush){
    // Zoek het artikel dat overeenkomt met highlight link
    let highlightedArticle = filtered.find(a=> a.link===highlightedLink || highlightedLink.includes(a.link) || a.link.includes(highlightedLink));
    // Als niet in filtered (door filter), zoek in alle artikelen
    if(!highlightedArticle){
      highlightedArticle = allArticles.find(a=> a.link===highlightedLink || highlightedLink.includes(a.link) || a.link.includes(highlightedLink));
    }
    // Als nog steeds niet gevonden, maak placeholder voor het gepushte artikel
    if(!highlightedArticle){
      const urlParams = new URLSearchParams(window.location.search);
      const pushTitle = urlParams.get('pushTitle') ? decodeURIComponent(urlParams.get('pushTitle')) : 'Nieuw artikel via push';
      const pushSource = urlParams.get('pushSource') ? decodeURIComponent(urlParams.get('pushSource')) : '';
      highlightedArticle = {
        title: pushTitle,
        link: highlightedLink,
        pubDate: new Date(),
        description: 'Dit artikel is via push melding geopend. Klik op de titel om het volledige artikel te lezen.',
        source: pushSource || 'Via push',
        id: 'highlighted'
      };
    }

    if(highlightedArticle){
      bannerHtml = `
        <div class="push-highlight-banner">
          <div class="left">🔔 Artikel via push melding</div>
          <button class="btn-overview" onclick="clearHighlight()">📋 Terug naar overzicht</button>
        </div>
      `;
      const cleanTitle = highlightedArticle.title.replace(/^\[[^\]]+\]\s*/,'').trim();
      html += `
        <div class="article highlighted-push" data-link="${highlightedArticle.link}" data-source="${highlightedArticle.id}">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
            <span style="background:#16a34a;color:white;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;">NIEUW via push</span>
            <small style="color:#16a34a;font-weight:600;">${highlightedArticle.source}</small>
          </div>
          <h2><a href="${highlightedArticle.link}" target="_blank">${cleanTitle}</a></h2>
          <small>${highlightedArticle.source} - ${formatDate(highlightedArticle.pubDate)}</small>
          <div style="margin-top:8px;color:#374151;">${highlightedArticle.description}</div>
          <div style="margin-top:12px;display:flex;gap:8px;">
            <a href="${highlightedArticle.link}" target="_blank" style="background:#16a34a;color:white;padding:8px 16px;border-radius:8px;text-decoration:none;font-weight:600;font-size:13px;">📖 Lees volledig artikel</a>
            <button class="btn-overview" style="border:1px solid #d1d5db;background:white;color:#374151;" onclick="clearHighlight()">📋 Alle artikelen</button>
          </div>
        </div>
      `;
      // Verwijder highlighted artikel uit normale lijst om duplicatie te voorkomen
      filtered = filtered.filter(a=> a.link !== highlightedArticle.link);
    }
  }

  const realCount = filtered.filter(a=>!a.isFallback).length;
  const countHtml = `<div class="articles-count">${realCount} artikelen - ${loadedSources.size} v/d ${BRONNEN.length} bronnen geladen</div>`;
  
  if(filtered.length===0 && !highlightedLink){
    container.innerHTML = countHtml + '<div class="article">Geen artikelen</div>';
    return;
  }

  const articlesHtml = filtered.map(a=>{
    const cleanTitle = a.title.replace(/^\[[^\]]+\]\s*/,'').trim();
    const isHighlighted = highlightedLink && (a.link===highlightedLink || highlightedLink.includes(a.link));
    return `<div class="article ${isHighlighted?'highlighted-push':''}" data-link="${a.link}" data-source="${a.id}"><h2><a href="${a.link}" target="_blank">${cleanTitle}</a></h2><small>${a.source} - ${formatDate(a.pubDate)}</small><div style="margin-top:6px;color:#555;">${a.description}</div></div>`;
  }).join('');

  container.innerHTML = bannerHtml + countHtml + html + articlesHtml;

  // Scroll naar omlijnd artikel
  if(highlightedLink && fromPush){
    setTimeout(()=>{
      const highlightedEl = container.querySelector('.highlighted-push');
      if(highlightedEl){
        highlightedEl.scrollIntoView({behavior:'smooth', block:'start'});
      }
    }, 300);
  }
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
  loadState(); renderFilters(); saveState(); restorePanelState(); setupFilterHeader();
  document.getElementById('search-input')?.addEventListener('input', filterNews);
  
  // v301 FIX: check highlight direct bij load
  const hl = getHighlightFromUrl();
  if(hl){
    highlightedLink = hl.link;
    fromPush = hl.fromPush;
    console.log('[v301] Highlight from URL:', hl);
  }
  
  setTimeout(()=>refreshNews(), 200);

  // v301 FIX: luister naar push click messages van Service Worker
  if('serviceWorker' in navigator){
    navigator.serviceWorker.addEventListener('message', event=>{
      console.log('[v301] SW message', event.data);
      if(event.data && event.data.type==='PUSH_CLICKED'){
        const link = event.data.link || event.data.url;
        if(link){
          console.log('[v301] PUSH_CLICKED via message, highlight', link);
          highlightedLink = link;
          fromPush = true;
          localStorage.setItem('ommen_highlight_link', link);
          localStorage.setItem('ommen_from_push','1');
          // Update URL zonder reload
          try{
            const url = new URL(window.location);
            url.searchParams.set('highlight', link);
            url.searchParams.set('fromPush','1');
            if(event.data.title) url.searchParams.set('pushTitle', event.data.title);
            if(event.data.source) url.searchParams.set('pushSource', event.data.source);
            window.history.replaceState({}, '', url.toString());
          }catch{}
          renderArticles();
        }
      }
    });
  }
});

window.clearHighlight = clearHighlight;
window.closePanel=closePanel; window.resetFilters=resetFilters; window.BRONNEN=BRONNEN; window.filterNews=filterNews; window.refreshNews=refreshNews;

function restorePanelState(){ try{ const open=localStorage.getItem('ommen_filter_panel_open'); if(open==='1') openPanel(); else closePanel(); }catch{ closePanel(); } }
