// app.js v264 FINAL - terug naar gisteren werkend
const BRONNEN=[
{id:'De Stentor',name:'De Stentor',sub:'regionaal'},{id:'Gemeente Ommen',name:'Gemeente Ommen',sub:'officieel'},{id:'Natuurlijk Ommen',name:'Natuurlijk Ommen',sub:'evenementen'},{id:'Ommen City',name:'Ommen City',sub:'lokaal'},{id:'OudOmmen',name:'OudOmmen',sub:'historie'},{id:'RondOmmen',name:'RondOmmen',sub:'lokaal'},{id:'RTV Oost',name:'RTV Oost',sub:'Overijssel'},{id:'RTV Vechtdal',name:'RTV Vechtdal',sub:'Vechtdal'},{id:'Vechtdal Centraal',name:'Vechtdal Centraal',sub:'112'},
];
const BRON_URLS={
'De Stentor':'https://www.destentor.nl/ommen/rss.xml',
'Natuurlijk Ommen':'https://www.natuurlijkommen.nl/feed/',
'Ommen City':'https://ommencity.nl/feed/',
'OudOmmen':'https://weblog.oudommen.nl/feed/',
'RondOmmen':'https://www.rondommen.nl/feed/',
'RTV Vechtdal':'https://rtvvechtdal.nl/feed/',
'Vechtdal Centraal':'https://www.vechtdalcentraal.nl/feed/',
'Gemeente Ommen':'https://www.ommen.nl/actueel/',
'RTV Oost':'https://www.rtvoost.nl/nieuws/vechtdal'
};
const WORKER='https://ommen-push-v2.leeuw008.workers.dev';
let state={};let allArticles=[];let loaded=0;
function loadState(){try{const v=localStorage.getItem('nieuwsommen_bronnen_v2');if(v){state=JSON.parse(v);BRONNEN.forEach(b=>{if(!state[b.id])state[b.id]={aan:true,vandaag:false,scope:'regio'};});}else{BRONNEN.forEach(b=>state[b.id]={aan:true,vandaag:false,scope:'regio'});}}catch{BRONNEN.forEach(b=>state[b.id]={aan:true,vandaag:false,scope:'regio'});}}
function saveState(){localStorage.setItem('nieuwsommen_bronnen_v2',JSON.stringify(state));}
function renderFilters(){
  const l=document.getElementById('source-list');if(!l)return;l.innerHTML='';
  BRONNEN.forEach(b=>{
    const s=state[b.id]||{aan:true,vandaag:false,scope:'regio'};
    const isGemeente=s.scope==='gemeente';
    const row=document.createElement('div');row.className='source-row';
    row.innerHTML=`<div class="source-meta"><div class="source-name">${b.name}</div><div class="source-sub">${b.sub||''}</div></div><div class="toggles"><div class="toggle-col"><label class="mini-switch vandaag ${s.vandaag?'checked':''}"><input type="checkbox" ${s.vandaag?'checked':''} data-type="vandaag" data-id="${b.id}"><span class="mini-slider"></span></label><span class="mini-label">${s.vandaag?'VANDAAG':'MEER'}</span></div><div class="toggle-col"><label class="mini-switch ${isGemeente?'checked':''}" style="background:${isGemeente?'#0b5bd3':'#7c3aed'}"><input type="checkbox" ${isGemeente?'checked':''} data-type="scope" data-id="${b.id}"><span class="mini-slider"></span></label><span class="mini-label">${isGemeente?'GEMEENTE':'REGIO'}</span></div><div class="toggle-col"><label class="mini-switch aan ${s.aan?'checked':''}"><input type="checkbox" ${s.aan?'checked':''} data-type="aan" data-id="${b.id}"><span class="mini-slider"></span></label><span class="mini-label">${s.aan?'AAN':'UIT'}</span></div></div>`;
    l.appendChild(row);
  });
  l.querySelectorAll('input').forEach(i=>{i.addEventListener('change',e=>{const id=e.target.dataset.id;const t=e.target.dataset.type;if(!state[id])state[id]={aan:true,vandaag:false,scope:'regio'};if(t==='vandaag')state[id].vandaag=e.target.checked;if(t==='scope')state[id].scope=e.target.checked?'gemeente':'regio';if(t==='aan')state[id].aan=e.target.checked;saveState();renderFilters();refreshNews();});});
}
function setupHeader(){const fh=document.getElementById('filter-header');if(!fh)return;fh.addEventListener('click',e=>{if(e.target.closest('#bell-slot'))return;if(e.target.id==='btn-all'||e.target.closest('#btn-all')){e.stopPropagation();const allOn=Object.values(state).every(s=>s.aan);BRONNEN.forEach(b=>state[b.id].aan=!allOn);saveState();renderFilters();refreshNews();return;}const p=document.getElementById('source-panel');if(p.classList.contains('open')){p.classList.remove('open');fh.classList.remove('open');document.body.classList.remove('panel-open');}else{fh.classList.add('open');p.classList.add('open');document.body.classList.add('panel-open');}});}
async function fetchWithTimeout(url,ms){const c=new AbortController();const to=setTimeout(()=>c.abort(),ms);try{const r=await fetch(url,{cache:'no-store',signal:c.signal});clearTimeout(to);return await r.text();}catch(e){clearTimeout(to);throw e;}}
async function fetchRSS(url){try{const txt=await fetchWithTimeout(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(url)}&t=${Date.now()}`,2500);const j=JSON.parse(txt);if(j.status==='ok'&&j.items&&j.items.length>0){return j.items.slice(0,12).map(it=>({title:it.title,link:it.link,pubDate:new Date(it.pubDate),description:(it.description||'').replace(/<[^>]*>/g,'').slice(0,120)}));}}catch{}return [];}
async function fetchOost(url){
  try{
    const html=await fetchWithTimeout(`${WORKER}/proxy?url=${encodeURIComponent(url)}&t=${Date.now()}`,6000);
    if(!html||html.length<1000)return [];
    let items=[];
    // Zoals gisteren: datum uit page source halen (publishedAt + datetime)
    let m;
    const re1=/"publishedAt"\s*:\s*"([^"]+)"[\s\S]{0,400}?"title"\s*:\s*"([^"]+)"[\s\S]{0,400}?"url"\s*:\s*"([^"]+)"/gi;
    const re2=/"url"\s*:\s*"([^"]+)"[\s\S]{0,400}?"title"\s*:\s*"([^"]+)"[\s\S]{0,400}?"publishedAt"\s*:\s*"([^"]+)"/gi;
    const re3=/<time[^>]+datetime="([^"]+)"[^>]*>[\s\S]*?href="([^"]+)"[^>]*>([^<]+)</gi;
    while((m=re1.exec(html))!==null&&items.length<10){
      let d=m[1],t=m[2],u=m[3];if(!u.startsWith('http'))u='https://www.rtvoost.nl'+u;
      items.push({title:t,link:u,pubDate:new Date(d),description:t,source:'RTV Oost',id:'RTV Oost'});
    }
    while((m=re2.exec(html))!==null&&items.length<10){
      if(items.find(x=>x.link.includes(m[1])))continue;
      let u=m[1],t=m[2],d=m[3];if(!u.startsWith('http'))u='https://www.rtvoost.nl'+u;
      items.push({title:t,link:u,pubDate:new Date(d),description:t,source:'RTV Oost',id:'RTV Oost'});
    }
    if(items.length===0){
      while((m=re3.exec(html))!==null&&items.length<10){
        let d=m[1],u=m[2],t=m[3].trim();if(!u.startsWith('http'))u='https://www.rtvoost.nl'+u;
        items.push({title:t,link:u,pubDate:new Date(d),description:t,source:'RTV Oost',id:'RTV Oost'});
      }
    }
    return items;
  }catch{return [];}
}
async function loadBron(b){try{let arts=[];if(b.id==='RTV Oost')arts=await fetchOost(BRON_URLS[b.id]);else arts=await fetchRSS(BRON_URLS[b.id]);if(arts.length>0){allArticles=allArticles.filter(x=>x.id!==b.id).concat(arts.map(a=>({...a,source:b.name,id:b.id})));}}catch{}loaded++;}
function renderArticles(){const c=document.getElementById('news-container');if(!c)return;const activeIds=Object.keys(state).filter(id=>state[id]&&state[id].aan);let f=allArticles.filter(a=>activeIds.includes(a.id));f=f.sort((a,b)=>b.pubDate-a.pubDate);const header=document.getElementById('header-count');if(header)header.textContent=`${activeIds.length} v/d ${BRONNEN.length} bronnen`;c.innerHTML=`<div class="articles-count">${f.length} artikelen - ${loaded} v/d ${activeIds.length} bronnen geladen (filter: ${activeIds.join(', ')})</div>`+f.map(a=>{const d=a.pubDate?`${a.pubDate.getDate()}-${a.pubDate.getMonth()+1} ${a.pubDate.getHours()}:${String(a.pubDate.getMinutes()).padStart(2,'0')}`:'';return `<div class="article"><h2><a href="${a.link}" target="_blank">${a.title}</a></h2><small>${a.source} - ${d}</small><div>${a.description||''}</div></div>`;}).join('')+(f.length===0?`<div class="article">Geen artikelen voor ${activeIds.join(', ')}.</div>`:'');}
async function refreshNews(){const active=BRONNEN.filter(b=>state[b.id]&&state[b.id].aan);document.getElementById('news-container').innerHTML=`<div class="article">Laden... ${active.map(b=>b.name).join(', ')}</div>`;allArticles=[];loaded=0;await Promise.allSettled(active.map(b=>loadBron(b)));renderArticles();}
document.addEventListener('DOMContentLoaded',()=>{loadState();renderFilters();setupHeader();setTimeout(()=>refreshNews(),100);});
window.refreshNews=refreshNews;
