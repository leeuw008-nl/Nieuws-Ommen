// news.js v215 - INCREMENTAL - toont direct wat binnen is
const PROXIES = ['https://ommen-push-v2.leeuw008.workers.dev/proxy?url=','https://corsproxy.io/?'];
const CACHE_KEY = 'ommen_cache_v213_v2';
const CACHE_TTL = 10*60*1000;
const MAX_DESC = 380;
let allArticles = [];
const feeds = [
    { name: 'Ommen City', url: 'https://ommencity.nl/feed/', limit: 10 },
    { name: 'OudOmmen', url: 'https://weblog.oudommen.nl/feed/', limit: 10 },
    { name: 'De Stentor', url: 'https://www.destentor.nl/ommen/rss.xml', limit: 25 },
    { name: 'RondOmmen', url: 'https://www.rondommen.nl/feed/', limit: 20 },
    { name: 'Natuurlijk Ommen', url: 'https://www.natuurlijkommen.nl/feed/', limit: 10 }
];
async function fetchWithTimeout(url, ms=3500){ const c=new AbortController(); const t=setTimeout(()=>c.abort(),ms); try{ const r=await fetch(url,{signal:c.signal}); clearTimeout(t); return r; }catch(e){ clearTimeout(t); throw e; } }
async function fetchViaProxy(targetUrl){
  for(let i=0;i<PROXIES.length;i++){
    try{
      const r=await fetchWithTimeout(PROXIES[i]+encodeURIComponent(targetUrl),3500);
      if(!r.ok) continue;
      const t=await r.text();
      if(t && t.length>80) return t;
    }catch{}
  }
  throw new Error('proxy fail');
}
function loadCache(){ try{ const raw=localStorage.getItem(CACHE_KEY); if(!raw) return null; const obj=JSON.parse(raw); if(Date.now()-obj.ts>CACHE_TTL) return null; return obj.articles; }catch{ return null; } }
function saveCache(a){ try{ localStorage.setItem(CACHE_KEY, JSON.stringify({ts:Date.now(), articles:a.slice(0,120)})); }catch{} }
function stripFooters(html){ if(!html) return ""; return html.replace(/<p[^>]*>\s*(Het bericht|The post|De post)\s+.*?(verscheen eerst op|appeared first on).*?<\/p>/gis,""); }
function sanitizeFinal(text){ if(!text) return " [...]"; let d=String(text); d=d.replace(/\[[^\]]*\]/g,' ').replace(/&hellip;/gi,' ').replace(/…/g,' ').replace(/\s*\.\.\.\s*/g,' ').trim().replace(/\s{2,}/g,' ').trim(); if(!d.endsWith('[...]')) d+=' [...]'; return d; }
function cleanHTML(html,maxLength=MAX_DESC){ if(!html) return ""; html=stripFooters(html); const ta=document.createElement("textarea"); ta.innerHTML=html; let dec=ta.value; const doc=new DOMParser().parseFromString(dec,"text/html"); doc.querySelectorAll("script, style, iframe").forEach(el=>el.remove()); let plain=doc.body.innerText.replace(/\s+/g," ").trim(); plain=plain.replace(/\[[^\]]*\]/g,' ').replace(/\s{2,}/g,' ').trim(); if(plain.length>maxLength){ let cut=plain.substring(0,maxLength); let ls=cut.lastIndexOf(" "); if(ls>60) cut=cut.substring(0,ls); return sanitizeFinal(cut); } return sanitizeFinal(plain); }
function cleanHTMLOriginal(html){ if(!html) return ""; const ta=document.createElement("textarea"); ta.innerHTML=html; let dec=ta.value.replace(/\[[^\]]*\]/g,' ').replace(/\s{2,}/g,' ').trim(); return sanitizeFinal(dec); }
async function fetchRSS(url, limit=10){
  try{
    const text=await fetchViaProxy(url);
    const xml=new DOMParser().parseFromString(text,"text/xml");
    if(xml.querySelector("parsererror")) return [];
    return Array.from(xml.getElementsByTagName("item")).slice(0,limit).map(item=>{
      let link=""; const le=item.querySelector("link"); if(le) link=le.getAttribute("href")||le.textContent||"";
      const date=item.querySelector("pubDate")?.textContent?.trim()||""; const ts=Date.parse(date);
      const rawDesc=item.querySelector("description")?.textContent||""; const isOud=url.includes("oudommen");
      return { title:item.querySelector("title")?.textContent?.trim()||"Geen titel", description:isOud?cleanHTMLOriginal(rawDesc):cleanHTML(rawDesc,MAX_DESC), link:link.trim(), timestamp:isNaN(ts)?0:ts };
    });
  }catch{ return []; }
}
async function fetchGemeenteNieuws(){ const url="https://www.ommen.nl/actueel/"; try{ const text=await fetchViaProxy(url); const html=new DOMParser().parseFromString(text,"text/html"); const links=[]; for(const a of html.querySelectorAll("a")){ const title=a.querySelector("h3, h2")?.textContent?.trim()||a.textContent.trim(); const href=a.href; if(title && href.includes("/actueel/") && title.length>10 && links.length<10) links.push({title,link:href}); } const results=await Promise.allSettled(links.map(l=>fetchGemeenteGegevens(l.link))); return results.map((r,i)=>{ if(r.status==='fulfilled'&&r.value) return {title:links[i].title,link:links[i].link,description:r.value.tekst,timestamp:r.value.datum?Date.parse(r.value.datum):Date.now()}; return null; }).filter(Boolean); }catch{ return []; } }
async function fetchGemeenteGegevens(url){ try{ const text=await fetchViaProxy(url); const html=new DOMParser().parseFromString(text,"text/html"); const bodyText=html.body?.innerText||""; const m=bodyText.match(/\d{1,2}\s+(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\s+\d{4}/i); const datum=m?m[0]:""; let contentDiv=html.querySelector("article.content,.text-content, [class*='content'] p"); let tekst=""; if(contentDiv){ let parent=contentDiv.closest("article")||contentDiv.parentElement; const doc=new DOMParser().parseFromString(parent?parent.innerHTML:contentDiv.innerHTML,"text/html"); tekst=sanitizeFinal(doc.body.innerText.substring(0,650)); } return {datum,tekst}; }catch{ return {datum:"",tekst:""}; } }
async function fetchRTVVechtdalNieuws(){ try{ const rss=await fetchRSS('https://rtvvechtdal.nl/feed/',6); if(rss.length) return rss.map(a=>({...a,source:'RTV Vechtdal'})); }catch{} try{ const text=await fetchViaProxy("https://www.vechtdalleeft.nl/wp-json/wp/v2/posts?per_page=6"); const data=JSON.parse(text); return data.map(item=>({title:(item.title?.rendered||"").replace(/<[^>]*>/g,"").trim(),link:item.link,description:cleanHTML(item.excerpt?.rendered||"",MAX_DESC),timestamp:Date.parse(item.date)||Date.now(),source:"RTV Vechtdal"})); }catch{ return []; } }
async function fetchVechtdalCentraalNieuws(){ try{ const arts=await fetchRSS('https://www.vechtdalcentraal.nl/feed/',8); return arts.map(a=>({...a,source:'Vechtdal Centraal'})); }catch{ return []; } }
async function fetchOostNieuws(){ try{ const html=await fetchViaProxy("https://www.oost.nl/nieuws"); const doc=new DOMParser().parseFromString(html,"text/html"); let links=[...doc.querySelectorAll('a[href*="/nieuws/"]')].map(a=>a.href).filter(h=>h&&h.includes('oost.nl')); links=[...new Set(links)].slice(0,8); const arts=await Promise.allSettled(links.map(link=>fetchOostArtikel(link))); return arts.filter(r=>r.status==='fulfilled'&&r.value).map(r=>r.value).slice(0,6); }catch{ return []; } }
async function fetchOostArtikel(url){ try{ const html=await fetchViaProxy(url); if(!html) return null; if(html.toLowerCase().includes('<title>404')) return null; const doc=new DOMParser().parseFromString(html,"text/html"); const title=(doc.querySelector("h1")?.innerText?.trim()||"").trim(); if(!title||title.length<5) return null; let datum=doc.querySelector('meta[property="article:published_time"]')?.content||""; const contentEl=doc.querySelector("article,.article__content"); const description=contentEl?cleanHTML(contentEl.innerHTML,MAX_DESC):""; if(!description) return null; return {title,link:url,description,timestamp:datum?Date.parse(datum):Date.now(),source:"RTV Oost"}; }catch{ return null; } }

function finalizeArticles(){ const seen=new Set(); allArticles=allArticles.filter(a=>{ if(seen.has(a.link)) return false; seen.add(a.link); return true; }); allArticles.sort((a,b)=>b.timestamp-a.timestamp); }
function renderArticles(articles){ const container=document.getElementById("news-container"); let html=`<p><strong>${articles.length} artikelen</strong> <span style="font-weight:400;color:#64748b;font-size:11px;">• ${new Date().toLocaleTimeString('nl-NL',{hour:'2-digit',minute:'2-digit'})}</span></p>`; if(articles.length===0) html+="<p>Geen artikelen gevonden.</p>"; else html+=articles.map(a=>{ let ts=""; if(a.timestamp){ const d=new Date(a.timestamp); ts=d.toLocaleString('nl-NL',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}); } return `<div class="article"><h2><a href="${a.link}" target="_blank" rel="noopener">${a.title}</a></h2><small>${a.source} — ${ts}</small><div class="article-content">${a.description}</div></div>`; }).join(""); container.innerHTML=html; }
function searchNews(){ const si=document.getElementById("search-input"); const zoekterm=si?si.value.toLowerCase().trim():""; let articles=[...allArticles]; if(zoekterm) articles=articles.filter(a=> (a.title+" "+(a.description||"")).toLowerCase().includes(zoekterm)); const gekozenBronnen=Array.from(document.querySelectorAll(".source-filter:checked")).map(b=>b.value); if(gekozenBronnen.length===0){ document.getElementById("news-container").innerHTML="<p><strong>0 artikelen</strong></p><p>Selecteer bron.</p>"; return; } articles=articles.filter(a=>gekozenBronnen.includes(a.source)); try{ const raw=localStorage.getItem('nieuwsommen_bronnen_v2'); if(raw){ const state=JSON.parse(raw); const todayStart=new Date(); todayStart.setHours(0,0,0,0); const todayEnd=new Date(); todayEnd.setHours(23,59,59,999); articles=articles.filter(a=>{ const cfg=state[a.source]; if(!cfg) return true; if(cfg.scope==='gemeente'){ if(a.source!=='Gemeente Ommen' &&!(a.title+" "+(a.description||"")).toLowerCase().includes("ommen")) return false; } if(cfg.vandaag){ const ts=a.timestamp||0; if(ts && (ts < todayStart.getTime() || ts > todayEnd.getTime())) return false; } return true; }); } }catch{} articles.sort((a,b)=>b.timestamp-a.timestamp); renderArticles(articles); }

async function loadNews(){
    const container=document.getElementById("news-container");
    const cached=loadCache();
    if(cached){ allArticles=cached; searchNews(); }
    else container.innerHTML="<p>Nieuws laden... (eerste keer 4-7s)</p>";

    const addAndRender = (newArts) => {
      if(!newArts ||!newArts.length) return;
      allArticles = [...newArts,...allArticles];
      finalizeArticles();
      saveCache(allArticles);
      searchNews();
    };

    // laad alles parallel maar render zodra iets binnen is
    const tasks = [
     ...feeds.map(f=>fetchRSS(f.url,f.limit).then(arts=>arts.map(a=>({...a,source:f.name})))),
      fetchGemeenteNieuws().then(a=>a.map(x=>({...x,source:"Gemeente Ommen"}))),
      fetchRTVVechtdalNieuws(),
      fetchVechtdalCentraalNieuws(),
      fetchOostNieuws()
    ];
    for(const t of tasks){
      t.then(addAndRender).catch(()=>{});
    }
}
function refreshNews(){ try{ localStorage.removeItem(CACHE_KEY); allArticles=[]; }catch{} loadNews(); }
window.addEventListener("DOMContentLoaded", ()=>{ const si=document.getElementById("search-input"); if(si) si.addEventListener("input", searchNews); loadNews(); });
window.searchNews=searchNews; window.filterNews=searchNews; window.applyFilters=searchNews; window.refreshNews=refreshNews; window.getAllArticles=()=>allArticles;
