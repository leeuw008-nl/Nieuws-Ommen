const PROXY = 'https://corsproxy.io/?';
const TIMEOUT = 8000;

const feeds = [
    { name: 'Ommen City', url: 'https://ommencity.nl/feed/' },
    { name: 'OudOmmen', url: 'https://weblog.oudommen.nl/feed/' },
    { name: 'De Stentor', url: 'https://www.destentor.nl/ommen/rss.xml' }
];

const ommenKeywords = ["ommen","arriën","arrien","beerze","beerzerveld","besthmen","diffelen","giethmen","junne","lemele","stegeren","vilsteren","witharen","varsen","ommermars"];
let allArticles = [];

async function fetchWithTimeout(url, ms = TIMEOUT) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), ms);
    try {
        const r = await fetch(url, { signal: controller.signal });
        clearTimeout(t);
        return r;
    } catch(e){ clearTimeout(t); throw e; }
}

async function fetchRSS(url) {
    try {
        const response = await fetchWithTimeout(PROXY + encodeURIComponent(url));
        if (!response.ok) return [];
        const text = await response.text();
        const xml = new DOMParser().parseFromString(text, "text/xml");
        const items = Array.from(xml.getElementsByTagName("item"));
        return items.slice(0,15).map(item => {
            let link = item.querySelector("link")?.getAttribute("href") || item.querySelector("link")?.textContent || "";
            return {
                title: item.querySelector("title")?.textContent?.trim() || "Geen titel",
                description: (item.querySelector("description")?.textContent || "").replace(/<[^>]+>/g,"").substring(0,200),
                link: link.trim(),
                timestamp: Date.parse(item.querySelector("pubDate")?.textContent || "") || Date.now()
            };
        });
    } catch { return []; }
}

// GEMEENTE - alleen titels, geen detailpagina's meer (voorkomt hangen)
async function fetchGemeenteNieuws() {
    try {
        const res = await fetchWithTimeout(PROXY + encodeURIComponent("https://www.ommen.nl/actueel/"));
        const text = await res.text();
        const html = new DOMParser().parseFromString(text, "text/html");
        const links = [];
        html.querySelectorAll("a").forEach(a=>{
            const hrefAttr = a.getAttribute("href") || "";
            if(!hrefAttr.includes("/actueel/") || hrefAttr === "/actueel/" || hrefAttr === "/actueel") return;
            const title = a.querySelector("h3, h2")?.textContent?.trim() || a.textContent.trim();
            if(title.length < 15 || title.length > 150) return;
            if(links.some(l=>l.link.includes(hrefAttr))) return;
            const fullLink = hrefAttr.startsWith("http")? hrefAttr : "https://www.ommen.nl" + hrefAttr;
            links.push({ title, link: fullLink, description: "Gemeente Ommen nieuws", timestamp: Date.now() });
        });
        return links.slice(0,8);
    } catch { return []; }
}

// RTV VECHTDAL - alleen overzicht
async function fetchRTVVechtdalNieuws() {
    try {
        const res = await fetchWithTimeout(PROXY + encodeURIComponent("https://rtvvechtdal.nl/"));
        const text = await res.text();
        const html = new DOMParser().parseFromString(text, "text/html");
        const links = [];
        html.querySelectorAll("a").forEach(a=>{
            const raw = a.getAttribute("href") || "";
            if(!raw.includes("type=detail")) return;
            const title = a.textContent.trim();
            if(title.length < 10) return;
            const href = new URL(raw, "https://rtvvechtdal.nl").href;
            if(links.some(l=>l.link===href)) return;
            links.push({ title, link: href, description: "RTV Vechtdal", timestamp: Date.now() });
        });
        return links.slice(0,8);
    } catch { return []; }
}

// VECHTDAL CENTRAAL - via rss2json (deze werkte!)
async function fetchVechtdalCentraalNieuws() {
    try {
        const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent('https://www.vechtdalcentraal.nl/feed/')}`;
        const res = await fetchWithTimeout(apiUrl, 15000);
        const data = await res.json();
        if(data.status!=='ok') return [];
        return data.items.slice(0,10).map(item => ({
            title: item.title,
            link: item.link,
            description: item.description.replace(/<[^>]+>/g,"").substring(0,300),
            timestamp: Date.parse(item.pubDate) || Date.now()
        }));
    } catch { return []; }
}

// OOST - via rss2json
async function fetchOostNieuws() {
    try {
        const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent('https://www.oost.nl/rss.xml')}`;
        const res = await fetchWithTimeout(apiUrl);
        const data = await res.json();
        if(data.status!=='ok') return [];
        return data.items.slice(0,10).map(item => ({
            title: item.title,
            link: item.link,
            description: item.description.replace(/<[^>]+>/g,"").substring(0,300),
            timestamp: Date.parse(item.pubDate) || Date.now()
        }));
    } catch { return []; }
}

function isOmmenNieuws(a){ return ommenKeywords.some(k=>(a.title+" "+a.description).toLowerCase().includes(k)); }
function addArticles(arts,bron){ arts.forEach(a=>allArticles.push({...a,source:bron})); }
function finalizeArticles(){
    const seen=new Set();
    allArticles=allArticles.filter(a=>{ if(seen.has(a.link)) return false; seen.add(a.link); return true; });
    allArticles.sort((a,b)=>b.timestamp-a.timestamp);
}

async function loadNews() {
    const container = document.getElementById("news-container");
    allArticles = [];
    container.innerHTML = "<p>Nieuws laden... <small id='load-status'>start</small></p>";

    const setStatus = (t) => { const el=document.getElementById("load-status"); if(el) el.innerText=t; };

    try {
        setStatus("Ommen City...");
        addArticles(await fetchRSS(feeds[0].url), feeds[0].name);
        setStatus("OudOmmen...");
        addArticles(await fetchRSS(feeds[1].url), feeds[1].name);
        setStatus("De Stentor...");
        addArticles(await fetchRSS(feeds[2].url), feeds[2].name);
        finalizeArticles(); searchNews();

        setStatus("Gemeente Ommen...");
        addArticles(await fetchGemeenteNieuws(), "Gemeente Ommen");
        finalizeArticles(); searchNews();

        setStatus("RTV Vechtdal...");
        addArticles(await fetchRTVVechtdalNieuws(), "RTV Vechtdal");
        finalizeArticles(); searchNews();

        setStatus("RTV Oost...");
        addArticles(await fetchOostNieuws(), "RTV Oost");
        finalizeArticles(); searchNews();

        setStatus("Vech
