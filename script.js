const PROXIES = [
  'https://ommen-push.leeuw008.workers.dev/proxy?url=',
  'https://corsproxy.io/?',
  'https://api.allorigins.win/raw?url=',
  'https://api.codetabs.com/v1/proxy?quest='
];
const PROXY = PROXIES[0];

async function fetchViaProxy(targetUrl, attempt=0){
  if(attempt>=PROXIES.length) throw new Error('All proxies failed for '+targetUrl);
  const proxyUrl = PROXIES[attempt] + encodeURIComponent(targetUrl);
  try{
    const res = await fetch(proxyUrl);
    if(res.status===429) throw new Error('429');
    if(!res.ok) throw new Error('Proxy '+res.status);
    const text = await res.text();
    if(!text || text.length<100) throw new Error('Empty');
    return text;
  }catch(e){
    await new Promise(r=>setTimeout(r, 300*attempt));
    return fetchViaProxy(targetUrl, attempt+1);
  }
}

// FIX RTV 00:00 - Date.parse snapt geen NL maanden
const NL_MONTHS = {januari:0,februari:1,maart:2,april:3,mei:4,juni:5,juli:6,augustus:7,september:8,oktober:9,november:10,december:11};
function parseDutchDate(str){
  if(!str) return 0;
  let m = str.match(/(\d{1,2})\s+(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\s+(\d{4})[^\d]{0,10}(\d{1,2}):(\d{2})/i);
  if(m){
    const month = NL_MONTHS[m[2].toLowerCase()];
    if(month!==undefined) return new Date(parseInt(m[3]),month,parseInt(m[1]),parseInt(m[4]),parseInt(m[5])).getTime();
  }
  m = str.match(/(\d{1,2})\s+(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\s+(\d{4})/i);
  if(m){
    const month = NL_MONTHS[m[2].toLowerCase()];
    if(month!==undefined) return new Date(parseInt(m[3]),month,parseInt(m[1]),12,0).getTime();
  }
  const ts = Date.parse(str);
  return isNaN(ts)?0:ts;
}


const feeds = [
    { name: 'Ommen City', url: 'https://ommencity.nl/feed/' },
    { name: 'OudOmmen', url: 'https://weblog.oudommen.nl/feed/' },
    { name: 'De Stentor', url: 'https://www.destentor.nl/ommen/rss.xml' }
];

const ommenKeywords = [
    "ommen","arriën","arrien","beerze","beerzerveld","besthmen","diffelen","giethmen","junne","lemele","stegeren","vilsteren","witharen","varsen","ommermars"
];

let allArticles = [];
const MAX_DESC = 380;

// --- PUSH CONFIG - DEFINITIEF VOOR OMMEN ---
const PUSH_WORKER_URL = 'https://ommen-push.leeuw008.workers.dev';
let VAPID_PUBLIC_KEY = null; // wordt automatisch opgehaald

async function getVapidKey(){
  if(VAPID_PUBLIC_KEY) return VAPID_PUBLIC_KEY;
  try{
    const r = await fetch(`${PUSH_WORKER_URL}/vapidPublicKey`);
    if(r.ok){
      const txt = (await r.text()).trim();
      if(txt && txt.length > 20){
        VAPID_PUBLIC_KEY = txt;
        return txt;
      }
    }
  }catch(e){}
  try{
    const r = await fetch(`${PUSH_WORKER_URL}/vapid`);
    const j = await r.json();
    if(j.publicKey){ VAPID_PUBLIC_KEY = j.publicKey; return j.publicKey; }
  }catch(e){ console.error('VAPID ophalen mislukt', e); }
  return null; 
}

const LS_SEEN_KEY = "ommen_nieuws_seen_links";
const LS_SOURCES_KEY = "ommen_selected_sources";

function stripFooters(html) {
    if(!html) return "";
    let txt = html;
    txt = txt.replace(/<p[^>]*>\s*(Het bericht|The post|De post)\s+.*?(verscheen eerst op|appeared first on).*?<\/p>/gis, "");
    txt = txt.replace(/\s*Het bericht.*verscheen eerst op.*?(Ommen City|Vechtdal Centraal|OudOmmen)?\.?\s*(<\/p>)/gi, " $2");
    txt = txt.replace(/\s*The post.*appeared first on.*?(Vechtdal Centraal|Ommen City)?\.?\s*(<\/p>)/gi, " $2");
    txt = txt.replace(/\s*Het bericht[^<]{0,200}verscheen eerst op[^<]{0,200}\./gi, "");
    txt = txt.replace(/\s*The post[^<]{0,200}appeared first on[^<]{0,200}\./gi, "");
    txt = txt.replace(/nl"\s*>.*?(Ommen City|Vechtdal Centraal)\.?/gi, "");
    txt = txt.replace(/"\s*>\s*(Ommen City|Vechtdal Centraal)\.?/gi, "");
    return txt.trim();
}

function cleanHTMLOriginal(html) {
    if(!html) return "";
    html = stripFooters(html);
    const textarea = document.createElement("textarea");
    textarea.innerHTML = html;
    let decoded = textarea.value;
    decoded = stripFooters(decoded);
    const doc = new DOMParser().parseFromString(decoded, "text/html");
    doc.querySelectorAll("script, style, iframe, form, object, embed, link, noscript").forEach(el=>el.remove());
    doc.querySelectorAll("a").forEach(a=>{ a.setAttribute("target","_blank"); a.setAttribute("rel","noopener"); });
    let safe = "";
    doc.body.childNodes.forEach(node=>{
        if(node.nodeType === 3) { if(node.textContent.trim()) safe += node.textContent; }
        else if(["P","BR","STRONG","B","EM","I","U","A","UL","OL","LI","H2","H3","H4","BLOCKQUOTE","DIV","SPAN"].includes(node.tagName)) safe += node.outerHTML;
    });
    if(!safe.trim()) safe = doc.body.innerHTML;
    return stripFooters(safe).trim();
}

function cleanHTML(html, maxLength = MAX_DESC) {
    if(!html) return "";
    html = stripFooters(html);
    const textarea = document.createElement("textarea");
    textarea.innerHTML = html;
    let decoded = textarea.value;
    decoded = stripFooters(decoded);
    const doc = new DOMParser().parseFromString(decoded, "text/html");
    doc.querySelectorAll("script, style, iframe, form, object, embed, link, noscript").forEach(el=>el.remove());
    doc.querySelectorAll("a").forEach(a=>{ a.setAttribute("target","_blank"); a.setAttribute("rel","noopener"); });
    let plainText = doc.body.innerText.replace(/\s+/g," ").trim();
    plainText = stripFooters(plainText);
    if(plainText.length > maxLength) {
        let currentLen = 0; let result = "";
        for(let child of Array.from(doc.body.childNodes)) {
            let textLen = (child.textContent || "").replace(/\s+/g," ").trim().length;
            if(!textLen) continue;
            if(currentLen + textLen > maxLength) {
                let remaining = maxLength - currentLen;
                let cut = child.textContent.substring(0, remaining);
                let lastSpace = cut.lastIndexOf(" ");
                if(lastSpace > 30) cut = cut.substring(0, lastSpace);
                let tag = child.tagName ? child.tagName.toLowerCase() : "";
                if(tag === "a") { let href = child.getAttribute("href") || "#"; result += `<a href="${href}" target="_blank" rel="noopener">${cut.trim()}</a>`; }
                else if(["p","div","span","strong","b","em","i"].includes(tag)) result += `<${tag}>${cut.trim()}</${tag}>`;
                else result += cut.trim();
                break;
            } else { result += child.outerHTML || child.textContent; currentLen += textLen; }
        }
        result = stripFooters(result).trim();
        if(result.endsWith("</p>") || result.endsWith("</div>")) result = result.replace(/<\/(p|div)>$/i, " [...]</$1>");
        if(!result.includes("[...]")) result = result.trim() + " [...]";
        return result;
    }
    let htmlOut = stripFooters(doc.body.innerHTML).trim();
    if(htmlOut && !htmlOut.includes("[...]")) {
        if(htmlOut.endsWith("</p>")) htmlOut = htmlOut.replace(/<\/p>$/i, " [...]</p>");
        else htmlOut = htmlOut.trim() + " [...]";
    }
    return htmlOut;
}

function cleanTextWithEllipsis(text, maxLength = MAX_DESC) {
    if(!text) return "";
    text = text.replace(/\s+/g," ").trim();
    text = stripFooters(text);
    if(text.length > maxLength) { let cut = text.substring(0, maxLength); let lastSpace = cut.lastIndexOf(" "); if(lastSpace > 100) cut = cut.substring(0, lastSpace); return cut.trim() + " [...]"; }
    if(!text.includes("[...]")) return text + " [...]";
    return text;
}

function cleanGemeenteHTML(html, maxLength = 650) {
    if(!html) return "";
    html = stripFooters(html);
    const doc = new DOMParser().parseFromString(html, "text/html");
    doc.querySelectorAll("script, style, iframe, form, object, embed, link, noscript").forEach(el=>el.remove());
    doc.querySelectorAll("a").forEach(a=>{ a.setAttribute("target","_blank"); a.setAttribute("rel","noopener"); });
    let paragraphs = Array.from(doc.querySelectorAll("p")).map(p => p.outerHTML).filter(p => { let txt = p.replace(/<[^>]*>/g,"").trim(); return txt.length > 30 && !txt.includes("verscheen eerst op") && !txt.includes("appeared first on"); });
    if(paragraphs.length === 0) return cleanHTML(html, maxLength);
    let result = ""; let currentLen = 0; let totalLen = paragraphs.join("").replace(/<[^>]*>/g,"").length;
    for(let p of paragraphs) { let textLen = p.replace(/<[^>]*>/g,"").length; if(currentLen + textLen > maxLength && currentLen > 200) break; result += p; currentLen += textLen; if(currentLen >= maxLength) break; }
    result = stripFooters(result);
    if(totalLen > currentLen) { if(result.endsWith("</p>")) result = result.replace(/<\/p>$/i, " [...]</p>"); if(!result.includes("[...]")) result += " [...]"; }
    else if(!result.includes("[...]")) { result = result.replace(/<\/p>$/i, " [...]</p>"); if(!result.includes("[...]")) result += " [...]"; }
    return result;
}

async function fetchRSS(url) {
    try {
        const text = await fetchViaProxy(url);   
        const xml = new DOMParser().parseFromString(text,"text/xml");
        if (xml.querySelector("parsererror")) return [];
        const items = Array.from(xml.getElementsByTagName("item"));
        return items.slice(0,25).map(item => {
            let link = ""; const linkElement = item.querySelector("link");
            if (linkElement) link = linkElement.getAttribute("href") || linkElement.textContent || "";
            const date = item.querySelector("pubDate")?.textContent?.trim() || item.querySelector("published")?.textContent?.trim() || item.querySelector("updated")?.textContent?.trim() || "";
            const timestamp = Date.parse(date);
            const rawDesc = item.querySelector("description, content\\:encoded, summary, content")?.textContent || "";
            const isOudOmmen = url.includes("oudommen");
            return { title: item.querySelector("title")?.textContent?.trim() || "Geen titel", description: isOudOmmen ? cleanHTMLOriginal(rawDesc) : cleanHTML(rawDesc, MAX_DESC), link: link.trim(), timestamp: isNaN(timestamp) ? 0 : timestamp };
        });
    } catch(error) { console.error("RSS ophalen mislukt:", url, error); return []; }
}

async function fetchGemeenteNieuws() {
    const url = "https://www.ommen.nl/actueel/";
    try {
        const res = await fetch(PROXY + encodeURIComponent(url));
        if (!res.ok) throw new Error("Gemeente pagina niet bereikbaar");
        const text = await res.text();
        const html = new DOMParser().parseFromString(text,"text/html");
        const links = [];
        for (const link of html.querySelectorAll("a")) {
            const title = link.querySelector("h3, h2")?.textContent?.trim() || link.textContent.trim();
            const href = link.href;
            if (title && href.includes("/actueel/") && title.length > 10) links.push({ title: title, link: href });
        }
        const artikelen = await Promise.all(links.slice(0,10).map(async artikel => {
            const gegevens = await fetchGemeenteGegevens(artikel.link);
            return { title: artikel.title, link: artikel.link, description: gegevens.tekst, pubDate: gegevens.datum, timestamp: gegevens.datum ? Date.parse(gegevens.datum) : Date.now() };
        }));
        return artikelen;
    } catch(error) { console.error("Fout gemeente Ommen:", error); return []; }
}
async function fetchGemeenteGegevens(url) {
    try {
        const res = await fetch(PROXY + encodeURIComponent(url));
        if (!res.ok) return { datum: "", tekst: "" };
        const text = await res.text();
        const html = new DOMParser().parseFromString(text, "text/html");
        const bodyText = html.body?.innerText || "";
        const match = bodyText.match(/\d{1,2}\s+(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\s+\d{4}(,\s*\d{2}:\d{2})?/i);
        const datum = match ? match[0] : "";
        let contentDiv = html.querySelector("article .content, .text-content, [class*='content'] p");
        let tekst = "";
        if(contentDiv) { let parent = contentDiv.closest("article") || contentDiv.parentElement; tekst = cleanGemeenteHTML(parent ? parent.innerHTML : contentDiv.innerHTML, 650); }
        else { const regels = bodyText.split("\n").map(r=>r.trim()).filter(r=>r.length>40 && !r.includes("HomeActueel")); if(regels.length>0) tekst = cleanTextWithEllipsis(regels.slice(0,3).join(" "), 650); }
        return { datum, tekst };
    } catch(error) { return { datum: "", tekst: "" }; }
}
async function fetchRTVVechtdalNieuws() {
    const url = "https://rtvvechtdal.nl/";
    try {
        const text = await fetchViaProxy(url);
        const html = new DOMParser().parseFromString(text, "text/html");
        const links = [];
        html.querySelectorAll("a").forEach(a => { try { const href = new URL(a.getAttribute("href"), "https://rtvvechtdal.nl").href; const title = a.textContent.trim(); if (href.includes("type=detail") && title.length > 10 && !links.some(l => l.link === href)) links.push({ title, link: href }); } catch {} });
        const artikelen = await Promise.all(links.slice(0,10).map(async artikel => {
            try {
                const text2 = await fetchViaProxy(artikel.link);
                let bodyText = "";
                let datumStr = "";
                try{
                  const doc = new DOMParser().parseFromString(text2,"text/html");
                  // EXACT FIX voor jouw HTML: <time itemprop="datePublished">31 juli 2026</time> en <span title="Gepubliceerd: 31 juli 2026">
                  const timeTag = doc.querySelector('time[itemprop="datePublished"]')?.textContent?.trim();
                  const publishedTitle = doc.querySelector('span.published')?.getAttribute('title')?.replace('Gepubliceerd:', '').trim();
                  const metaDate = doc.querySelector('meta[property="article:published_time"]')?.content;
                  
                  if(timeTag) datumStr = timeTag;
                  else if(publishedTitle) datumStr = publishedTitle;
                  else if(metaDate) {
                    // ISO date fallback
                    const ts = Date.parse(metaDate);
                    if(!isNaN(ts)) return { title: artikel.title, link: artikel.link, description: cleanTextWithEllipsis(doc.body.innerText, MAX_DESC), timestamp: ts };
                  }
                  
                  bodyText = doc.body.innerText.replace(/\s+/g," ").trim();
                  bodyText = bodyText.replace(/^.*?(\d{1,2}\s+(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\s+\d{4})/i, "");
                  bodyText = bodyText.replace(/Home Vechtdal TV.*?Stichting RTV Vechtdal/i, "").trim();
                }catch{}
                // Fallback: zoek in raw HTML als bovenstaande niet werkt
                if(!datumStr){
                  const timeMatch = text2.match(/(\d{1,2})\s+(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\s+\d{4}[^\d]*\d{1,2}:\d{2}/i);
                  const dateMatch = text2.match(/\d{1,2}\s+(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\s+\d{4}/i);
                  if(timeMatch) datumStr = timeMatch[0];
                  else if(dateMatch) datumStr = dateMatch[0];
                }
                const ts = datumStr ? parseDutchDate(datumStr) : Date.now();
                return { title: artikel.title, link: artikel.link, description: cleanTextWithEllipsis(bodyText, MAX_DESC), timestamp: ts || Date.now() };
            } catch(e){ console.error("RTV detail fout", e); return null; }
        }));
        return artikelen.filter(Boolean);
    } catch(error) { console.error("RTV:", error); return []; }
}
async function fetchVechtdalCentraalNieuws() {
    try {
        const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent('https://www.vechtdalcentraal.nl/feed/')}`;
        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error("Vechtdal Centraal fout");
        const data = await response.json();
        if (data.status !== 'ok') throw new Error("rss2json fout");
        return data.items.slice(0,10).map(item => {
            let desc = cleanHTML(item.description, MAX_DESC);
            if(!desc.includes("[...]")) { desc = desc.replace(/<\/p>$/i, " [...]</p>"); if(!desc.includes("[...]")) desc = desc.trim() + " [...]"; }
            return { title: item.title.replace(/&#8217;/g,"'").replace(/&amp;/g,"&"), link: item.link, description: desc, timestamp: Date.parse(item.pubDate) || Date.now() };
        });
    } catch(error) { console.error("Vechtdal Centraal fout:", error); return []; }
}
async function fetchOostNieuws() {
    const url = "https://www.oost.nl/nieuws";
    try {
        const html = await fetchViaProxy(url);
        const doc = new DOMParser().parseFromString(html, "text/html");
        const links = [...doc.querySelectorAll("a")].map(a => a.href).filter(href => href && href.includes("/nieuws/") && /\/nieuws\/\d+\//.test(href)).map(href => href.replace("https://leeuw008-nl.github.io","https://www.oost.nl"));
        const uniek = [...new Set(links)];
        const artikelen = await Promise.all(uniek.slice(0,10).map(link => fetchOostArtikel(link)));
        return artikelen.filter(a=>a!==null);
    } catch(e) { console.error("Oost fout:", e); return []; }
}
async function fetchOostArtikel(url) {
    try {
        const html = await fetchViaProxy(url);
        const doc = new DOMParser().parseFromString(html, "text/html");
        const title = doc.querySelector("h1")?.innerText?.trim() || "RTV Oost";
        let datum = doc.querySelector('meta[property="article:published_time"]')?.content || doc.querySelector('meta[name="date"]')?.content || doc.querySelector("time")?.getAttribute("datetime") || "";
        if (!datum) { const match = doc.body.innerText.match(/\d{1,2}\s+(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\s+\d{4}/i); if (match) datum = match[0]; }
        const contentEl = doc.querySelector("article, .article__content");
        const description = contentEl ? cleanHTML(contentEl.innerHTML, MAX_DESC) : cleanTextWithEllipsis(doc.querySelector('meta[name="description"]')?.content || "", MAX_DESC);
        return { title, link: url, description, timestamp: datum ? Date.parse(datum) : Date.now(), source: "RTV Oost" };
    } catch(e) { return null; }
}

function isOmmenNieuws(article) { const text = (article.title + " " + (article.description || "")).toLowerCase().replace(/<[^>]*>/g," "); return ommenKeywords.some(keyword => text.includes(keyword)); }
function addArticles(artikelen, bron) { artikelen.forEach(article => { allArticles.push({ ...article, source: bron }); }); }
function finalizeArticles() { const seen = new Set(); allArticles = allArticles.filter(article => { if (seen.has(article.link)) return false; seen.add(article.link); return true; }); allArticles.sort((a,b) => b.timestamp - a.timestamp); }

// --- PUSH LOGICA ---
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
    return outputArray;
}

async function subscribePush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) { alert('Push wordt niet ondersteund in deze browser'); return; }
    if (!VAPID_PUBLIC_KEY) { await getVapidKey(); }
    if (!VAPID_PUBLIC_KEY) { alert('VAPID key nog niet beschikbaar - check '+PUSH_WORKER_URL+'/vapidPublicKey'); return; }
    try {
        // FIX: zorg dat er een actieve SW is
        let reg = await navigator.serviceWorker.getRegistration();
        if(!reg){
            reg = await navigator.serviceWorker.register('./service-worker.js', {scope: './'});
        }
        await navigator.serviceWorker.ready;

        if (Notification.permission === 'denied') {
            alert('Meldingen zijn geblokkeerd.\nIn Edge/Chrome: slotje in adresbalk > Meldingen > Toestaan.');
            return;
        }
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') { 
            alert('Geen toestemming ('+permission+')');
            return; 
        }
        const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) });
        const sources = (typeof getSelectedSources === 'function') ? getSelectedSources() : [];
        const payload = Object.assign({}, sub.toJSON(), {sources: sources});
        await fetch(PUSH_WORKER_URL + '/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        localStorage.setItem('ommen_push_subscribed','1');
        updatePushButton();
        alert('Push aan! 🔔 Je krijgt nu meldingen ook als site dicht is.');
    } catch(e){
        console.error(e);
        alert('Push mislukt: ' + e.message + '\n\nTip: doe even Ctrl+Shift+R en probeer opnieuw. Check ook of service-worker.js bereikbaar is.');
    }
}


async function unsubscribePush() {
    const reg = await navigator.serviceWorker.getRegistration();
    if(reg) { const sub = await reg.pushManager.getSubscription(); if(sub) { await fetch(PUSH_WORKER_URL + '/unsubscribe', { method: 'POST', body: JSON.stringify({ endpoint: sub.endpoint }) }); await sub.unsubscribe(); } }
    localStorage.removeItem('ommen_push_subscribed');
    updatePushButton();
}

function updatePushButton() {
    const btn = document.getElementById('push-toggle');
    if(!btn) return;
    const isOn = localStorage.getItem('ommen_push_subscribed')==='1';
    if(isOn) { 
        btn.textContent='🔔'; 
        btn.style.background='#d4edda'; 
        btn.style.borderColor='#a3d9a5';
        btn.title='Push aan - klik om uit te zetten';
    } else { 
        btn.textContent='🔕'; 
        btn.style.background='#ffffff'; 
        btn.style.borderColor='#ccc';
        btn.title='Push uit - klik om aan te zetten';
    }
}

function ensureBanner() {
    if(document.getElementById('new-articles-banner')) return;
    const style = document.createElement('style');
    style.textContent = `#new-articles-banner{position:sticky;top:0;z-index:999;background:#ffcc00;color:#000;padding:10px 14px;border-radius:6px;margin:10px 0;display:none;align-items:center;justify-content:space-between;gap:10px;font-weight:600}
        #new-articles-banner button{border:none;padding:6px 12px;border-radius:4px;cursor:pointer}`;
    document.head.appendChild(style);
    const banner = document.createElement('div');
    banner.id='new-articles-banner';
    banner.innerHTML=`<span id="new-articles-text"></span><span><button id="banner-reload">Vernieuwen</button><button id="banner-close" style="background:transparent">✕</button></span>`;
    const container = document.getElementById('news-container');
    if(container?.parentNode) container.parentNode.insertBefore(banner, container);
    document.getElementById('banner-reload').onclick=()=>{banner.style.display='none'; refreshNews();};
    document.getElementById('banner-close').onclick=()=>banner.style.display='none';
}

function getSeenLinks(){ try{ return new Set(JSON.parse(localStorage.getItem(LS_SEEN_KEY)||"[]")); }catch{ return new Set(); } }
function saveSeenLinks(links){ localStorage.setItem(LS_SEEN_KEY, JSON.stringify([...links].slice(0,200))); }
function checkForNewArticles(currentArticles){
    const seen = getSeenLinks();
    if(seen.size===0){ saveSeenLinks(new Set(currentArticles.map(a=>a.link))); return; }
    const newOnes = currentArticles.filter(a=>!seen.has(a.link));
    if(newOnes.length>0){
        ensureBanner();
        const banner = document.getElementById('new-articles-banner');
        const txt = document.getElementById('new-articles-text');
        if(banner&&txt){ txt.textContent=`🔔 ${newOnes.length} nieuw artikel${newOnes.length>1?'en':''}: ${newOnes[0].title}`; banner.style.display='flex'; }
        saveSeenLinks(new Set([...seen, ...newOnes.map(a=>a.link)]));
    }
}

async function loadNews(isBackground=false) {
    const container = document.getElementById("news-container");
    if(!isBackground) container.innerHTML = "<p>Nieuws laden...</p>";
    allArticles = [];
    const results = await Promise.all(feeds.map(async feed => ({ source: feed.name, articles: await fetchRSS(feed.url) })));
    results.forEach(result => { addArticles(result.articles, result.source); });
    const [gemeenteArtikelen, rtvArtikelen, oostArtikelen, vechtdalCentraalArtikelen] = await Promise.all([fetchGemeenteNieuws(), fetchRTVVechtdalNieuws(), fetchOostNieuws(), fetchVechtdalCentraalNieuws()]);
    addArticles(gemeenteArtikelen, "Gemeente Ommen"); addArticles(rtvArtikelen, "RTV Vechtdal"); addArticles(oostArtikelen, "RTV Oost"); addArticles(vechtdalCentraalArtikelen, "Vechtdal Centraal");
    finalizeArticles();
    if(isBackground) checkForNewArticles(allArticles);
    else { searchNews(); setTimeout(()=>checkForNewArticles(allArticles),800); }
}

function renderArticles(articles) {
    const container = document.getElementById("news-container");
    let html = `<p><strong>${articles.length} artikelen gevonden</strong></p>`;
    if (articles.length === 0) html += "<p>Geen artikelen gevonden.</p>";
    else html += articles.map(article => {
        let timeStr = "";
        if(article.timestamp){
            const d = new Date(article.timestamp);
            const h = d.getHours(); const m = d.getMinutes();
            // Als tijd 00:00 of 12:00 fallback is, toon alleen datum (geen 00:00 meer)
            if((h===0 && m===0) || (h===12 && m===0 && article.source==="RTV Vechtdal")){
                timeStr = d.toLocaleString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' });
            } else {
                timeStr = d.toLocaleString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
            }
        }
        return `<div class="article"><h2><a href="${article.link}" target="_blank" rel="noopener">${article.title}</a></h2><small>${article.source} — ${timeStr}</small><div class="article-content">${article.description}</div></div>`;
    }).join("");
    container.innerHTML = html;
}
function searchNews() {
    const searchInput = document.getElementById("search-input");
    const alleenOmmen = document.getElementById("only-ommen");
    const zoekterm = searchInput ? searchInput.value.toLowerCase().trim() : "";
    const onlyOmmenChecked = alleenOmmen ? alleenOmmen.checked : false;
    let articles = [...allArticles];
    if (onlyOmmenChecked) articles = articles.filter(article => isOmmenNieuws(article));
    if (zoekterm !== "") articles = articles.filter(article => { const text = (article.title + " " + (article.description||"")).toLowerCase().replace(/<[^>]*>/g," "); return text.includes(zoekterm); });
    const gekozenBronnen = Array.from(document.querySelectorAll(".source-filter:checked")).map(box => box.value);
    if(gekozenBronnen.length>0) articles = articles.filter(article => gekozenBronnen.includes(article.source));
    articles.sort((a,b) => b.timestamp - a.timestamp);
    renderArticles(articles);
}
function setupSearch() {
    const searchInput = document.getElementById("search-input");
    const switchOmmen = document.getElementById("only-ommen");
    if(searchInput) searchInput.addEventListener("input", searchNews);
    if (switchOmmen) switchOmmen.addEventListener("change", function() { searchNews(); });
}
function refreshNews() { loadNews(false); }
function saveSelectedSources(){
    const selected = Array.from(document.querySelectorAll(".source-filter:checked")).map(cb=>cb.value);
    localStorage.setItem(LS_SOURCES_KEY, JSON.stringify(selected));
    updatePushPreferences();
}
function loadSelectedSources(){
    try{
        const saved = JSON.parse(localStorage.getItem(LS_SOURCES_KEY)||"null");
        if(!saved || !Array.isArray(saved) || saved.length===0) return;
        document.querySelectorAll(".source-filter").forEach(cb=>{
            cb.checked = saved.includes(cb.value);
        });
    }catch(e){}
}
function getSelectedSources(){
    return Array.from(document.querySelectorAll(".source-filter:checked")).map(cb=>cb.value);
}
async function updatePushPreferences(){
    if(localStorage.getItem('ommen_push_subscribed')!=='1') return;
    try{
        const reg = await navigator.serviceWorker.getRegistration();
        if(!reg) return;
        const sub = await reg.pushManager.getSubscription();
        if(!sub) return;
        const sources = getSelectedSources();
        await fetch(PUSH_WORKER_URL + '/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({...sub.toJSON(), sources: sources})
        });
    }catch(e){}
}
function setupSources() {
    const button = document.getElementById("source-button");
    const menu = document.getElementById("source-menu");
    if(menu) menu.style.display = "none";
    loadSelectedSources();
    if (!button || !menu) return;
    button.addEventListener("click", function() { if (menu.style.display === "none") { menu.style.display = "block"; button.innerHTML = "Bronnen ▲"; } else { menu.style.display = "none"; button.innerHTML = "Bronnen ▼"; } });
    document.querySelectorAll(".source-filter").forEach(box => {
        box.addEventListener("change", function() { saveSelectedSources(); searchNews(); });
    });
}
function injectPushButton(){
    if(document.getElementById('push-toggle')) return;
    const bronnenBtn = document.getElementById('source-button');
    const parent = bronnenBtn?.parentElement || document.getElementById('search-input')?.parentElement || document.querySelector('header');
    if(!parent) return;
    const btn = document.createElement('button');
    btn.id='push-toggle';
    btn.style.cssText='margin-left:8px;padding:7px 11px;border-radius:20px;border:1px solid #ccc;cursor:pointer;font-size:18px;line-height:1;background:#fff;vertical-align:middle;';
    btn.onclick = async ()=>{
        if(localStorage.getItem('ommen_push_subscribed')==='1') await unsubscribePush();
        else await subscribePush();
    };
    if(bronnenBtn){
        bronnenBtn.insertAdjacentElement('afterend', btn);
    } else {
        parent.appendChild(btn);
    }
    updatePushButton();
}
window.addEventListener("DOMContentLoaded", function() {
    setupSearch(); setupSources(); ensureBanner(); injectPushButton(); loadNews(false);
});
