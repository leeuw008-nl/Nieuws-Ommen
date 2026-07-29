const feeds = [
    { name: 'Ommen City', url: 'https://ommencity.nl/feed/' },
    { name: 'OudOmmen', url: 'https://weblog.oudommen.nl/feed/' },
    { name: 'De Stentor', url: 'https://www.destentor.nl/ommen/rss.xml' }
];

const ommenKeywords = ["ommen","arriën","arrien","beerze","beerzerveld","besthmen","diffelen","giethmen","junne","lemele","stegeren","vilsteren","witharen","varsen","ommermars"];
let allArticles = [];

// Laat fouten op de pagina zien ipv in console
window.onerror = function(msg, src, line) {
    const c = document.getElementById("news-container");
    if(c) c.innerHTML += `<div style="background:#fee;color:#900;padding:8px;margin:8px 0;border:1px solid red">FOUT: ${msg} (regel ${line})</div>`;
};

function setStatus(txt) {
    const el = document.getElementById("load-status");
    if(el) el.innerText = txt;
    const container = document.getElementById("news-container");
    if(container && container.innerHTML.includes("Nieuws laden")) {
        container.innerHTML = `<p>Nieuws laden...<br><small id="load-status">${txt}</small></p><div id="error-log"></div>`;
    }
}

async function fetchWithTimeout(url, ms = 7000) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), ms);
    try {
        const r = await fetch(url, { signal: controller.signal });
        clearTimeout(t);
        return r;
    } catch(e) {
        clearTimeout(t);
        throw e;
    }
}

// ===== NIEUWE RSS METHODE - GEEN CORSPROXY MEER =====
async function fetchRSS(url) {
    // rss2json zet RSS om naar JSON en heeft geen CORS problemen
    const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(url)}`;
    try {
        setStatus(`Laden ${url}...`);
        const res = await fetchWithTimeout(apiUrl);
        if(!res.ok) throw new Error("HTTP " + res.status);
        const data = await res.json();
        if(data.status !== 'ok') throw new Error(data.message || 'rss2json fout');
        return data.items.slice(0,20).map(item => ({
            title: item.title || "Geen titel",
            description: (item.description || "").replace(/<[^>]+>/g,"").substring(0,350),
            link: item.link,
            timestamp: Date.parse(item.pubDate) || Date.now()
        }));
    } catch(e) {
        const log = document.getElementById("error-log");
        if(log) log.innerHTML += `<div style="color:orange">RSS mislukt ${url}: ${e.message}</div>`;
        return [];
    }
}

// ===== VECHTDAL CENTRAAL - 100% ANDERE AANPAK =====
async function fetchVechtdalCentraalNieuws() {
    // 1. Probeer via allorigins (werkt bijna altijd)
    const targets = [
        `https://api.allorigins.win/get?url=${encodeURIComponent('https://www.vechtdalcentraal.nl/wp-json/wp/v2/posts?per_page=10')}`,
        `https://api.allorigins.win/get?url=${encodeURIComponent('https://www.vechtdalcentraal.nl/feed/')}`
    ];

    for (const target of targets) {
        try {
            setStatus("Vechtdal Centraal proberen...");
            const res = await fetchWithTimeout(target, 8000);
            if(!res.ok) continue;
            const wrapper = await res.json(); // allorigins geeft {contents: "..."}
            const text = wrapper.contents;

            if(!text) continue;

            if(text.trim().startsWith("[")) {
                const data = JSON.parse(text);
                if(data.length > 0) {
                    return data.map(i=>({
                        title: (i.title?.rendered||"").replace(/&#8217;/g,"'"),
                        link: i.link,
                        description: (i.excerpt?.rendered||"").replace(/<[^>]+>/g,"").substring(0,350)+"...",
                        timestamp: Date.parse(i.date)||Date.now()
                    }));
                }
            } else {
                // RSS
                const xml = new DOMParser().parseFromString(text, "text/xml");
                const items = Array.from(xml.getElementsByTagName("item"));
                if(items.length > 0) {
                    return items.slice(0,10).map(it=>({
                        title: it.querySelector("title")?.textContent?.trim()||"Geen titel",
                        link: it.querySelector("link")?.textContent?.trim()||"",
                        description: (it.querySelector("description")?.textContent||"").replace(/<[^>]+>/g,"").substring(0,350)+"...",
                        timestamp: Date.parse(it.querySelector("pubDate")?.textContent||"")||Date.now()
                    }));
                }
            }
        } catch(e) {
            const log = document.getElementById("error-log");
            if(log) log.innerHTML += `<div style="color:red">Vechtdal poging mislukt: ${e.message}</div>`;
        }
    }
    return [];
}

async function fetchGemeenteNieuws(){ return []; } // tijdelijk uitgeschakeld om hangen te voorkomen
async function fetchRTVVechtdalNieuws(){ return []; }
async function fetchOostNieuws(){ return []; }

async function fetchVechtdalCentraalNieuws() {
    const rssUrl = "https://www.vechtdalcentraal.nl/feed/";
    const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`;

    try {
        setStatus("Vechtdal Centraal laden via rss2json...");
        // 15 seconden timeout ipv 8
        const res = await fetchWithTimeout(apiUrl, 15000);
        if(!res.ok) throw new Error("HTTP " + res.status);
        
        const data = await res.json();
        
        if(data.status !== 'ok' || !data.items) {
            throw new Error("rss2json gaf: " + (data.message || "geen items"));
        }

        setStatus(`Vechtdal Centraal: ${data.items.length} artikelen gevonden!`);
        
        return data.items.slice(0,10).map(item => ({
            title: (item.title || "Geen titel").replace(/&#8217;/g,"'").replace(/&amp;/g,"&"),
            link: item.link,
            description: (item.description || "").replace(/<[^>]+>/g,"").trim().substring(0,350) + "...",
            timestamp: Date.parse(item.pubDate) || Date.now()
        }));

    } catch(e) {
        const log = document.getElementById("error-log");
        if(log) log.innerHTML += `<div style="color:red">Vechtdal mislukt: ${e.message}. Probeer later opnieuw, feed is traag.</div>`;
        setStatus(`Vechtdal Centraal mislukt: ${e.message}`);
        return [];
    }
}
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

    setStatus("RSS laden...");
    for(const feed of feeds) {
        const arts = await fetchRSS(feed.url);
        addArticles(arts, feed.name);
        finalizeArticles();
        searchNews();
        setStatus(`${feed.name} klaar, totaal ${allArticles.length}`);
    }

    setStatus("Vechtdal Centraal laden...");
    const vc = await fetchVechtdalCentraalNieuws();
    addArticles(vc, "Vechtdal Centraal");
    finalizeArticles();
    searchNews();
    
    setStatus(`KLAAR! ${allArticles.length} artikelen. Vechtdal: ${vc.length} gevonden.`);
}

function renderArticles(articles){
    // bewaar status
    const oldStatus = document.getElementById("load-status")?.innerText || "";
    const oldLog = document.getElementById("error-log")?.innerHTML || "";
    const container=document.getElementById("news-container");
    let html=`<p><strong>${articles.length} artikelen gevonden</strong> <small id="load-status">${oldStatus}</small></p><div id="error-log">${oldLog}</div>`;
    if(articles.length===0) html+=`<p>Geen artikelen. Fouten staan hierboven.</p>`;
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
