const PROXY = 'https://corsproxy.io/?';
const TIMEOUT = 12000;

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
        if (!response.ok) throw new Error("RSS fout");
        const text = await response.text();
        const xml = new DOMParser().parseFromString(text, "text/xml");
        if (xml.querySelector("parsererror")) return [];
        const items = Array.from(xml.getElementsByTagName("item"));
        return items.slice(0,25).map(item => {
            let link = "";
            const linkElement = item.querySelector("link");
            if (linkElement) link = linkElement.getAttribute("href") || linkElement.textContent || "";
            const date = item.querySelector("pubDate")?.textContent?.trim() || item.querySelector("published")?.textContent?.trim() || item.querySelector("updated")?.textContent?.trim() || "";
            const timestamp = Date.parse(date);
            return {
                title: item.querySelector("title")?.textContent?.trim() || "Geen titel",
                description: (item.querySelector("description, summary, content")?.textContent || "").replace(/<[^>]+>/g, "").trim(),
                link: link.trim(),
                timestamp: isNaN(timestamp)? 0 : timestamp
            };
        });
    } catch(error) { return []; }
}

async function fetchGemeenteNieuws() {
    const url = "https://www.ommen.nl/actueel/";
    try {
        const res = await fetchWithTimeout(PROXY + encodeURIComponent(url));
        if (!res.ok) throw new Error("Gemeente pagina niet bereikbaar");
        const text = await res.text();
        const html = new DOMParser().parseFromString(text, "text/html");
        const links = [];
        for (const link of html.querySelectorAll("a")) {
            const title = link.querySelector("h3, h2")?.textContent?.trim() || link.textContent.trim();
            const href = link.href;
            if (title && href.includes("/actueel/") && title.length > 10) {
                links.push({ title: title, link: href });
            }
        }
        const artikelen = await Promise.all(links.slice(0,10).map(async artikel => {
            const gegevens = await fetchGemeenteGegevens(artikel.link);
            return { title: artikel.title, link: artikel.link, description: gegevens.tekst, pubDate: gegevens.datum, timestamp: gegevens.datum? Date.parse(gegevens.datum) : Date.now() };
        }));
        return artikelen;
    } catch(error) { return []; }
}

async function fetchGemeenteGegevens(url) {
    try {
        const res = await fetchWithTimeout(PROXY + encodeURIComponent(url), 8000);
        if (!res.ok) return { datum: "", tekst: "" };
        const text = await res.text();
        const html = new DOMParser().parseFromString(text, "text/html");
        const bodyText = html.body?.innerText || "";
        const match = bodyText.match(/\d{1,2}\s+(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\s+\d{4}(,\s*\d{2}:\d{2})?/i);
        const datum = match? match[0] : "";
        const regels = bodyText.split("\n").map(regel => regel.trim()).filter(regel => regel.length > 40 &&!regel.includes("HomeActueel") &&!regel.includes("Uitleg in eenvoudige taal") &&!regel.includes("simpele tekst"));
        let tekst = "";
        if (regels.length > 0) tekst = regels.slice(1,4).join(" ").substring(0,350) + "...";
        return { datum, tekst };
    } catch(error) { return { datum: "", tekst: "" }; }
}

async function fetchRTVVechtdalNieuws() {
    const url = "https://rtvvechtdal.nl/";
    try {
        const res = await fetchWithTimeout(PROXY + encodeURIComponent(url));
        const text = await res.text();
        const html = new DOMParser().parseFromString(text, "text/html");
        const links = [];
        html.querySelectorAll("a").forEach(a => {
            try{
                const href = new URL(a.getAttribute("href"), "https://rtvvechtdal.nl").href;
                const title = a.textContent.trim();
                if (href.includes("type=detail") && title.length > 10 &&!links.some(l => l.link === href)) {
                    links.push({ title, link: href });
                }
            }catch{}
        });
        const artikelen = await Promise.all(links.slice(0,10).map(async artikel => {
            try{
                const res2 = await fetchWithTimeout(PROXY + encodeURIComponent(artikel.link), 8000);
                const text2 = await res2.text();
                const doc = new DOMParser().parseFromString(text2,"text/html");
                const body = doc.body.innerText.replace(/\s+/g," ").trim();
                let schoneTekst = body.replace(/^.*?(\d{1,2}\s+(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\s+\d{4})/i, "$1");
                const match = body.match(/\d{1,2}\s+(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\s+\d{4}/i);
                const datum = match? match[0] : "";
                let beschrijving = schoneTekst.replace(artikel.title,"").replace(/Home Vechtdal TV.*?Stichting RTV Vechtdal/i, "").replace(/\d{1,2}\s+(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\s+\d{4}/i, "").trim().substring(0,300);
                return { title: artikel.title, link: artikel.link, description: beschrijving + "...", timestamp: datum? Date.parse(datum) : Date.now() };
            }catch{ return null; }
        }));
        return artikelen.filter(Boolean);
    } catch(error
