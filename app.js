// app.js v260 FINAL - filter FIX: alleen RTV Oost als alleen Oost aan staat
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
'RTV Oost':'https://www.rtvoost.nl/nieuws/ommen'
};
let state={};let allArticles=[];let loaded=0;
function loadState(){
  try{
    const v=localStorage.getItem('nieuwsommen_bronnen_v2');
    if(v){
      const parsed=JSON.parse(v);
      BRONNEN.forEach(b=>{if(parsed[b.id])state[b.id]=parsed[b.id];else state[b.id]={aan:false,vandaag:false,scope:'regio'};});
    }else{
      BRONNEN.forEach(b=>state[b.id]={aan:(b.id==='RTV Oost'),vandaag:false,scope:'regio'}); // default alleen Oost als je test
    }
  }catch{BRONNEN.forEach(b=>state[b.id]={aan:true,vandaag:false,scope:'regio'});}
}
function saveState(){localStorage.setItem('nieuwsommen_bronnen_v2',JSON.stringify(state));}
function renderFilters(){
  const l=document.getElementById('source-list');if(!l)return;l.innerHTML='';
  BRONNEN.forEach(b=>{
    const s=state[b.id]||{aan:false};const row=document.createElement('div');row.className='source-row';
    row.innerHTML=`<div class="source-meta"><div class="source-name">${b.name}</div></div>
    <div class="toggles"><div class="toggle-col"><label class="mini-switch aan ${s.aan?'checked':''}"><input type="checkbox" ${s.aan?'checked':''} data-type="aan" data-id="${b.id}"><span class="mini-slider"></span></label><span class="mini-label">${s.aan?'AAN':'UIT'}</span></div></div>`;
    l.appendChild(row);
  });
  l.querySelectorAll('input').forEach(i=>{
    i.addEventListener('change',e=>{
      const id=e.target.dataset.id;if(!state[id])state[id]={aan:false};
      state[id].aan=e.target.checked;saveState();renderFilters();refreshNews();
    });
  });
}
function closePanel(){document.getElementById('filter-header')?.classList.remove('open');document.getElementById('source-panel')?.classList.remove('open');document.body.classList.remove('panel-open');}
function setupHeader(){
  const fh=document.getElementById('filter-header');if(!fh)return;
  fh.addEventListener('click',e=>{
    if(e.target.closest('#bell-slot'))return;
    if(e.target.id==='btn-all'||e.target.closest('#btn-all')){e.stopPropagation();const allOn=Object.values(state).every(s=>s.aan);BRONNEN.forEach(b=>state[b.id].aan=!allOn);saveState();renderFilters();refreshNews();return;}
    const p=document.getElementById('source-panel');
    if(p.classList.contains('open'))closePanel();else{document.getElementById('filter-header')?.classList.add('open');document.getElementById('source-panel')?.classList.add('open');document.body.classList.add('panel-open');}
  });
}
async function fetchWithTimeout(url,ms){
  const c=new AbortController();const to=setTimeout(()=>c.abort(),ms);
  try{const r=await fetch(url,{cache:'no-store',signal:c.signal});clearTimeout(to);const t=await r.text();return t;}catch(e){clearTimeout(to);throw e;}
}
async function fetchRSS(url){
  try{const txt=await fetchWithTimeout(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(url)}&t=${Date.now()}`,2500);const j=JSON.parse(txt);if(j.status==='ok'&&j.items&&j.items.length>0){return j.items.slice(0,12).map(it=>({title:it.title,link:it.link,pubDate:new Date(it.pubDate),description:(it.description||'').replace(/<[^>]*>/g,'').slice(0,120)+' [...]'}));}}catch{}
  return [];
}
async function fetchOost(url){
  try{
    const html=await fetchWithTimeout(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}&t=${Date.now()}`,3000);
    if(html.length>800&&!html.includes('Just a moment')){let m,items=[];const re=/href="(\/nieuws\/[^"]+)"[^>]*>[\s\S]{0,300}?<h3[^>]*>([^<]+)<\/h3>/gi;while((m=re.exec(html))!==null&&items.length<10){items.push({title:m[2].trim(),link:'https://www.rtvoost.nl'+m[1],pubDate:new Date(),description:m[2].trim()+' [...]'});}return items;}
  }catch{}
  return [];
}
async function loadBron(b){
  try{
    let arts=[];
    if(b.id==='RTV Oost') arts=await fetchOost(BRON_URLS[b.id]);
    else arts=await fetchRSS(BRON_URLS[b.id]);
    if(arts.length>0){allArticles=allArticles.filter(x=>x.id!==b.id).concat(arts.map(a=>({...a,source:b.name,id:b.id})));}
  }catch{}
  loaded++;
}
function renderArticles(){
  const c=document.getElementById('news-container');if(!c)return;
  // RESPECTEER FILTER: alleen tonen waar aan=true
  const activeIds=Object.keys(state).filter(id=>state[id]&&state[id].aan);
  let f=allArticles.filter(a=>activeIds.includes(a.id));
  f=f.sort((a,b)=>b.pubDate-a.pubDate);
  const header=document.getElementById('header-count');if(header)header.textContent=`${activeIds.length} v/d ${BRONNEN.length} bronnen`;
  c.innerHTML=`<div class="articles-count">${f.length} artikelen - ${loaded} v/d ${activeIds.length} bronnen geladen (filter: ${activeIds.join(', ')})</div>`+f.map(a=>`<div class="article"><h2><a href="${a.link}" target="_blank">${a.title}</a></h2><small>${a.source}</small><div>${a.description||''}</div></div>`).join('')+(f.length===0?`<div class="article">Geen artikelen voor filter ${activeIds.join(', ')}. Staat RTV Oost echt AAN? Dan is hij offline door Cloudflare.</div>`:'');
}
async function refreshNews(){
  const active=BRONNEN.filter(b=>state[b.id]&&state[b.id].aan);
  document.getElementById('news-container').innerHTML=`<div class="article">Laden... alleen ${active.map(b=>b.name).join(', ')} (${active.length} bronnen)</div>`;
  allArticles=[];loaded=0;
  // ALLEEN actieve bronnen fetchen, niet alle 9
  await Promise.allSettled(active.map(b=>loadBron(b)));
  renderArticles();
}
document.addEventListener('DOMContentLoaded',()=>{loadState();renderFilters();setupHeader();setTimeout(()=>refreshNews(),100);});
window.refreshNews=refreshNews;
