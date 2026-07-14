const PROXY = 'https://corsproxy.io/?';

const feeds = [
    { name: 'Ommen City', url: 'https://ommencity.nl/feed/' },
    { name: 'De Stentor', url: 'https://www.destentor.nl/ommen/rss.xml' },
    { name: 'RTV Oost', url: 'http://rss.rtvoost.nl/' },           // Algemeen Overijssel
];

let allArticles = [];

async function fetchRSS(url) {
    try {
        const proxyUrl = PROXY + encodeURIComponent(url);
        const res = await fetch(proxyUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const text = await res.text();
        const xml = new DOMParser().parseFromString(text, "text/xml");

        if (xml.querySelector("parsererror")) {
            console.error("XML parse error voor", url);
            return [];
        }

        return Array.from(xml.querySelectorAll("item, entry")).slice(0, 7).map(item => {
            const title = item.querySelector("title")?.textContent.trim() || "Geen titel";
            const linkEl = item.querySelector("link");
            const link = linkEl ? (linkEl.getAttribute("href") || linkEl.textContent.trim()) : "#";
            let description = (item.querySelector("description, summary, content")?.textContent || "")
                              .replace(/<[^>]+>/g, "").trim();

            if (description.length > 280) description = description.substring(0, 277) + "...";

            return {
                title,
                link,
                description,
                pubDate: item.querySelector("pubDate, dc\\:date, updated, published")?.textContent.trim() || "",
                source: ""
            };
        });

    } catch (e) {
        console.error("RSS fout:", url, e);
        return [];
    }
}

function containsOmmen(text) {
    if (!text) return false;
    const lower = text.toLowerCase();
    return lower.includes("ommen") || lower.includes("ommon");
}

async function loadNews() {
    const container = document.getElementById("news-container");
    container.innerHTML = "<p>Laden van nieuws uit Ommen en omgeving...</p>";

    const promises = feeds.map(async feed => {
        const arts = await fetchRSS(feed.url);
        return arts.map(a => ({ ...a, source: feed.name }));
    });

    const results = await Promise.all(promises);
    let rawArticles = results.flat();

    console.log("Totaal opgehaald:", rawArticles.length);

    // Filter alleen artikelen met "Ommen"
    allArticles = rawArticles.filter(article => {
        const relevant = containsOmmen(article.title) || containsOmmen(article.description);
        if (!relevant) console.log("Gefilterd:", article.title.substring(0, 80));
        return relevant;
    });

    console.log("Artikelen na Ommen-filter:", allArticles.length);

    allArticles.sort((a, b) => new Date(b.pubDate || 0) - new Date(a.pubDate || 0));

    renderArticles(allArticles);
}

function renderArticles(articles) {
    const container = document.getElementById("news-container");

    if (articles.length === 0) {
        container.innerHTML = `<p>Geen artikelen met "Ommen" gevonden op dit moment.<br><small>Probeer te refreshen.</small></p>`;
        return;
    }

    container.innerHTML = articles.map(article => `
        <div class="article">
            <h2><a href="\( {article.link}" target="_blank" rel="noopener"> \){article.title}</a></h2>
            <small>${article.source} — ${article.pubDate ? new Date(article.pubDate).toLocaleDateString('nl-NL') : ""}</small>
            <p>${article.description}</p>
        </div>
    `).join('');
}

function searchNews(query) {
    if (!query) return renderArticles(allArticles);
    const q = query.toLowerCase();
    renderArticles(allArticles.filter(a => 
        a.title.toLowerCase().includes(q) || a.description.toLowerCase().includes(q)
    ));
}

function refreshNews() {
    loadNews();
}

window.addEventListener("DOMContentLoaded", loadNews);
