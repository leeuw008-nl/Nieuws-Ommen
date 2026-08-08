/* Nieuw(s)Ommen v111 - FIX artikelen terug + bel + [ ] [...] */
const PROXIES = [
  'https://ommen-push.leeuw008.workers.dev/proxy?url=',
  'https://corsproxy.io/?',
  'https://api.allorigins.win/raw?url=',
  'https://api.codetabs.com/v1/proxy?quest='
];
const PROXY = PROXIES[0];
const FETCH_TIMEOUT = 8000;
const CACHE_KEY = 'ommen_cache_v111';
const CACHE_TTL = 10*60*1000;
async function fetchWithTimeout(url){ const c=new AbortController(); const t=setTimeout(()=>c.abort(),FETCH_TIMEOUT); try{ const r=await fetch(url,{signal:c.signal}); clearTimeout(t); return r; }catch(e){ clearTimeout(t); throw e; } }
async function fetchViaProxy(targetUrl, attempt=0){
  if(attempt>=PROXIES.length) throw new Error('All proxies failed for '+targetUrl);
  const proxyUrl = PROXIES[attempt] + encodeURIComponent(targetUrl);
  try{
    const res = await fetchWithTimeout(proxyUrl);
    if(res.status===429) throw new Error('429');
    if(!res.ok) throw new Error('Proxy '+res.status);
    const text = await res.text();
    if(!text || text.length<80) throw new Error('Empty');
    return text;
  }catch(e){
    await new Promise(r=>setTimeout(r, 400*attempt));
    return fetchViaProxy(targetUrl, attempt+1);
  }
}
function loadCache(){ try{ const raw=localStorage.getItem(CACHE_KEY); if(!raw) return null; const obj=JSON.parse(raw); if(Date.now()-obj.ts>CACHE_TTL) return null; return obj.articles; }catch{ return null; } }
function saveCache(a){ try{ localStorage.setItem(CACHE_KEY, JSON.stringify({ts:Date.now(), articles:a.slice(0,100)})); }catch{} }
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
    let d = String(text);
    d = d.replace(/\[\s*\.\.\.\s*\]/g, ' ');
    d = d.replace(/\[\s*…\s*\]/g, ' ');
    d = d.replace(/\[&hellip;\]/gi, ' ');
    d = d.replace(/&hellip;/gi, ' ');
    d = d.replace(/…/g, ' ');
    d = d.replace(/\s*\.\.\.\s*/g, ' ');
    d = d.replace(/\[\s*\]/g, ' ');
    d = d.replace(/\s+/g, ' ').trim();
    if(/<\/p>\s*$/i.test(d)) d = d.replace(/<\/p>\s*$/i, ' [...]</p>');
    else if(/<\/div>\s*$/i.test(d)) d = d.replace(/<\/div>\s*$/i, ' [...]</div>');
    else d = d + ' [...]';
    d = d.replace(/(\s*\[...\]\s*){2,}/g, ' [...]');
    return d;
}
function cleanHTMLOriginal(html){ if(!html) return ""; html=stripFooters(html); const ta=document.createElement("textarea"); ta.innerHTML=html; let dec=ta.value; const doc=new DOMParser().parseFromString(dec,"text/html"); doc.querySelectorAll("script, style, iframe").forEach(el=>el.remove()); return sanitizeFinal(doc.body.innerHTML); }
function cleanHTML(html, maxLength=MAX_DESC){ if(!html) return ""; html=stripFooters(html); const ta=document.createElement("textarea"); ta.innerHTML=html; let dec=ta.value; const doc=new DOMParser().parseFromString(dec,"text/html"); doc.querySelectorAll("script, style, iframe").forEach(el=>el.remove()); let plain=doc.body.innerText.replace(/\s+/g," ").trim(); if(plain.length>maxLength){ let cut=plain.substring(0,maxLength); let ls=cut.lastIndexOf(" "); if(ls>60) cut=cut.substring(0,ls); return sanitizeFinal(cut); } return sanitizeFinal(doc.body.innerHTML); }
function cleanTextWithEllipsis(text, maxLength=MAX_DESC){ if(!text) return ""; text=text.replace(/\s+/g," ").trim(); if(text.length>maxLength){ let cut=text.substring(0,maxLength); let ls=cut.lastIndexOf(" "); if(ls>60) cut=cut.substring(0,ls); return sanitizeFinal(cut); } return sanitizeFinal(text); }
function cleanGemeenteHTML(html, maxLength=650){ if(!html) return ""; html=stripFooters(html); const doc=new DOMParser().parseFromString(html,"text/html"); let paras=Array.from(doc.querySelectorAll("p")).map(p=>p.outerHTML).filter(p=>{ let txt=p.replace(/<[^>]*>/g,"").trim(); return txt.length>30; }); if(paras.length===0) return cleanHTML(html,maxLength); return sanitizeFinal(paras.slice(0,3).join("")); }

async function fetchRSS(url){
    try {
        const feedConfig = feeds.find(f => f.url === url);
        const keywords = feedConfig?.filterKeywords?.map(k => k.toLowerCase()) || null;
        let articles = [];
        // Vechtdal Centraal & Salland Centraal: probeer rss2json eerst (stabieler)
        const useRss2JsonFirst = url.includes("vechtdalcentraal") || url.includes("sallandcentraal");
        if (useRss2JsonFirst){
            try {
                const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(url)}`;
                const res = await fetch(apiUrl);
                const data = await res.json();
                if (data.status === 'ok' && data.items && data.items.length>0) {
                    articles = data.items.slice(0,25).map(item => ({
                        title: item.title,
                        link: item.link,
                        description: cleanHTML(item.description, MAX_DESC),
                        timestamp: Date.parse(item.pubDate) || Date.now(),
                        _searchText: (item.title + " " + item.description).toLowerCase()
                    }));
                    console.log(url + " via rss2json: " + articles.length);
                }
            } catch(e){ console.warn("rss2json fail", url, e); }
        }
        if(articles.length===0){
            const text = await fetchViaProxy(url);
            if (!text) return [];
            const xml = new DOMParser().parseFromString(text,"text/xml");
            if (xml.querySelector("parsererror")) return articles.length?articles:[];
            const items = Array.from(xml.getElementsByTagName("item"));
            articles = items.slice(0,25).map(item => {
                let link = "";
                const linkElement = item.querySelector("link");
                if (linkElement) link = linkElement.getAttribute("href") || linkElement.textContent || "";
                const date = item.querySelector("pubDate")?.textContent?.trim() || "";
                const timestamp = Date.parse(date);
                const rawDesc = item.querySelector("description")?.textContent || "";
                const isOudOmmen = url.includes("oudommen");
                return {
                    title: item.querySelector("title")?.textContent?.trim() || "Geen titel",
                    description: isOudOmmen ? cleanHTMLOriginal(rawDesc) : cleanHTML(rawDesc, MAX_DESC),
                    link: link.trim(),
                    timestamp: isNaN(timestamp) ? 0 : timestamp,
                    _searchText: (item.querySelector("title")?.textContent + " " + rawDesc).toLowerCase()
                };
            });
        }
        if (keywords && keywords.length > 0) {
            const before = articles.length;
            articles = articles.filter(a => keywords.some(k => a._searchText.includes(k)));
            console.log(`${feedConfig.name}: ${before} -> ${articles.length} na filter [${keywords.join(", ")}]`);
        }
        return articles.map(({_searchText, ...rest}) => rest);
    } catch(error) {
        console.error("RSS ophalen mislukt:", url, error);
        return [];
    }
}


function ensureBanner(){ if(document.getElementById('new-articles-banner')) return; const style=document.createElement('style'); style.textContent=`#new-articles-banner{position:sticky;top:0;z-index:999;background:#ffcc00;color:#000;padding:10px 14px;border-radius:6px;margin:10px 0;display:none;align-items:center;justify-content:space-between;gap:10px;font-weight:600;cursor:pointer} #new-articles-banner button{border:none;padding:6px 12px;border-radius:4px;cursor:pointer}`; document.head.appendChild(style); const banner=document.createElement('div'); banner.id='new-articles-banner'; banner.innerHTML=`<span id="new-articles-text" style="flex:1"></span><span><button id="banner-view">Bekijken</button><button id="banner-close" style="background:transparent">✕</button></span>`; const container=document.getElementById('news-container'); if(container?.parentNode) container.parentNode.insertBefore(banner,container); }
function getSeenLinks(){ try{ return new Set(JSON.parse(localStorage.getItem(LS_SEEN_KEY)||"[]")); }catch{ return new Set(); } }
function saveSeenLinks(links){ localStorage.setItem(LS_SEEN_KEY, JSON.stringify([...links].slice(0,300))); }
async function loadNews(isBackground=false){
    const container=document.getElementById("news-container");
    const isFirst=!isBackground && allArticles.length===0;
    if(isFirst){
        const cached=loadCache();
        if(cached && cached.length>0){ allArticles=cached; searchNews(); container.insertAdjacentHTML('afterbegin', `<div id="cache-notice" style="font-size:11px;color:#64748b;padding:4px 0;">⚡ cache • verversen...</div>`); }
        else { container.innerHTML="<p>Nieuws laden... (eerste keer 4-7s)</p>"; }
    }
    try{
        const feedPromises=feeds.map(async f=>{ try{ const arts=await fetchRSS(f.url); return {source:f.name,articles:arts}; }catch{ return {source:f.name,articles:[]}; } });
        const [feedResults,gemeente,rtv,oost] = await Promise.all([ Promise.all(feedPromises), fetchGemeenteNieuws(), fetchRTVVechtdalNieuws(), fetchOostNieuws() ]);
        const fresh=[]; feedResults.forEach(r=>r.articles.forEach(a=>fresh.push({...a,source:r.source}))); gemeente.forEach(a=>fresh.push({...a,source:"Gemeente Ommen"})); rtv.forEach(a=>fresh.push({...a,source:"RTV Vechtdal"})); oost.forEach(a=>fresh.push({...a,source:"RTV Oost"}));
        if(fresh.length>0){ allArticles=fresh; finalizeArticles(); saveCache(allArticles); searchNews(); const n=document.getElementById('cache-notice'); if(n) n.remove(); } else { // behoud cache als fetch faalt
            const cached=loadCache(); if(cached && allArticles.length===0){ allArticles=cached; searchNews(); }
        }
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
function searchNews(){
    const si=document.getElementById("search-input"); const so=document.getElementById("only-ommen");
    const zoekterm=si?si.value.toLowerCase().trim():""; const onlyOmmenChecked=so?so.checked:false;
    let articles=[...allArticles];
    if(onlyOmmenChecked) articles=articles.filter(a=>isOmmenNieuws(a));
    if(zoekterm!=="") articles=articles.filter(a=>{ const text=(a.title+" "+(a.description||"")).toLowerCase().replace(/<[^>]*>/g," "); return text.includes(zoekterm); });
    const gekozenBronnen=Array.from(document.querySelectorAll(".source-filter:checked")).map(b=>b.value);
    if(gekozenBronnen.length===0){ const c=document.getElementById("news-container"); if(c) c.innerHTML="<p><strong>0 artikelen</strong></p><p>Selecteer bron.</p>"; return; }
    articles=articles.filter(a=>gekozenBronnen.includes(a.source));
    try{ const raw=localStorage.getItem('nieuwsommen_bronnen_v2'); if(raw){ const state=JSON.parse(raw); const todayStart=new Date(); todayStart.setHours(0,0,0,0); const todayEnd=new Date(); todayEnd.setHours(23,59,59,999); articles=articles.filter(a=>{ const cfg=state[a.source]; if(!cfg) return true; if(cfg.scope==='gemeente'){ if(a.source!=='Gemeente Ommen' &&!isOmmenNieuws(a)) return false; } if(cfg.vandaag){ const ts=a.timestamp||0; if(!ts) return true; if(ts < todayStart.getTime() || ts > todayEnd.getTime()) return false; } return true; }); } }catch{}
    articles.sort((a,b)=>b.timestamp-a.timestamp);
    renderArticles(articles);
}
window.searchNews=searchNews; window.filterNews=searchNews; window.applyFilters=searchNews;
function setupSearch(){ const si=document.getElementById("search-input"); const so=document.getElementById("only-ommen"); if(si) si.addEventListener("input",searchNews); if(so) so.addEventListener("change",searchNews); }
function searchNews(){ try{ const c=JSON.parse(localStorage.getItem(CACHE_KEY)||'{}'); if(c.ts) c.ts=0; localStorage.setItem(CACHE_KEY,JSON.stringify(c)); }catch{} loadNews(false); }
function saveSelectedSources(){ try{ const v2raw=localStorage.getItem('nieuwsommen_bronnen_v2'); if(v2raw){ const v2=JSON.parse(v2raw); document.querySelectorAll(".source-filter").forEach(cb=>{ if(v2[cb.value]) v2[cb.value].aan=cb.checked; }); localStorage.setItem('nieuwsommen_bronnen_v2',JSON.stringify(v2)); } }catch{} const all={}; document.querySelectorAll(".source-filter").forEach(cb=>{ all[cb.value]=cb.checked; }); localStorage.setItem(LS_SOURCES_KEY,JSON.stringify(all)); }
function loadSelectedSources(){ try{ const v2raw=localStorage.getItem('nieuwsommen_bronnen_v2'); if(v2raw){ const v2=JSON.parse(v2raw); document.querySelectorAll(".source-filter").forEach(cb=>{ if(v2[cb.value] && typeof v2[cb.value].aan==='boolean') cb.checked=v2[cb.value].aan; }); return; } const saved=JSON.parse(localStorage.getItem(LS_SOURCES_KEY)||"null"); if(!saved||typeof saved!=='object') return; document.querySelectorAll(".source-filter").forEach(cb=>{ if(saved.hasOwnProperty(cb.value)) cb.checked=saved[cb.value]; }); }catch{} }
function getSelectedSources(){ return Array.from(document.querySelectorAll(".source-filter:checked")).map(cb=>cb.value); }
function setupSources(){ const button=document.getElementById("source-button"); const menu=document.getElementById("source-menu"); if(menu) menu.style.display="none"; loadSelectedSources(); if(!button||!menu) return; button.addEventListener("click", function(){ if(menu.style.display==="none"){ menu.style.display="block"; button.innerHTML="Bronnen ▲"; } else { menu.style.display="none"; button.innerHTML="Bronnen ▼"; } }); document.querySelectorAll(".source-filter").forEach(box=>{ box.addEventListener("change", function(){ saveSelectedSources(); searchNews(); }); }); }
window.addEventListener("DOMContentLoaded", function(){ setupSearch(); setupSources(); ensureBanner(); injectPushButton(); loadNews(false); setTimeout(injectPushButton,500); setTimeout(injectPushButton,1500); });

function refreshNews(){ loadNews(false); }
