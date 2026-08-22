// app.js v256 FINAL - FIX traag + 0 artikelen + 1/9 bronnen
// - Volgorde omgedraaid: eerst snelle CORS proxies, worker pas als laatste
// - RTV Oost: oude scraper v238 die weken werkte, via allorigins RAW (bypass CF)
// - Timeout per bron 4 sec, parallel, geen wachten op trage worker
const BRONNEN=[
{id:'De Stentor',name:'De Stentor',sub:'regionaal'},{id:'Gemeente Ommen',name:'Gemeente Ommen',sub:'officieel'},{id:'Natuurlijk Ommen',name:'Natuurlijk Ommen',sub:'evenementen'},{id:'Ommen City',name:'Ommen City',sub:'lokaal'},{id:'OudOmmen',name:'OudOmmen',sub:'historie'},{id:'RondOmmen',name:'RondOmmen',sub:'lokaal'},{id:'RTV Oost',name:'RTV Oost',sub:'Overijssel'},{id:'RTV Vechtdal',name:'RTV Vechtdal',sub:'Vechtdal'},{id:'Vechtdal Centraal',name:'Vechtdal Centraal',sub:'112'},
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
function parseOost(html){
  let m,items=[];
  const re=/publishedAt="([^"]+)"[\s\S]{0,900}?href="(\/nieuws\/[^"]+)"[\s\S]{0,900}?<h3[^>]*>([^<]+)<\/h3>/gi;
  while((m=re.exec(html))!==null&&items.length<10){const pd=new Date(m[1]);const link='https://www.rtvoost.nl'+m[2];items.push({title:m[3].trim(),link,pubDate:pd,description:m[3].trim()+' [...]'});}
  if(items.length===0){
    const re2=/<a href="(\/nieuws\/[^"]+)"[^>]*>[\s\S]*?<h3[^>]*>([^<]+)<\/h3>/gi;
    while((m=re2.exec(html))!==null&&items.length<10){items.push({title:m[2].trim(),link:'https://www.rtvoost.nl'+m[1],pubDate:new Date(),description:m[2].trim()+' [...]'});}
  }
  return items;
}
function parseVC(html){let re=/<h3 class="entry-title[^>]*>\s*<a href="([^"]+)"[^>]*>([^<]+)<\/a>/gi,m,items=[];while((m=re.exec(html))!==null&&items.length<15){let l=m[1];if(l.startsWith('/'))l='https://www.vechtdalcentraal.nl'+l;items.push({title:m[2].trim(),link:l,pubDate:new Date(),description:m[2].trim()+' [...]'});}return items;}
function parseGemeente(html){let re=/<h[23][^>]*>\s*<a[^>]+href=["']([^"']*\/actueel\/[^"'?#]+)["'][^>]*>([\s\S]*?)<\/a>\s*<\/h[23]>/gi,m,items=[];while((m=re.exec(html))!==null&&items.length<10){let h=m[1];if(!h.startsWith('http'))h='https://www.ommen.nl'+h;items.push({title:m[2].replace(/<[^>]*>/g,'').trim().slice(0,120),link:h,pubDate:new Date(),description:m[2].replace(/<[^>]*>/g,'').trim().slice(0,80)+' [...]'});}return items;}

let state={};let allArticles=[];let loadedSources=new Set();
function loadState(){try{const v=localStorage.getItem('nieuwsommen_bronnen_v2');if(v){state=JSON.parse(v);BRONNEN.forEach(b=>{if(!state[b.id])state[b.id]={aan:true,vandaag:false,scope:'regio'};});}else{BRONNEN.forEach(b=>state[b.id]={aan:true,vandaag:false,scope:'regio'});}}catch{BRONNEN.forEach(b=>state[b.id]={aan:true,vandaag:false,scope:'regio'});}}
function saveState(){localStorage.setItem('nieuwsommen_bronnen_v2',JSON.stringify(state));}

const WORKER='https://ommen-push-v2.leeuw008.workers.dev';

// NIEUWE VOLGORDE: eerst snelle public CORS proxies, worker pas als laatste redmiddel
async function fetchFast(url){
  const isOost=url.includes('rtvoost.nl');
  // 1. Voor RSS feeds: rss2json direct (snelste)
  if(!isOost){
    try{
      const r=await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(url)}&t=${Date.now()}`,{cache:'no-store'});
      if(r.ok){const j=await r.json(); if(j.status==='ok'&&j.items&&j.items.length>0){let xml='<rss><channel>'; j.items.slice(0,15).forEach(it=>{xml+=`<item><title><![CDATA[${it.title}]]></title><link>${it.link}</link><pubDate>${it.pubDate}</pubDate><description><![CDATA[${it.description}]]></description></item>`;}); xml+='</channel></rss>'; return xml;}}
    }catch{}
  }
  // 2. allorigins RAW (bypass CF voor Oost)
  try{
    const r=await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}&t=${Date.now()}`,{cache:'no-store'});
    if(r.ok){const t=await r.text(); if(t.length>800&&!t.includes('Just a moment')) return t;}
  }catch{}
  // 3. corsproxy.io
  try{
    const r=await fetch(`https://corsproxy.io/?${encodeURIComponent(url)}`,{cache:'no-store'});
    if(r.ok){const t=await r.text(); if(t.length>800&&!t.includes('Just a moment')) return t;}
  }catch{}
  // 4. worker proxy pas als laatste
  try{
    const c=new AbortController(); const to=setTimeout(()=>c.abort(),4000);
    const r=await fetch(`${WORKER}/proxy?url=${encodeURIComponent(url)}&t=${Date.now()}`,{cache:'no-store',signal:c.signal});
    clearTimeout(to);
    if(r.ok){const t=await r.text(); if(t.length>500) return t;}
  }catch{}
  throw new Error('all fail '+url);
}
function parseRSS(xml,bronId){const max=MAX_PER_BRON[bronId]||10; let items=[...xml.matchAll(/<item[^>]*>([\s\S]*?)<\/item>/gi)]; items=items.slice(0,max); return items.map(m=>{const it=m[0]; let title=(it.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i)||[])[1]||''; title=title.replace(/<[^>]*>/g,'').trim(); let link=(it.match(/<link[^>]*>([\s\S]*?)<\/link>/i)||[])[1]||''; link=link.replace(/<!\[CDATA\[/g,'').replace(/\]\]>/g,'').trim(); if(!link.startsWith('http')){const mm=it.match(/https?:\/\/[^\s<"\]]+/); if(mm) link=mm[0];} let pub=(it.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)||[])[1]||''; let desc=(it.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i)||[])[1]||''; return {title,link,pubDate:pub?new Date(pub):new Date(),description:desc.replace(/<[^>]*>/g,' ').slice(0,120)+' [...]'};}).filter(x=>x.link&&x.title);}
async function loadOne(b){const cfg=BRON_URLS[b.id];try{let arts=[];const html=await fetchFast(cfg.url);if(cfg.type==='gemeente'){arts=parseGemeente(html);}else if(cfg.type==='oost'){arts=parseOost(html);if(arts.length===0)arts=parseRSS(html,b.id);}else{if(html.includes('<h3')){if(b.id==='Vechtdal Centraal')arts=parseVC(html);else arts=parseRSS(html,b.id);}else arts=parseRSS(html,b.id);}if(arts.length===0)throw new Error('empty');return arts.map(a=>({...a,source:b.name,id:b.id,isFallback:false}));}catch(e){console.log('fail',b.id,e.message);return [{title:b.name,link:cfg.homepage,pubDate:new Date(0),description:'Bron tijdelijk offline [...]',source:b.name,id:b.id,isFallback:true}];}}
function renderArticles(){
  const c=document.getElementById('news-container');if(!c)return;
  let f=allArticles.filter(a=>{const s=state[a.id];return s&&s.aan;});
  f=f.sort((a,b)=>b.pubDate-a.pubDate);
  const real=f.filter(a=>!a.isFallback).length;
  c.innerHTML=`<div class="articles-count">${real} artikelen - ${loadedSources.size} v/d ${BRONNEN.length} bronnen geladen</div>`+f.map(a=>`<div class="article"><h2><a href="${a.link}" target="_blank">${a.title}</a></h2><small>${a.source}</small><div>${a.description||''}</div></div>`).join('');
}
async function refreshNews(){
  const c=document.getElementById('news-container');if(c)c.innerHTML='<div class="article">Laden... 9 bronnen parallel (snel)</div>';
  allArticles=[];loadedSources=new Set();
  const tasks=BRONNEN.map(async b=>{
    if(!state[b.id]||!state[b.id].aan)return;
    try{
      const arts=await Promise.race([loadOne(b),new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout '+b.id)),4000))]);
      allArticles=allArticles.filter(x=>x.id!==b.id).concat(arts);loadedSources.add(b.id);
      document.getElementById('header-count').textContent=`${loadedSources.size} v/d ${BRONNEN.length} bronnen`;
      renderArticles();
    }catch(e){loadedSources.add(b.id);renderArticles();}
  });
  await Promise.all(tasks);renderArticles();
}
document.addEventListener('DOMContentLoaded',()=>{loadState();setTimeout(()=>refreshNews(),100);});
