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

async function enrichVechtdalWithDetail(arts){
  const cache = getGemeenteCache(); // reuse same cache
  const now = Date.now();
  const results=[];
  for(let a of arts){
    const cached = cache[a.link+'_vd'];
    if(cached && (now - cached.ts) < 1000*60*60*6 && cached.iso){
      const d=new Date(cached.iso); if(!isNaN(d.getTime())){ a.pubDate=d; results.push(a); continue; }
    }
    try{
      await new Promise(r=>setTimeout(r, 350));
      const html = await fetchViaWorker(a.link);
      // probeer tijd te vinden: <meta property="article:published_time" content="2026-08-11T14:23:00+02:00">
      let m = html.match(/property="article:published_time" content="([^"]+)"/i) || html.match(/property="og:.*published.*?" content="([^"]+)"/i) || html.match(/"datePublished"\s*:\s*"([^"]+)"/i) || html.match(/<time[^>]+datetime="([^"]+)"/i) || html.match(/(\d{2}-\d{2}-\d{4})\s+(\d{1,2}:\d{2})/);
      let realDate=null;
      if(m){
        if(m[2]){ // dd-mm-yyyy hh:mm
          const dparts=m[1].split('-'); const tparts=m[2].split(':');
          realDate=new Date(dparts[2], dparts[1]-1, dparts[0], parseInt(tparts[0]), parseInt(tparts[1]));
        }else{
          realDate=new Date(m[1]);
        }
      }
      if(realDate && !isNaN(realDate.getTime())){
        a.pubDate=realDate;
        cache[a.link+'_vd']={iso:realDate.toISOString(), ts:now};
      }
    }catch(e){}
    results.push(a);
    if(results.length % 2 ===0){
      allArticles = allArticles.filter(x=>x.id!=='RTV Vechtdal').concat(results.map(r=>({...r, source:'RTV Vechtdal', id:'RTV Vechtdal', isFallback:false})));
      renderArticles();
    }
  }
  setGemeenteCache(cache);
  return results;
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
  // Voor Vechtdal Centraal en RTV Oost: probeer eerst rss2json (heeft CORS + omzeilt Cloudflare block)
  const isVC = url.includes('vechtdalcentraal.nl');
  const isOost = url.includes('rtvoost.nl') || url.includes('oost.nl');
  if(isVC || isOost){
    try{
      const rssUrl = isVC ? 'https://www.vechtdalcentraal.nl/feed/' : 'https://www.rtvoost.nl/nieuws/ommen';
      // rss2json werkt alleen met echte RSS, dus voor VC gebruiken we feed, voor Oost proberen we homepage via rss2json alternatief
      if(isVC){
        const rss2jsonUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}&t=${Date.now()}`;
        const rRss = await fetch(rss2jsonUrl, {cache:'no-store'});
        if(rRss.ok){
          const j = await rRss.json();
          if(j.status==='ok' && j.items && j.items.length>0){
            console.log('rss2json OK voor', url, j.items.length);
            // Bouw RSS XML na zodat parseRSSFull het snapt
            let xml = '<rss><channel>';
            j.items.slice(0,20).forEach(it=>{
              xml += `<item><title><![CDATA[${it.title}]]></title><link>${it.link}</link><pubDate>${it.pubDate}</pubDate><description><![CDATA[${it.description}]]></description></item>`;
            });
            xml += '</channel></rss>';
            return xml;
          }
        }
      }
    }catch(eRss){ console.log('rss2json fail', eRss.message); }
  }

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
        let overview=parseRTVVechtdalFull(html); 
        if(overview.length>0){
          // toon meteen met datum
          const tempArts=overview.map(a=>({...a, source:b.name, id:b.id, isFallback:false}));
          allArticles = allArticles.filter(x=>x.id!==b.id).concat(tempArts);
          loadedSources.add(b.id); updateHeaderCount(); renderArticles();
          // verrijk daarna met echte tijden
          arts = await enrichVechtdalWithDetail(overview);
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
  // Als tijd 00:00 is, was het een datum-only (zoals RTV Vechtdal overzicht) -> toon alleen datum tot detail is opgehaald
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
<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ommen SYNC</title>
<style>body{font-family:system-ui;margin:0;background:#f5f7fb;padding:12px} .card{background:#fff;border-radius:12px;padding:14px;margin:12px 0;box-shadow:0 2px 8px rgba(0,0,0,.08)} textarea{width:100%;height:320px;font-family:monospace;font-size:11px;border:1px solid #d1d5db;border-radius:8px;padding:10px} h2{margin:0 0 8px} .btn{display:inline-block;background:#0b5bd3;color:#fff;padding:10px 14px;border-radius:8px;text-decoration:none;font-weight:700}</style>
</head><body>
<h1>Nieuws Ommen - v13 SYNC</h1>
<div class="card"><h2>1. Worker v13 - SYNC</h2><p>Deploy over v12 heen (zelfde PUSH_KV). Geen nieuwe KV nodig.</p><textarea id="w">// push-worker-v13-SYNC - STABIEL + LOGIN SYNC
// BASED ON v12 - added auth + sync endpoints using same PUSH_KV
// KV binding: PUSH_KV (bestaande) - gebruikt prefixes: user:, session:, sync:

const CORS = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization'};
function b64uToU8(s){ if(!s) return new Uint8Array(0); s=s.replace(/-/g,'+').replace(/_/g,'/'); const p=s.length%4; if(p) s+='='.repeat(4-p); const bin=atob(s); const arr=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) arr[i]=bin.charCodeAt(i); return arr; }
function u8ToB64u(a){ let b=''; for(let x of a) b+=String.fromCharCode(x); return btoa(b).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
function abToB64u(b){ return u8ToB64u(new Uint8Array(b)); }
function json(data, status=200){ return new Response(JSON.stringify(data), {status, headers: {'Content-Type':'application/json', ...CORS}}); }
function text(t, status=200){ return new Response(t, {status, headers: {'Content-Type':'text/plain; charset=utf-8', ...CORS}}); }

async function hashPassword(pw){
  const enc = new TextEncoder().encode(pw);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');
}

async function getVapidKeys(env){
  let pub=env.PUSH_KV?await env.PUSH_KV.get('VAPID_PUBLIC_KEY'):null;
  let priv=env.PUSH_KV?await env.PUSH_KV.get('VAPID_PRIVATE_KEY'):null;
  if(pub&&priv) return {publicKey:pub, privateKey:priv};
  const kp=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
  pub=abToB64u(await crypto.subtle.exportKey('raw',kp.publicKey));
  priv=abToB64u(await crypto.subtle.exportKey('pkcs8',kp.privateKey));
  if(env.PUSH_KV){ await env.PUSH_KV.put('VAPID_PUBLIC_KEY',pub); await env.PUSH_KV.put('VAPID_PRIVATE_KEY',priv); }
  return {publicKey:pub, privateKey:priv};
}
async function importVapidPrivateKey(b64u){ return await crypto.subtle.importKey('pkcs8', b64uToU8(b64u), {name:'ECDH',namedCurve:'P-256'}, false, ['sign']); }
// fix: need ECDSA import
async function importVapidPrivateKeyECDSA(b64u){ return await crypto.subtle.importKey('pkcs8', b64uToU8(b64u), {name:'ECDSA',namedCurve:'P-256'}, false, ['sign']); }
async function createVapidHeaders(aud, pub, privB64u){
  const now=Math.floor(Date.now()/1000);
  const h=u8ToB64u(new TextEncoder().encode(JSON.stringify({typ:'JWT',alg:'ES256'})));
  const p=u8ToB64u(new TextEncoder().encode(JSON.stringify({aud, exp:now+43200, sub:'mailto:info@leeuw008.nl'})));
  const unsigned=`${h}.${p}`;
  const key=await importVapidPrivateKeyECDSA(privB64u);
  const sig=new Uint8Array(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'}, key, new TextEncoder().encode(unsigned)));
  let raw=sig;
  if(sig[0]===0x30){ try{ const rLen=sig[3]; const r=sig.slice(4,4+rLen); const sLen=sig[5+rLen]; const s=sig.slice(6+rLen,6+rLen+sLen); raw=new Uint8Array(64); raw.set(r.slice(-32),32-Math.min(32,r.length)); raw.set(s.slice(-32),64-Math.min(32,s.length)); }catch{} }
  return {Authorization:`vapid t=${h}.${p}.${u8ToB64u(raw)}, k=${pub}`, 'Crypto-Key':`p256ecdsa=${pub}`};
}
async function hkdfExtract(salt, ikm){ const k=await crypto.subtle.importKey('raw',salt,{name:'HMAC',hash:'SHA-256'},false,['sign']); return new Uint8Array(await crypto.subtle.sign('HMAC',k,ikm)); }
async function hkdfExpand(prk, info, len){
  const k=await crypto.subtle.importKey('raw',prk,{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const out=new Uint8Array(len); let t=new Uint8Array(0), pos=0, ctr=1;
  while(pos<len){ const data=new Uint8Array(t.length+info.length+1); data.set(t,0); data.set(info,t.length); data[t.length+info.length]=ctr; const sig=new Uint8Array(await crypto.subtle.sign('HMAC',k,data)); t=sig; const take=Math.min(t.length,len-pos); out.set(t.slice(0,take),pos); pos+=take; ctr++; }
  return out;
}
function concat(...arrs){ const total=arrs.reduce((s,a)=>s+a.length,0); const out=new Uint8Array(total); let o=0; for(const a of arrs){ out.set(a,o); o+=a.length; } return out; }
async function encryptPayloadAes128gcm(sub, payload){
  const p256dh=b64uToU8(sub.keys.p256dh); const auth=b64uToU8(sub.keys.auth);
  if(p256dh.length!==65) throw new Error('p256dh len '+p256dh.length); if(auth.length!==16) throw new Error('auth len '+auth.length);
  const salt=crypto.getRandomValues(new Uint8Array(16));
  const localKP=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);
  const localPubRaw=new Uint8Array(await crypto.subtle.exportKey('raw',localKP.publicKey));
  const clientPub=await crypto.subtle.importKey('raw',p256dh,{name:'ECDH',namedCurve:'P-256'},false,[]);
  const shared=new Uint8Array(await crypto.subtle.deriveBits({name:'ECDH',public:clientPub},localKP.privateKey,256));
  const prk=await hkdfExtract(auth, shared);
  const infoPrefix=new TextEncoder().encode('WebPush: info\0');
  const keyInfo=concat(infoPrefix, p256dh, localPubRaw);
  const ikm=await hkdfExpand(prk, keyInfo, 32);
  const prk2=await hkdfExtract(salt, ikm);
  const cek=await hkdfExpand(prk2, new TextEncoder().encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce=await hkdfExpand(prk2, new TextEncoder().encode('Content-Encoding: nonce\0'), 12);
  const cekKey=await crypto.subtle.importKey('raw',cek,{name:'AES-GCM'},false,['encrypt']);
  const payloadBytes=new TextEncoder().encode(payload);
  const padded=new Uint8Array(payloadBytes.length+1); padded.set(payloadBytes,0); padded[payloadBytes.length]=2;
  const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv:nonce},cekKey,padded);
  const rs=new Uint8Array(4); new DataView(rs.buffer).setUint32(0,4096);
  const header=concat(salt, rs, new Uint8Array([localPubRaw.length]), localPubRaw);
  return {body:concat(header, new Uint8Array(encrypted))};
}

async function fetchText(url){
  const isVC = url.includes('vechtdalcentraal.nl');
  const isOost = url.includes('rtvoost.nl') || url.includes('oost.nl');
  const tryFetch = async (u, h) => {
    try{
      const r = await fetch(u, { headers: h, cf:{ cacheTtl: 0, cacheEverything: false }, redirect:'follow' });
      if(!r.ok) throw new Error(`Fetch ${r.status} ${u}`);
      const t = await r.text();
      if(t.length<200) throw new Error('empty '+t.length);
      if(t.includes('Just a moment')||t.includes('Attention Required')) throw new Error('cf challenge');
      return t;
    }catch(e){ throw e; }
  };
  const headersList = [
    {'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36','Accept':'text/html,application/xhtml+xml,application/xml;q=0.9,application/rss+xml,*/*;q=0.8','Accept-Language':'nl-NL,nl;q=0.9','Referer': isOost?'https://www.rtvoost.nl/':(isVC?'https://www.vechtdalcentraal.nl/':'https://www.ommen.nl/')},
    {'User-Agent':'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)','Accept':'*/*'}
  ];
  for(let h of headersList){
    try{ return await tryFetch(url, h); }catch(e){}
  }
  if(isVC){
    try{
      const rssUrl = 'https://www.vechtdalcentraal.nl/feed/';
      const rRss = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`, {cf:{cacheTtl:300}});
      if(rRss.ok){ const j=await rRss.json(); if(j.status==='ok' && j.items && j.items.length>0){ let xml='<rss><channel>'; j.items.slice(0,20).forEach(it=>{ xml+=`<item><title><![CDATA[${it.title}]]></title><link>${it.link}</link><pubDate>${it.pubDate}</pubDate></item>`; }); xml+='</channel></rss>'; return xml; } }
    }catch{}
  }
  try{
    const ao = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`, {cf:{cacheTtl:300}});
    if(ao.ok){ const j=await ao.json(); if(j.contents && j.contents.length>500) return j.contents; }
  }catch{}
  const r2 = await fetch(url, {headers:{'User-Agent':'Mozilla/5.0 OmmenNieuws'}});
  if(!r2.ok) throw new Error('final fail '+r2.status);
  return await r2.text();
}
async function fetchTextWithFallback(urls){
  for(const u of urls){
    try{ const t=await fetchText(u); if(t && t.length>200) return t; }catch(e){ console.log('fetch fallback fail', u, e.message); }
  }
  return '';
}
function parseRSSItems(text, max=10){
  const items = [...text.matchAll(/<item[^>]*>([\s\S]*?)<\/item>/gi)];
  return items.slice(0,max).map(m=>{
    const item=m[0];
    const title=(item.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i)||[])[1]?.replace(/<[^>]*>/g,'').trim()||'Nieuw artikel';
    let link=(item.match(/<link[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i)||[])[1]?.trim()||'';
    if(!link){ const guid=(item.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i)||[])[1]?.trim(); if(guid&&guid.startsWith('http')) link=guid; }
    link=link.replace(/^<!\[CDATA\[/,'').replace(/\]\]>$/,'').trim();
    if(!link||!link.startsWith('http')){ const mm=item.match(/https?:\/\/[^\s<"]+/); if(mm) link=mm[0]; }
    const pubDate=(item.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)||[])[1]?.trim()||'';
    return {title:title.replace(/&#8217;/g,"'").replace(/&amp;/g,"&").slice(0,120), link, pubDate};
  }).filter(x=>x.link);
}
async function getLatestListForSource(source, max=10){
  try{
    if(['Ommen City','OudOmmen','De Stentor','RondOmmen','Natuurlijk Ommen','Vechtdal Centraal'].includes(source.name)){
      const t=await fetchText(source.url);
      const list=parseRSSItems(t, max);
      return list.map(p=>({title:p.title, link:p.link, pubDate:p.pubDate, source:source.name}));
    }
    if(source.name==='Gemeente Ommen'){
      try{
        const urlsToTry=['https://www.ommen.nl/actueel/','https://www.ommen.nl/nieuws/','https://www.ommen.nl/actueel/overzicht/'];
        let html=''; try{ html=await fetchTextWithFallback(urlsToTry); }catch{ html=await fetchText('https://www.ommen.nl/actueel/'); }
        let allLinks=[]; const re1 = /href=["']([^"']*\/actueel\/[^"'?#]+)["']/gi; const re2 = /href=["']([^"']*\/nieuws\/[^"'?#]+)["']/gi; let m; while((m=re1.exec(html))!==null) allLinks.push(m[1]); while((m=re2.exec(html))!==null) allLinks.push(m[1]);
        const cleaned=[...new Set(allLinks.map(h=>{ if(h.startsWith('http')) return h; if(h.startsWith('/')) return 'https://www.ommen.nl'+h; return 'https://www.ommen.nl/'+h; }).filter(h=>h.length>30 && !h.endsWith('/actueel/') && !h.endsWith('/nieuws/')) )].slice(0,max);
        if(cleaned.length===0) throw new Error('no gemeente links');
        return cleaned.map(link=>({title:'Gemeente Ommen: '+decodeURIComponent(link.split('/').filter(Boolean).pop().replace(/-/g,' ').slice(0,80)), link, source:source.name}));
      }catch(e){ console.log('Gemeente fail',e.message); return []; }
    }
    if(source.name==='RTV Vechtdal'){
      try{ const rssText=await fetchText('https://rtvvechtdal.nl/feed/'); const list=parseRSSItems(rssText, max); if(list.length) return list.map(p=>({title:p.title, link:p.link, pubDate:p.pubDate, source:source.name})); }catch{}
      try{ const rssText2=await fetchText('https://rtvvechtdal.nl/rss.xml'); const list=parseRSSItems(rssText2, max); if(list.length) return list.map(p=>({title:p.title, link:p.link, pubDate:p.pubDate, source:source.name})); }catch{}
      try{ const t=await fetchText('https://www.vechtdalleeft.nl/wp-json/wp/v2/posts?per_page='+max); const j=JSON.parse(t); return j.map(it=>({title:it.title.rendered.replace(/<[^>]*>/g,'').trim(), link:it.link, pubDate:it.date, source:source.name})); }catch{} return [];
    }
    if(source.name==='RTV Oost'){
      try{
        const html=await fetchText('https://www.oost.nl/nieuws'); let all=[...html.matchAll(/href=["']([^"']*\/nieuws\/\d+\/[^"']*)["']/gi)].map(m=>m[1]); if(all.length===0) all=[...html.matchAll(/href=["'](\/nieuws\/[^"']+)["']/gi)].map(m=>m[1]);
        const uniq=[...new Set(all.map(l=>l.startsWith('http')?l:'https://www.oost.nl'+l))].slice(0,max); const res=[];
        for(const link of uniq){ try{ const art=await fetchText(link); const mt=art.match(/<h1[^>]*>([^<]+)<\/h1>/i); res.push({title:mt?mt[1].trim().slice(0,120):'RTV Oost artikel', link, source:source.name}); }catch{ res.push({title:'RTV Oost artikel', link, source:source.name}); } }
        return res;
      }catch(e){ console.log('Oost fail',e.message); return []; }
    }
  }catch(e){ console.log('getLatestList error', source.name, e.message); }
  return [];
}
async function sendPushForArticle(env, article){
  const vapid=await getVapidKeys(env);
  const list=env.PUSH_KV?await env.PUSH_KV.list({prefix:''}):{keys:[]};
  let sent=0, failed=0; const seenEndpoints=new Set();
  const appUrl=`https://leeuw008-nl.github.io/Nieuws-Ommen/?open=${encodeURIComponent(article.link)}&src=${encodeURIComponent(article.source)}`;
  const payload=JSON.stringify({title:`${article.title} [Bron: ${article.source}]`, body:`${article.title} • Bron: ${article.source}`, url:article.link, appUrl:appUrl, source:article.source});
  for(const k of list.keys){
    if(!k.name.startsWith('sub:')&&!k.name.startsWith('push2:')) continue;
    let sub=null; try{ sub=await env.PUSH_KV.get(k.name,{type:'json'}); }catch{} if(!sub?.endpoint) continue;
    if(seenEndpoints.has(sub.endpoint)) continue; seenEndpoints.add(sub.endpoint);
    const us=sub.sources||[]; if(us.length>0 && !us.includes(article.source)) continue;
    try{
      const aud=new URL(sub.endpoint).origin; const vh=await createVapidHeaders(aud,vapid.publicKey,vapid.privateKey);
      const encP=await encryptPayloadAes128gcm(sub,payload);
      const headers={...vh,'Content-Type':'application/octet-stream','Content-Encoding':'aes128gcm','TTL':'86400'};
      const res=await fetch(sub.endpoint,{method:'POST',headers,body:encP.body});
      if(res.ok) sent++; else { failed++; if(res.status===404||res.status===410) await env.PUSH_KV.delete(k.name); }
    }catch{ failed++; }
  }
  return {sent, failed, total:seenEndpoints.size};
}
async function runCronCheck(env){
  const sources=[
    {name:'Ommen City', url:'https://ommencity.nl/feed/'},{name:'OudOmmen', url:'https://weblog.oudommen.nl/feed/'},{name:'De Stentor', url:'https://www.destentor.nl/ommen/rss.xml'},{name:'RondOmmen', url:'https://www.rondommen.nl/feed/'},{name:'Natuurlijk Ommen', url:'https://www.natuurlijkommen.nl/feed/'},{name:'Vechtdal Centraal', url:'https://www.vechtdalcentraal.nl/feed/'},{name:'Gemeente Ommen', url:'gemeente'},{name:'RTV Vechtdal', url:'rtvvechtdal'},{name:'RTV Oost', url:'oost'}
  ];
  const results=[];
  for(const src of sources){
    const latestList=await getLatestListForSource(src, 10);
    if(!latestList.length){ results.push({source:src.name, status:'no-article'}); continue; }
    for(const latest of latestList.reverse()){
      if(!latest.link) continue; const kvKey=`lastSeen:${src.name}`; const pushedKey=`pushed:${src.name}:`+btoa(latest.link).slice(0,60);
      const lastSeen=await env.PUSH_KV.get(kvKey); const alreadyPushed=await env.PUSH_KV.get(pushedKey);
      if(alreadyPushed) continue; if(!lastSeen){ await env.PUSH_KV.put(kvKey, latest.link); results.push({source:src.name, status:'init', link:latest.link, title:latest.title}); continue; } if(lastSeen===latest.link) break;
    }
    const lastSeen=await env.PUSH_KV.get(`lastSeen:${src.name}`);
    if(!lastSeen){ await env.PUSH_KV.put(`lastSeen:${src.name}`, latestList[0].link); continue; }
    const newOnes=[]; for(const art of latestList){ if(art.link===lastSeen) break; const pk=`pushed:${src.name}:`+btoa(art.link).slice(0,60); const already=await env.PUSH_KV.get(pk); if(!already) newOnes.push(art); }
    if(newOnes.length===0){ results.push({source:src.name, status:'unchanged', link:latestList[0].link}); }
    else { for(const art of newOnes.reverse()){ const sendRes=await sendPushForArticle(env, art); await env.PUSH_KV.put(`pushed:${src.name}:`+btoa(art.link).slice(0,60), '1', {expirationTtl: 86400*7}); results.push({source:src.name, status:'pushed', link:art.link, title:art.title, ...sendRes}); } await env.PUSH_KV.put(`lastSeen:${src.name}`, latestList[0].link); }
  }
  return results;
}

export default {
  async scheduled(event, env, ctx){ ctx.waitUntil(runCronCheck(env).then(r=>console.log('CRON', JSON.stringify(r))).catch(e=>console.log('CRON ERR', e))); },
  async fetch(req,env){
    try{
      const url=new URL(req.url); const path=url.pathname;
      if(req.method==='OPTIONS') return new Response(null,{headers:CORS});

      // ===== NEW: AUTH & SYNC =====
      if(path==='/auth/register' && req.method==='POST'){
        const {email, password} = await req.json();
        if(!email || !password || password.length<6) return json({error:'Email + wachtwoord (min 6) verplicht'}, 400);
        const key=`user:${email.toLowerCase()}`;
        const exists=await env.PUSH_KV.get(key);
        if(exists) return json({error:'Account bestaat al'}, 400);
        const id=crypto.randomUUID();
        const pwHash=await hashPassword(password);
        await env.PUSH_KV.put(key, JSON.stringify({id, email: email.toLowerCase(), pwHash, created: Date.now()}));
        const token=crypto.randomUUID();
        await env.PUSH_KV.put(`session:${token}`, JSON.stringify({id, email: email.toLowerCase()}), {expirationTtl: 60*60*24*30});
        return json({token, email: email.toLowerCase(), id});
      }
      if(path==='/auth/login' && req.method==='POST'){
        const {email, password} = await req.json();
        const key=`user:${email.toLowerCase()}`;
        const raw=await env.PUSH_KV.get(key);
        if(!raw) return json({error:'Onbekend account'}, 401);
        const user=JSON.parse(raw);
        const pwHash=await hashPassword(password);
        if(pwHash!==user.pwHash) return json({error:'Wachtwoord onjuist'}, 401);
        const token=crypto.randomUUID();
        await env.PUSH_KV.put(`session:${token}`, JSON.stringify({id:user.id, email:user.email}), {expirationTtl: 60*60*24*30});
        return json({token, email:user.email, id:user.id});
      }
      if(path==='/auth/me'){
        const token=req.headers.get('Authorization')?.replace('Bearer ','') || url.searchParams.get('token');
        if(!token) return json({error:'no token'}, 401);
        const sess=await env.PUSH_KV.get(`session:${token}`);
        if(!sess) return json({error:'invalid'}, 401);
        return new Response(sess, {headers:{'Content-Type':'application/json', ...CORS}});
      }
      if(path==='/auth/logout' && req.method==='POST'){
        try{ const body=await req.json().catch(()=>({})); const token=req.headers.get('Authorization')?.replace('Bearer ','') || body.token || url.searchParams.get('token'); if(token) await env.PUSH_KV.delete(`session:${token}`); }catch{}
        return json({ok:true});
      }
      if(path==='/sync/save' && req.method==='POST'){
        const token=req.headers.get('Authorization')?.replace('Bearer ','');
        if(!token) return json({error:'Niet ingelogd'}, 401);
        const sessRaw=await env.PUSH_KV.get(`session:${token}`);
        if(!sessRaw) return json({error:'Sessie verlopen'}, 401);
        const sess=JSON.parse(sessRaw);
        const body=await req.json();
        if(!body.state) return json({error:'no state'}, 400);
        await env.PUSH_KV.put(`sync:${sess.id}`, JSON.stringify({state: body.state, updated: Date.now(), email: sess.email}));
        return json({ok:true, updated: Date.now()});
      }
      if(path==='/sync/load'){
        const token=req.headers.get('Authorization')?.replace('Bearer ','') || url.searchParams.get('token');
        if(!token) return json({error:'Niet ingelogd'}, 401);
        const sessRaw=await env.PUSH_KV.get(`session:${token}`);
        if(!sessRaw) return json({error:'Sessie verlopen'}, 401);
        const sess=JSON.parse(sessRaw);
        const data=await env.PUSH_KV.get(`sync:${sess.id}`);
        if(!data) return json({state:null});
        return new Response(data, {headers:{'Content-Type':'application/json', ...CORS}});
      }

      // ===== EXISTING ROUTES (unchanged) =====
      if(path.endsWith('/api/gemeente')){
        try{
          const html=await fetchText('https://www.ommen.nl/actueel/');
          const matches=[...html.matchAll(/href=["']([^"']*\/actueel\/[^"']+)["']/gi)];
          const links=[...new Set(matches.map(m=>m[1]).map(h=>h.startsWith('http')?h:'https://www.ommen.nl'+h))].slice(0,10);
          return new Response(JSON.stringify(links.map(l=>({title:'Gemeente Ommen', link:l}))),{headers:{...CORS,'Content-Type':'application/json'}});
        }catch(e){ return new Response(JSON.stringify([]),{headers:CORS}); }
      }
      if(path.endsWith('/api/oost')){
        try{
          const html=await fetchText('https://www.oost.nl/nieuws');
          let all=[...html.matchAll(/href=["']([^"']*\/nieuws\/\d+\/[^"']*)["']/gi)].map(m=>m[1]);
          if(all.length===0) all=[...html.matchAll(/href=["'](\/nieuws\/[^"']+)["']/gi)].map(m=>m[1]);
          const uniq=[...new Set(all.map(l=>l.startsWith('http')?l:'https://www.oost.nl'+l))].slice(0,10);
          return new Response(JSON.stringify(uniq.map(l=>({title:'RTV Oost', link:l}))),{headers:{...CORS,'Content-Type':'application/json'}});
        }catch(e){ return new Response(JSON.stringify([]),{headers:CORS}); }
      }
      if(path.endsWith('/api/rtvvechtdal')){
        try{
          const txt=await fetchText('https://rtvvechtdal.nl/feed/');
          const list=parseRSSItems(txt,10);
          return new Response(JSON.stringify(list),{headers:{...CORS,'Content-Type':'application/json'}});
        }catch{
          try{
            const txt=await fetchText('https://www.vechtdalleeft.nl/wp-json/wp/v2/posts?per_page=10');
            return new Response(txt,{headers:{...CORS,'Content-Type':'application/json'}});
          }catch(e){ return new Response(JSON.stringify([]),{headers:CORS}); }
        }
      }
      if(path.endsWith('/api/vechtdalcentraal')){
        try{
          const txt=await fetchText('https://www.vechtdalcentraal.nl/feed/');
          const list=parseRSSItems(txt,10);
          return new Response(JSON.stringify(list),{headers:{...CORS,'Content-Type':'application/json'}});
        }catch(e){ return new Response(JSON.stringify([]),{headers:CORS}); }
      }
      if(path.endsWith('/dashboard') || path.endsWith('/testpanel') || path==='/' || path.endsWith('/panel')){
        const html = `<!DOCTYPE html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ommen Push Dashboard v13 SYNC</title>
<style>*{box-sizing:border-box}body{font-family:sans-serif;margin:0;background:#f5f7fb;color:#111}.header{background:#0b5bd3;color:#fff;padding:18px 14px;position:sticky;top:0}.container{max-width:900px;margin:0 auto;padding:14px}.card{background:#fff;border-radius:12px;padding:14px;margin:10px 0;box-shadow:0 2px 8px rgba(0,0,0,.08)}.btn{padding:10px 14px;border-radius:10px;border:none;font-weight:600;cursor:pointer}.btn-primary{background:#0b5bd3;color:#fff}.btn-secondary{background:#eef2ff;color:#0b5bd3}input,select{width:100%;padding:10px;border-radius:8px;border:1px solid #d1d5db;margin:4px 0}.small{font-size:12px;color:#6b7280}.badge{display:inline-block;padding:2px 8px;border-radius:20px;background:#e0f2fe;font-size:11px}pre{white-space:pre-wrap;word-break:break-word;background:#0f172a;color:#e2e8f0;padding:10px;border-radius:8px;max-height:300px;overflow:auto}</style></head><body>
<div class="header"><h1>Ommen Push Dashboard v13 + SYNC</h1><div class="small" style="color:#c7d2fe">9 bronnen + Login Sync • PUSH_KV hergebruikt</div></div>
<div class="container">
<div class="card"><h3>Status</h3><div id="status">Laden...</div><button class="btn btn-secondary" onclick="loadDebug()">Vernieuw</button> <button class="btn btn-secondary" onclick="doCron()">Cron nu</button></div>
<div class="card"><h3>Testbericht</h3><input id="tTitle" value="Test Ommen Nieuws ✅"><input id="tBody" value="Testmelding"><input id="tUrl" value="https://leeuw008-nl.github.io/Nieuws-Ommen/"><select id="tSource"><option value="">ALL</option><option>Gemeente Ommen</option><option>Ommen City</option><option>OudOmmen</option><option>De Stentor</option><option>RondOmmen</option><option>RTV Oost</option><option>RTV Vechtdal</option><option>Natuurlijk Ommen</option><option>Vechtdal Centraal</option></select><label><input type="checkbox" id="tStrict" checked> Strict</label><br><button class="btn btn-primary" onclick="sendTest()">Verstuur</button><pre id="sendResult"></pre></div>
<div class="card"><h3>Cron</h3><pre id="cronResult"></pre></div></div>
<script>
async function loadDebug(){ const r=await fetch('/debug'); const j=await r.json(); document.getElementById('status').innerHTML='<b>'+j.total+' abonnementen</b><br>'+j.lastSeen.map(s=>'<span class=badge>'+s.source+'</span>').join(' ')+'<br><pre>'+JSON.stringify(j,null,2)+'</pre>'; }
async function sendTest(){ const t=encodeURIComponent(document.getElementById('tTitle').value); const b=encodeURIComponent(document.getElementById('tBody').value); const u=encodeURIComponent(document.getElementById('tUrl').value); const s=document.getElementById('tSource').value; const st=document.getElementById('tStrict').checked?1:0; let q='/test?title='+t+'&body='+b+'&url='+u; if(s) q+='&source='+encodeURIComponent(s); q+='&strict='+st; document.getElementById('sendResult').textContent='...'; const r=await fetch(q); document.getElementById('sendResult').textContent=await r.text(); }
async function doCron(){ document.getElementById('cronResult').textContent='...'; const r=await fetch('/cron'); document.getElementById('cronResult').textContent=await r.text(); }
loadDebug();
</script></body></html>`;
        return new Response(html,{headers:{...CORS,'Content-Type':'text/html'}});
      }
      if(path.endsWith('/cron')){ const res=await runCronCheck(env); return new Response(JSON.stringify(res,null,2),{headers:{...CORS,'Content-Type':'application/json'}}); }
      if(path.includes('clear-all')){
        if(url.searchParams.get('confirm')!=='yes') return new Response(JSON.stringify({err:'Add ?confirm=yes'}),{status:400,headers:{...CORS,'Content-Type':'application/json'}});
        const list=await env.PUSH_KV.list({prefix:''}); let d=0; for(const k of list.keys){ if(k.name.startsWith('sub:')||k.name.startsWith('push2:')||k.name.startsWith('lastSeen:')||k.name.startsWith('pushed:')){ await env.PUSH_KV.delete(k.name); d++; } }
        return new Response(JSON.stringify({ok:true,deleted:d}),{headers:{...CORS,'Content-Type':'application/json'}});
      }
      if(path.endsWith('/vapidPublicKey')){ const k=await getVapidKeys(env); return new Response(k.publicKey,{headers:{...CORS,'Content-Type':'text/plain'}}); }
      if(path.endsWith('/vapid')){ const k=await getVapidKeys(env); return new Response(JSON.stringify({publicKey:k.publicKey}),{headers:{...CORS,'Content-Type':'application/json'}}); }
      if(path.endsWith('/debug')){
        const list=env.PUSH_KV?await env.PUSH_KV.list({prefix:''}):{keys:[]};
        const subs=[]; const lastSeen=[]; let syncCount=0, userCount=0;
        for(const k of list.keys.slice(0,200)){
          if(k.name.startsWith('lastSeen:')){ const v=await env.PUSH_KV.get(k.name); lastSeen.push({source:k.name.replace('lastSeen:',''), link:v}); continue; }
          if(k.name.startsWith('pushed:')) continue;
          if(k.name.startsWith('sync:')){ syncCount++; continue; }
          if(k.name.startsWith('user:')){ userCount++; continue; }
          if(k.name.startsWith('session:')) continue;
          if(!k.name.startsWith('sub:')&&!k.name.startsWith('push2:')) continue;
          try{ const v=await env.PUSH_KV.get(k.name,{type:'json'}); subs.push({id:k.name.slice(0,8), endpoint:(v?.endpoint||'').slice(0,40)+'...', sources:v?.sources||[], created:new Date(v?.created||0).toLocaleString()}); }catch{}
        }
        return new Response(JSON.stringify({total:list.keys.filter(k=>k.name.startsWith('sub:')||k.name.startsWith('push2:')).length, users:userCount, syncedDevices:syncCount, lastSeen, subs},null,2),{headers:{...CORS,'Content-Type':'application/json'}});
      }
      if(path.endsWith('/subscribe')&&req.method==='POST'){
        try{ const data=await req.json(); const id='push2:'+crypto.randomUUID(); await env.PUSH_KV.put(id, JSON.stringify({endpoint:data.endpoint,keys:data.keys,sources:data.sources||[],created:Date.now()})); return new Response(JSON.stringify({ok:true,id}),{headers:{...CORS,'Content-Type':'application/json'}}); }catch(e){ return new Response(JSON.stringify({ok:false,err:e.message}),{status:400,headers:{...CORS,'Content-Type':'application/json'}}); }
      }
      if(path.endsWith('/unsubscribe')){
        try{ const data=await req.json().catch(()=>({})); const ep=data.endpoint||url.searchParams.get('endpoint'); const list=await env.PUSH_KV.list({prefix:''}); for(const k of list.keys){ if(!k.name.startsWith('sub:')&&!k.name.startsWith('push2:')) continue; const v=await env.PUSH_KV.get(k.name,{type:'json'}); if(v?.endpoint===ep) await env.PUSH_KV.delete(k.name); } return new Response(JSON.stringify({ok:true}),{headers:{...CORS,'Content-Type':'application/json'}}); }catch(e){ return new Response(JSON.stringify({ok:false,err:e.message}),{status:500,headers:CORS}); }
      }
      if(path.includes('/proxy')){
        const t=url.searchParams.get('url'); if(!t) return new Response('Missing url',{status:400,headers:CORS});
        try{ const txt=await fetchText(t); const ct = t.includes('.xml')||t.includes('/feed')||t.includes('/rss') ? 'application/xml' : (t.includes('.json')?'application/json':'text/html; charset=utf-8'); return new Response(txt,{headers:{...CORS,'Content-Type':ct}}); }catch(e){ return new Response('Proxy err '+e.message,{status:500,headers:CORS}); }
      }
      if(path.includes('/send')||path.includes('/test')){
        const isTest=path.includes('/test'); const title=url.searchParams.get('title')||(isTest?'Test Ommen Nieuws':'Nieuw Ommen nieuws'); let body=url.searchParams.get('body')||(isTest?'Testmelding '+new Date().toLocaleTimeString('nl-NL'):'Nieuw artikel'); const link=url.searchParams.get('url')||'https://leeuw008-nl.github.io/Nieuws-Ommen/'; let src=url.searchParams.get('source'); if(src==='ALL'||src==='all'||src==='') src=null; const strict=url.searchParams.get('strict')==='1'; if(src && !body.includes(src)) body=body+` vanuit ${src}`; const vapid=await getVapidKeys(env); const list=env.PUSH_KV?await env.PUSH_KV.list({prefix:''}):{keys:[]}; let sent=0,failed=0; const seen=new Set(); const appUrl=`https://leeuw008-nl.github.io/Nieuws-Ommen/?open=${encodeURIComponent(link)}&src=${encodeURIComponent(src||'')}`; const payload=JSON.stringify({title: src? `${title} [Bron: ${src}]` : title, body, url:link, appUrl, source:src||'ALL'}); for(const k of list.keys){ if(!k.name.startsWith('sub:')&&!k.name.startsWith('push2:')) continue; let sub=null; try{ sub=await env.PUSH_KV.get(k.name,{type:'json'}); }catch{} if(!sub?.endpoint) continue; if(seen.has(sub.endpoint)) continue; seen.add(sub.endpoint); const us=sub.sources||[]; if(src){ if(strict){ if(!us.includes(src)) continue; } else { if(us.length>0 && !us.includes(src)) continue; } } try{ const aud=new URL(sub.endpoint).origin; const vh=await createVapidHeaders(aud,vapid.publicKey,vapid.privateKey); const encP=await encryptPayloadAes128gcm(sub,payload); const headers={...vh,'Content-Type':'application/octet-stream','Content-Encoding':'aes128gcm','TTL':'86400'}; const res=await fetch(sub.endpoint,{method:'POST',headers,body:encP.body}); if(res.ok) sent++; else{ failed++; if(res.status===404||res.status===410) await env.PUSH_KV.delete(k.name); } }catch(e){ failed++; } } return new Response(JSON.stringify({sent,failed,total:seen.size,source:src||'ALL'},null,2),{headers:{...CORS,'Content-Type':'application/json'}}); }
      return new Response('Ommen Push Worker v13 SYNC - FIX + AUTH',{headers:CORS});
    }catch(e){ return new Response('Worker exception: '+e.message+'\n'+e.stack,{status:500,headers:CORS}); }
  }
}
</textarea><br><br><a class="btn" onclick="navigator.clipboard.writeText(document.getElementById('w').value)">Kopieer Worker</a></div>
<div class="card"><h2>2. App.js v226 Addon</h2><p>Plak dit HELEMAAL onderaan je huidige app.js v225, na de laatste regel <code>window.refreshNews=refreshNews;</code></p><textarea id="a">
// ===== v226 SYNC + LOGIN - PLAK DIT ONDERAAN JE APP.JS V225 =====
const SYNC_ENABLED = true;
let currentUser = null;
let authToken = localStorage.getItem('ommen_auth_token') || null;

function getAuthHeaders(){
  return authToken ? {'Authorization': 'Bearer '+authToken, 'Content-Type':'application/json'} : {'Content-Type':'application/json'};
}

async function checkLogin(){
  if(!authToken) return null;
  try{
    const r = await fetch(WORKER+'/auth/me', {headers: getAuthHeaders()});
    if(!r.ok){ logout(); return null; }
    const u = await r.json();
    currentUser = u;
    return u;
  }catch{ return null; }
}

async function login(email, password){
  const r = await fetch(WORKER+'/auth/login', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({email, password})});
  const j = await r.json();
  if(!r.ok) throw new Error(j.error||'Login mislukt');
  authToken = j.token;
  localStorage.setItem('ommen_auth_token', authToken);
  currentUser = {id:j.id, email:j.email};
  await loadFromCloud();
  updateAuthUI();
  return j;
}

async function register(email, password){
  const r = await fetch(WORKER+'/auth/register', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({email, password})});
  const j = await r.json();
  if(!r.ok) throw new Error(j.error||'Registratie mislukt');
  authToken = j.token;
  localStorage.setItem('ommen_auth_token', authToken);
  currentUser = {id:j.id, email:j.email};
  await saveToCloud();
  updateAuthUI();
  return j;
}

function logout(){
  if(authToken) fetch(WORKER+'/auth/logout', {method:'POST', headers: getAuthHeaders(), body: JSON.stringify({token: authToken})}).catch(()=>{});
  authToken = null;
  currentUser = null;
  localStorage.removeItem('ommen_auth_token');
  updateAuthUI();
}

async function saveToCloud(){
  if(!authToken || !SYNC_ENABLED) return;
  try{
    await fetch(WORKER+'/sync/save', {method:'POST', headers: getAuthHeaders(), body: JSON.stringify({state})});
    console.log('Sync: opgeslagen');
  }catch(e){ console.log('Sync save fail', e.message); }
}

async function loadFromCloud(){
  if(!authToken) return;
  try{
    const r = await fetch(WORKER+'/sync/load', {headers: getAuthHeaders()});
    if(!r.ok) return;
    const data = await r.json();
    if(data.state && Object.keys(data.state).length>0){
      state = data.state;
      localStorage.setItem('nieuwsommen_bronnen_v2', JSON.stringify(state));
      console.log('Sync: geladen uit cloud');
      renderFilters();
      filterNews();
    }
  }catch(e){ console.log('Sync load fail', e.message); }
}

function updateAuthUI(){
  const slot = document.getElementById('auth-slot');
  if(!slot) return;
  if(currentUser){
    slot.innerHTML = `<div class="auth-logged"><span class="auth-email">${currentUser.email}</span><button id="btn-logout" class="btn-mini">Uitloggen</button><button id="btn-sync" class="btn-mini primary">Sync nu</button></div>`;
    slot.querySelector('#btn-logout')?.addEventListener('click', logout);
    slot.querySelector('#btn-sync')?.addEventListener('click', ()=>{ saveToCloud(); alert('Instellingen gesynchroniseerd!'); });
  } else {
    slot.innerHTML = `<button id="btn-login-open" class="btn-mini">Inloggen / Sync</button>`;
    slot.querySelector('#btn-login-open')?.addEventListener('click', openLoginModal);
  }
}

function openLoginModal(){
  const existing = document.getElementById('login-modal');
  if(existing) existing.remove();
  const div = document.createElement('div');
  div.id='login-modal';
  div.innerHTML = `
  <div style="position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px">
    <div style="background:white;border-radius:16px;padding:24px;max-width:360px;width:100%;box-shadow:0 10px 30px rgba(0,0,0,0.2)">
      <h3 style="margin:0 0 8px;font-size:18px">Inloggen voor sync</h3>
      <p style="margin:0 0 16px;color:#666;font-size:13px">Je filterinstellingen worden dan op al je apparaten gelijk.</p>
      <input id="auth-email" type="email" placeholder="Email" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:8px;margin-bottom:10px">
      <input id="auth-pass" type="password" placeholder="Wachtwoord (min 6 tekens)" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:8px;margin-bottom:16px">
      <div style="display:flex;gap:8px">
        <button id="auth-do-login" style="flex:1;padding:10px;background:#0b5bd3;color:white;border:0;border-radius:8px;font-weight:600">Inloggen</button>
        <button id="auth-do-register" style="flex:1;padding:10px;background:#e8eef8;color:#0b5bd3;border:0;border-radius:8px;font-weight:600">Account maken</button>
      </div>
      <button id="auth-close" style="width:100%;margin-top:10px;padding:8px;background:transparent;border:0;color:#666">Annuleren</button>
      <div id="auth-error" style="margin-top:10px;color:#c00;font-size:13px"></div>
    </div>
  </div>`;
  document.body.appendChild(div);
  div.querySelector('#auth-close').onclick=()=>div.remove();
  div.querySelector('#auth-do-login').onclick=async()=>{
    const email=div.querySelector('#auth-email').value.trim();
    const pass=div.querySelector('#auth-pass').value;
    const err=div.querySelector('#auth-error');
    try{ err.textContent='Bezig...'; await login(email, pass); div.remove(); }catch(e){ err.textContent=e.message; }
  };
  div.querySelector('#auth-do-register').onclick=async()=>{
    const email=div.querySelector('#auth-email').value.trim();
    const pass=div.querySelector('#auth-pass').value;
    const err=div.querySelector('#auth-error');
    try{ err.textContent='Bezig...'; await register(email, pass); div.remove(); alert('Account aangemaakt en ingelogd!'); }catch(e){ err.textContent=e.message; }
  };
}

const _origSaveState = saveState;
saveState = function(){
  localStorage.setItem('nieuwsommen_bronnen_v2', JSON.stringify(state));
  updateHiddenCompat(); updateHeaderCount();
  if(window.updatePushBell) window.updatePushBell();
  if(authToken) saveToCloud();
};

document.addEventListener('DOMContentLoaded', async ()=>{
  setTimeout(async ()=>{
    const slot = document.createElement('div');
    slot.id='auth-slot';
    slot.style.cssText='padding:10px 14px;border-top:1px solid #eee;background:#f9fbff';
    document.getElementById('source-panel')?.appendChild(slot);
    await checkLogin();
    if(currentUser) await loadFromCloud();
    updateAuthUI();
  }, 500);
});
// ===== EINDE V226 ADDON =====
</textarea><br><br><a class="btn" onclick="navigator.clipboard.writeText(document.getElementById('a').value)">Kopieer Addon</a></div>
</body></html>
