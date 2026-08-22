// app.js v249 FINAL - SNEL + 9/9 BRONNEN + 0 ARTIKELEN FIX
// - RTV Oost + VC via rss2json (geen proxy timeout meer)
// - Timeout 5s, alles parallel
// - Geen gemeente detail enrichment (was traag)
// - Default scope REGIO (was gemeente -> 0 artikelen)
// - Gemeente filter bypass voor fallback
// - Focus mode?highlight
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
'Vechtdal Centraal':{url:'https://www.vechtdalcentraal.nl/feed/',homepage:'https://www.vechtdalcentraal.nl/',fallback:'https://www.vechtdalcentraal.nl/'},
};
function parseVechtdalCentraalECHT(html){const items=[];const seen=new Set();let re=/<h3 class="entry-title[^>]*>\s*<a href="([^"]+)"[^>]*>([^<]+)<\/a>/gi;let m;while((m=re.exec(html))!==null&&items.length<25){let link=m[1];if(link.startsWith('/'))link='https://www.vechtdalcentraal.nl'+link;if(seen.has(link))continue;seen.add(link);const title=m[2].replace(/&#8217;/g,"'").replace(/&amp;/g,"&").trim();if(title.length>4)items.push({title,link,pubDate:new Date(),description:title+' [...]'});}return items;}
function parseRTVVechtdalECHT(html){const items=[];const pm=new Date();const today=new Date();today.setHours(0,0,0,0);const re=/<div class="allmode_date">([^<]+)<\/div>[\s\S]{0,600}?<h3 class="allmode_title"><a href="([^"]+)">([^<]+)<\/a>/gi;let m;while((m=re.exec(html))!==null&&items.length<20){const dparts=m[1].split('-');let pd=new Date(pm);if(dparts.length===3){const d=new Date(parseInt(dparts[2]),parseInt(dparts[1])-1,parseInt(dparts[0]));const dm=new Date(d);dm.setHours(0,0,0,0);pd=dm.getTime()===today.getTime()?new Date(pm):new Date(d.getFullYear(),d.getMonth(),d.getDate());}let link=m[2].replace(/&amp;/g,'&');if(!link.startsWith('http'))link='https://www.rtvvechtdal.nl'+link;items.push({title:m[3].trim(),link,pubDate:pd,description:m[3].trim()+' [...]'});}return items;}
function parseRTVOostECHT(html){const items=[];let m;const re=/publishedAt="([^"]+)"[\s\S]{0,900}?href="(\/nieuws\/[^"]+)"[\s\S]{0,900}?<h3[^>]*>([^<]+)<\/h3>/gi;while((m=re.exec(html))!==null&&items.length<20){const pd=new Date(m[1]);const link='https://www.rtvoost.nl'+m[2];const title=m[3].trim();if(!items.find(x=>x.link===link))items.push({title,link,pubDate:pd,description:title+' [...]'});}if(items.length===0){const re2=/<a href="(\/nieuws\/[^"]+)"[^>]*>[\s\S]*?<h3[^>]*>([^<]+)<\/h3>/gi;while((m=re2.exec(html))!==null&&items.length<20){const link='https://www.rtvoost.nl'+m[1];const title=m[2].trim();if(!items.find(x=>x.link===link))items.push({title,link,pubDate:new Date(),description:title+' [...]'});}}return items;}
const GEMEENTE_PLAATSEN=['Ommen','Lemele','Vilsteren','Beerze','Beerzerveld','Witharen','Archem','Arriën','Besthmen','Dalmsholte','Eerde','Giethmen','Junne','Varsen','Vinkenbuurt','Zeesse','Stegeren','Ommerschans','Ommerkanaal'];
const GEMEENTE_ZOEK=GEMEENTE_PLAATSEN.map(p=>p.toLowerCase());
function isGemeenteArtikel(art){const txt=(art.title+' '+(art.description||'')).toLowerCase();return GEMEENTE_ZOEK.some(pl=>txt.includes(pl));}
let state={};let allArticles=[];let loadedSources=new Set();
function loadState(){try{const v2=localStorage.getItem('nieuwsommen_bronnen_v2');if(v2){state=JSON.parse(v2);BRONNEN.forEach(b=>{if(!state[b.id]) state[b.id]={aan:true,vandaag:false,scope:'regio'};});}else{BRONNEN.forEach(b=>state[b.id]={aan:true,vandaag:false,scope:'regio'});}}catch(e){BRONNEN.forEach(b=>state[b.id]={aan:true,vandaag:false,scope:'regio'});}}
function saveState(){localStorage.setItem('nieuwsommen_bronnen_v2',JSON.stringify(state));updateHiddenCompat();updateHeaderCount();if(window.updatePushBell)window.updatePushBell();try{if(window.pushFiltersToSW)window.pushFiltersToSW();}catch{}}
function updateHiddenCompat(){const cont=document.getElementById('compat-sources');if(!cont)return;cont.innerHTML='';BRONNEN.forEach(b=>{const s=state[b.id]||{aan:true,vandaag:false,scope:'regio'};let cb=document.createElement('input');cb.type='checkbox';cb.className='source-filter';cb.value=b.id;cb.checked=s.aan;cb.dataset.source=b.id;cont.appendChild(cb);});}
function renderFilters(){const list=document.getElementById('source-list');if(!list)return;list.innerHTML='';BRONNEN.forEach(b=>{const s=state[b.id]||{aan:true,vandaag:false,scope:'regio'};const row=document.createElement('div');row.className='source-row'+(s.aan?'':' off');const scopeIsGemeente=s.scope==='gemeente';row.innerHTML=`<div class="source-meta"><div class="source-name">${b.name}</div><div class="source-sub">${b.sub}</div></div><div class="toggles"><div class="toggle-col"><label class="mini-switch vandaag ${s.vandaag?'checked':''}"><input type="checkbox" ${s.vandaag?'checked':''} data-type="vandaag" data-id="${b.id}"><span class="mini-slider"></span></label><span class="mini-label">${s.vandaag?'VANDAAG':'MEER'}</span></div><div class="toggle-col"><label class="mini-switch ${scopeIsGemeente?'checked':''}" style="background:${scopeIsGemeente?'#0b5bd3':'#7c3aed'}"><input type="checkbox" ${scopeIsGemeente?'checked':''} data-type="scope" data-id="${b.id}"><span class="mini-slider"></span></label><span class="mini-label">${scopeIsGemeente?'GEMEENTE':'REGIO'}</span></div><div class="toggle-col"><label class="mini-switch aan ${s.aan?'checked':''}"><input type="checkbox" ${s.aan?'checked':''} data-type="aan" data-id="${b.id}"><span class="mini-slider"></span></label><span class="mini-label">${s.aan?'AAN':'UIT'}</span></div></div>`;list.appendChild(row);});list.querySelectorAll('input').forEach(inp=>{inp.addEventListener('change',(e)=>{const id=e.target.dataset.id;const type=e.target.dataset.type;if(!state[id])state[id]={aan:true,vandaag:false,scope:'regio'};if(type==='vandaag')state[id].vandaag=e.target.checked;if(type==='scope')state[id].scope=e.target.checked?'gemeente':'regio';if(type==='aan')state[id].aan=e.target.checked;saveState();renderFilters();filterNews();});});}
function updateHeaderCount(){const aan=Object.values(state).filter(s=>s.aan).length;const countEl=document.getElementById('header-count');if(countEl){countEl.textContent=`${loadedSources.size||aan} v/d ${BRONNEN.length} bronnen`;if(loadedSources.size>=BRONNEN.length)countEl.textContent=`9 v/d 9 bronnen`;}}
function openPanel(){document.getElementById('filter-header')?.classList.add('open');document.getElementById('source-panel')?.classList.add('open');document.body.classList.add('panel-open');}
function closePanel(){document.getElementById('filter-header')?.classList.remove('open');document.getElementById('source-panel')?.classList.remove('open');document.body.classList.remove('panel-open');}
function setupFilterHeader(){const fh=document.getElementById('filter-header');if(!fh)return;fh.addEventListener('click',(e)=>{if(e.target.closest('#bell-slot')||e.target.closest('#push-bell-btn'))return;if(e.target.id==='btn-all'||e.target.closest('#btn-all')){e.stopPropagation();const allOn=Object.values(state).every(s=>s.aan);BRONNEN.forEach(b=>state[b.id].aan=!allOn);saveState();renderFilters();filterNews();return;}const p=document.getElementById('source-panel');if(p.classList.contains('open'))closePanel();else openPanel();});}
const WORKER='https://ommen-push-v2.leeuw008.workers.dev';
async function fetchViaWorker(url){
  const isVC=url.includes('vechtdalcentraal.nl'); const isOost=url.includes('rtvoost.nl')||url.includes('oost.nl')||url.includes('/nieuws/ommen');
  if(isVC||isOost){
    try{
      const rssUrl=isVC?'https://www.vechtdalcentraal.nl/feed/':'https://www.rtvoost.nl/nieuws/ommen';
      const rss2jsonUrl=`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}&t=${Date.now()}`;
      const r=await fetch(rss2jsonUrl,{cache:'no-store'});
      if(r.ok){const j=await r.json(); if(j.status==='ok'&&j.items&&j.items.length>0){let xml='<rss><channel>'; j.items.slice(0,20).forEach(it=>{xml+=`<item><title><![CDATA[${it.title}]]></title><link>${it.link}</link><pubDate>${it.pubDate}</pubDate><description><![CDATA[${it.description}]]></description></item>`;}); xml+='</channel></rss>'; return xml;}}
    }catch(e){}
  }
  try{
    const ctrl=new AbortController(); const to=setTimeout(()=>ctrl.abort(),5000);
    const r=await fetch(`${WORKER}/proxy?url=${encodeURIComponent(url)}&t=${Date.now()}`,{cache:'no-store',signal:ctrl.signal});
    clearTimeout(to); if(r.ok){const t=await r.text(); if(t.length>300) return t;}
  }catch(e){}
  try{const r2=await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}&t=${Date.now()}`,{cache:'no-store'}); if(r2.ok){const j=await r2.json(); if(j.contents&&j.contents.length>300) return j.contents;}}catch{}
  throw new Error('fetch fail '+url.slice(0,50));
}
function parseRSSFull(xml,bronId){const max=MAX_PER_BRON[bronId]||10; let items=[...xml.matchAll(/<item[^>]*>([\s\S]*?)<\/item>/gi)]; if(items.length===0) items=[...xml.matchAll(/<entry[^>]*>([\s\S]*?)<\/entry>/gi)]; items=items.slice(0,max); return items.map(m=>{const it=m[0]; let title=(it.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i)||[])[1]||''; title=title.replace(/<[^>]*>/g,'').trim(); let link=(it.match(/<link[^>]*>([\s\S]*?)<\/link>/i)||[])[1]||''; if(!link||link.includes('<')){const hm=it.match(/<link[^>]+href=["']([^"']+)["']/i); if(hm) link=hm[1];} link=link.replace(/<!\[CDATA\[/g,'').replace(/\]\]>/g,'').trim(); if(!link.startsWith('http')){const mm=it.match(/https?:\/\/[^\s<"\]]+/); if(mm) link=mm[0];} let pub=(it.match(/<(pubDate|published|updated)[^>]*>([\s\S]*?)<\/(pubDate|published|updated)>/i)||[])[2]||''; let desc=(it.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i)||[])[1]||''; let useDesc=desc.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim(); if(useDesc.length>150) useDesc=useDesc.slice(0,147)+' [...]'; else if(useDesc) useDesc+=' [...]'; return {title,link,pubDate:pub?new Date(pub):new Date(),description:useDesc};}).filter(x=>x.link&&x.title);}
function parseGemeenteOverview(html){const max=MAX_PER_BRON['Gemeente Ommen']; let clean=html.replace(/<!--[\s\S]*?-->/g,' '); const results=[]; const seen=new Set(); const re=/<h[23][^>]*>\s*<a[^>]+href=["']([^"']*\/actueel\/[^"'?#]+)["'][^>]*>([\s\S]*?)<\/a>\s*<\/h[23]>/gi; let m; while((m=re.exec(clean))!==null&&results.length<max){let href=m[1],title=m[2].replace(/<[^>]*>/g,'').trim(); if(title.length<8) continue; const full=href.startsWith('http')?href:'https://www.ommen.nl'+href; if(seen.has(full)) continue; seen.add(full); results.push({title:title.slice(0,130),link:full,pubDate:new Date(),description:title.slice(0,100)+' [...]'});} return results;}
async function loadOneSource(b){const cfg=BRON_URLS[b.id]; try{let arts=[]; if(cfg.type==='gemeente'){const html=await fetchViaWorker(cfg.url); arts=parseGemeenteOverview(html);} else if(cfg.type==='oost'){const html=await fetchViaWorker(cfg.url); arts=parseRTVOostECHT(html); if(arts.length===0) arts=parseRSSFull(html,b.id);} else{const xml=await fetchViaWorker(cfg.url); if(xml.includes('<rss')||xml.includes('<feed')||xml.includes('<item')) arts=parseRSSFull(xml,b.id); else{if(b.id==='RTV Vechtdal') arts=parseRTVVechtdalECHT(xml); else if(b.id==='Vechtdal Centraal') arts=parseVechtdalCentraalECHT(xml); else arts=parseRSSFull(xml,b.id);}} if(arts.length===0) throw new Error('empty'); return arts.map(a=>({...a,source:b.name,id:b.id,isFallback:false}));}catch(e){return [{title:b.name,link:cfg.homepage,pubDate:new Date(0),description:'Bron tijdelijk offline [...]',source:b.name,id:b.id,isFallback:true}];}}
function isSameDay(d1,d2){if(!d1||!d2||isNaN(d1.getTime())||isNaN(d2.getTime())) return false; return d1.getFullYear()===d2.getFullYear()&&d1.getMonth()===d2.getMonth()&&d1.getDate()===d2.getDate();}
function formatDate(d){if(!d||isNaN(d.getTime())||d.getTime()===0) return ''; const ds=d.toLocaleDateString('nl-NL',{day:'numeric',month:'short'}); if(d.getHours()===0&&d.getMinutes()===0) return ds; return `${ds} ${d.toLocaleTimeString('nl-NL',{hour:'2-digit',minute:'2-digit'})}`;}
function renderArticles(){
  const container=document.getElementById('news-container'); if(!container) return;
  const search=(document.getElementById('search-input')?.value||'').toLowerCase(); const today=new Date();
  let filtered=allArticles.filter(a=>{const s=state[a.id]; if(!s||!s.aan) return false; if(s.vandaag){if(a.isFallback) return false; if(!a.pubDate||isNaN(a.pubDate.getTime())) return false; if(!isSameDay(a.pubDate,today)) return false;} if(s.scope==='gemeente'){if(!a.isFallback&&!isGemeenteArtikel(a)) return false;} return true;});
  if(search) filtered=filtered.filter(a=>(a.title+' '+a.description+' '+a.source).toLowerCase().includes(search));
  filtered=filtered.sort((a,b)=>b.pubDate-a.pubDate);
  const params=new URLSearchParams(location.search); const hid=params.get('highlight'); const hurl=params.get('url')?decodeURIComponent(params.get('url')):''; const hsrc=params.get('src')?decodeURIComponent(params.get('src')):'';
  if(hid||hurl){
    let found=null; if(hurl) found=allArticles.find(x=>x.link===hurl)||filtered.find(x=>x.link===hurl);
    if(!found&&hid) found=filtered.find(x=>x.link&&hid&&x.link.includes(hid))||allArticles.find(x=>x.link===hurl);
    if(!found&&hsrc){const c=filtered.filter(x=>x.source===hsrc); if(c.length) found=c[0];}
    if(found){const clean=found.title.replace(/^\[[^\]]+\]\s*/,'').trim()||found.title; const back=`<div style="margin:16px 0;text-align:center"><button class="btn-back-all" style="padding:14px 28px;background:#065f46;color:white;border:0;border-radius:999px;font-weight:800;font-size:15px;cursor:pointer">← Toon alle artikelen</button></div>`; const htmlOne=`<div class="article" style="border:3px solid #065f46;box-shadow:0 0 0 4px rgba(6,95,70,0.15);border-radius:16px"><h2><a href="${found.link}" target="_blank">${clean}</a></h2><small>${found.source} - ${formatDate(found.pubDate)} - via push</small><div style="margin-top:8px">${found.description||''}</div><div style="margin-top:12px"><a href="${found.link}" target="_blank" style="padding:10px 18px;background:#0b5bd3;color:white;border-radius:8px;text-decoration:none;font-weight:600">Lees origineel →</a></div></div>`; container.innerHTML=back+htmlOne+back; document.querySelectorAll('.btn-back-all').forEach(b=>b.addEventListener('click',()=>{history.replaceState(null,'','/');renderArticles();})); return;}
  }
  const realCount=filtered.filter(a=>!a.isFallback).length; const vandaagActive=Object.values(state).some(s=>s.aan&&s.vandaag); const gemeenteActive=Object.values(state).some(s=>s.aan&&s.scope==='gemeente'); let fl=''; if(vandaagActive) fl+=' (alleen vandaag)'; if(gemeenteActive) fl+=vandaagActive?' + gemeente':' (alleen gemeente Ommen)';
  const countHtml=`<div class="articles-count">${realCount} artikelen${fl} - ${loadedSources.size} v/d ${BRONNEN.length} bronnen geladen</div>`;
  if(filtered.length===0){container.innerHTML=countHtml+'<div class="article" style="padding:20px;text-align:center;color:#666">Geen artikelen gevonden met dit filter.<br>Zet filter op REGIO of klik Alles aan/uit.</div>'; return;}
  container.innerHTML=countHtml+filtered.map(a=>{const ct=a.title.replace(/^\[[^\]]+\]\s*/,'').trim()||a.title; if(a.isFallback) return `<div class="article fallback"><h2><a href="${a.link}" target="_blank">${a.source}</a></h2><small>${a.source}</small><div style="margin-top:6px;color:#666">${a.description}</div></div>`; return `<div class="article" data-source="${a.id}"><h2><a href="${a.link}" target="_blank">${ct}</a></h2><small>${a.source} - ${formatDate(a.pubDate)}</small>${a.description?`<div style="margin-top:6px;color:#555">${a.description}</div>`:''}</div>`;}).join('');
}
function filterNews(){renderArticles();}
async function refreshNews(){
  const c=document.getElementById('news-container'); if(c) c.innerHTML='<div class="article">Bezig met laden... 9 bronnen parallel</div>';
  allArticles=[]; loadedSources=new Set(); updateHeaderCount();
  const tasks=BRONNEN.map(async b=>{
    if(!state[b.id]||!state[b.id].aan) return;
    try{
      const arts=await Promise.race([loadOneSource(b),new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')),6000))]);
      allArticles=allArticles.filter(x=>x.id!==b.id).concat(arts); loadedSources.add(b.id); updateHeaderCount(); renderArticles();
    }catch(e){const cfg=BRON_URLS[b.id]; allArticles=allArticles.filter(x=>x.id!==b.id).concat([{title:b.name,link:cfg.homepage,pubDate:new Date(0),description:'Offline [...]',source:b.name,id:b.id,isFallback:true}]); loadedSources.add(b.id); updateHeaderCount(); renderArticles();}
  });
  await Promise.all(tasks); updateHeaderCount(); renderArticles();
}
document.addEventListener('DOMContentLoaded',()=>{loadState(); renderFilters(); saveState(); closePanel(); setupFilterHeader(); document.getElementById('search-input')?.addEventListener('input',filterNews); setTimeout(()=>refreshNews(),100);});
window.closePanel=closePanel; window.BRONNEN=BRONNEN; window.filterNews=filterNews; window.refreshNews=refreshNews;
// AUTH + PUSH BRIDGE (zelfde als v227)
(function(){
  let currentUser=null; let authToken=localStorage.getItem('ommen_auth_token')||null;
  function getAuthHeaders(){return authToken?{'Authorization':'Bearer '+authToken,'Content-Type':'application/json'}:{'Content-Type':'application/json'};}
  window.loginOmmen=async function(email,password){const r=await fetch(WORKER+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,username:email,password})}); const j=await r.json(); if(!r.ok) throw new Error(j.error||'Login mislukt'); authToken=j.token; localStorage.setItem('ommen_auth_token',authToken); currentUser={id:j.id||j.user?.id,email:j.email||j.username||email,username:j.username||email}; location.reload();};
  window.registerOmmen=async function(email,password){const r=await fetch(WORKER+'/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,username:email,password})}); const j=await r.json(); if(!r.ok) throw new Error(j.error||'Registratie mislukt'); authToken=j.token; localStorage.setItem('ommen_auth_token',authToken); currentUser={id:j.id,email:j.email||email,username:j.username||email}; location.reload();};
  window.logoutOmmen=function(){localStorage.removeItem('ommen_auth_token'); location.reload();};
  function getSelected(){try{const sel=[]; for(const b of BRONNEN){const s=state[b.id]; if(s&&s.aan) sel.push(b.id);} return sel;}catch{return [];}}
  window.pushFiltersToSW=function(){const sources=getSelected(); try{if(navigator.serviceWorker&&navigator.serviceWorker.controller){navigator.serviceWorker.controller.postMessage({type:'SET_FILTERS',sources});} navigator.serviceWorker.ready.then(reg=>{if(reg.active) reg.active.postMessage({type:'SET_FILTERS',sources});}).catch(()=>{});}catch{} try{const req=indexedDB.open('nieuws-ommen',1); req.onupgradeneeded=(e)=>{const db=e.target.result; if(!db.objectStoreNames.contains('settings')) db.createObjectStore('settings');}; req.onsuccess=(e)=>{const db=e.target.result; try{const tx=db.transaction('settings','readwrite'); const store=tx.objectStore('settings'); store.put(sources,'selectedSources');}catch{}};}catch{}};
  if('serviceWorker' in navigator){navigator.serviceWorker.addEventListener('message',event=>{if(event.data&&event.data.type==='GET_FILTERS'){const sources=getSelected(); if(event.ports&&event.ports[0]) event.ports[0].postMessage({sources});} if(event.data&&event.data.type==='NOTIFICATION_CLICK'){const id=event.data.id; const url=event.data.url; const src=event.data.source; const newUrl=`/?highlight=${encodeURIComponent(id)}&src=${encodeURIComponent(src)}&url=${encodeURIComponent(url)}`; history.replaceState(null,'',newUrl); renderArticles();}});}
  document.addEventListener('DOMContentLoaded',()=>{setTimeout(()=>{try{window.pushFiltersToSW();}catch{}},1000);});
})();
