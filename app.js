// app.js v255 FINAL - RTV Oost terug naar oude werkende scraper
// - Geen rss2json voor Oost (heeft nooit bestaan)
// - Oost via 4 CORS proxies parallel die CF bypassen
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
function parseOostOLD(html){
  const items=[];let m;
  const re=/publishedAt="([^"]+)"[\s\S]{0,900}?href="(\/nieuws\/[^"]+)"[\s\S]{0,900}?<h3[^>]*>([^<]+)<\/h3>/gi;
  while((m=re.exec(html))!==null&&items.length<15){
    const pd=new Date(m[1]);const link='https://www.rtvoost.nl'+m[2];const title=m[3].trim();
    if(!items.find(x=>x.link===link))items.push({title,link,pubDate:pd,description:title+' [...]'});
  }
  if(items.length===0){
    const re2=/<a href="(\/nieuws\/[^"]+)"[^>]*>[\s\S]*?<h3[^>]*>([^<]+)<\/h3>/gi;
    while((m=re2.exec(html))!==null&&items.length<15){
      const link='https://www.rtvoost.nl'+m[1];const title=m[2].trim();
      if(!items.find(x=>x.link===link))items.push({title,link,pubDate:new Date(),description:title+' [...]'});
    }
  }
  return items;
}
let state={};let allArticles=[];let loadedSources=new Set();
function loadState(){try{const v=localStorage.getItem('nieuwsommen_bronnen_v2');if(v){state=JSON.parse(v);}else{BRONNEN.forEach(b=>state[b.id]={aan:true,vandaag:false,scope:'regio'});}}catch{BRONNEN.forEach(b=>state[b.id]={aan:true,vandaag:false,scope:'regio'});}}
function saveState(){localStorage.setItem('nieuwsommen_bronnen_v2',JSON.stringify(state));}
function renderFilters(){const l=document.getElementById('source-list');if(!l)return;l.innerHTML='';BRONNEN.forEach(b=>{const s=state[b.id]||{aan:true,vandaag:false,scope:'regio'};l.innerHTML+=`<div class="source-row"><div class="source-name">${b.name}</div><div><input type="checkbox" ${s.aan?'checked':''} data-type="aan" data-id="${b.id}"> AAN</div></div>`;});}
function closePanel(){document.getElementById('filter-header')?.classList.remove('open');document.getElementById('source-panel')?.classList.remove('open');}
const WORKER='https://ommen-push-v2.leeuw008.workers.dev';
async function fetchOostMetBypass(url){
  const proxies=[
    `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}&t=${Date.now()}`,
    `https://corsproxy.io/?${encodeURIComponent(url)}`,
    `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
    `https://thingproxy.freeboard.name/fetch/${url}`,
    `${WORKER}/proxy?url=${encodeURIComponent(url)}&t=${Date.now()}`
  ];
  const attempts=proxies.map(async p=>{
    const r=await fetch(p,{cache:'no-store'});
    if(!r.ok) throw new Error('proxy '+r.status);
    const t=await r.text();
    if(t.length<800) throw new Error('te kort');
    if(t.includes('Just a moment')||t.includes('Attention Required')||t.includes('cf-challenge')) throw new Error('CF block');
    if(!t.includes('nieuws')&&!t.includes('/nieuws/')) throw new Error('geen nieuws html');
    return t;
  });
  // Probeer allemaal parallel, eerste die lukt wint
  for(let i=0;i<attempts.length;i++){
    try{
      const html=await Promise.any(attempts);
      console.log('Oost OK via proxy',html.length);
      return html;
    }catch{
      // wacht 400ms en probeer volgende
      await new Promise(r=>setTimeout(r,400));
    }
  }
  throw new Error('alle proxies geblokkeerd');
}
async function fetchViaWorker(url){
  if(url.includes('rtvoost.nl')){
    return await fetchOostMetBypass(url);
  }
  try{
    const r=await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(url)}&t=${Date.now()}`,{cache:'no-store'});
    if(r.ok){const j=await r.json(); if(j.status==='ok'&&j.items&&j.items.length>0){let xml='<rss><channel>'; j.items.slice(0,15).forEach(it=>{xml+=`<item><title><![CDATA[${it.title}]]></title><link>${it.link}</link><pubDate>${it.pubDate}</pubDate><description><![CDATA[${it.description}]]></description></item>`;}); xml+='</channel></rss>'; return xml;}}
  }catch{}
  try{
    const r2=await fetch(`${WORKER}/proxy?url=${encodeURIComponent(url)}&t=${Date.now()}`,{cache:'no-store'});
    if(r2.ok){const t=await r2.text(); if(t.length>500) return t;}
  }catch{}
  try{
    const r3=await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}&t=${Date.now()}`,{cache:'no-store'});
    if(r3.ok){const t=await r3.text(); if(t.length>500) return t;}
  }catch{}
  throw new Error('fetch fail');
}
function parseRSS(xml,bronId){const max=MAX_PER_BRON[bronId]||10; let items=[...xml.matchAll(/<item[^>]*>([\s\S]*?)<\/item>/gi)]; items=items.slice(0,max); return items.map(m=>{const it=m[0]; let title=(it.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i)||[])[1]||''; title=title.replace(/<[^>]*>/g,'').trim(); let link=(it.match(/<link[^>]*>([\s\S]*?)<\/link>/i)||[])[1]||''; link=link.replace(/<!\[CDATA\[/g,'').replace(/\]\]>/g,'').trim(); if(!link.startsWith('http')){const mm=it.match(/https?:\/\/[^\s<"\]]+/); if(mm) link=mm[0];} let pub=(it.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)||[])[1]||''; let desc=(it.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i)||[])[1]||''; return {title,link,pubDate:pub?new Date(pub):new Date(),description:desc.replace(/<[^>]*>/g,' ').slice(0,120)+' [...]'};}).filter(x=>x.link&&x.title);}
function parseGemeente(html){let re=/<h[23][^>]*>\s*<a[^>]+href=["']([^"']*\/actueel\/[^"'?#]+)["'][^>]*>([\s\S]*?)<\/a>\s*<\/h[23]>/gi,m;const res=[];while((m=re.exec(html))!==null&&res.length<10){let href=m[1];if(!href.startsWith('http'))href='https://www.ommen.nl'+href;res.push({title:m[2].replace(/<[^>]*>/g,'').trim().slice(0,120),link:href,pubDate:new Date(),description:m[2].replace(/<[^>]*>/g,'').trim().slice(0,100)+' [...]'});}return res;}
async function loadOne(b){const cfg=BRON_URLS[b.id];try{let arts=[];if(cfg.type==='gemeente'){const h=await fetchViaWorker(cfg.url);arts=parseGemeente(h);}else if(cfg.type==='oost'){const h=await fetchViaWorker(cfg.url);arts=parseOostOLD(h);if(arts.length===0)arts=parseRSS(h,b.id);}else{const x=await fetchViaWorker(cfg.url);arts=parseRSS(x,b.id);}if(arts.length===0)throw new Error('empty');return arts.map(a=>({...a,source:b.name,id:b.id,isFallback:false}));}catch(e){console.log('load fail',b.id,e.message);return [{title:b.name,link:cfg.homepage,pubDate:new Date(0),description:'Bron tijdelijk offline [...]',source:b.name,id:b.id,isFallback:true}];}}
function renderArticles(){
  const c=document.getElementById('news-container');if(!c)return;
  let f=allArticles.filter(a=>{const s=state[a.id];return s&&s.aan;});
  f=f.sort((a,b)=>b.pubDate-a.pubDate);
  const real=f.filter(a=>!a.isFallback).length;
  c.innerHTML=`<div class="articles-count">${real} artikelen - ${loadedSources.size} v/d ${BRONNEN.length} bronnen geladen</div>`+f.map(a=>`<div class="article"><h2><a href="${a.link}" target="_blank">${a.title}</a></h2><small>${a.source}</small><div>${a.description||''}</div></div>`).join('');
}
async function refreshNews(){
  const c=document.getElementById('news-container');if(c)c.innerHTML='<div class="article">Bezig met laden...</div>';
  allArticles=[];loadedSources=new Set();
  for(const b of BRONNEN){
    if(!state[b.id]||!state[b.id].aan)continue;
    try{
      const arts=await Promise.race([loadOne(b),new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')),6000))]);
      allArticles=allArticles.filter(x=>x.id!==b.id).concat(arts);loadedSources.add(b.id);renderArticles();
    }catch(e){loadedSources.add(b.id);renderArticles();}
  }
}
document.addEventListener('DOMContentLoaded',()=>{loadState();setTimeout(()=>refreshNews(),100);});
