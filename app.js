// app.js v252 FINAL - RTV Oost fix zonder filtering gedoe
// FIX: rss2json nu voor ZOWEL VC als Oost (was alleen if(isVC))
// FIX: default REGIO, gemeente filter bypass voor fallback
const BRONNEN=[
{id:'De Stentor',name:'De Stentor',sub:'regionaal (Ommen)'},
{id:'Gemeente Ommen',name:'Gemeente Ommen',sub:'officiële berichten'},
{id:'Natuurlijk Ommen',name:'Natuurlijk Ommen',sub:'evenementen & toerisme'},
{id:'Ommen City',name:'Ommen City',sub:'lokaal nieuws Ommen'},
{id:'OudOmmen',name:'OudOmmen',sub:'artikelen over historie'},
{id:'RondOmmen',name:'RondOmmen',sub:'lokaal nieuws'},
{id:'RTV Oost',name:'RTV Oost',sub:'regionaal Overijssel'},
{id:'RTV Vechtdal',name:'RTV Vechtdal',sub:'lokaal Vechtdal'},
{id:'Vechtdal Centraal',name:'Vechtdal Centraal',sub:'112 & dorpsnieuws'},
];
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
function parseVechtdalCentraalECHT(html){const items=[];const seen=new Set();let re=/<h3 class="entry-title[^>]*>\s*<a href="([^"]+)"[^>]*>([^<]+)<\/a>/gi;let m;while((m=re.exec(html))!==null&&items.length<25){let link=m[1];if(link.startsWith('/'))link='https://www.vechtdalcentraal.nl'+link;if(seen.has(link))continue;seen.add(link);const title=m[2].replace(/&#8217;/g,"'").replace(/&amp;/g,"&").trim();if(title.length>4)items.push({title,link,pubDate:new Date(),description:title+' [...]'});}return items;}
function parseRTVVechtdalECHT(html){const items=[];let re=/<div class="allmode_date">([^<]+)<\/div>[\s\S]{0,600}?<h3 class="allmode_title"><a href="([^"]+)">([^<]+)<\/a>/gi;let m;while((m=re.exec(html))!==null&&items.length<20){let link=m[2].replace(/&amp;/g,'&');if(!link.startsWith('http'))link='https://www.rtvvechtdal.nl'+link;items.push({title:m[3].trim(),link,pubDate:new Date(),description:m[3].trim()+' [...]'});}return items;}
function parseRTVOostECHT(html){const items=[];let m;const re=/publishedAt="([^"]+)"[\s\S]{0,900}?href="(\/nieuws\/[^"]+)"[\s\S]{0,900}?<h3[^>]*>([^<]+)<\/h3>/gi;while((m=re.exec(html))!==null&&items.length<20){const pd=new Date(m[1]);const link='https://www.rtvoost.nl'+m[2];const title=m[3].trim();if(!items.find(x=>x.link===link))items.push({title,link,pubDate:pd,description:title+' [...]'});}if(items.length===0){const re2=/<a href="(\/nieuws\/[^"]+)"[^>]*>[\s\S]*?<h3[^>]*>([^<]+)<\/h3>/gi;while((m=re2.exec(html))!==null&&items.length<20){const link='https://www.rtvoost.nl'+m[1];const title=m[2].trim();if(!items.find(x=>x.link===link))items.push({title,link,pubDate:new Date(),description:title+' [...]'});}}return items;}
const GEMEENTE_PLAATSEN=['Ommen','Lemele','Vilsteren','Beerze','Witharen','Archem','Arriën','Besthmen','Dalmsholte','Eerde','Giethmen','Junne','Varsen','Vinkenbuurt','Zeesse','Stegeren','Ommerschans','Ommerkanaal'];
const GEMEENTE_ZOEK=GEMEENTE_PLAATSEN.map(p=>p.toLowerCase());
function isGemeenteArtikel(a){const t=(a.title+' '+(a.description||'')).toLowerCase();return GEMEENTE_ZOEK.some(p=>t.includes(p));}
let state={};let allArticles=[];let loadedSources=new Set();
function loadState(){try{const v2=localStorage.getItem('nieuwsommen_bronnen_v2');if(v2){state=JSON.parse(v2);BRONNEN.forEach(b=>{if(!state[b.id])state[b.id]={aan:true,vandaag:false,scope:'regio'};});}else{BRONNEN.forEach(b=>state[b.id]={aan:true,vandaag:false,scope:'regio'});}}catch{BRONNEN.forEach(b=>state[b.id]={aan:true,vandaag:false,scope:'regio'});}}
function saveState(){localStorage.setItem('nieuwsommen_bronnen_v2',JSON.stringify(state));updateHeaderCount();}
function renderFilters(){const l=document.getElementById('source-list');if(!l)return;l.innerHTML='';BRONNEN.forEach(b=>{const s=state[b.id]||{aan:true,vandaag:false,scope:'regio'};const row=document.createElement('div');row.className='source-row';const sg=s.scope==='gemeente';row.innerHTML=`<div class="source-meta"><div class="source-name">${b.name}</div><div class="source-sub">${b.sub}</div></div><div class="toggles"><div class="toggle-col"><label class="mini-switch vandaag ${s.vandaag?'checked':''}"><input type="checkbox" ${s.vandaag?'checked':''} data-type="vandaag" data-id="${b.id}"><span class="mini-slider"></span></label><span class="mini-label">${s.vandaag?'VANDAAG':'MEER'}</span></div><div class="toggle-col"><label class="mini-switch ${sg?'checked':''}" style="background:${sg?'#0b5bd3':'#7c3aed'}"><input type="checkbox" ${sg?'checked':''} data-type="scope" data-id="${b.id}"><span class="mini-slider"></span></label><span class="mini-label">${sg?'GEMEENTE':'REGIO'}</span></div><div class="toggle-col"><label class="mini-switch aan ${s.aan?'checked':''}"><input type="checkbox" ${s.aan?'checked':''} data-type="aan" data-id="${b.id}"><span class="mini-slider"></span></label><span class="mini-label">${s.aan?'AAN':'UIT'}</span></div></div>`;l.appendChild(row);});l.querySelectorAll('input').forEach(i=>{i.addEventListener('change',e=>{const id=e.target.dataset.id;const t=e.target.dataset.type;if(!state[id])state[id]={aan:true,vandaag:false,scope:'regio'};if(t==='vandaag')state[id].vandaag=e.target.checked;if(t==='scope')state[id].scope=e.target.checked?'gemeente':'regio';if(t==='aan')state[id].aan=e.target.checked;saveState();renderFilters();renderArticles();});});}
function updateHeaderCount(){const aan=Object.values(state).filter(s=>s.aan).length;const el=document.getElementById('header-count');if(el)el.textContent=`${loadedSources.size||aan} v/d ${BRONNEN.length} bronnen`;}
function closePanel(){document.getElementById('filter-header')?.classList.remove('open');document.getElementById('source-panel')?.classList.remove('open');document.body.classList.remove('panel-open');}
function setupFilterHeader(){const fh=document.getElementById('filter-header');if(!fh)return;fh.addEventListener('click',e=>{if(e.target.closest('#bell-slot'))return;if(e.target.id==='btn-all'||e.target.closest('#btn-all')){e.stopPropagation();const allOn=Object.values(state).every(s=>s.aan);BRONNEN.forEach(b=>state[b.id].aan=!allOn);saveState();renderFilters();renderArticles();return;}const p=document.getElementById('source-panel');if(p.classList.contains('open'))closePanel();else{document.getElementById('filter-header')?.classList.add('open');document.getElementById('source-panel')?.classList.add('open');document.body.classList.add('panel-open');}});}
const WORKER='https://ommen-push-v2.leeuw008.workers.dev';
async function fetchViaWorker(url){
  const isOost=url.includes('rtvoost.nl')||url.includes('oost.nl')||url.includes('/nieuws/ommen');
  const isVC=url.includes('vechtdalcentraal.nl');
  if(isOost||isVC){
    try{
      const rssUrl=isVC?'https://www.vechtdalcentraal.nl/feed/':'https://www.rtvoost.nl/nieuws/ommen';
      const rss2jsonUrl=`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}&t=${Date.now()}`;
      const r=await fetch(rss2jsonUrl,{cache:'no-store'});
      if(r.ok){
        const j=await r.json();
        if(j.status==='ok'&&j.items&&j.items.length>0){
          let xml='<rss><channel>';
          j.items.slice(0,20).forEach(it=>{
            xml+=`<item><title><![CDATA[${it.title}]]></title><link>${it.link}</link><pubDate>${it.pubDate}</pubDate><description><![CDATA[${it.description}]]></description></item>`;
          });
          xml+='</channel></rss>';
          console.log('rss2json OK voor '+(isOost?'RTV Oost':'VC'),j.items.length);
          return xml;
        }
      }
    }catch(e){console.log('rss2json fail',e.message);}
  }
  const controller=new AbortController();const to=setTimeout(()=>controller.abort(),8000);
  try{
    const r=await fetch(`${WORKER}/proxy?url=${encodeURIComponent(url)}&t=${Date.now()}`,{cache:'no-store',signal:controller.signal});
    clearTimeout(to);
    if(!r.ok) throw new Error('proxy fail '+r.status);
    const t=await r.text();
    if(t.length>300) return t;
    throw new Error('proxy empty');
  }catch(e1){
    clearTimeout(to);
    try{
      const r2=await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}&t=${Date.now()}`,{cache:'no-store'});
      if(r2.ok){const j=await r2.json();if(j.contents&&j.contents.length>300) return j.contents;}
    }catch{}
    throw e1;
  }
}
function parseRSSFull(xml,bronId){const max=MAX_PER_BRON[bronId]||10;let items=[...xml.matchAll(/<item[^>]*>([\s\S]*?)<\/item>/gi)];if(items.length===0)items=[...xml.matchAll(/<entry[^>]*>([\s\S]*?)<\/entry>/gi)];items=items.slice(0,max);return items.map(m=>{const it=m[0];let title=(it.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i)||[])[1]||'';title=title.replace(/<[^>]*>/g,'').trim();let link=(it.match(/<link[^>]*>([\s\S]*?)<\/link>/i)||[])[1]||'';if(!link||link.includes('<')){const hm=it.match(/<link[^>]+href=["']([^"']+)["']/i);if(hm)link=hm[1];}link=link.replace(/<!\[CDATA\[/g,'').replace(/\]\]>/g,'').trim();if(!link.startsWith('http')){const mm=it.match(/https?:\/\/[^\s<"\]]+/);if(mm)link=mm[0];}let pub=(it.match(/<(pubDate|published|updated)[^>]*>([\s\S]*?)<\/(pubDate|published|updated)>/i)||[])[2]||'';let desc=(it.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i)||[])[1]||'';let useDesc=desc.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,150)+' [...]';return {title,link,pubDate:pub?new Date(pub):new Date(),description:useDesc};}).filter(x=>x.link&&x.title);}
function parseGemeenteOverview(html){let clean=html.replace(/<!--[\s\S]*?-->/g,' ');const res=[];const seen=new Set();const re=/<h[23][^>]*>\s*<a[^>]+href=["']([^"']*\/actueel\/[^"'?#]+)["'][^>]*>([\s\S]*?)<\/a>\s*<\/h[23]>/gi;let m;while((m=re.exec(clean))!==null&&res.length<10){let href=m[1],title=m[2].replace(/<[^>]*>/g,'').trim();if(title.length<8)continue;const full=href.startsWith('http')?href:'https://www.ommen.nl'+href;if(seen.has(full))continue;seen.add(full);res.push({title:title.slice(0,130),link:full,pubDate:new Date(),description:title.slice(0,100)+' [...]'});}return res;}
function parseRTVOost(html){let m;const items=[];const re=/publishedAt="([^"]+)"[\s\S]{0,900}?href="(\/nieuws\/[^"]+)"[\s\S]{0,900}?<h3[^>]*>([^<]+)<\/h3>/gi;while((m=re.exec(html))!==null&&items.length<15){const pd=new Date(m[1]);const link='https://www.rtvoost.nl'+m[2];const title=m[3].trim();if(!items.find(x=>x.link===link))items.push({title,link,pubDate:pd,description:title+' [...]'});}return items;}
async function loadOneSource(b){const cfg=BRON_URLS[b.id];try{let arts=[];if(cfg.type==='gemeente'){const html=await fetchViaWorker(cfg.url);arts=parseGemeenteOverview(html);}else if(cfg.type==='oost'){const html=await fetchViaWorker(cfg.url);arts=parseRTVOost(html);if(arts.length===0)arts=parseRSSFull(html,b.id);}else{const xml=await fetchViaWorker(cfg.url);arts=parseRSSFull(xml,b.id);}if(arts.length===0)throw new Error('empty');return arts.map(a=>({...a,source:b.name,id:b.id,isFallback:false}));}catch(e){console.log('load fail',b.id,e.message);return [{title:b.name,link:cfg.homepage,pubDate:new Date(0),description:'Bron tijdelijk offline [...]',source:b.name,id:b.id,isFallback:true}];}}
function isSameDay(d1,d2){if(!d1||!d2||isNaN(d1.getTime())||isNaN(d2.getTime()))return false;return d1.getFullYear()===d2.getFullYear()&&d1.getMonth()===d2.getMonth()&&d1.getDate()===d2.getDate();}
function formatDate(d){if(!d||isNaN(d.getTime())||d.getTime()===0)return'';const ds=d.toLocaleDateString('nl-NL',{day:'numeric',month:'short'});if(d.getHours()===0&&d.getMinutes()===0)return ds;return `${ds} ${d.toLocaleTimeString('nl-NL',{hour:'2-digit',minute:'2-digit'})}`;}
function renderArticles(){
  const c=document.getElementById('news-container');if(!c)return;
  const search=(document.getElementById('search-input')?.value||'').toLowerCase();const today=new Date();
  let filtered=allArticles.filter(a=>{const s=state[a.id];if(!s||!s.aan)return false;if(s.vandaag){if(a.isFallback)return false;if(!a.pubDate||isNaN(a.pubDate.getTime()))return false;if(!isSameDay(a.pubDate,today))return false;}if(s.scope==='gemeente'){if(!a.isFallback&&!isGemeenteArtikel(a))return false;}return true;});
  if(search)filtered=filtered.filter(a=>(a.title+' '+a.description+' '+a.source).toLowerCase().includes(search));
  filtered=filtered.sort((a,b)=>b.pubDate-a.pubDate);
  const params=new URLSearchParams(location.search);const hid=params.get('highlight');const hurl=params.get('url')?decodeURIComponent(params.get('url')):'';const hsrc=params.get('src')?decodeURIComponent(params.get('src')):'';
  if(hid||hurl){
    let found=null;if(hurl)found=allArticles.find(x=>x.link===hurl)||filtered.find(x=>x.link===hurl);
    if(!found&&hid)found=filtered.find(x=>x.link&&x.link.includes(hid));
    if(!found&&hsrc){const cc=filtered.filter(x=>x.source===hsrc);if(cc.length)found=cc[0];}
    if(found){const ct=found.title.replace(/^\[[^\]]+\]\s*/,'').trim()||found.title;const back=`<div style="margin:16px 0;text-align:center"><button class="btn-back-all" style="padding:14px 28px;background:#065f46;color:white;border:0;border-radius:999px;font-weight:800;cursor:pointer">← Toon alle artikelen</button></div>`;const one=`<div class="article" style="border:3px solid #065f46;box-shadow:0 0 0 4px rgba(6,95,70,0.15);border-radius:16px"><h2><a href="${found.link}" target="_blank">${ct}</a></h2><small>${found.source} - ${formatDate(found.pubDate)} - via push</small><div style="margin-top:8px">${found.description||''}</div><div style="margin-top:12px"><a href="${found.link}" target="_blank" style="padding:10px 18px;background:#0b5bd3;color:white;border-radius:8px;text-decoration:none;font-weight:600">Lees origineel →</a></div></div>`;c.innerHTML=back+one+back;document.querySelectorAll('.btn-back-all').forEach(b=>b.addEventListener('click',()=>{history.replaceState(null,'','/');renderArticles();}));return;}
  }
  const real=filtered.filter(a=>!a.isFallback).length;const countHtml=`<div class="articles-count">${real} artikelen - ${loadedSources.size} v/d ${BRONNEN.length} bronnen geladen</div>`;
  if(filtered.length===0){c.innerHTML=countHtml+'<div class="article" style="padding:20px;text-align:center;color:#666">Geen artikelen met huidige filter. Zet op REGIO.<br><button onclick="localStorage.clear();location.reload()" style="margin-top:10px;padding:8px 16px;background:#0b5bd3;color:white;border:0;border-radius:8px">Reset filters</button></div>';return;}
  c.innerHTML=countHtml+filtered.map(a=>{const ct=a.title.replace(/^\[[^\]]+\]\s*/,'').trim()||a.title;if(a.isFallback)return `<div class="article fallback"><h2><a href="${a.link}" target="_blank">${a.source}</a></h2><small>${a.source}</small><div style="margin-top:6px;color:#666">${a.description}</div></div>`;return `<div class="article"><h2><a href="${a.link}" target="_blank">${ct}</a></h2><small>${a.source} - ${formatDate(a.pubDate)}</small><div style="margin-top:6px;color:#555">${a.description||''}</div></div>`;}).join('');
}
function filterNews(){renderArticles();}
async function refreshNews(){
  const c=document.getElementById('news-container');if(c)c.innerHTML='<div class="article">Bezig met laden... 9 bronnen parallel</div>';
  allArticles=[];loadedSources=new Set();updateHeaderCount();
  const tasks=BRONNEN.map(async b=>{
    if(!state[b.id]||!state[b.id].aan)return;
    try{
      const arts=await Promise.race([loadOneSource(b),new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')),6000))]);
      allArticles=allArticles.filter(x=>x.id!==b.id).concat(arts);loadedSources.add(b.id);updateHeaderCount();renderArticles();
    }catch(e){const cfg=BRON_URLS[b.id];allArticles=allArticles.filter(x=>x.id!==b.id).concat([{title:b.name,link:cfg.homepage,pubDate:new Date(0),description:'Offline [...]',source:b.name,id:b.id,isFallback:true}]);loadedSources.add(b.id);updateHeaderCount();renderArticles();}
  });
  await Promise.all(tasks);updateHeaderCount();renderArticles();
}
document.addEventListener('DOMContentLoaded',()=>{loadState();renderFilters();setupFilterHeader();document.getElementById('search-input')?.addEventListener('input',()=>renderArticles());setTimeout(()=>refreshNews(),100);});
window.filterNews=filterNews;window.refreshNews=refreshNews;
(function(){
  let at=localStorage.getItem('ommen_auth_token')||null;
  window.loginOmmen=async function(e,p){const r=await fetch(WORKER+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:e,username:e,password:p})});const j=await r.json();if(!r.ok)throw new Error(j.error||'Login mislukt');localStorage.setItem('ommen_auth_token',j.token);location.reload();};
  window.registerOmmen=async function(e,p){const r=await fetch(WORKER+'/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:e,username:e,password:p})});const j=await r.json();if(!r.ok)throw new Error(j.error||'Registratie mislukt');localStorage.setItem('ommen_auth_token',j.token);location.reload();};
  window.logoutOmmen=function(){localStorage.removeItem('ommen_auth_token');location.reload();};
  function getSel(){try{const s=[];for(const b of BRONNEN){const st=state[b.id];if(st&&st.aan)s.push(b.id);}return s;}catch{return [];}}
  window.pushFiltersToSW=function(){const sources=getSel();try{if(navigator.serviceWorker&&navigator.serviceWorker.controller){navigator.serviceWorker.controller.postMessage({type:'SET_FILTERS',sources});}navigator.serviceWorker.ready.then(reg=>{if(reg.active)reg.active.postMessage({type:'SET_FILTERS',sources});}).catch(()=>{});}catch{}try{const req=indexedDB.open('nieuws-ommen',1);req.onupgradeneeded=(e)=>{const db=e.target.result;if(!db.objectStoreNames.contains('settings'))db.createObjectStore('settings');};req.onsuccess=(e)=>{const db=e.target.result;try{const tx=db.transaction('settings','readwrite');const store=tx.objectStore('settings');store.put(sources,'selectedSources');}catch{}};}catch{}};
  if('serviceWorker' in navigator){navigator.serviceWorker.addEventListener('message',e=>{if(e.data&&e.data.type==='GET_FILTERS'){const s=getSel();if(e.ports&&e.ports[0])e.ports[0].postMessage({sources:s});}if(e.data&&e.data.type==='NOTIFICATION_CLICK'){const id=e.data.id;const url=e.data.url;const src=e.data.source;const nu=`/?highlight=${encodeURIComponent(id)}&src=${encodeURIComponent(src)}&url=${encodeURIComponent(url)}`;history.replaceState(null,'',nu);renderArticles();}});}
  document.addEventListener('DOMContentLoaded',()=>{setTimeout(()=>{try{window.pushFiltersToSW();}catch{}},1000);});
})();
