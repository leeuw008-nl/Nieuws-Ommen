// news.js v12.9 - 9/9 - 2 weken geleden methode hersteld voor 4 kapotte bronnen
const PUSH_WORKER_URL='https://ommen-push-v2.leeuw008.workers.dev';
const PROXY = (u) => `${PUSH_WORKER_URL}/proxy?url=${encodeURIComponent(u)}`;
const RSS2JSON = (u) => `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(u)}`;

const SOURCES = [
  {name:'Ommen City', url:'https://ommencity.nl/feed/', type:'rss'},
  {name:'OudOmmen', url:'https://weblog.oudommen.nl/feed/', type:'rss'},
  {name:'De Stentor', url:'https://www.destentor.nl/ommen/rss.xml', type:'rss'},
  {name:'RondOmmen', url:'https://www.rondommen.nl/feed/', type:'rss'},
  {name:'Natuurlijk Ommen', url:'https://www.natuurlijkommen.nl/feed/', type:'rss'},
  {name:'Vechtdal Centraal', url:'https://www.vechtdalcentraal.nl/feed/', type:'rss2json'},
  {name:'Gemeente Ommen', url:'https://www.ommen.nl/actueel/', type:'gemeente'},
  {name:'RTV Vechtdal', url:'https://www.vechtdalleeft.nl/feed/', type:'rss2json'},
  {name:'RTV Oost', url:'https://www.oost.nl/nieuws', type:'oost'}
];

async function fetchTextWithFallback(url){
  // 1. via eigen worker proxy
  try{
    const r=await fetch(PROXY(url));
    if(r.ok){ const t=await r.text(); if(t.length>400) return t; }
  }catch{}
  // 2. direct
  try{
    const r=await fetch(url, {headers:{'Accept':'*/*'}});
    if(r.ok){ const t=await r.text(); if(t.length>400) return t; }
  }catch{}
  // 3. via corsproxy
  try{
    const r=await fetch('https://corsproxy.io/?'+encodeURIComponent(url));
    if(r.ok){ const t=await r.text(); if(t.length>400) return t; }
  }catch{}
  throw new Error('fetch fail '+url);
}

function parseRSS(text){
  const items=[...text.matchAll(/<item[^>]*>([\s\S]*?)<\/item>/gi)];
  return items.map(m=>{
    const item=m[0];
    let title=(item.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i)||[])[1]||'';
    title=title.replace(/<[^>]*>/g,'').trim();
    let link=(item.match(/<link[^>]*>([\s\S]*?)<\/link>/i)||[])[1]||'';
    link=link.replace(/<!\[CDATA\[/g,'').replace(/\]\]>/g,'').trim();
    if(!link.startsWith('http')){
      const mm=item.match(/https?:\/\/[^\s<"\]]+/); if(mm) link=mm[0];
    }
    let pub=(item.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)||[])[1]||'';
    let desc=(item.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i)||[])[1]||'';
    desc=desc.replace(/<[^>]*>/g,'').trim().slice(0,200);
    return {title,link,pubDate:pub,description:desc};
  }).filter(x=>x.link);
}

async function getFromRss2Json(feedUrl){
  const r=await fetch(RSS2JSON(feedUrl));
  const j=await r.json();
  if(!j.items) throw new Error('rss2json no items');
  return j.items.map(it=>({
    title: (it.title||'').slice(0,150),
    link: it.link,
    pubDate: it.pubDate||'',
    description: (it.description||'').replace(/<[^>]*>/g,'').slice(0,200)
  }));
}

async function getSourceArticles(src){
  try{
    if(src.type==='rss'){
      const txt=await fetchTextWithFallback(src.url);
      return parseRSS(txt).slice(0,10).map(a=>({...a,source:src.name}));
    }
    if(src.type==='rss2json'){
      try{
        const arts=await getFromRss2Json(src.url);
        return arts.slice(0,10).map(a=>({...a,source:src.name}));
      }catch{
        // fallback via proxy rss
        const txt=await fetchTextWithFallback(src.url);
        return parseRSS(txt).slice(0,10).map(a=>({...a,source:src.name}));
      }
    }
    if(src.type==='gemeente'){
      const html=await fetchTextWithFallback(src.url);
      const links=[...html.matchAll(/href=["']([^"']*\/actueel\/[^"'?#]+)["']/gi)].map(m=>m[1]);
      const uniq=[...new Set(links.map(h=>h.startsWith('http')?h:'https://www.ommen.nl'+h))].slice(0,10);
      return uniq.map(link=>({
        title: 'Gemeente: '+decodeURIComponent(link.split('/').filter(Boolean).pop().replace(/-/g,' ').slice(0,80)),
        link, pubDate:'', description:'', source:src.name
      }));
    }
    if(src.type==='oost'){
      const html=await fetchTextWithFallback(src.url);
      const links=[...html.matchAll(/href=["']([^"']*\/nieuws\/[^"']+)["']/gi)].map(m=>m[1]);
      const uniq=[...new Set(links.map(l=>l.startsWith('http')?l:'https://www.oost.nl'+l))].slice(0,12);
      return uniq.map(link=>({
        title: 'RTV Oost: '+decodeURIComponent(link.split('/').filter(Boolean).pop().replace(/-/g,' ').slice(0,80)),
        link, pubDate:'', description:'', source:src.name
      }));
    }
  }catch(e){
    console.warn('fail',src.name,e.message);
    return [];
  }
  return [];
}

// --- bestaande functies van jouw app.js blijven werken ---
// Deze functie wordt door app.js / index aangeroepen
window.refreshNews = async function(){
  const container=document.getElementById('news-container');
  if(container) container.innerHTML='Bezig met laden...';
  const all=[];
  const results=await Promise.all(SOURCES.map(s=>getSourceArticles(s)));
  results.forEach(list=>all.push(...list));
  // sorteer op datum als beschikbaar, anders behoud volgorde
  all.sort((a,b)=> new Date(b.pubDate||0) - new Date(a.pubDate||0));
  if(window.renderNews) window.renderNews(all);
  else if(container){
    container.innerHTML=all.map(a=>`<div class="news-item"><a href="${a.link}" target="_blank"><b>[${a.source}]</b> ${a.title}</a><br><small>${a.description||''}</small></div>`).join('');
  }
  const countEl=document.getElementById('header-count');
  if(countEl){
    const okSources=new Set(all.map(a=>a.source));
    countEl.textContent=`${okSources.size} v/d 9 bronnen`;
  }
  return all;
};

// auto load
document.addEventListener('DOMContentLoaded', ()=>{
  if(typeof window.refreshNews==='function') setTimeout(()=>window.refreshNews(), 500);
});
