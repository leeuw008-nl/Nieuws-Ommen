const PROXY = 'https://corsproxy.io/?';
const TIMEOUT_MS = 8000; // 8 sec max per bron

const feeds = [
    { name: 'Ommen City', url: 'https://ommencity.nl/feed/' },
    { name: 'OudOmmen', url: 'https://weblog.oudommen.nl/feed/' },
    { name: 'De Stentor', url: 'https://www.destentor.nl/ommen/rss.xml' }
];

const ommenKeywords = ["ommen","arriën","arrien","beerze","beerzerveld","besthmen","diffelen","giethmen","junne","lemele","stegeren","vilsteren","witharen","varsen","ommermars"];
let allArticles = [];

// ===== NIEUW: fetch met timeout, zodat hij nooit blijft hangen =====
async function fetchWithTimeout(url, ms = TIMEOUT_MS) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), ms);
    try {
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(id);
        return res;
    } catch (e) {
        clearTimeout(id);
        throw e;
    }
}

async function fetchRSS(url) {
    try {
        const response = await fetchWithTimeout(PROXY + encodeURIComponent(url));
        if (!response.ok) throw new Error("RSS fout " + response.status);
        const text = await response.text();
        const xml = new DOMParser().parseFromString(text, "text/xml");
        if (xml.querySelector("parsererror")) return [];
        const items = Array.from(xml.getElementsByTagName("item"));
        return items.slice(0, 25).map(item => {
            let link = "";
            const le = item.querySelector("link");
            if (le) link = le.getAttribute("href") || le.textContent || "";
            const date = item.querySelector("pubDate")?.textContent?.trim() || item.querySelector("published")?.textContent?.trim() || "";
            return {
                title: item.querySelector("title")?.textContent?.trim() || "Geen titel",
                description: (item.querySelector("description, summary, content")?.textContent || "").replace(/<[^>]+>/g, "").trim(),
                link: link.trim(),
                timestamp: Date.parse(date) || 0
            };
        });
    } catch (error) {
        console.error("RSS mislukt:", url, error);
        return [];
    }
}

async function fetchGemeenteNieuws() {
    try {
        const res = await fetchWithTimeout(PROXY + encodeURIComponent("https://www.ommen.nl/actueel/"));
        if (!res.ok) throw new Error("Gemeente niet bereikbaar");
        const text = await res.text();
        const html = new DOMParser().parseFromString(text, "text/html");
        const links = [];
        for (const a of html.querySelectorAll("a")) {
            const title = a.querySelector("h3, h2")?.textContent?.trim() || a.textContent.trim();
            const href = a.href;
            if (title && href.includes("/actueel/") && title.length > 10) links.push({ title, link: href });
        }
        const arts = await Promise.all(links.slice(0,10).map(async art => {
            try {
                const g = await fetchGemeenteGegevens(art.link);
                return { title: art.title, link: art.link, description: g.tekst, timestamp: g.datum? Date.parse(g.datum) : Date.now() };
            } catch { return null; }
        }));
        return arts.filter(Boolean);
    } catch(e){ return []; }
}

async function fetchGemeenteGegevens(url) {
    try {
        const res = await fetchWithTimeout(PROXY + encodeURIComponent(url), 5000);
        if (!res.ok) return { datum: "", tekst: "" };
        const text = await res.text();
        const html = new DOMParser().parseFromString(text, "text/html");
        const bodyText = html.body?.innerText || "";
        const match = bodyText.match(/\d{1,2}\s+(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\s+\d{4}(,\s*\d{2}:\d{2})?/i);
        const regels = bodyText.split("\n").map(r=>r.trim()).filter(r=>r.length>40 &&!r.includes("HomeActueel"));
        return { datum: match?match[0]:"", tekst: regels.slice(1,4).join(" ").substring(0,350)+"..." };
    } catch { return { datum: "", tekst: "" }; }
}

async function fetchRTVVechtdalNieuws() {
    try {
        const res = await fetchWithTimeout(PROXY + encodeURIComponent("https://rtvvechtdal.nl/"));
        const html = new DOMParser().parseFromString(await res.text(), "text/html");
        const links = [];
        html.querySelectorAll("a").forEach(a=>{
            try{
                const href = new URL(a.getAttribute("href"), "https://rtvvechtdal.nl").href;
                const title = a.textContent.trim();
                if (href.includes("type=detail") && title.length>10 &&!links.some(l=>l.link===href)) links.push({title,link:href});
            }catch{}
        });
        const arts = await Promise.all(links.slice(0,10).map(async art=>{
            try{
                const r2 = await fetchWithTimeout(PROXY + encodeURIComponent(art.link), 5000);
                const doc = new DOMParser().parseFromString(await r2.text(),"text/html");
                const body = doc.body.innerText.replace(/\s+/g," ").trim();
                const match = body.match(/\d{1,2}\s+(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\s+\d{4}/i);
                return { title: art.title, link: art.link, description: body.replace(art.title,"").substring(0,300)+"...", timestamp: match?Date.parse(match[0]):Date.now() };
            }catch{return null;}
        }));
        return arts.filter(Boolean);
    }catch{return [];}
}

// ===== VECHTDAL CENTRAAL - NU MET TIMEOUT EN FALLBACK =====
async function fetchVechtdalCentraalNieuws() {
    const urls = [
        "https://www.vechtdalcentraal.nl/wp-json/wp/v2/posts?per_page=10",
        "https://www.vechtdalcentraal.nl/feed/"
    ];
    for (const url of urls) {
        try {
            const response = await fetchWithTimeout(PROXY + encodeURIComponent(url));
            if (!response.ok) continue;
            const text = await response.text();
            if (text.trim().startsWith("[")) {
                const data = JSON.parse(text);
                if (data.length>0) return data.map(i=>({
                    title: (i.title?.rendered||"").replace(/&#8217;/g,"'").replace(/&amp;/g,"&"),
                    link: i.link,
                    description: (i.excerpt?.rendered||"").replace(/<[^>]+>/g,"").trim().substring(0,350)+"...",
                    timestamp: Date.parse(i.date)||Date.now()
                }));
            } else {
                const xml = new DOMParser().parseFromString(text,"text/xml");
                const items = Array.from(xml.getElementsByTagName("item"));
                if (items.length>0) return items.slice(0,10).map(it=>({
                    title: it.querySelector("title")?.textContent?.trim()||"Geen titel",
                    link: it.querySelector("link")?.textContent?.trim()||"",
                    description: (it.querySelector("description")?.textContent||"").replace(/<[^>]+>/g,"").trim().substring(0,350)+"...",
                    timestamp: Date.parse(it.querySelector("pubDate")?.textContent||"")||Date.now()
                }));
            }
        } catch(e) { /* probeer volgende */ }
    }
    return [];
}

async function fetchOostNieuws() {
    try{
        const res = await fetchWithTimeout(PROXY + encodeURIComponent("https://www.oost.nl/nieuws"));
        if(!res.ok) return [];
        const doc = new DOMParser().parseFromString(await res.text(),"text/html");
        const links = [...new Set([...doc.querySelectorAll("a")].map(a=>a.href).filter(h=>h && h.includes("/nieuws/") && /\/nieuws\/\d+\//.test(h)).map(h=>h.replace("https://leeuw008-nl.github.io","https://www.oost.nl")))];
        const arts = await Promise.all(links.slice(0,10).map(async l=>{
            try{
                const r = await fetchWithTimeout(PROXY + encodeURIComponent(l), 5000);
                if(!r.ok) return null;
                const d = new DOMParser().parseFromString(await r.text(),"text/html");
                return { title: d.querySelector("h1")?.innerText?.trim()||"RTV Oost", link: l, description: d.querySelector('meta[name="description"]')?.content||"", timestamp: Date.now() };
            }catch{return null;}
        }));
        return arts.filter(Boolean);
    }catch{return [];}
}

function isOmmenNieuws(a){ const t=(a.title+" "+a.description).toLowerCase(); return ommenKeywords.some(k=>t.includes(k)); }
function addArticles(arts,bron){ arts.forEach(a=>allArticles.push({...a,source:bron})); }
function finalizeArticles(){
    const seen=new Set();
    allArticles=allArticles.filter(a=>{ if(seen.has(a.link)) return false; seen.add(a.link); return true; });
    allArticles.sort((a,b)=>b.timestamp-a.timestamp);
}

async function loadNews() {
    const container = document.getElementById("news-container");
    allArticles = [];
    container.innerHTML = "<p>Nieuws laden...<br><small id='load-status'></small></p>";
    const statusEl = () => document.getElementById("load-status");

    // Laad RSS eerst - snel zichtbaar resultaat
    const rssResults = await Promise.allSettled(feeds.map(f=>fetchRSS(f.url).then(arts=>({source:f.name,arts}))));
    rssResults.forEach(r=>{ if(r.status==='fulfilled') addArticles(r.value.arts, r.value.source); });
    if(statusEl()) statusEl().innerText = `RSS klaar (${allArticles.length} artikelen)...`;
    finalizeArticles();
    search
