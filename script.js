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
async function fetchRSS(url){ try{ const text=await fetchViaProxy(url); if(!text) return []; const xml=new DOMParser().parseFromString(text,"text/xml"); if(xml.querySelector("parsererror")) return []; const items=Array.from(xml.getElementsByTagName("item")); return items.slice(0,12).map(item=>{ let link=""; const le=item.querySelector("link"); if(le) link=le.getAttribute("href")||le.textContent||""; const date=item.querySelector("pubDate")?.textContent?.trim()||""; const ts=Date.parse(date); const rawDesc=item.querySelector("description")?.textContent||""; const isOud=url.includes("oudommen"); return { title:item.querySelector("title")?.textContent?.trim()||"Geen titel", description:isOud?cleanHTMLOriginal(rawDesc):cleanHTML(rawDesc,MAX_DESC), link:link.trim(), timestamp:isNaN(ts)?0:ts }; }); }catch{ return []; } }
async function fetchGemeenteNieuws(){ const url="https://www.ommen.nl/actueel/"; try{ const text=await fetchViaProxy(url); const html=new DOMParser().parseFromString(text,"text/html"); const links=[]; for(const a of html.querySelectorAll("a")){ const title=a.querySelector("h3, h2")?.textContent?.trim()||a.textContent.trim(); const href=a.href; if(title && href.includes("/actueel/") && title.length>10 && links.length<5) links.push({title,link:href}); } const results=await Promise.allSettled(links.map(l=>fetchGemeenteGegevens(l.link))); return results.map((r,i)=>{ if(r.status==='fulfilled'&&r.value) return {title:links[i].title,link:links[i].link,description:r.value.tekst,timestamp:r.value.datum?Date.parse(r.value.datum):Date.now()}; return null; }).filter(Boolean); }catch{ return []; } }
async function fetchGemeenteGegevens(url){ try{ const text=await fetchViaProxy(url); const html=new DOMParser().parseFromString(text,"text/html"); const bodyText=html.body?.innerText||""; const m=bodyText.match(/\d{1,2}\s+(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\s+\d{4}/i); const datum=m?m[0]:""; let contentDiv=html.querySelector("article .content, .text-content, [class*='content'] p"); let tekst=""; if(contentDiv){ let parent=contentDiv.closest("article")||contentDiv.parentElement; tekst=cleanGemeenteHTML(parent?parent.innerHTML:contentDiv.innerHTML,650); } else { const regels=bodyText.split("\n").map(r=>r.trim()).filter(r=>r.length>40); if(regels.length>0) tekst=cleanTextWithEllipsis(regels.slice(0,2).join(" "),650); } return {datum,tekst}; }catch{ return {datum:"",tekst:""}; } }
async function fetchRTVVechtdalNieuws(){
  const apiUrl="https://www.vechtdalleeft.nl/wp-json/wp/v2/posts?per_page=15&_embed";
  try{
    for(let i=0;i<PROXIES.length;i++){
      try{
        const r=await fetch(PROXIES[i]+encodeURIComponent(apiUrl));
        if(!r.ok) continue;
        const t=await r.text();
        if(t && t.length>200 && t.includes('"title"')){
          const data=JSON.parse(t);
          console.log("[RTV] JSON OK via proxy "+i+" : "+data.length);
          return data.map(item=>{
            let raw=item.excerpt?.rendered || item.content?.rendered || "";
            try{ const low=raw.toLowerCase(); const pos=low.indexOf("stichting rtv vechtdal"); if(pos!==-1 && pos<600) raw=raw.substring(pos+22); }catch{}
            let ts=0; const c=item.date_gmt||item.date; if(c){ const d=new Date(c); if(!isNaN(d.getTime())) ts=d.getTime(); }
            if(!ts) ts=Date.now();
            return {title:(item.title?.rendered||"").replace(/<[^>]*>/g,"").trim(), link:item.link, description:cleanHTML(raw, MAX_DESC), timestamp:ts};
          });
        }
      }catch(e){}
    }
  }catch(e){}
  try{
    const rss="https://www.vechtdalleeft.nl/feed/";
    const api="https://api.rss2json.com/v1/api.json?rss_url="+encodeURIComponent(rss);
    const r=await fetch(api);
    const j=await r.json();
    if(j.status==='ok' && j.items && j.items.length>0){
      console.log("[RTV] RSS rss2json OK "+j.items.length);
      return j.items.slice(0,12).map(it=>({title:it.title, link:it.link, description:cleanHTML(it.description, MAX_DESC), timestamp:Date.parse(it.pubDate)||Date.now()}));
    }
  }catch(e){}
  console.error("[RTV] alle methodes faalden");
  return [];
}


async function fetchVechtdalCentraalNieuws(){
  const feedUrl='https://www.vechtdalcentraal.nl/feed/';
  try{
    const api='https://api.rss2json.com/v1/api.json?rss_url='+encodeURIComponent(feedUrl);
    const r=await fetch(api);
    const data=await r.json();
    if(data.status==='ok' && data.items && data.items.length>0){
      console.log("[VC] rss2json OK "+data.items.length);
      return data.items.slice(0,12).map(item=>{
        let desc=cleanHTML(item.description, MAX_DESC);
        if(!desc.includes("[...]")) desc=desc.replace(/<\/p>$/i," [...]</p>");
        return {title:item.title.replace(/&#8217;/g,"'").replace(/&amp;/g,"&"), link:item.link, description:desc, timestamp:Date.parse(item.pubDate)||Date.now()};
      });
    }
  }catch(e){}
  try{
    const txt=await fetchViaProxy(feedUrl);
    if(txt){
      const xml=new DOMParser().parseFromString(txt,"text/xml");
      const items=Array.from(xml.getElementsByTagName("item"));
      if(items.length>0){
        console.log("[VC] proxy XML OK "+items.length);
        return items.slice(0,12).map(it=>({title:it.querySelector("title")?.textContent||"VC", link:it.querySelector("link")?.textContent||"", description:cleanHTML(it.querySelector("description")?.textContent||"", MAX_DESC), timestamp:Date.parse(it.querySelector("pubDate")?.textContent||"")||Date.now()}));
      }
    }
  }catch(e){}
  console.error("[VC] alle methodes faalden");
  return [];
}



