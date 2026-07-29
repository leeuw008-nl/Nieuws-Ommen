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

// ===== NIEUW: HTML opschonen maar opmaak behouden =====
function cleanHTML(html) {
    if(!html) return "";
    // rss2json geeft soms al ge-escaped HTML, eerst decoden
    const textarea = document.createElement("textarea");
    textarea.innerHTML = html;
    let decoded = textarea.value;

    const doc = new DOMParser().parseFromString(decoded, "text/html");
    
    // gevaarlijke dingen verwijderen
    doc.querySelectorAll("script, style, iframe, form, object, embed, link").forEach(el=>el.remove());
    
    // alle attributen die met 'on' beginnen (onclick etc) verwijderen
    doc.querySelectorAll("*").forEach(el=>{
        [...el.attributes].forEach(attr=>{
            if(attr.name.startsWith("on") || attr.name === "style" && attr.value.includes("javascript")) {
                el.removeAttribute(attr.name);
            }
        });
    });

    // links veilig maken
    doc.querySelectorAll("a").forEach(a=>{
        a.setAttribute("target","_blank");
        a.setAttribute("rel","noopener");
        // relatieve links fixen
        const href = a.getAttribute("href");
        if(href && href.startsWith("/") && !href.startsWith("//")) {
            // laat relatief, wordt via proxy/context opgelost
        }
    });

    return doc.body.innerHTML;
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
            let link = "";
            const linkElement = item.querySelector("link");
            if (linkElement) {
                link = linkElement.getAttribute("href") || linkElement.textContent || "";
            }
            const date = item.querySelector("pubDate")?.textContent?.trim() || item.querySelector("published")?.textContent?.trim() || item.querySelector("updated")?.textContent?.trim() || "";
            const timestamp = Date.parse(date);
            const rawDesc = item.querySelector("description, content\\:encoded, summary, content")?.textContent || "";
            return {
                title: item.querySelector("title")?.textContent?.trim() || "Geen titel",
                description: cleanHTML(rawDesc).substring(0, 800),
                link: link.trim(),
                timestamp: isNaN(timestamp) ? 0 : timestamp
            };
        });
    } catch(error) {
        console.error("RSS ophalen mislukt:", url, error);
        return [];
    }
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
            if (title && href.includes("/actueel/") && title.length > 10) {
                links.push({ title: title, link: href });
            }
        }
        const artikelen = await Promise.all(
            links.slice(0,10).map(async artikel => {
                const gegevens = await fetchGemeenteGegevens(artikel.link);
                return {
                    title: artikel.title,
                    link: artikel.link,
                    description: gegevens.tekst,
                    pubDate: gegevens.datum,
                    timestamp: gegevens.datum ? Date.parse(gegevens.datum) : Date.now()
                };
            })
        );
        return artikelen;
    } catch(error) {
        console.error("Fout gemeente Ommen:", error);
        return [];
    }
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
        // Voor gemeente: probeer echte content div te pakken met HTML
        let contentDiv = html.querySelector(".content, .text, article, [class*='content']");
        let tekst = "";
        if(contentDiv) {
            tekst = cleanHTML(contentDiv.innerHTML).substring(0,600);
        } else {
            const regels = bodyText.split("\n").map(r=>r.trim()).filter(r=>r.length>40 && !r.includes("HomeActueel") && !r.includes("Uitleg in eenvoudige taal"));
            if(regels.length>0) tekst = regels.slice(1,4).join("<br><br>").substring(0,600);
        }
        return { datum, tekst: tekst + (tekst.length>=600 ? "..." : "") };
    } catch(error) {
        return { datum: "", tekst: "" };
    }
}

async function fetchRTVVechtdalNieuws() {
    const url = "https://rtvvechtdal.nl/";
    try {
        const res = await fetch(PROXY + encodeURIComponent(url));
        const text = await res.text();
        const html = new DOMParser().parseFromString(text, "text/html");
        const links = [];
        html.querySelectorAll("a").forEach(a => {
            try {
                const href = new URL(a.getAttribute("href"), "https://rtvvechtdal.nl").href;
                const title = a.textContent.trim();
                if (href.includes("type=detail") && title.length > 10 && !links.some(l => l.link === href)) {
                    links.push({ title, link: href });
                }
            } catch {}
        });
        const artikelen = await Promise.all(
            links.slice(0,10).map(async artikel => {
                try {
                    const res2 = await fetch(PROXY + encodeURIComponent(artikel.link));
                    const text2 = await res2.text();
                    const doc = new DOMParser().parseFromString(text2,"text/html");
                    const bodyEl = doc.querySelector(".content, article, .news-content") || doc.body;
                    const bodyText = bodyEl.innerText.replace(/\s+/g," ").trim();
                    let schoneTekst = bodyText.replace(/^.*?(\d{1,2}\s+(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\s+\d{4})/i, "$1");
                    const match = bodyText.match(/\d{1,2}\s+(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\s+\d{4}/i);
                    const datum = match ? match[0] : "";
                    let beschrijving = cleanHTML(bodyEl.innerHTML).replace(artikel.title,"").substring(0,600);
                    return {
                        title: artikel.title,
                        link: artikel.link,
                        description: beschrijving + "...",
                        timestamp: datum ? Date.parse(datum) : Date.now()
                    };
                } catch { return null; }
            })
        );
        return artikelen.filter(Boolean);
    } catch(error) {
        console.error("RTV:", error);
        return [];
    }
}

async function fetchVechtdalCentraalNieuws() {
    try {
        const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent('https://www.vechtdalcentraal.nl/feed/')}`;
        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error("Vechtdal Centraal fout");
        const data = await response.json();
        if (data.status !== 'ok') throw new Error("rss2json fout");
        return data.items.slice(0,10).map(item => ({
            title: item.title.replace(/&#8217;/g,"'").replace(/&amp;/g,"&"),
            link: item.link,
            description: cleanHTML(item.description).substring(0,800),
            timestamp: Date.parse(item.pubDate) || Date.now()
        }));
    } catch(error) {
        console.error("Vechtdal Centraal fout:", error);
        return [];
    }
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
    } catch(e) {
        console.error("Oost fout:", e);
        return [];
    }
}

async function fetchOostArtikel(url) {
    try {
        const response = await fetch(PROXY + encodeURIComponent(url));
        if (!response.ok) return null;
        const html = await response.text();
        const doc = new DOMParser().parseFromString(html, "text/html");
        const title = doc.querySelector("h1")?.innerText?.trim() || "RTV Oost";
        let datum = doc.querySelector('meta[property="article:published_time"]')?.content || doc.querySelector('meta[name="date"]')?.content || doc.querySelector("time")?.getAttribute("datetime") || "";
        if (!datum) {
            const match = doc.body.innerText.match(/\d{1,2}\s+(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\s+\d{4}/i);
            if (match) datum = match[0];
        }
        const descMeta = doc.querySelector('meta[name="description"]')?.content || "";
        const contentEl = doc.querySelector("article p, .article__content p") ? doc.querySelector("article, .article__content") : null;
        const description = contentEl ? cleanHTML(contentEl.innerHTML).substring(0,800) : descMeta;
        return { title, link: url, description, timestamp: datum ? Date.parse(datum) : Date.now(), source: "RTV Oost" };
    } catch(e) { return null; }
}

function isOmmenNieuws(article) {
    const text = (article.title + " " + (article.description || "")).toLowerCase().replace(/<[^>]*>/g," ");
    return ommenKeywords.some(keyword => text.includes(keyword));
}
function addArticles(artikelen, bron) {
    artikelen.forEach(article => { allArticles.push({ ...article, source: bron }); });
}
function finalizeArticles() {
    const seen = new Set();
    allArticles = allArticles.filter(article => { if (seen.has(article.link)) return false; seen.add(article.link); return true; });
    allArticles.sort((a,b) => b.timestamp - a.timestamp);
}

async function loadNews() {
    const container = document.getElementById("news-container");
    container.innerHTML = "<p>Nieuws laden...</p>";
    allArticles = [];
    const results = await Promise.all(feeds.map(async feed => ({ source: feed.name, articles: await fetchRSS(feed.url) })));
    results.forEach(result => { addArticles(result.articles, result.source); });
    const [gemeenteArtikelen, rtvArtikelen, oostArtikelen, vechtdalCentraalArtikelen] = await Promise.all([
        fetchGemeenteNieuws(), fetchRTVVechtdalNieuws(), fetchOostNieuws(), fetchVechtdalCentraalNieuws()
    ]);
    addArticles(gemeenteArtikelen, "Gemeente Ommen");
    addArticles(rtvArtikelen, "RTV Vechtdal");
    addArticles(oostArtikelen, "RTV Oost");
    addArticles(vechtdalCentraalArtikelen, "Vechtdal Centraal");
    finalizeArticles();
    searchNews();
}

function renderArticles(articles) {
    const container = document.getElementById("news-container");
    let html = `<p><strong>${articles.length} artikelen gevonden</strong></p>`;
    if (articles.length === 0) {
        html += "<p>Geen artikelen gevonden.</p>";
    } else {
        html += articles.map(article => `
            <div class="article">
                <h2><a href="${article.link}" target="_blank" rel="noopener">${article.title}</a></h2>
                <small>
                    ${article.source} — ${article.timestamp ? new Date(article.timestamp).toLocaleString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ""}
                </small>
                <div class="article-content">
                    ${article.description}
                </div>
            </div>
        `).join("");
    }
    container.innerHTML = html;
}

function searchNews() {
    const searchInput = document.getElementById("search-input");
    const alleenOmmen = document.getElementById("only-ommen").checked;
    const zoekterm = searchInput.value.toLowerCase().trim();
    let articles = [...allArticles];
    if (alleenOmmen) articles = articles.filter(article => isOmmenNieuws(article));
    if (zoekterm !== "") {
        articles = articles.filter(article => {
            const text = (article.title + " " + (article.description||"")).toLowerCase().replace(/<[^>]*>/g," ");
            return text.includes(zoekterm);
        });
    }
    const gekozenBronnen = Array.from(document.querySelectorAll(".source-filter:checked")).map(box => box.value);
    articles = articles.filter(article => gekozenBronnen.includes(article.source));
    articles.sort((a,b) => b.timestamp - a.timestamp);
    renderArticles(articles);
}

function setupSearch() {
    const searchInput = document.getElementById("search-input");
    const switchOmmen = document.getElementById("only-ommen");
    searchInput.addEventListener("input", searchNews);
    if (switchOmmen) {
        switchOmmen.addEventListener("change", function() {
            searchInput.value = "";
            searchNews();
        });
    }
}
function refreshNews() { loadNews(); }
function setupSources() {
    const button = document.getElementById("source-button");
    const menu = document.getElementById("source-menu");
    menu.style.display = "none";
    if (!button || !menu) return;
    button.addEventListener("click", function() {
        if (menu.style.display === "none") { menu.style.display = "block"; button.innerHTML = "Bronnen ▲"; } 
        else { menu.style.display = "none"; button.innerHTML = "Bronnen ▼"; }
    });
    document.querySelectorAll(".source-filter").forEach(box => {
        box.addEventListener("change", function() { searchNews(); });
    });
}
window.addEventListener("DOMContentLoaded", function() {
    setupSearch();
    setupSources();
    loadNews();
});
