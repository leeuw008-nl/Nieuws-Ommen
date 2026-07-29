const feeds = [
    { name: 'Ommen City', url: 'https://ommencity.nl/feed/' },
    { name: 'OudOmmen', url: 'https://weblog.oudommen.nl/feed/' },
    { name: 'De Stentor', url: 'https://www.destentor.nl/ommen/rss.xml' }
];

const ommenKeywords = ["ommen","arriën","arrien","beerze","beerzerveld","besthmen","diffelen","giethmen","junne","lemele","stegeren","vilsteren","witharen","varsen","ommermars"];
let allArticles = [];

window.onerror = function(msg, src, line) {
    const c = document.getElementById("news-container");
    if(c) c.innerHTML += `<div style="background:#fee;color:#900;padding:8px;margin:8px 0;border:1px solid red">FOUT: ${msg} (regel ${line})</div>`;
};
function setStatus(txt) {
    const el = document.getElementById("load-status");
    if(el) el.innerText = txt;
}
async function fetchWithTimeout(url, ms = 15000) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), ms);
    try {
        const r = await fetch(url, { signal: controller.signal });
        clearTimeout(t);
        return r;
    } catch(e) { clearTimeout(t); throw e; }
}

// ===== RSS BRONNEN =====
async function fetchRSS(url) {
    const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(url)}`;
    try {
        const res = await fetchWithTimeout(apiUrl);
        const data = await res.json();
        if(data.status!== 'ok') return [];
        return data.items.slice(0,20).map(item => ({
            title: item.title || "Geen titel",
            description: (item.description || "").replace(/<[^>]+>/g,"").substring(0,350),
            link: item.link,
            timestamp: Date.parse(item.pubDate) || Date.now()
        }));
    } catch(e) { return []; }
}

// ===== VECHTDAL CENTRAAL - WERKT! =====
async function fetchVechtdalCentraalNieuws() {
    const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent('https://www.vechtdalcentraal.nl/feed/')}`;
    try {
        const res = await fetchWithTimeout(apiUrl);
        const data = await res.json();
        if(data.status!== 'ok') return [];
        return data.items.slice(0,10).map(item => ({
            title: item.title.replace(/&#8217;/g,"'"),
            link: item.link,
            description: item.description.replace(/<[^>]+>/g,"").substring(0,350)+"...",
            timestamp: Date.parse(item.pubDate) || Date.now()
        }));
    } catch(e) { return []; }
}

// ===== GEMEENTE OMMEN - GEREPAREERD =====
async function fetchGemeenteNieuws() {
    try {
        setStatus("Gemeente Ommen laden...");
        const url = `https://api.allorigins.win/get?url=${encodeURIComponent('https://www.ommen.nl/actueel/')}`;
        const res = await fetchWithTimeout(url);
        const wrapper = await res.json();
        const html = new DOMParser().parseFromString(wrapper.contents, "text/html");
        const links = [];
        html.querySelectorAll("a").forEach(a=>{
            const title = a.querySelector("h3, h2")?.textContent?.trim() || a.textContent.trim();
            const href = a.href;
            if(title && href.includes("/actueel/") && title.length > 15 &&!href.endsWith("/actueel/") &&!links.some(l=>l.link===href)) {
                links.push({title, link: href.startsWith("http")? href : "https://www.ommen.nl" + a.getAttribute("href")});
            }
        });
        // haal max 6 artikelen op om niet te spammen
        const arts = await Promise.all(links.slice(0,6).map(async art=>{
            try{
                const r = await fetchWithTimeout(`https://api.allorigins.win/get?url=${encodeURIComponent(art.link)}`, 8000);
                const w = await r.json();
                const doc = new DOMParser().parseFromString(w.contents, "text/html");
                const text = doc.body?.innerText || "";
                const match = text.match(/\d{1,2}\s+(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\s+\d{4}/i);
                const regels = text.split("\n").map(s=>s.trim()).filter(s=>s.length>50);
                return { title: art.title, link: art.link, description: regels.slice(0,3).join(" ").substring(0,350)+"...", timestamp: match?Date.parse(match[0]):Date.now() };
            }catch{return null;}
        }));
        return arts.filter(Boolean);
    } catch(e) { return []; }
}

// ===== RTV VECHTDAL - GEREPAREERD =====
async function fetchRTVVechtdalNieuws() {
    try {
        setStatus("RTV Vechtdal laden...");
        const url = `https://api.allorigins.win/get?url=${encodeURIComponent('https://rtvvechtdal.nl/')}`;
        const res = await fetchWithTimeout(url);
        const wrapper = await res.json();
        const html = new DOMParser().parseFromString(wrapper.contents, "text/html");
        const links = [];
        html.querySelectorAll("a").forEach(a=>{
            try{
                const href = new URL(a.getAttribute("href"), "https://rtvvechtdal.nl").href;
                if(href.includes("type=detail") && a.textContent.trim().length>10 &&!links.some(l=>l.link===href)) {
                    links.push({title: a.textContent.trim(), link: href});
                }
            }catch{}
        });
        const arts = await Promise.all(links.slice(0,8).map(async art=>{
            try{
                const r = await fetchWithTimeout(`https://api.allorigins.win/get?url=${encodeURIComponent(art.link)}`, 8000);
                const w = await r.json();
                const doc = new DOMParser().parseFromString(w.contents, "text/html");
                const body = doc.body.innerText.replace(/\s+/g," ").trim();
                const match = body.match(/\d{1,2}\s+(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\s+\d{4}/i);
                return { title: art.title, link: art.link, description: body.substring(0,350)+"...", timestamp: match?Date.parse(match[0]):Date.now() };
            }catch{return null;}
        }));
        return arts.filter(Boolean);
    } catch(e){ return []; }
}

// ===== RTV OOST - GEREPAREERD (via RSS) =====
async function fetchOostNieuws() {
    try {
        setStatus("RTV Oost laden...");
        // Oost heeft een RSS feed die veel betrouwbaarder is dan scrapen
        const rssUrl = "https://www.oost.nl/rss.xml";
        const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`;
        const res = await fetchWithTimeout(apiUrl);
        const data = await res.json();
        if(data.status === 'ok') {
            return data.items.slice(0,10).map(item => ({
                title: item.title,
                link: item.link,
                description: item.description.replace(/<[^>]+>/g,"").substring(0,350)+"...",
                timestamp: Date.parse(item.pubDate) || Date.now()
            }));
        }
        return [];
    } catch(e){ return []; }
}

function isOmmenNieuws(a){ return ommenKeywords.some(k => (a.title+" "+a.description).toLowerCase().includes(k)); }
function addArticles(arts,bron){ arts.forEach(a=>allArticles.push({...a,source:bron})); }
function finalizeArticles(){
    const seen=new Set();
    allArticles=allArticles.filter(a=>{ if(seen.has(a.link)) return false; seen.add(a.link); return true; });
    allArticles.sort((a,b)=>b.timestamp-a.timestamp);
}

async function loadNews() {
    const container = document.getElementById("news-container");
    allArticles = [];
    container.innerHTML = `<p>Nieuws laden...<br><small id="load-status">Starten...</small></p><div id="error-log"></div>`;

    for(const feed of feeds) {
        setStatus(`${feed.name} laden...`);
        const arts = await fetchRSS(feed.url);
        addArticles(arts, feed.name);
        finalizeArticles(); searchNews();
    }

    const extra = [
        {fn: fetchGemeenteNieuws, naam: "Gemeente Ommen"},
        {fn: fetchRTVVechtdalNieuws, naam: "RTV Vechtdal"},
        {fn: fetchOostNieuws, naam: "RTV Oost"},
        {fn: fetchVechtdalCentraalNieuws, naam: "Vechtdal Centraal"}
    ];

    for(const b of extra) {
        setStatus(`${b.naam} laden... (${allArticles.length} artikelen binnen)`);
        const arts = await b.fn();
        addArticles(arts, b.naam);
        finalizeArticles(); searchNews();
    }
    setStatus(`KLAAR! ${allArticles.length} artikelen totaal.`);
}

function renderArticles(articles){
    const oldStatus = document.getElementById("load-status")?.innerText || "";
    const oldLog = document.getElementById("error-log")?.innerHTML || "";
    const container=document.getElementById("news-container");
    let html=`<p><strong>${articles.length} artikelen gevonden</strong> <small id="load-status">${oldStatus}</small></p><div id="error-log">${oldLog}</div>`;
    if(articles.length===0) html+=`<p>Geen artikelen.</p>`;
    else html+=articles.map(a=>`<div class="article"><h2><a href="${a.link}" target="_blank" rel="noopener">${a.title}</a></h2><small>${a.source} — ${a.timestamp?new Date(a.timestamp).toLocaleDateString('nl-NL'):""}</small><p>${a.description}</p></div>`).join("");
    container.innerHTML=html;
}
function searchNews(){
    const si=document.getElementById("search-input");
    if(!si) return;
    const alleenOmmen=document.getElementById("only-ommen")?.checked;
    const zoekterm=si.value.toLowerCase().trim();
    let arts=[...allArticles];
    if(alleenOmmen) arts=arts.filter(a=>isOmmenNieuws(a));
    if(zoekterm) arts=arts.filter(a=>(a.title+" "+a.description).toLowerCase().includes(zoekterm));
    const gekozen=Array.from(document.querySelectorAll(".source-filter:checked")).map(b=>b.value);
    if(gekozen.length>0) arts=arts.filter(a=>gekozen.includes(a.source));
    arts.sort((a,b)=>b.timestamp-a.timestamp);
    renderArticles(arts);
}
function setupSearch(){
    const si=document.getElementById("search-input");
    const so=document.getElementById("only-ommen");
    if(si) si.addEventListener("input",searchNews);
    if(so) so.addEventListener("change",()=>{ si.value=""; searchNews(); });
}
function setupSources(){
    const b=document.getElementById("source-button");
    const m=document.getElementById("source-menu");
    if(m) m.style.display="none";
    if(!b||!m) return;
    b.addEventListener("click",()=>{
        if(m.style.display==="none"){ m.style.display="block"; b.innerHTML="Bronnen ▲"; }
        else{ m.style.display="none"; b.innerHTML="Bronnen ▼"; }
    });
    document.querySelectorAll(".source-filter").forEach(el=>el.addEventListener("change",searchNews));
}
window.addEventListener("DOMContentLoaded",()=>{ setupSearch(); setupSources(); loadNews(); });
function refreshNews(){ loadNews(); }
