// news.js v214 - FIX alleen RTV Oost, RTV Vechtdal, Vechtdal Centraal - rest v213 intact
const PROXIES = [
  'https://ommen-push-v2.leeuw008.workers.dev/proxy?url=',
  'https://corsproxy.io/?',
  'https://api.allorigins.win/raw?url=',
  'https://api.codetabs.com/v1/proxy?quest='
];
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
async function fetchWithTimeout(url, ms=8000){ const c=new AbortController(); const t=setTimeout(()=>c.abort(),ms); try{ const r=await fetch(url,{signal:c.signal}); clearTimeout(t); return r; }catch(e){ clearTimeout(t); throw e; } }
async function fetchViaProxy(targetUrl, attempt=0){
  if(attempt>=PROXIES.length) throw new Error('All proxies failed');
  const proxyUrl = PROXIES[attempt] + encodeURIComponent(targetUrl);
  try{
    const res = await fetchWithTimeout(proxyUrl);
    if(!res.ok) throw new Error('Proxy '+res.status);
    const text = await res.text();
    if(!text || text.length<100) throw new Error('Empty');
    return text;
  }catch(e){ await new Promise(r=>setTimeout(r, 300*attempt)); return fetchViaProxy(targetUrl, attempt+1); }
}
function loadCache(){ try{ const raw=localStorage.getItem(CACHE_KEY); if(!raw) return null; const obj=JSON.parse(raw); if(Date.now()-obj.ts>CACHE_TTL) return null; return obj.articles; }catch{ return null; } }
function saveCache(a){ try{ localStorage.setItem(CACHE_KEY, JSON.stringify({ts:Date.now(), articles:a.slice(0,100)})); }catch{} }
function stripFooters(html){ if(!html) return ""; return html.replace(/<p[^>]*>\s*(Het bericht|The post|De post)\s+.*?(verscheen eerst op|appeared first on).*?<\/p>/gis,""); }
function sanitizeFinal(text){
    if(!text) return " [...]";
    let d = String(text);
    d = d.replace(/\[[^\]]*\]/g, ' ');
    d = d.replace(/&hellip;/gi, ' ');
    d = d.replace(/…/g, ' ');
    d = d.replace(/\s*\.\.\.\s*/g, ' ');
    d = d.trim().replace(/\s{2,}/g, ' ').trim();
    if(!d.endsWith('[...]')) d += ' [...]';
    return d;
}
function cleanHTML(html, maxLength=MAX_DESC){
    if(!html) return "";
    html=stripFooters(html);
    const ta=document.createElement("textarea"); ta.innerHTML=html;
    let dec=ta.value;
    const doc=new DOMParser().parseFromString(dec,"text/html");
    doc.querySelectorAll("script, style, iframe").forEach(el=>el.remove());
    let plain=doc.body.innerText.replace(/\s+/g," ").trim();
    plain = plain.replace(/\[[^\]]*\]/g, ' ').replace(/\s{2,}/g,' ').trim();
    if(plain.length>maxLength){
        let cut=plain.substring(0,maxLength);
        let ls=cut.lastIndexOf(" ");
        if(ls>60) cut=cut.substring(0,ls);
        return sanitizeFinal(cut);
    }
    return sanitizeFinal(plain);
}
function cleanHTMLOriginal(html){
    if(!html) return "";
    const ta=document.createElement("textarea"); ta.innerHTML=html;
    let dec = ta.value.replace(/\[[^\]]*\]/g, ' ').replace(/\s{2,}/g,' ').trim();
    return sanitizeFinal(dec);
}
async function fetchRSS(url, limit=10){
  try{
    const text=await fetchViaProxy(url); if(!text) return [];
    const xml=new DOMParser().parseFromString(text,"text/xml"); if(xml.querySelector("parsererror")) return [];
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

// --- FIX 3 BRONNEN ---
async function fetchRTVVechtdalNieuws(){
  try{
    const rss = await fetchRSS('https://rtvve
