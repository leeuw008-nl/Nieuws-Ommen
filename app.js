// app.js v311 - v311 + alle 15 Gemeente echte beschrijving fix (was alleen 8) stabiel + alleen opmaak NieuwOmmen vet + Nieuwsbrief updates & releases klein
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
    let m = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
    if(m && m[1].length>20) return m[1].trim().slice(0,200);
    m = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
    if(m && m[1].length>20) return m[1].trim().slice(0,200);
    m = html.match(/<h1[^>]*>[\s\S]*?<\/h1>[\s\S]{0,500}?<p[^>]*>([^<]{20,400})<\/p>/i);
    if(m){ let txt=m[1].replace(/<[^>]*>/g,'').trim(); if(txt.length>20) return txt.slice(0,200); }
    const ps = [...html.matchAll(/<p[^>]*>([^<]{30,400})<\/p>/gi)].map(x=>x[1].replace(/<[^>]*>/g,'').trim()).filter(t=>t.length>30 && !t.toLowerCase().includes('cookie'));
    if(ps.length>0) return ps[0].slice(0,200);
  }catch{} return null;
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
      if(i<15){ // v311 FIX: was i<8 waardoor oudste 2 geen beschrijving kregen, nu alle 15
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
  const aan = Object.values(state).filter(s=>s.aan).length;
  const countEl = document.getElementById('header-count');
  if(countEl){ countEl.textContent = `${loadedSources.size || aan} v/d ${BRONNEN.length} bronnen`; if(loadedSources.size>=BRONNEN.length) countEl.textContent = `10 v/d 10 bronnen`; }
  const btn = document.getElementById('btn-all');
  if(btn){
    btn.classList.remove('all-on','all-off','some-on');
    if(aan===BRONNEN.length){ btn.classList.add('all-on'); btn.textContent='Alles uit'; }
    else if(aan===0){ btn.classList.add('all-off'); btn.textContent='Alles aan'; }
    else { btn.classList.add('some-on'); btn.textContent='Alles aan/uit'; }
    console.log('[v311] updateHeaderCount aan=', aan, 'btn=', btn.textContent);
  }
}
function setupFilterHeader(){
  const fh = document.getElementById('filter-header'); if(!fh) return;
  fh.addEventListener('click', (e)=>{
    if(e.target.closest('#bell-slot') || e.target.closest('#push-bell-btn') || e.target.closest('#btn-all') || e.target.closest('#user-icon-btn') || e.target.closest('.info-icon-btn') || e.target.closest('.user-icon-btn')) {
      console.log('[v311] filter-header click ignored for button', e.target.id||e.target.className);
      return;
    }
    const p = document.getElementById('source-panel'); if(p.classList.contains('open')) closePanel(); else openPanel();
  });
}
function setupAllButtonsDirect(){
  // DIRECT binding voor btn-all - niet via delegation
  const btnAll = document.getElementById('btn-all');
  if(btnAll){
    btnAll.style.pointerEvents='auto';
    btnAll.style.position='relative';
    btnAll.style.zIndex='20';
    // Verwijder oude listeners door clone
    const newBtn = btnAll.cloneNode(true);
    btnAll.parentNode.replaceChild(newBtn, btnAll);
    newBtn.addEventListener('click', (e)=>{
      e.stopPropagation(); e.preventDefault();
      const allOn = Object.values(state).every(s=>s.aan);
      console.log('[v311] DIRECT btn-all clicked! allOn=', allOn, 'state before', JSON.stringify(state).slice(0,200));
      BRONNEN.forEach(b=>{ if(!state[b.id]) state[b.id]={aan:true,vandaag:false,scope:'gemeente'}; state[b.id].aan = !allOn; });
      saveState(); renderFilters(); filterNews(); updateSourceLeds(); setupAllButtonsDirect(); // re-bind na render
      console.log('[v311] after toggle allOn should be', !allOn);
    });
    console.log('[v311] btn-all direct bound');
  }
  
  // DIRECT binding voor account button
  const accBtn = document.getElementById('user-icon-btn');
  if(accBtn){
    accBtn.style.pointerEvents='auto';
    accBtn.style.position='relative';
    accBtn.style.zIndex='30';
    accBtn.style.cursor='pointer';
    accBtn.style.display='inline-flex';
    const newAcc = accBtn.cloneNode(true);
    accBtn.parentNode.replaceChild(newAcc, accBtn);
    newAcc.style.pointerEvents='auto';
    newAcc.style.zIndex='30';
    newAcc.addEventListener('click', (e)=>{
      e.stopPropagation(); e.preventDefault();
      console.log('[v311] DIRECT account button clicked!');
      alert('[v311] Account knopje werkt! (test) - originele functie wordt nu geprobeerd');
      if(window.openUserPanel) { window.openUserPanel(); return; }
      if(window.openAccountModal) { window.openAccountModal(); return; }
      // Probeer push account modal
      if(typeof window.showPushSettings === 'function'){ window.showPushSettings(); return; }
      // Fallback naar informatie.html om te testen of navigatie werkt
      window.location.href = 'informatie.html';
    });
    const svg = newAcc.querySelector('svg'); if(svg){ svg.style.pointerEvents='none'; }
    console.log('[v311] account button direct bound, visible?', newAcc.offsetParent!==null, 'rect', newAcc.getBoundingClientRect());
  } else {
    console.warn('[v311] user-icon-btn NOT FOUND in DOM!');
  }
  
  // Info button check
  const infoBtn = document.querySelector('.info-icon-btn');
  if(infoBtn){
    console.log('[v311] info button found', infoBtn.href);
  }
}


