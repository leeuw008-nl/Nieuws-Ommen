/* Nieuw(s)Ommen v108 - SPEED + SINGLE [...] FIX - DEFINITIEF */
const PROXIES = ['https://ommen-push.leeuw008.workers.dev/proxy?url=','https://corsproxy.io/?'];
const PROXY = PROXIES[0];
const FETCH_TIMEOUT = 4500;
const CACHE_KEY = 'ommen_cache_v108';
const CACHE_TTL = 10*60*1000;
async function fetchWithTimeout(url){ const c=new AbortController(); const t=setTimeout(()=>c.abort(),FETCH_TIMEOUT); try{ const r=await fetch(url,{signal:c.signal}); clearTimeout(t); return r; }catch(e){ clearTimeout(t); throw e; } }
async function fetchViaProxy(targetUrl, attempt=0){ if(attempt>=PROXIES.length) throw new Error('All proxies failed'); const proxyUrl=PROXIES[attempt]+encodeURIComponent(targetUrl); try{ const res=await fetchWithTimeout(proxyUrl); if(!res.ok) throw new Error('Proxy '+res.status); const text=await res.text(); if(!text||text.length<80) throw new Error('Empty'); return text; }catch(e){ return fetchViaProxy(targetUrl, attempt+1); } }
function loadCache(){ try{ const raw=localStorage.getItem(CACHE_KEY); if(!raw) return null; const obj=JSON.parse(raw); if(Date.now()-obj.ts>CACHE_TTL) return null; return obj.articles; }catch{ return null; } }
function saveCache(a){ try{ localStorage.setItem(CACHE_KEY, JSON.stringify({ts:Date.now(), articles:a.slice(0,80)})); }catch{} }
const feeds = [
    { name: 'Ommen City', url: 'https://ommencity.nl/feed/' },
    { name: 'OudOmmen', url: 'https://weblog.oudommen.nl/feed/' },
    { name: 'De Stentor', url: 'https://www.destentor.nl/ommen/rss.xml' },
    { name: 'RondOmmen', url: 'https://www.rondommen.nl/feed/' },
    { name: 'Vechtdal Centraal', url: 'https://www.vechtdalcentraal.nl/feed/' },
    { name: 'Natuurlijk Ommen', url: 'https://www.natuurlijkommen.nl/feed/' }
];
const ommenKeywords = ["ommen","arriën","arrien","beerze","beerzerveld","besthmen","diffelen","giethmen","junne","lemele","stegeren","vilsteren","witharen","varsen","ommermars"];
let allArticles = [];
const MAX_DESC = 380;
const PUSH_WORKER_URL = 'https://ommen-push.leeuw008.workers.dev';
let VAPID_PUBLIC_KEY = null;
async function getVapidKey(){ if(VAPID_PUBLIC_KEY) return VAPID_PUBLIC_KEY; try{ const r=await fetchWithTimeout(`${PUSH_WORKER_URL}/vapid`); const j=await r.json(); VAPID_PUBLIC_KEY=j.publicKey; return VAPID_PUBLIC_KEY; }catch{ return null; } }
const LS_SEEN_KEY = "ommen_nieuws_seen_links";
const LS_SOURCES_KEY = "ommen_selected_sources";
function stripFooters(html){ if(!html) return ""; let txt=html; txt=txt.replace(/<p[^>]*>\s*(Het bericht|The post|De post)\s+.*?(verscheen eerst op|appeared first on).*?<\/p>/gis,""); return txt.trim(); }
function sanitizeFinal(text){
    if(!text) return " [...]";
    let d=String(text);
    d=d.replace(/\[&hellip;\]/gi,' ').replace(/&hellip;/gi,' ').replace(/…/g,' ').replace(/&#8230;/g,' ');
    d=d.replace(/\[\s*\.\.\.\s*\]/g,' ').replace(/\[\s*…\s*\]/g,' ').replace(/\s*\.\.\.\s*/g,' ');
    d=d.replace(/\s*\[...\]\s*/g,' ');
    d=d.replace(/\s+/g,' ').trim();
    if(/<\/p>\s*$/i.test(d)) d=d.replace(/<\/p>\s*$/i,' [...]</p>');
    else if(/<\/div>\s*$/i.test(d)) d=d.replace(/<\/div>\s*$/i,' [...]</div>');
    else d=d+' [...]';
    d=d.replace(/(\s*\[...\]\s*){2,}/g,' [...]');
    return d;
}
function cleanHTMLOriginal(html){ if(!html) return ""; html=stripFooters(html); const ta=document.createElement("textarea"); ta.innerHTML=html; let dec=ta.value; const doc=new DOMParser().parseFromString(dec,"text/html"); doc.querySelectorAll("script, style, iframe").forEach(el=>el.remove()); return sanitizeFinal(doc.body.innerHTML); }
function cleanHTML(html, maxLength=MAX_DESC){ if(!html) return ""; html=stripFooters(html); const ta=document.createElement("textarea"); ta.innerHTML=html; let dec=ta.value; const doc=new DOMParser().parseFromString(dec,"text/html"); doc.querySelectorAll("script, style, iframe").forEach(el=>el.remove()); let plain=doc.body.innerText.replace(/\s+/g," ").trim(); if(plain.length>maxLength){ let cut=plain.substring(0,maxLength); let ls=cut.lastIndexOf(" "); if(ls>60) cut=cut.substring(0,ls); return sanitizeFinal(cut); } return sanitizeFinal(doc.body.innerHTML); }
function cleanTextWithEllipsis(text, maxLength=MAX_DESC){ if(!text) return ""; text=text.replace(/\s+/g," ").trim(); if(text.length>maxLength){ let cut=text.substring(0,maxLength); let ls=cut.lastIndexOf(" "); if(ls>60) cut=cut.substring(0,ls); return sanitizeFinal(cut); } return sanitizeFinal(text); }
function cleanGemeenteHTML(html, maxLength=650){ if(!html) return ""; html=stripFooters(html); const doc=new DOMParser().parseFromString(html,"text/html"); let paras=Array.from(doc.querySelectorAll("p")).map(p=>p.outerHTML).filter(p=>{ let txt=p.replace(/<[^>]*>/g,"").trim(); return txt.length>30; }); if(paras.length===0) return cleanHTML(html,maxLength); return sanitizeFinal(paras.slice(0,3).join("")); }
async function fetchRSS(url){ try{ const text=await fetchViaProxy(url); if(!text) return []; const xml=new DOMParser().parseFromString(text,"text/xml"); if(xml.querySelector("parsererror")) return []; const items=Array.from(xml.getElementsByTagName("item")); return items.slice(0,12).map(item=>{ let link=""; const le=item.querySelector("link"); if(le) link=le.getAttribute("href")||le.textContent||""; const date=item.querySelector("pubDate")?.textContent?.trim()||""; const ts=Date.parse(date); const rawDesc=item.querySelector("description")?.textContent||""; const isOud=url.includes("oudommen"); return { title:item.querySelector("title")?.textContent?.trim()||"Geen titel", description:isOud?cleanHTMLOriginal(rawDesc):cleanHTML(rawDesc,MAX_DESC), link:link.trim(), timestamp:isNaN(ts)?0:ts }; }); }catch{ return []; } }
async function fetchGemeenteNieuws(){ const url="https://www.ommen.nl/actueel/"; try{ const text=await fetchViaProxy(url); const html=new DOMParser().parseFromString(text,"text/html"); const links=[]; for(const a of html.querySelectorAll("a")){ const title=a.querySelector("h3, h2")?.textContent?.trim()||a.textContent.trim(); const href=a.href; if(title && href.includes("/actueel/") && title.length>10 && links.length<5) links.push({title,link:href}); } const results=await Promise.allSettled(links.map(l=>fetchGemeenteGegevens(l.link))); return results.map((r,i)=>{ if(r.status==='fulfilled'&&r.value) return {title:links[i].title,link:links[i].link,description:r.value.tekst,timestamp:r.value.datum?Date.parse(r.value.datum):Date.now()}; return null; }).filter(Boolean); }catch{ return []; } }
async function fetchGemeenteGegevens(url){ try{ const text=await fetchViaProxy(url); const html=new DOMParser().parseFromString(text,"text/html"); const bodyText=html.body?.innerText||""; const m=bodyText.match(/\d{1,2}\s+(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\s+\d{4}/i); const datum=m?m[0]:""; let contentDiv=html.querySelector("article .content, .text-content, [class*='content'] p"); let tekst=""; if(contentDiv){ let parent=contentDiv.closest("article")||contentDiv.parentElement; tekst=cleanGemeenteHTML(parent?parent.innerHTML:contentDiv.innerHTML,650); } else { const regels=bodyText.split("\n").map(r=>r.trim()).filter(r=>r.length>40); if(regels.length>0) tekst=cleanTextWithEllipsis(regels.slice(0,2).join(" "),650); } return {datum,tekst}; }catch{ return {datum:"",tekst:""}; } }
async function fetchRTVVechtdalNieuws(){ const apiUrl="https://www.vechtdalleeft.nl/wp-json/wp/v2/posts?per_page=12&_embed"; try{ const text=await fetchViaProxy(apiUrl); if(!text) throw new Error("leeg"); const data=JSON.parse(text); return data.map(item=>({ title:(item.title?.rendered||"Geen titel").replace(/<[^>]*>/g,"").trim(), link:item.link, description:cleanHTML(item.excerpt?.rendered||item.content?.rendered||"",MAX_DESC), timestamp:Date.parse(item.date)||Date.now() })); }catch{ return []; } }
async function fetchOostNieuws(){ const url="https://www.oost.nl/nieuws"; try{ const html=await fetchViaProxy(url); const doc=new DOMParser().parseFromString(html,"text/html"); const links=[...doc.querySelectorAll("a")].map(a=>a.href).filter(h=>h&&h.includes("/nieuws/")&&/\/nieuws\/\d+\//.test(h)).map(h=>h.replace("https://leeuw008-nl.github.io","https://www.oost.nl")); const uniek=[...new Set(links)].slice(0,5); const arts=await Promise.allSettled(uniek.map(link=>fetchOostArtikel(link))); return arts.filter(r=>r.status==='fulfilled'&&r.value).map(r=>r.value); }catch{ return []; } }
async function fetchOostArtikel(url){ try{ const html=await fetchViaProxy(url); const doc=new DOMParser().parseFromString(html,"text/html"); const title=doc.querySelector("h1")?.innerText?.trim()||"RTV Oost"; let datum=doc.querySelector('meta[property="article:published_time"]')?.content||doc.querySelector("time")?.getAttribute("datetime")||""; if(!datum){ const m=doc.body.innerText.match(/\d{1,2}\s+(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\s+\d{4}/i); if(m) datum=m[0]; } const contentEl=doc.querySelector("article, .article__content"); const description=contentEl?cleanHTML(contentEl.innerHTML,MAX_DESC):cleanTextWithEllipsis(doc.querySelector('meta[name="description"]')?.content||"",MAX_DESC); return {title,link:url,description,timestamp:datum?Date.parse(datum):Date.now(),source:"RTV Oost"}; }catch{ return null; } }
function isOmmenNieuws(a){ const t=(a.title+" "+(a.description||"")).toLowerCase().replace(/<[^>]*>/g," "); return ommenKeywords.some(k=>t.includes(k)); }
function finalizeArticles(){ const seen=new Set(); allArticles=allArticles.filter(a=>{ if(seen.has(a.link)) return false; seen.add(a.link); return true; }); allArticles.sort((a,b)=>b.timestamp-a.timestamp); }
function ensureBanner(){ if(document.getElementById('new-articles-banner')) return; const style=document.createElement('style'); style.textContent=`#new-articles-banner{position:sticky;top:0;z-index:999;background:#ffcc00;color:#000;padding:10px 14px;border-radius:6px;margin:10px 0;display:none;align-items:center;justify-content:space-between;gap:10px;font-weight:600;cursor:pointer} #new-articles-banner button{border:none;padding:6px 12px;border-radius:4px;cursor:pointer}`; document.head.appendChild(style); const banner=document.createElement('div'); banner.id='new-articles-banner'; banner.innerHTML=`<span id="new-articles-text" style="flex:1"></span><span><button id="banner-view">Bekijken</button><button id="banner-close" style="background:transparent">✕</button></span>`; const container=document.getElementById('news-container'); if(container?.parentNode) container.parentNode.insertBefore(banner,container); }
function getSeenLinks(){ try{ return new Set(JSON.parse(localStorage.getItem(LS_SEEN_KEY)||"[]")); }catch{ return new Set(); } }
function saveSeenLinks(links){ localStorage.setItem(LS_SEEN_KEY, JSON.stringify([...links].slice(0,300))); }
function getFilteredForBanner(articles){ let f=[...articles]; try{ const gekozen=Array.from(document.querySelectorAll(".source-filter:checked")).map(b=>b.value); if(gekozen.length>0) f=f.filter(a=>gekozen.includes(a.source)); }catch{} return f; }
function checkForNewArticles(cur){ const seen=getSeenLinks(); const filtered=getFilteredForBanner(cur); if(seen.size===0){ saveSeenLinks(new Set(filtered.map(a=>a.link))); return; } const newOnes=filtered.filter(a=>!seen.has(a.link)); if(newOnes.length>0){ ensureBanner(); const banner=document.getElementById('new-articles-banner'); const txt=document.getElementById('new-articles-text'); window._lastNewLinks=newOnes.map(a=>a.link); if(banner&&txt){ txt.textContent=`🔔 ${newOnes.length} nieuw: ${newOnes[0].title}`; banner.style.display='flex'; } } }
async function loadNews(isBackground=false){
    const container=document.getElementById("news-container");
    const isFirst= !isBackground && allArticles.length===0;
    if(isFirst){
        const cached=loadCache();
        if(cached && cached.length>0){ allArticles=cached; searchNews(); container.insertAdjacentHTML('afterbegin', `<div id="cache-notice" style="font-size:11px;color:#64748b;padding:4px 0;">⚡ cache • verversen...</div>`); }
        else { container.innerHTML="<p>Nieuws laden... (eerste keer 4-7s)</p>"; }
    }
    try{
        const feedPromises=feeds.map(async f=>{ try{ const arts=await fetchRSS(f.url); return {source:f.name,articles:arts}; }catch{ return {source:f.name,articles:[]}; } });
        const [feedResults,gemeente,rtv,oost] = await Promise.all([ Promise.all(feedPromises), fetchGemeenteNieuws(), fetchRTVVechtdalNieuws(), fetchOostNieuws() ]);
        const fresh=[]; feedResults.forEach(r=>r.articles.forEach(a=>fresh.push({...a,source:r.source}))); gemeente.forEach(a=>fresh.push({...a,source:"Gemeente Ommen"})); rtv.forEach(a=>fresh.push({...a,source:"RTV Vechtdal"})); oost.forEach(a=>fresh.push({...a,source:"RTV Oost"}));
        if(fresh.length>0){ allArticles=fresh; finalizeArticles(); saveCache(allArticles); searchNews(); const n=document.getElementById('cache-notice'); if(n) n.remove(); }
    }catch(e){ console.error(e); }
}
function renderArticles(articles){
    const container=document.getElementById("news-container");
    articles.forEach(a=>{ if(a.description) a.description=sanitizeFinal(a.description); });
    let html=`<p><strong>${articles.length} artikelen</strong> <span style="font-weight:400;color:#64748b;font-size:11px;">• ${new Date().toLocaleTimeString('nl-NL',{hour:'2-digit',minute:'2-digit'})}</span></p>`;
    if(articles.length===0) html+="<p>Geen artikelen.</p>";
    else html+=articles.map(article=>{ let timeStr=""; if(article.timestamp){ const d=new Date(article.timestamp); timeStr=d.toLocaleString('nl-NL',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}); } return `<div class="article"><h2><a href="${article.link}" target="_blank" rel="noopener">${article.title}</a></h2><small>${article.source} — ${timeStr}</small><div class="article-content">${article.description}</div></div>`; }).join("");
    container.innerHTML=html;
}
function searchNews(){ const si=document.getElementById("search-input"); const so=document.getElementById("only-ommen"); const zoekterm=si?si.value.toLowerCase().trim():""; const onlyOmmenChecked=so?so.checked:false; let articles=[...allArticles]; if(onlyOmmenChecked) articles=articles.filter(a=>isOmmenNieuws(a)); if(zoekterm!=="") articles=articles.filter(a=>{ const text=(a.title+" "+(a.description||"")).toLowerCase().replace(/<[^>]*>/g," "); return text.includes(zoekterm); }); const gekozenBronnen=Array.from(document.querySelectorAll(".source-filter:checked")).map(b=>b.value); if(gekozenBronnen.length===0){ const c=document.getElementById("news-container"); if(c) c.innerHTML="<p><strong>0 artikelen</strong></p><p>Selecteer bron.</p>"; return; } articles=articles.filter(a=>gekozenBronnen.includes(a.source)); articles.sort((a,b)=>b.timestamp-a.timestamp); renderArticles(articles); }
window.searchNews=searchNews; window.filterNews=searchNews; window.applyFilters=searchNews;
function setupSearch(){ const si=document.getElementById("search-input"); const so=document.getElementById("only-ommen"); if(si) si.addEventListener("input",searchNews); if(so) so.addEventListener("change",searchNews); }
function refreshNews(){ try{ const c=JSON.parse(localStorage.getItem(CACHE_KEY)||'{}'); if(c.ts) c.ts=0; localStorage.setItem(CACHE_KEY,JSON.stringify(c)); }catch{} loadNews(false); }
function saveSelectedSources(){ const all={}; document.querySelectorAll(".source-filter").forEach(cb=>{ all[cb.value]=cb.checked; }); localStorage.setItem(LS_SOURCES_KEY,JSON.stringify(all)); }
function loadSelectedSources(){ try{ const saved=JSON.parse(localStorage.getItem(LS_SOURCES_KEY)||"null"); if(!saved||typeof saved!=='object') return; document.querySelectorAll(".source-filter").forEach(cb=>{ if(saved.hasOwnProperty(cb.value)) cb.checked=saved[cb.value]; }); }catch{} }
function getSelectedSources(){ return Array.from(document.querySelectorAll(".source-filter:checked")).map(cb=>cb.value); }
function setupSources(){ const button=document.getElementById("source-button"); const menu=document.getElementById("source-menu"); if(menu) menu.style.display="none"; loadSelectedSources(); if(!button||!menu) return; button.addEventListener("click", function(){ if(menu.style.display==="none"){ menu.style.display="block"; button.innerHTML="Bronnen ▲"; } else { menu.style.display="none"; button.innerHTML="Bronnen ▼"; } }); document.querySelectorAll(".source-filter").forEach(box=>{ box.addEventListener("change", function(){ saveSelectedSources(); searchNews(); }); }); }
window.addEventListener("DOMContentLoaded", function(){ setupSearch(); setupSources(); loadNews(false); });
