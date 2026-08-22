// app.js v258 FINAL - GEEN worker proxy meer, direct snel
// - Alle 7 RSS feeds via api.rss2json.com direct (geen trage worker)
// - RTV Oost wordt geskipt als hij CF blokkeert, blokkeert de rest niet
// - 4 sec timeout per bron, parallel, render zodra er 1 klaar is
const BRONNEN=[
{id:'De Stentor',name:'De Stentor'},{id:'Gemeente Ommen',name:'Gemeente Ommen'},{id:'Natuurlijk Ommen',name:'Natuurlijk Ommen'},{id:'Ommen City',name:'Ommen City'},{id:'OudOmmen',name:'OudOmmen'},{id:'RondOmmen',name:'RondOmmen'},{id:'RTV Oost',name:'RTV Oost'},{id:'RTV Vechtdal',name:'RTV Vechtdal'},{id:'Vechtdal Centraal',name:'Vechtdal Centraal'},
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
let allArticles=[];let loaded=0;
function render(){
  const c=document.getElementById('news-container');if(!c)return;
  const real=allArticles.filter(a=>!a.isFallback);
  c.innerHTML=`<div class="articles-count">${real.length} artikelen - ${loaded} v/d ${BRONNEN.length} bronnen geladen</div>`+
  real.map(a=>`<div class="article"><h2><a href="${a.link}" target="_blank">${a.title}</a></h2><small>${a.source}</small><div>${a.description||''}</div></div>`).join('')+
  (real.length===0?`<div class="article">Geen artikelen geladen, klik Vernieuwen<br><button onclick="localStorage.clear();location.reload()">Reset</button></div>`:'');
  document.getElementById('header-count').textContent=`${loaded} v/d ${BRONNEN.length} bronnen`;
}
async function fetchRSS(url){
  const ctrl=new AbortController();setTimeout(()=>ctrl.abort(),4000);
  try{
    // 1. rss2json direct
    const r=await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(url)}&t=${Date.now()}`,{signal:ctrl.signal,cache:'no-store'});
    if(r.ok){const j=await r.json();if(j.status==='ok'&&j.items&&j.items.length>0){return j.items.slice(0,12).map(it=>({title:it.title,link:it.link,pubDate:new Date(it.pubDate),description:(it.description||'').replace(/<[^>]*>/g,'').slice(0,120)+' [...]'}));}}
  }catch(e){}
  try{
    // 2. allorigins raw
    const r2=await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}&t=${Date.now()}`,{cache:'no-store'});
    if(r2.ok){const txt=await r2.text();if(txt.length>500){const items=[...txt.matchAll(/<item[^>]*>([\s\S]*?)<\/item>/gi)].slice(0,12).map(m=>{const it=m[0];let t=(it.match(/<title[^>]*>([\s\S]*?)<\/title>/i)||[])[1]||'';let l=(it.match(/<link[^>]*>([\s\S]*?)<\/link>/i)||[])[1]||'';return {title:t.replace(/<[^>]*>/g,'').trim(),link:l.replace(/<[^>]*>/g,'').trim(),pubDate:new Date(),description:''};}).filter(x=>x.link);if(items.length>0)return items;}}
  }catch{}
  return [];
}
async function fetchOost(url){
  const ctrl=new AbortController();setTimeout(()=>ctrl.abort(),3500);
  try{
    const r=await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}&t=${Date.now()}`,{signal:ctrl.signal,cache:'no-store'});
    if(r.ok){const html=await r.text();if(html.length>1000&&!html.includes('Just a moment')){let m,items=[];const re=/href="(\/nieuws\/[^"]+)"[^>]*>[\s\S]{0,300}?<h3[^>]*>([^<]+)<\/h3>/gi;while((m=re.exec(html))!==null&&items.length<10){items.push({title:m[2].trim(),link:'https://www.rtvoost.nl'+m[1],pubDate:new Date(),description:m[2].trim()+' [...]'});}if(items.length>0)return items;}}
  }catch{}
  return [];
}
async function loadBron(b){
  try{
    let arts=[];
    if(b.id==='RTV Oost'){arts=await fetchOost(BRON_URLS[b.id]);}
    else if(b.id==='Gemeente Ommen'){
      try{
        const html=await (await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(BRON_URLS[b.id])}`,{cache:'no-store'})).text();
        let re=/<a[^>]+href=["']([^"']*\/actueel\/[^"'?#]+)["'][^>]*>([\s\S]*?)<\/a>/gi,m;while((m=re.exec(html))!==null&&arts.length<10){let h=m[1];if(!h.startsWith('http'))h='https://www.ommen.nl'+h;arts.push({title:m[2].replace(/<[^>]*>/g,'').trim(),link:h,pubDate:new Date(),description:''});}
      }catch{}
    }else{
      arts=await fetchRSS(BRON_URLS[b.id]);
    }
    if(arts.length>0){allArticles=allArticles.filter(x=>x.source!==b.name).concat(arts.map(a=>({...a,source:b.name,id:b.id,isFallback:false})));}
  }catch{}
  loaded++;render();
}
async function refreshNews(){
  document.getElementById('news-container').innerHTML='<div class="article">Laden... 9 bronnen direct (zonder worker)</div>';
  allArticles=[];loaded=0;
  await Promise.allSettled(BRONNEN.map(b=>loadBron(b)));
  render();
}
document.addEventListener('DOMContentLoaded',()=>{
  const ls=localStorage.getItem('nieuwsommen_bronnen_v2'); // negeren, alles aan
  BRONNEN.forEach(b=>{if(!localStorage.getItem('nieuwsommen_bronnen_v2')){}}); // dummy
  refreshNews();
});
window.refreshNews=refreshNews;
