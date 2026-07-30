const PROXY = 'https://corsproxy.io/?';

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

// --- PUSH CONFIG ---
const PUSH_WORKER_URL = 'https://ommen-push.leeuw008.workers.dev';
let VAPID_PUBLIC_KEY = null;

async function getVapidKey(){
  if(VAPID_PUBLIC_KEY) return VAPID_PUBLIC_KEY;
  try{
    const r = await fetch(`${PUSH_WORKER_URL}/vapid`);
    const j = await r.json();
    VAPID_PUBLIC_KEY = j.publicKey;
    return VAPID_PUBLIC_KEY;
  }catch(e){ console.error('VAPID ophalen mislukt', e); return null; }
}

const LS_SEEN_KEY = "ommen_nieuws_seen_links";

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
        const response = await fetch(PROXY + encodeURIComponent(url));
        if (!response.ok) throw new Error("RSS fout");
        const text = await response.text();   
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
        const res = await fetch(PROXY + encodeURIComponent(url));
        const text = await res.text();
        const html = new DOMParser().parseFromString(text, "text/html");
        const links = [];
        html.querySelectorAll("a").forEach(a => { try { const href = new URL(a.getAttribute("href"), "https://rtvvechtdal.nl").href; const title = a.textContent.trim(); if (href.includes("type=detail") && title.length > 10 && !links.some(l => l.link === href)) links.push({ title, link: href }); } catch {} });
        const artikelen = await Promise.all(links.slice(0,10).map(async artikel => {
            try {
                const res2 = await fetch(PROXY + encodeURIComponent(artikel.link));
                const text2 = await res2.text();
                const doc = new DOMParser().parseFromString(text2,"text/html");
                let bodyText = doc.body.innerText.replace(/\s+/g," ").trim();
                bodyText = bodyText.replace(/^.*?(\d{1,2}\s+(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\s+\d{4})/i, "");
                bodyText = bodyText.replace(/Home Vechtdal TV.*?Stichting RTV Vechtdal/i, "").trim();
                const match = text2.match(/\d{1,2}\s+(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\s+\d{4}/i);
                const datum = match ? match[0] : "";
                return { title: artikel.title, link: artikel.link, description: cleanTextWithEllipsis(bodyText, MAX_DESC), timestamp: datum ? Date.parse(datum) : Date.now() };
            } catch { return null; }
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
        const response = await fetch(PROXY + encodeURIComponent(url));
        if (!response.ok) throw new Error("Oost pagina niet bereikbaar");
        const html = await response.text();
        const doc = new DOMParser().parseFromString(html, "text/html");
        const links = [...doc.querySelectorAll("a")].map(a => a.href).filter(href => href && href.includes("/nieuws/") && /\/nieuws\/\d+\//.test(href)).map(href => href.replace("https://leeuw008-nl.github.io","https://www.oost.nl"));
        const uniek = [...new Set(links)];
        const artikelen = await Promise.all(uniek.slice(0,10).map(link => fetchOostArtikel(link)));
        return artikelen.filter(a=>a!==null);
    } catch(e) { console.error("Oost fout:", e); return []; }
}
async function fetchOostArtikel(url) {
    try {
        const response = await fetch(PROXY + encodeURIComponent(url));
        if (!response.ok) return null;
        const html = await response.text();
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
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) { alert('Push wordt niet ondersteund'); return; }
    if (PUSH_WORKER_URL.includes('JOUW-WORKER') || VAPID_PUBLIC_KEY.includes('VUL-HIER')) {
        alert('Je moet eerst PUSH_WORKER_URL en VAPID_PUBLIC_KEY invullen bovenaan script.js - zie uitleg in bestanden.');
        return;
    }
    const reg = await navigator.serviceWorker.register('/service-worker.js');
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') { alert('Geen toestemming voor notificaties'); return; }
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) });
    await fetch(PUSH_WORKER_URL + '/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sub) });
    localStorage.setItem('ommen_push_subscribed','1');
    updatePushButton();
    alert('🔔 Push aan! Je krijgt nu melding ook als site dicht is.');
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
    if(localStorage.getItem('ommen_push_subscribed')==='1') { btn.textContent='🔔 Push aan (klik om uit te zetten)'; btn.style.background='#d4edda'; }
    else { btn.textContent='🔔 Push aanzetten (ook als site dicht is)'; btn.style.background='#ffcc00'; }
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
    else html += articles.map(article => `<div class="article"><h2><a href="${article.link}" target="_blank" rel="noopener">${article.title}</a></h2><small>${article.source} — ${article.timestamp ? new Date(article.timestamp).toLocaleString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ""}</small><div class="article-content">${article.description}</div></div>`).join("");
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
    if (switchOmmen) switchOmmen.addEventListener("change", function() { if(searchInput) searchInput.value = ""; searchNews(); });
}
function refreshNews() { loadNews(false); }
function setupSources() {
    const button = document.getElementById("source-button");
    const menu = document.getElementById("source-menu");
    if(menu) menu.style.display = "none";
    if (!button || !menu) return;
    button.addEventListener("click", function() { if (menu.style.display === "none") { menu.style.display = "block"; button.innerHTML = "Bronnen ▲"; } else { menu.style.display = "none"; button.innerHTML = "Bronnen ▼"; } });
    document.querySelectorAll(".source-filter").forEach(box => { box.addEventListener("change", function() { searchNews(); }); });
}
function injectPushButton(){
    if(document.getElementById('push-toggle')) return;
    const parent = document.getElementById('search-input')?.parentElement || document.querySelector('header') || document.body;
    const btn = document.createElement('button');
    btn.id='push-toggle'; btn.style.cssText='margin-left:8px;padding:6px 12px;border-radius:20px;border:1px solid #ccc;cursor:pointer;font-weight:600';
    btn.onclick = async ()=>{
        if(localStorage.getItem('ommen_push_subscribed')==='1') await unsubscribePush();
        else await subscribePush();
    };
    parent.appendChild(btn);
    updatePushButton();
}
window.addEventListener("DOMContentLoaded", function() {
    setupSearch(); setupSources(); ensureBanner(); injectPushButton(); loadNews(false);
});
