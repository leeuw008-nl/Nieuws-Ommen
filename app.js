// app.js v225 - FIX Gemeente filter hersteld (plaatsenlijst) + knop fix
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
  'RTV Oost': {url:'https://www.rtvoost.nl/nieuws/ommen', homepage:'https://www.rtvoost.nl/nieuws/ommen', type:'oost'},
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
function parseRTVVechtdalECHT(html){
  const items=[];
  const reFull=/<div class="allmode_date">([^<]+)<\/div>[\s\S]{0,600}?<h3 class="allmode_title"><a href="([^"]+)">([^<]+)<\/a>[\s\S]{0,800}?<div class="allmode_(?:intro|text|introtext)[^>]*>([\s\S]*?)<\/div>/gi;
  let m;
  while((m=reFull.exec(html))!==null && items.length<20){
    const dparts=m[1].split('-'); let pd=new Date(); if(dparts.length===3) pd=new Date(dparts[2],dparts[1]-1,dparts[0],0,0,0);
    let link=m[2].replace(/&amp;/g,'&'); if(!link.startsWith('http')) link='https://www.rtvvechtdal.nl'+link;
    let intro=m[4].replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
    if(intro.length>200) intro=intro.slice(0,200)+' [...]'; else if(intro) intro=intro+' [...]'; else intro=m[3].trim()+' [...]';
    items.push({title:m[3].trim(), link, pubDate:pd, description:intro});
  }
  if(items.length===0){
    const re=/<div class="allmode_date">([^<]+)<\/div>[\s\S]{0,500}?<h3 class="allmode_title"><a href="([^"]+)">([^<]+)<\/a>/gi;
    while((m=re.exec(html))!==null && items.length<15){
      const dparts=m[1].split('-'); let pd=new Date(); if(dparts.length===3) pd=new Date(dparts[2],dparts[1]-1,dparts[0],0,0,0);
      let link=m[2].replace(/&amp;/g,'&'); if(!link.startsWith('http')) link='https://www.rtvvechtdal.nl'+link;
      items.push({title:m[3].trim(), link, pubDate:pd, description:m[3].trim()+' [...]'});
    }
  }
  return items;
}
function parseRTVOostECHT(html){
  const items=[]; let m;
  const re=/publishedAt="([^"]+)"[\s\S]{0,900}?href="(\/nieuws\/[^"]+)"[\s\S]{0,900}?<h3[^>]*>([^<]+)<\/h3>/gi;
  while((m=re.exec(html))!==null && items.length<20){
    const pd=new Date(m[1]); const link='https://www.rtvoost.nl'+m[2]; const title=m[3].trim();
    if(!items.find(x=>x.link===link)) items.push({title, link, pubDate:pd, description:title+' [...]'});
  }
  if(items.length===0){
    const re2=/<a href="(\/nieuws\/[^"]+)"[^>]*>[\s\S]*?<h3[^>]*>([^<]+)<\/h3>/gi;
    while((m=re2.exec(html))!==null && items.length<20){
      const link='https://www.rtvoost.nl'+m[1]; const title=m[2].trim();
      if(!items.find(x=>x.link===link)) items.push({title, link, pubDate:new Date(), description:title+' [...]'});
    }
  }
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
// Voor filter: lowercase set
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
async function fetchViaWorker(url){
  const controller = new AbortController();
  const to = setTimeout(()=>controller.abort(), 9000);
  try{
    const r = await fetch(`${WORKER}/proxy?url=${encodeURIComponent(url)}&t=${Date.now()}`, {cache:'no-store', signal:controller.signal});
    clearTimeout(to);
    if(!r.ok) throw new Error('proxy fail '+r.status);
    const t = await r.text();
    if(t.length<150) throw new Error('proxy empty len '+t.length);
    if(t.includes('Proxy blocked')||t.includes('Proxy error')||t.startsWith('Proxy err')) throw new Error(t.slice(0,200));
    if(t.includes('<title>Just a moment</title>')||t.includes('Attention Required')) throw new Error('cf challenge');
    return t;
  }catch(e1){
    clearTimeout(to);
    console.log('worker proxy fail, probeer fallback', url, e1.message);
    // Fallback voor geblokkeerde domeinen
    try{
      // 1. allorigins /get geeft JSON met CORS headers (raw geeft geen CORS!)
      const fallbackUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}&t=${Date.now()}`;
      const r2 = await fetch(fallbackUrl, {cache:'no-store'});
      if(r2.ok){
        const j = await r2.json();
        if(j.contents && j.contents.length>500) {
          console.log('fallback allorigins /get OK voor', url);
          return j.contents;
        }
      }
    }catch(e2){ console.log('allorigins /get fail', e2.message); }
    try{
      const fallbackUrl2 = `https://corsproxy.io/?${encodeURIComponent(url)}`;
      const r3 = await fetch(fallbackUrl2, {cache:'no-store'});
      if(r3.ok){
        const t3 = await r3.text();
        if(t3.length>500) {
          console.log('fallback corsproxy.io OK voor', url);
          return t3;
        }
      }
    }catch(e3){ console.log('corsproxy fail', e3.message); }
    try{
      const fallbackUrl3 = `https://thingproxy.freeboard.io/fetch/${url}`;
      const r4 = await fetch(fallbackUrl3, {cache:'no-store'});
      if(r4.ok){
        const t4 = await r4.text();
        if(t4.length>500) {
          console.log('fallback thingproxy OK voor', url);
          return t4;
        }
      }
    }catch(e4){ console.log('thingproxy fail', e4.message); }
    
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
  const results=[];
  for(let a of arts){
    const cached=cache[a.link];
    if(cached && (now - cached.ts) < CACHE_TTL && cached.iso){
      const d=new Date(cached.iso);
      if(!isNaN(d.getTime())){ a.pubDate=d; results.push(a); continue; }
    }
    if(a.pubDate && !isNaN(a.pubDate.getTime()) && a.pubDate.getHours()!==0){
      cache[a.link]={iso:a.pubDate.toISOString(), ts:now};
      results.push(a);
      continue;
    }
    try{
      await new Promise(r=>setTimeout(r, 400));
      const html = await fetchViaWorker(a.link);
      const realDate = extractGemeenteDate(html);
      if(realDate){
        a.pubDate=realDate;
        cache[a.link]={iso:realDate.toISOString(), ts:now};
      } else if(!a.pubDate || isNaN(a.pubDate.getTime())){
        a.pubDate=new Date();
      }
    }catch(e){
      if(!a.pubDate || isNaN(a.pubDate.getTime())) a.pubDate=new Date();
    }
    results.push(a);
    if(results.length % 2 ===0){
      allArticles = allArticles.filter(x=>x.id!=='Gemeente Ommen').concat(results.map(r=>({...r, source:'Gemeente Ommen', id:'Gemeente Ommen', isFallback:false})));
      renderArticles();
    }
  }
  setGemeenteCache(cache);
  return results;
}
function parseOostFull(html){
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
function parseVechtdalCentraalFallback(html){
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
async function loadOneSource(b){
  const cfg = BRON_URLS[b.id];
  try{
    let arts=[];
    if(cfg.type==='gemeente'){
      const html=await fetchViaWorker(cfg.url);
      let overview = parseGemeenteOverview(html);
      if(overview.length){
        const tempArts=overview.map(a=>({...a, source:b.name, id:b.id, isFallback:false, pubDate:a.pubDate||new Date()}));
        allArticles = allArticles.filter(x=>x.id!==b.id).concat(tempArts);
        loadedSources.add(b.id); updateHeaderCount(); renderArticles();
      }
      arts = await enrichGemeenteWithDetail(overview);
    }
    else if(cfg.type==='oost'){ 
      const html=await fetchViaWorker(cfg.url); 
      arts=parseOostFull(html); 
    }
    else if(b.id==='RTV Vechtdal'){ 
      try{
        const html=await fetchViaWorker(cfg.homepage || 'https://www.rtvvechtdal.nl/');
        arts=parseRTVVechtdalFull(html); 
      }catch(e){}
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
  if(sourceId==='RTV Vechtdal' && d.getHours()===0 && d.getMinutes()===0){
    return dateStr;
  }
  if(d.getHours()===0 && d.getMinutes()===0){
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
    // HERSTELD: Gemeente filter - alleen artikelen met plaatsnaam uit gemeente Ommen
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
  if(c) c.innerHTML='<div class="article">Bezig met laden... (9 bronnen)</div>';
  allArticles=[]; loadedSources=new Set(); updateHeaderCount();
  const loadWithTimeout = async (b) => {
    try {
      const timeout = new Promise((_,rej)=> setTimeout(()=>rej(new Error('timeout '+b.id)), 12000));
      const arts = await Promise.race([loadOneSource(b), timeout]);
      return {b, arts};
    } catch(e){
      console.log('load timeout/fail', b.id, e.message);
      return {b, arts:[{title:b.name, link:BRON_URLS[b.id].homepage, pubDate:new Date(0), description:'Bron tijdelijk offline - '+e.message.slice(0,80)+' [...]', source:b.name, id:b.id, isFallback:true}]};
    }
  };
  const results = await Promise.allSettled(BRONNEN.map(b=>loadWithTimeout(b)));
  results.forEach(r=>{
    if(r.status==='fulfilled'){
      const {b, arts}=r.value;
      allArticles = allArticles.filter(x=>x.id!==b.id).concat(arts);
      loadedSources.add(b.id);
    }
  });
  updateHeaderCount();
  renderArticles();
  console.log('refreshNews klaar,', allArticles.length, 'artikelen');
}
document.addEventListener('DOMContentLoaded', ()=>{
  loadState(); renderFilters(); saveState(); closePanel(); setupFilterHeader();
  document.getElementById('search-input')?.addEventListener('input', filterNews);
  setTimeout(()=>refreshNews(), 200);
});
window.closePanel=closePanel; window.resetFilters=resetFilters; window.BRONNEN=BRONNEN; window.getAppState=()=>state;
window.filterNews=filterNews; window.refreshNews=refreshNews;
