// app.js v257 FINAL - FIX 1/9 geladen + traag + 0 artikelen
// - Alle fetches met AbortController 3500ms timeout
// - RTV Oost via oude scraper, maar niet blokkerend
// - 9 bronnen parallel, render zodra 1 klaar is
const BRONNEN=[
{id:'De Stentor',name:'De Stentor'},{id:'Gemeente Ommen',name:'Gemeente Ommen'},{id:'Natuurlijk Ommen',name:'Natuurlijk Ommen'},{id:'Ommen City',name:'Ommen City'},{id:'OudOmmen',name:'OudOmmen'},{id:'RondOmmen',name:'RondOmmen'},{id:'RTV Oost',name:'RTV Oost'},{id:'RTV Vechtdal',name:'RTV Vechtdal'},{id:'Vechtdal Centraal',name:'Vechtdal Centraal'},
];
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
let state={};let allArticles=[];let loadedSources=new Set();
function loadState(){try{const v=localStorage.getItem('nieuwsommen_bronnen_v2');if(v){state=JSON.parse(v);}else{BRONNEN.forEach(b=>state[b.id]={aan:true});}}catch{BRONNEN.forEach(b=>state[b.id]={aan:true});}}
function saveState(){localStorage.setItem('nieuwsommen_bronnen_v2',JSON.stringify(state));}
const WORKER='https://ommen-push-v2.leeuw008.workers.dev';

async function fetchWithTimeout(url, ms=3500){
  const c=new AbortController(); const t=setTimeout(()=>c.abort(),ms);
  try{
    const r=await fetch(url,{cache:'no-store',signal:c.signal});
    clearTimeout(t);
    if(!r.ok) throw new Error('status '+r.status);
    const txt=await r.text();
    if(txt.length<300) throw new Error('too short');
    if(txt.includes('Just a moment')||txt.includes('Attention Required')) throw new Error('CF');
    return txt;
  }catch(e){clearTimeout(t); throw e;}
}
async function fetchFast(url){
  const isOost=url.includes('rtvoost.nl');
  if(!isOost){
    try{ // rss2json snelste voor RSS
      const txt=await fetchWithTimeout(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(url)}&t=${Date.now()}`,3500);
      const j=JSON.parse(txt); if(j.status==='ok'&&j.items&&j.items.length>0){let xml='<rss><channel>'; j.items.slice(0,15).forEach(it=>{xml+=`<item><title><![CDATA[${it.title}]]></title><link>${it.link}</link><pubDate>${it.pubDate}</pubDate><description><![CDATA[${it.description}]]></description></item>`;}); xml+='</channel></rss>'; return xml;}
    }catch{}
  }
  // Oost en alle andere: allorigins RAW met timeout
  try{const t=await fetchWithTimeout(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}&t=${Date.now()}`,3500); if(t.length>500) return t;}catch{}
  try{const t=await fetchWithTimeout(`https://corsproxy.io/?${encodeURIComponent(url)}`,3500); if(t.length>500) return t;}catch{}
  try{const t=await fetchWithTimeout(`${WORKER}/proxy?url=${encodeURIComponent(url)}&t=${Date.now()}`,3500); if(t.length>300) return t;}catch{}
  throw new Error('all proxies fail');
}
function parseRSS(xml){let items=[...xml.matchAll(/<item[^>]*>([\s\S]*?)<\/item>/gi)]; return items.slice(0,15).map(m=>{const it=m[0]; let title=(it.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i)||[])[1]||''; title=title.replace(/<[^>]*>/g,'').trim(); let link=(it.match(/<link[^>]*>([\s\S]*?)<\/link>/i)||[])[1]||''; link=link.replace(/<!\[CDATA\[/g,'').replace(/\]\]>/g,'').trim(); if(!link.startsWith('http')){const mm=it.match(/https?:\/\/[^\s<"\]]+/); if(mm) link=mm[0];} let pub=(it.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)||[])[1]||''; let desc=(it.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i)||[])[1]||''; return {title,link,pubDate:pub?new Date(pub):new Date(),description:desc.replace(/<[^>]*>/g,' ').slice(0,120)+' [...]'};}).filter(x=>x.link&&x.title);}
function parseOost(html){let m,items=[];const re=/href="(\/nieuws\/[^"]+)"[^>]*>[\s\S]{0,300}?<h3[^>]*>([^<]+)<\/h3>/gi;while((m=re.exec(html))!==null&&items.length<10){items.push({title:m[2].trim(),link:'https://www.rtvoost.nl'+m[1],pubDate:new Date(),description:m[2].trim()+' [...]'});}return items;}
function parseGemeente(html){let re=/<a[^>]+href=["']([^"']*\/actueel\/[^"'?#]+)["'][^>]*>([\s\S]*?)<\/a>/gi,m,items=[];while((m=re.exec(html))!==null&&items.length<10){let h=m[1];if(!h.startsWith('http'))h='https://www.ommen.nl'+h;items.push({title:m[2].replace(/<[^>]*>/g,'').trim().slice(0,100),link:h,pubDate:new Date(),description:m[2].replace(/<[^>]*>/g,'').trim().slice(0,80)+' [...]'});}return items;}

async function loadOne(b){
  const cfg=BRON_URLS[b.id];
  try{
    const html=await fetchFast(cfg.url);
    let arts=[];
    if(cfg.type==='gemeente') arts=parseGemeente(html);
    else if(cfg.type==='oost'){arts=parseOost(html); if(arts.length===0) arts=parseRSS(html);}
    else arts=parseRSS(html);
    if(arts.length===0) throw new Error('empty');
    return arts.map(a=>({...a,source:b.name,id:b.id,isFallback:false}));
  }catch(e){
    console.log('fail',b.id,e.message);
    return [{title:b.name,link:cfg.homepage,pubDate:new Date(0),description:'Bron tijdelijk offline [...]',source:b.name,id:b.id,isFallback:true}];
  }
}
function renderArticles(){
  const c=document.getElementById('news-container');if(!c)return;
  let f=allArticles.filter(a=>{const s=state[a.id];return s&&s.aan;});
  f=f.sort((a,b)=>b.pubDate-a.pubDate);
  const real=f.filter(a=>!a.isFallback).length;
  c.innerHTML=`<div class="articles-count">${real} artikelen - ${loadedSources.size} v/d ${BRONNEN.length} bronnen geladen</div>`+f.map(a=>`<div class="article"><h2><a href="${a.link}" target="_blank">${a.title}</a></h2><small>${a.source}</small><div>${a.description||''}</div></div>`).join('');
}
async function refreshNews(){
  const c=document.getElementById('news-container');if(c)c.innerHTML='<div class="article">Laden... 9 bronnen parallel (met timeout)</div>';
  allArticles=[];loadedSources=new Set();
  const tasks=BRONNEN.map(async b=>{
    if(!state[b.id]||!state[b.id].aan) return;
    const arts=await loadOne(b);
    allArticles=allArticles.filter(x=>x.id!==b.id).concat(arts);
    loadedSources.add(b.id);
    document.getElementById('header-count').textContent=`${loadedSources.size} v/d ${BRONNEN.length} bronnen`;
    renderArticles();
  });
  await Promise.allSettled(tasks);
  renderArticles();
}
document.addEventListener('DOMContentLoaded',()=>{loadState();setTimeout(()=>refreshNews(),100);});
window.refreshNews=refreshNews;
