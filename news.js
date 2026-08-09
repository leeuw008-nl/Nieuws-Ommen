
const PROXIES = [
  'https://ommen-push-v2.leeuw008.workers.dev/proxy?url=',
  'https://corsproxy.io/?',
  'https://api.allorigins.win/raw?url=',
  'https://api.codetabs.com/v1/proxy?quest='
];
const CACHE_KEY='ommen_cache_v200';
const CACHE_TTL=10*60*1000;
const MAX_DESC=380;
let allArticles=[];
window._allArticles=allArticles;
const feeds = [
  { name: 'Ommen City', url: 'https://ommencity.nl/feed/' },
  { name: 'OudOmmen', url: 'https://weblog.oudommen.nl/feed/' },
  { name: 'De Stentor', url: 'https://www.destentor.nl/ommen/rss.xml' },
  { name: 'RondOmmen', url: 'https://www.rondommen.nl/feed/' },
  { name: 'Vechtdal Centraal', url: 'https://www.vechtdalcentraal.nl/feed/' },
  { name: 'Natuurlijk Ommen', url: 'https://www.natuurlijkommen.nl/feed/' }
];
const ommenKeywords=["ommen","arriën","arrien","beerze","beerzerveld","besthmen","diffelen","giethmen","junne","lemele","stegeren","vilsteren","witharen","varsen","ommermars"];

async function fetchWithTimeout(url, ms=9000){ const c=new AbortController(); const t=setTimeout(()=>c.abort(),ms); try{ const r=await fetch(url,{signal:c.signal}); clearTimeout(t); return r; }catch(e){ clearTimeout(t); throw e; } }
async function fetchViaProxy(targetUrl, attempt=0){
  if(attempt>=PROXIES.length) throw new Error('All proxies failed');
  const proxyUrl=PROXIES[attempt]+encodeURIComponent(targetUrl);
  try{
    const res=await fetchWithTimeout(proxyUrl);
    if(!res.ok) throw new Error('Proxy '+res.status);
    const text=await res.text();
    if(!text || text.length<100) throw new Error('Empty');
    return text;
  }catch(e){ await new Promise(r=>setTimeout(r,300*attempt)); return fetchViaProxy(targetUrl,attempt+1); }
}
function loadCache(){ try{ const raw=localStorage.getItem(CACHE_KEY); if(!raw) return null; const obj=JSON.parse(raw); if(Date.now()-obj.ts>CACHE_TTL) return null; return obj.articles; }catch{ return null; } }
function saveCache(a){ try{ localStorage.setItem(CACHE_KEY, JSON.stringify({ts:Date.now(), articles:a.slice(0,120)})); }catch{} }
function stripFooters(html){ if(!html) return ""; return html.replace(/<p[^>]*>\s*(Het bericht|The post|De post)\s+.*?(verscheen eerst op|appeared first on).*?<\/p>/gis,""); }
function sanitizeFinal(text){
  if(!text) return " [...]"; let d=String(text).replace(/\[\s*\.\.\.\s*\]/g,' ').replace(/&hellip;/gi,' ').replace(/…/g,' ').replace(/\s*\.\.\s*/g,' ').trim();
  if(!d.includes('[...]')) d+=' [...]'; return d;
}
function cleanHTML(html, maxLength=MAX_DESC){
  if(!html) return ""; html=stripFooters(html);
  const ta=document.createElement("textarea"); ta.innerHTML=html; let dec=ta.value;
  const doc=new DOMParser().parseFromString(dec,"text/html"); doc.querySelectorAll("script, style, iframe").forEach(el=>el.remove());
  let plain=doc.body.innerText.replace(/\s+/g," ").trim();
  if(plain.length>maxLength){ let cut=plain.substring(0,maxLength); let ls=cut.lastIndexOf(" "); if(ls>60) cut=cut.substring(0,ls); return sanitizeFinal(cut); }
  return sanitizeFinal(doc.body.innerHTML);
}
function cleanHTMLOriginal(html){ if(!html) return ""; const ta=document.createElement("textarea"); ta.innerHTML=html; return sanitizeFinal(ta.value); }
function isOmmenNieuws(article){ const text=(article.title+" "+(article.description||"")).toLowerCase(); return ommenKeywords.some(k=>text.includes(k)); }

async function fetchRSS(url){
  try{
    const text=await fetchViaProxy(url); if(!text) return [];
    const xml=new DOMParser().parseFromString(text,"text/xml"); if(xml.querySelector("parsererror")) return [];
    return Array.from(xml.getElementsByTagName("item")).slice(0,15).map(item=>{
      let link=""; const le=item.querySelector("link"); if(le) link=le.getAttribute("href")||le.textContent||"";
      const date=item.querySelector("pubDate")?.textContent?.trim()||""; const ts=Date.parse(date);
      const rawDesc=item.querySelector("description")?.textContent||""; const isOud=url.includes("oudommen");
      return { title:item.querySelector("title")?.textContent?.trim()||"Geen titel", description:isOud?cleanHTMLOriginal(rawDesc):cleanHTML(rawDesc,MAX_DESC), link:link.trim(), timestamp:isNaN(ts)?0:ts };
    });
  }catch{ return []; }
}
async function fetchGemeenteNieuws(){ const url="https://www.ommen.nl/actueel/"; try{ const text=await fetchViaProxy(url); const html=new DOMParser().parseFromString(text,"text/html"); const links=[]; for(const a of html.querySelectorAll("a")){ const title=a.querySelector("h3, h2")?.textContent?.trim()||a.textContent.trim(); const href=a.href; if(title && href.includes("/actueel/") && title.length>10 && links.length<6) links.push({title,link:href}); } const results=await Promise.allSettled(links.map(l=>fetchGemeenteGegevens(l.link))); return results.map((r,i)=>{ if(r.status==='fulfilled'&&r.value) return {title:links[i].title,link:links[i].link,description:r.value.tekst,timestamp:r.value.datum?Date.parse(r.value.datum):Date.now()}; return null; }).filter(Boolean); }catch{ return []; } }
async function fetchGemeenteGegevens(url){ try{ const text=await fetchViaProxy(url); const html=new DOMParser().parseFromString(text,"text/html"); const bodyText=html.body?.innerText||""; const m=bodyText.match(/\d{1,2}\s+(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\s+\d{4}/i); const datum=m?m[0]:""; let contentDiv=html.querySelector("article .content, .text-content, [class*='content'] p"); let tekst=""; if(contentDiv){ let parent=contentDiv.closest("article")||contentDiv.parentElement; const doc=new DOMParser().parseFromString(parent?parent.innerHTML:contentDiv.innerHTML,"text/html"); tekst=sanitizeFinal(doc.body.innerText.substring(0,700)); } return {datum,tekst}; }catch{ return {datum:"",tekst:""}; } }
async function fetchRTVVechtdalNieuws(){ const apiUrl="https://www.vechtdalleeft.nl/wp-json/wp/v2/posts?per_page=12&_embed"; try{ const text=await fetchViaProxy(apiUrl); const data=JSON.parse(text); return data.map(item=>({ title:(item.title?.rendered||"").replace(/<[^>]*>/g,"").trim(), link:item.link, description:cleanHTML(item.excerpt?.rendered||"",MAX_DESC), timestamp:Date.parse(item.date)||Date.now() })); }catch{ return []; } }
async function fetchOostNieuws(){ const url="https://www.oost.nl/nieuws"; try{ const html=await fetchViaProxy(url); const doc=new DOMParser().parseFromString(html,"text/html"); const links=[...doc.querySelectorAll("a")].map(a=>a.href).filter(h=>h&&h.includes("/nieuws/")&&/\/nieuws\/\d+\//.test(h)).slice(0,6); const uniek=[...new Set(links)]; const arts=await Promise.allSettled(uniek.map(link=>fetchOostArtikel(link))); return arts.filter(r=>r.status==='fulfilled'&&r.value).map(r=>r.value); }catch{ return []; } }
async function fetchOostArtikel(url){ try{ const html=await fetchViaProxy(url); const doc=new DOMParser().parseFromString(html,"text/html"); const title=doc.querySelector("h1")?.innerText?.trim()||"RTV Oost"; let datum=doc.querySelector('meta[property="article:published_time"]')?.content||""; const contentEl=doc.querySelector("article, .article__content"); const description=contentEl?cleanHTML(contentEl.innerHTML,MAX_DESC):""; return {title,link:url,description,timestamp:datum?Date.parse(datum):Date.now(),source:"RTV Oost"}; }catch{ return null; } }
function finalizeArticles(){ const seen=new Set(); allArticles=allArticles.filter(a=>{ if(seen.has(a.link)) return false; seen.add(a.link); return true; }); allArticles.sort((a,b)=>b.timestamp-a.timestamp); window._allArticles=allArticles; }

async function loadNews(isBackground=false){
  const container=document.getElementById("news-container");
  if(!isBackground && allArticles.length===0){
    const cached=loadCache();
    if(cached){ allArticles=cached; window._allArticles=allArticles; filterAndRender(); }
    else if(container) container.innerHTML="<p>Nieuws laden... (4-7 sec)</p>";
  }
  try{
    const feedPromises=feeds.map(async f=>{ const arts=await fetchRSS(f.url); return {source:f.name, articles:arts}; });
    const [feedResults,gemeente,rtv,oost] = await Promise.all([Promise.all(feedPromises), fetchGemeenteNieuws(), fetchRTVVechtdalNieuws(), fetchOostNieuws()]);
    const fresh=[]; feedResults.forEach(r=>r.articles.forEach(a=>fresh.push({...a,source:r.source}))); gemeente.forEach(a=>fresh.push({...a,source:"Gemeente Ommen"})); rtv.forEach(a=>fresh.push({...a,source:"RTV Vechtdal"})); oost.forEach(a=>fresh.push({...a,source:"RTV Oost"}));
    if(fresh.length>0){ allArticles=fresh; finalizeArticles(); saveCache(allArticles); filterAndRender(); }
  }catch(e){ console.error(e); }
}

function renderArticles(articles){
  const container=document.getElementById("news-container"); if(!container) return;
  let html=`<div class="articles-count" style="font-size:14px;font-weight:700;padding:6px 2px 8px;display:flex;gap:6px;align-items:center"><span style="width:3px;height:14px;background:#0b5bd3;border-radius:999px;display:inline-block"></span>${articles.length} artikelen <span style="font-weight:400;color:#64748b;font-size:11px">• ${new Date().toLocaleTimeString('nl-NL',{hour:'2-digit',minute:'2-digit'})}</span></div>`;
  if(articles.length===0) html+="<p>Geen artikelen. Check je filters of zoekterm.</p>";
  else html+=articles.map(a=>{ let ts=""; if(a.timestamp){ const d=new Date(a.timestamp); ts=d.toLocaleString('nl-NL',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}); } return `<div class="article"><h2><a href="${a.link}" target="_blank" rel="noopener">${a.title}</a></h2><small>${a.source} — ${ts}</small><div class="article-content">${a.description}</div></div>`; }).join("");
  container.innerHTML=html;
}

function filterAndRender(){
  const searchEl=document.getElementById('search') || document.getElementById('search-input');
  const zoekterm=(searchEl?.value||"").toLowerCase().trim();
  let articles=[...allArticles];
  if(zoekterm) articles=articles.filter(a=> (a.title+" "+(a.description||"")).toLowerCase().includes(zoekterm));
  // bronnen uit v2 state
  let gekozen=[];
  try{
    const state=JSON.parse(localStorage.getItem('nieuwsommen_bronnen_v2')||'{}');
    gekozen=Object.keys(state).filter(id=>state[id]?.aan);
    if(gekozen.length===0 && allArticles.length===0) gekozen=['De Stentor','Gemeente Ommen','Natuurlijk Ommen','Ommen City','OudOmmen','RondOmmen','RTV Oost','RTV Vechtdal','Vechtdal Centraal'];
    // filters vandaag + scope
    const todayStart=new Date(); todayStart.setHours(0,0,0,0); const todayEnd=new Date(); todayEnd.setHours(23,59,59,999);
    articles=articles.filter(a=>{
      if(gekozen.length>0 && !gekozen.includes(a.source)) return false;
      const cfg=state[a.source]; if(!cfg) return true;
      if(cfg.scope==='gemeente'){ if(a.source!=='Gemeente Ommen' && !isOmmenNieuws(a)) return false; }
      if(cfg.vandaag){ const ts=a.timestamp||0; if(ts && (ts < todayStart.getTime() || ts > todayEnd.getTime())) return false; }
      return true;
    });
  }catch(e){
    // fallback old checkboxes
    const cbs=document.querySelectorAll('.source-filter:checked');
    if(cbs.length>0){ const vals=Array.from(cbs).map(b=>b.value); articles=articles.filter(a=>vals.includes(a.source)); }
  }
  articles.sort((a,b)=>b.timestamp-a.timestamp);
  renderArticles(articles);
}

function refreshNews(){ try{ const c=JSON.parse(localStorage.getItem(CACHE_KEY)||'{}'); if(c.ts) c.ts=0; localStorage.setItem(CACHE_KEY,JSON.stringify(c)); }catch{} loadNews(false); }

document.addEventListener('DOMContentLoaded', ()=>{
  const si=document.getElementById('search') || document.getElementById('search-input');
  if(si) si.addEventListener('input', filterAndRender);
  loadNews(false);
});
window.searchNews=filterAndRender; window.filterAndRender=filterAndRender; window.filterNews=filterAndRender; window.applyFilters=filterAndRender; window.refreshNews=refreshNews; window.getAllArticles=()=>allArticles;
