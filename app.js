// app.js v254 FINAL - RTV Oost terug naar oude werkende scraper v238
// - Geen rss2json voor Oost (heeft geen feed)
// - Oost via allorigins RAW + parseRTVOostECHT (zoals weken geleden werkte)
const BRONNEN=[{id:'De Stentor',name:'De Stentor',sub:'regionaal'},{id:'Gemeente Ommen',name:'Gemeente Ommen',sub:'officieel'},{id:'Natuurlijk Ommen',name:'Natuurlijk Ommen',sub:'evenementen'},{id:'Ommen City',name:'Ommen City',sub:'lokaal'},{id:'OudOmmen',name:'OudOmmen',sub:'historie'},{id:'RondOmmen',name:'RondOmmen',sub:'lokaal'},{id:'RTV Oost',name:'RTV Oost',sub:'Overijssel'},{id:'RTV Vechtdal',name:'RTV Vechtdal',sub:'Vechtdal'},{id:'Vechtdal Centraal',name:'Vechtdal Centraal',sub:'112'}];
const MAX_PER_BRON={'De Stentor':25,'RondOmmen':20,'Ommen City':10,'OudOmmen':10,'Vechtdal Centraal':10,'Natuurlijk Ommen':10,'Gemeente Ommen':10,'RTV Oost':10,'RTV Vechtdal':10};
const BRON_URLS={
'De Stentor':{url:'https://www.destentor.nl/ommen/rss.xml',homepage:'https://www.destentor.nl/ommen/'},
'Gemeente Ommen':{url:'https://www.ommen.nl/actueel/',homepage:'https://www.ommen.nl/actueel/',type:'gemeente'},
'Natuurlijk Ommen':{url:'https://www.natuurlijkommen.nl/feed/',homepage:'https://www.natuurlijkommen.nl/'},
'Ommen City':{url:'https://ommencity.nl/feed/',homepage:'https://ommencity.nl/'},
'OudOmmen':{url:'https://weblog.oudommen.nl/feed/',homepage:'https://weblog.oudommen.nl/'},
'RondOmmen':{url:'https://www.rondommen.nl/feed/',homepage:'https://www.rondommen.nl/'},
'RTV Oost':{url:'https://www.rtvoost.nl/nieuws/ommen',homepage:'https://www.rtvoost.nl/nieuws/ommen',type:'oost'},
'RTV Vechtdal':{url:'https://rtvvechtdal.nl/feed/',homepage:'https://rtvvechtdal.nl/'},
'Vechtdal Centraal':{url:'https://www.vechtdalcentraal.nl/feed/',homepage:'https://www.vechtdalcentraal.nl/'},
};
// OUDE WERKENDE PARSERS uit v238 - dit was de oplossing van weken geleden
function parseVechtdalCentraalECHT(html){const items=[];const seen=new Set();let re=/<h3 class="entry-title[^>]*>\s*<a href="([^"]+)"[^>]*>([^<]+)<\/a>/gi,m;while((m=re.exec(html))!==null&&items.length<20){let l=m[1];if(l.startsWith('/'))l='https://www.vechtdalcentraal.nl'+l;if(seen.has(l))continue;seen.add(l);items.push({title:m[2].replace(/&#8217;/g,"'").replace(/&amp;/g,"&").trim(),link:l,pubDate:new Date(),description:m[2].trim()+' [...]'});}return items;}
function parseRTVVechtdalECHT(html){const items=[];let re=/<h3 class="allmode_title"><a href="([^"]+)">([^<]+)<\/a>/gi,m;while((m=re.exec(html))!==null&&items.length<15){let l=m[1];if(!l.startsWith('http'))l='https://www.rtvvechtdal.nl'+l;items.push({title:m[2].trim(),link:l,pubDate:new Date(),description:m[2].trim()+' [...]'});}return items;}
function parseRTVOostECHT(html){
  const items=[];let m;
  const re=/publishedAt="([^"]+)"[\s\S]{0,900}?href="(\/nieuws\/[^"]+)"[\s\S]{0,900}?<h3[^>]*>([^<]+)<\/h3>/gi;
  while((m=re.exec(html))!==null&&items.length<20){
    const pd=new Date(m[1]);const link='https://www.rtvoost.nl'+m[2];const title=m[3].trim();
    if(!items.find(x=>x.link===link))items.push({title,link,pubDate:pd,description:title+' [...]'});
  }
  if(items.length===0){
    const re2=/<a href="(\/nieuws\/[^"]+)"[^>]*>[\s\S]*?<h3[^>]*>([^<]+)<\/h3>/gi;
    while((m=re2.exec(html))!==null&&items.length<20){
      const link='https://www.rtvoost.nl'+m[1];const title=m[2].trim();
      if(!items.find(x=>x.link===link))items.push({title,link,pubDate:new Date(),description:title+' [...]'});
    }
  }
  return items;
}
let state={};let allArticles=[];let loadedSources=new Set();
function loadState(){try{const v=localStorage.getItem('nieuwsommen_bronnen_v2');if(v){state=JSON.parse(v);BRONNEN.forEach(b=>{if(!state[b.id])state[b.id]={aan:true,vandaag:false,scope:'regio'};});}else{BRONNEN.forEach(b=>state[b.id]={aan:true,vandaag:false,scope:'regio'});}}catch{BRONNEN.forEach(b=>state[b.id]={aan:true,vandaag:false,scope:'regio'});}}
function saveState(){localStorage.setItem('nieuwsommen_bronnen_v2',JSON.stringify(state));}
function renderFilters(){const l=document.getElementById('source-list');if(!l)return;l.innerHTML='';BRONNEN.forEach(b=>{const s=state[b.id]||{aan:true,vandaag:false,scope:'regio'};const row=document.createElement('div');row.className='source-row';const sg=s.scope==='gemeente';row.innerHTML=`<div class="source-meta"><div class="source-name">${b.name}</div></div><div class="toggles"><div class="toggle-col"><label class="mini-switch vandaag ${s.vandaag?'checked':''}"><input type="checkbox" ${s.vandaag?'checked':''} data-type="vandaag" data-id="${b.id}"><span class="mini-slider"></span></label><span class="mini-label">MEER</span></div><div class="toggle-col"><label class="mini-switch ${sg?'checked':''}"><input type="checkbox" ${sg?'checked':''} data-type="scope" data-id="${b.id}"><span class="mini-slider"></span></label><span class="mini-label">${sg?'GEMEENTE':'REGIO'}</span></div><div class="toggle-col"><label class="mini-switch aan ${s.aan?'checked':''}"><input type="checkbox" ${s.aan?'checked':''} data-type="aan" data-id="${b.id}"><span class="mini-slider"></span></label><span class="mini-label">${s.aan?'AAN':'UIT'}</span></div></div>`;l.appendChild(row);});l.querySelectorAll('input').forEach(i=>{i.addEventListener('change',e=>{const id=e.target.dataset.id;const t=e.target.dataset.type;if(!state[id])state[id]={aan:true,vandaag:false,scope:'regio'};if(t==='vandaag')state[id].vandaag=e.target.checked;if(t==='scope')state[id].scope=e.target.checked?'gemeente':'regio';if(t==='aan')state[id].aan=e.target.checked;saveState();renderFilters();renderArticles();});});}
function updateHeaderCount(){const el=document.getElementById('header-count');if(el)el.textContent=`${loadedSources.size} v/d ${BRONNEN.length} bronnen`;}
function closePanel(){document.getElementById('filter-header')?.classList.remove('open');document.getElementById('source-panel')?.classList.remove('open');}
function setupHeader(){const fh=document.getElementById('filter-header');if(!fh)return;fh.addEventListener('click',e=>{if(e.target.closest('#bell-slot'))return;if(e.target.id==='btn-all'||e.target.closest('#btn-all')){e.stopPropagation();const allOn=Object.values(state).every(s=>s.aan);BRONNEN.forEach(b=>state[b.id].aan=!allOn);saveState();renderFilters();renderArticles();return;}const p=document.getElementById('source-panel');if(p.classList.contains('open'))closePanel();else{ document.getElementById('filter-header')?.classList.add('open');document.getElementById('source-panel')?.classList.add('open');}});}
const WORKER='https://ommen-push-v2.leeuw008.workers.dev';
// FIX: Oost gebruikt allorigins RAW direct, geen worker proxy die CF challenge geeft
async function fetchViaWorker(url){
  const isOost=url.includes('rtvoost.nl');
  // Voor Oost: direct allorigins RAW (bypass CF) - dit werkte weken geleden
  if(isOost){
    try{
      const r=await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}&t=${Date.now()}`,{cache:'no-store'});
      if(r.ok){const t=await r.text(); if(t.length>1000&&!t.includes('Just a moment')){console.log('Oost via allorigins RAW OK',t.length); return t;}}
    }catch(e){console.log('allorigins RAW fail',e.message);}
    try{
      const r2=await fetch(`https://corsproxy.io/?${encodeURIComponent(url)}`,{cache:'no-store'});
      if(r2.ok){const t=await r2.text(); if(t.length>1000&&!t.includes('Just a moment')) return t;}
    }catch{}
  }
  // Voor andere bronnen: eerst rss2json, dan worker
  if(url.includes('vechtdalcentraal.nl')){
    try{
      const r=await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent('https://www.vechtdalcentraal.nl/feed/')}&t=${Date.now()}`,{cache:'no-store'});
      if(r.ok){const j=await r.json(); if(j.status==='ok'&&j.items&&j.items.length>0){let xml='<rss><channel>'; j.items.slice(0,15).forEach(it=>{xml+=`<item><title><![CDATA[${it.title}]]></title><link>${it.link}</link><pubDate>${it.pubDate}</pubDate><description><![CDATA[${it.description}]]></description></item>`;}); xml+='</channel></rss>'; return xml;}}
    }catch{}
  }
  try{
    const c=new AbortController(); setTimeout(()=>c.abort(),6000);
    const r=await fetch(`${WORKER}/proxy?url=${encodeURIComponent(url)}&t=${Date.now()}`,{cache:'no-store',signal:c.signal});
    if(r.ok){const t=await r.text(); if(t.length>500) return t;}
  }catch{}
  try{
    const r3=await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}&t=${Date.now()}`,{cache:'no-store'});
    if(r3.ok){const j=await r3.json(); if(j.contents&&j.contents.length>500) return j.contents;}
  }catch{}
  throw new Error('fetch fail '+url);
}
function parseRSS(xml,bronId){const max=MAX_PER_BRON[bronId]||10; let items=[...xml.matchAll(/<item[^>]*>([\s\S]*?)<\/item>/gi)]; if(items.length===0) items=[...xml.matchAll(/<entry[^>]*>([\s\S]*?)<\/entry>/gi)]; items=items.slice(0,max); return items.map(m=>{const it=m[0]; let title=(it.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i)||[])[1]||''; title=title.replace(/<[^>]*>/g,'').trim(); let link=(it.match(/<link[^>]*>([\s\S]*?)<\/link>/i)||[])[1]||''; if(!link||link.includes('<')){const hm=it.match(/<link[^>]+href=["']([^"']+)["']/i); if(hm) link=hm[1];} link=link.replace(/<!\[CDATA\[/g,'').replace(/\]\]>/g,'').trim(); if(!link.startsWith('http')){const mm=it.match(/https?:\/\/[^\s<"\]]+/); if(mm) link=mm[0];} let pub=(it.match(/<(pubDate|published|updated)[^>]*>([\s\S]*?)<\/(pubDate|published|updated)>/i)||[])[2]||''; let desc=(it.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i)||[])[1]||''; let d=desc.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,140)+' [...]'; return {title,link,pubDate:pub?new Date(pub):new Date(),description:d};}).filter(x=>x.link&&x.title);}
function parseGemeente(html){let clean=html.replace(/<!--[\s\S]*?-->/g,' ');const res=[];const seen=new Set();const re=/<h[23][^>]*>\s*<a[^>]+href=["']([^"']*\/actueel\/[^"'?#]+)["'][^>]*>([\s\S]*?)<\/a>\s*<\/h[23]>/gi;let m;while((m=re.exec(clean))!==null&&res.length<10){let href=m[1],title=m[2].replace(/<[^>]*>/g,'').trim();if(title.length<8)continue;const full=href.startsWith('http')?href:'https://www.ommen.nl'+href;if(seen.has(full))continue;seen.add(full);res.push({title:title.slice(0,120),link:full,pubDate:new Date(),description:title.slice(0,100)+' [...]'});}return res;}
async function loadOne(b){const cfg=BRON_URLS[b.id];try{let arts=[];if(cfg.type==='gemeente'){const h=await fetchViaWorker(cfg.url);arts=parseGemeente(h);}else if(cfg.type==='oost'){const h=await fetchViaWorker(cfg.url);arts=parseRTVOostECHT(h);if(arts.length===0)arts=parseRSS(h,b.id);}else{const x=await fetchViaWorker(cfg.url);if(x.includes('<h3')){if(b.id==='Vechtdal Centraal')arts=parseVechtdalCentraalECHT(x);else if(b.id==='RTV Vechtdal')arts=parseRTVVechtdalECHT(x);else arts=parseRSS(x,b.id);}else arts=parseRSS(x,b.id);}if(arts.length===0)throw new Error('empty');return arts.map(a=>({...a,source:b.name,id:b.id,isFallback:false}));}catch(e){console.log('load fail',b.id,e.message);return [{title:b.name,link:cfg.homepage,pubDate:new Date(0),description:'Bron tijdelijk offline [...]',source:b.name,id:b.id,isFallback:true}];}}
function fmt(d){if(!d||isNaN(d.getTime())||d.getTime()===0)return'';return d.toLocaleDateString('nl-NL',{day:'numeric',month:'short'});}
function renderArticles(){
  const c=document.getElementById('news-container');if(!c)return;
  let filtered=allArticles.filter(a=>{const s=state[a.id];return s&&s.aan;});
  filtered=filtered.sort((a,b)=>b.pubDate-a.pubDate);
  const real=filtered.filter(a=>!a.isFallback).length;
  c.innerHTML=`<div class="articles-count">${real} artikelen - ${loadedSources.size} v/d ${BRONNEN.length} bronnen geladen</div>`+filtered.map(a=>{const ct=a.title.replace(/^\[[^\]]+\]\s*/,'').trim()||a.title;if(a.isFallback)return `<div class="article fallback"><h2><a href="${a.link}" target="_blank">${a.source}</a></h2><small>${a.source}</small><div style="margin-top:6px;color:#666">${a.description}</div></div>`;return `<div class="article"><h2><a href="${a.link}" target="_blank">${ct}</a></h2><small>${a.source} - ${fmt(a.pubDate)}</small><div style="margin-top:6px;color:#555">${a.description||''}</div></div>`;}).join('');
}
async function refreshNews(){
  const c=document.getElementById('news-container');if(c)c.innerHTML='<div class="article">Bezig met laden... 9 bronnen</div>';
  allArticles=[];loadedSources=new Set();
  const tasks=BRONNEN.map(async b=>{
    if(!state[b.id]||!state[b.id].aan)return;
    try{
      const arts=await Promise.race([loadOne(b),new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')),5000))]);
      allArticles=allArticles.filter(x=>x.id!==b.id).concat(arts);loadedSources.add(b.id);updateHeaderCount();renderArticles();
    }catch(e){const cfg=BRON_URLS[b.id];allArticles=allArticles.filter(x=>x.id!==b.id).concat([{title:b.name,link:cfg.homepage,pubDate:new Date(0),description:'Offline [...]',source:b.name,id:b.id,isFallback:true}]);loadedSources.add(b.id);renderArticles();}
  });
  await Promise.all(tasks);renderArticles();
}
document.addEventListener('DOMContentLoaded',()=>{loadState();renderFilters();setupHeader();setTimeout(()=>refreshNews(),100);});
